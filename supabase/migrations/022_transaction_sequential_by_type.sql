-- Sequências separadas por tipo (R- receitas, D- despesas), por oficina
-- Execute no Supabase → SQL Editor
--
-- Reordena TODOS os sequential_number existentes: cada tipo volta a 1, 2, 3…
-- por workshop, na ordem created_at ASC, id ASC.
-- O prefixo R-/D- é só de exibição (campo type já existe).

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS sequential_number INTEGER;

DROP INDEX IF EXISTS idx_financial_transactions_workshop_sequential_number;

CREATE TABLE IF NOT EXISTS workshop_transaction_type_counters (
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  type         transaction_type NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  PRIMARY KEY (workshop_id, type)
);

ALTER TABLE workshop_transaction_type_counters ENABLE ROW LEVEL SECURITY;

-- Reordena dentro de cada (oficina, tipo): mais antigo = menor número
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workshop_id, type
      ORDER BY created_at ASC, id ASC
    )::integer AS n
  FROM financial_transactions
)
UPDATE financial_transactions AS tx
SET sequential_number = numbered.n
FROM numbered
WHERE tx.id = numbered.id;

INSERT INTO workshop_transaction_type_counters (workshop_id, type, last_number)
SELECT workshop_id, type, MAX(sequential_number)
FROM financial_transactions
WHERE sequential_number IS NOT NULL
GROUP BY workshop_id, type
ON CONFLICT (workshop_id, type) DO UPDATE
SET last_number = GREATEST(
  workshop_transaction_type_counters.last_number,
  EXCLUDED.last_number
);

ALTER TABLE financial_transactions
  ALTER COLUMN sequential_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_workshop_type_sequential_number
  ON financial_transactions (workshop_id, type, sequential_number);

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

  INSERT INTO workshop_transaction_type_counters (workshop_id, type, last_number)
  VALUES (NEW.workshop_id, NEW.type, 1)
  ON CONFLICT (workshop_id, type)
  DO UPDATE SET last_number = workshop_transaction_type_counters.last_number + 1
  RETURNING workshop_transaction_type_counters.last_number
  INTO NEW.sequential_number;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_transactions_sequential_number ON financial_transactions;

CREATE TRIGGER trg_financial_transactions_sequential_number
BEFORE INSERT ON financial_transactions
FOR EACH ROW
EXECUTE PROCEDURE public.assign_financial_transaction_sequential_number();

DROP TABLE IF EXISTS workshop_transaction_counters;

REVOKE ALL ON FUNCTION public.assign_financial_transaction_sequential_number() FROM PUBLIC;
REVOKE ALL ON workshop_transaction_type_counters FROM PUBLIC, anon, authenticated;
