-- Numeração sequencial de lançamentos por oficina
-- Execute no Supabase → SQL Editor
--
-- Backfill: registros existentes recebem números em ordem de criação
-- (created_at ASC, id ASC), sempre particionado por workshop_id.
-- Novos inserts passam pelo trigger atômico (sem MAX+1 no client).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workshop_transaction_counters (
  workshop_id  UUID PRIMARY KEY REFERENCES workshops(id) ON DELETE CASCADE,
  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

ALTER TABLE workshop_transaction_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS sequential_number INTEGER;

-- Retroativo: mais antigo = menor número, por oficina
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workshop_id
      ORDER BY created_at ASC, id ASC
    )::integer AS n
  FROM financial_transactions
  WHERE sequential_number IS NULL
)
UPDATE financial_transactions AS tx
SET sequential_number = numbered.n
FROM numbered
WHERE tx.id = numbered.id;

-- Contador começa no maior número já atribuído em cada oficina
INSERT INTO workshop_transaction_counters (workshop_id, last_number)
SELECT workshop_id, MAX(sequential_number)
FROM financial_transactions
WHERE sequential_number IS NOT NULL
GROUP BY workshop_id
ON CONFLICT (workshop_id) DO UPDATE
SET last_number = GREATEST(
  workshop_transaction_counters.last_number,
  EXCLUDED.last_number
);

ALTER TABLE financial_transactions
  ALTER COLUMN sequential_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_workshop_sequential_number
  ON financial_transactions (workshop_id, sequential_number);

CREATE OR REPLACE FUNCTION public.assign_financial_transaction_sequential_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sequential_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO workshop_transaction_counters (workshop_id, last_number)
  VALUES (NEW.workshop_id, 1)
  ON CONFLICT (workshop_id)
  DO UPDATE SET last_number = workshop_transaction_counters.last_number + 1
  RETURNING workshop_transaction_counters.last_number
  INTO NEW.sequential_number;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_transactions_sequential_number ON financial_transactions;

CREATE TRIGGER trg_financial_transactions_sequential_number
BEFORE INSERT ON financial_transactions
FOR EACH ROW
EXECUTE PROCEDURE public.assign_financial_transaction_sequential_number();

REVOKE ALL ON FUNCTION public.assign_financial_transaction_sequential_number() FROM PUBLIC;
REVOKE ALL ON workshop_transaction_counters FROM PUBLIC, anon, authenticated;
