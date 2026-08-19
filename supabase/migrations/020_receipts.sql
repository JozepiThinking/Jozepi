-- Comprovantes sequenciais por oficina
-- Execute no Supabase → SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS workshop_receipt_counters (
  workshop_id  UUID PRIMARY KEY REFERENCES workshops(id) ON DELETE CASCADE,
  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0)
);

CREATE TABLE IF NOT EXISTS receipts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id         UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  sequential_number   INTEGER NOT NULL CHECK (sequential_number > 0),
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_label        TEXT NOT NULL,
  period_label        TEXT NOT NULL,
  items               JSONB NOT NULL DEFAULT '[]'::jsonb,
  total               NUMERIC(12, 2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_workshop_sequential_number
  ON receipts (workshop_id, sequential_number);

CREATE INDEX IF NOT EXISTS idx_receipts_workshop_issued_at
  ON receipts (workshop_id, issued_at DESC);

ALTER TABLE workshop_receipt_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_select_own_workshop ON receipts;
CREATE POLICY receipts_select_own_workshop
  ON receipts
  FOR SELECT
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Counters are only mutated by issue_receipt() (SECURITY DEFINER).
-- No INSERT/UPDATE/DELETE policies for authenticated on either table:
-- issued receipts stay immutable from the client, and numbering stays atomic.

CREATE OR REPLACE FUNCTION public.issue_receipt(
  p_workshop_id uuid,
  p_client_id uuid,
  p_client_label text,
  p_period_label text,
  p_items jsonb,
  p_total numeric
)
RETURNS TABLE (
  id uuid,
  sequential_number integer,
  issued_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  new_id uuid;
  new_issued_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.workshop_id = p_workshop_id
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM clients
    WHERE clients.id = p_client_id
      AND clients.workshop_id = p_workshop_id
  ) THEN
    RAISE EXCEPTION 'invalid client';
  END IF;

  INSERT INTO workshop_receipt_counters (workshop_id, last_number)
  VALUES (p_workshop_id, 1)
  ON CONFLICT (workshop_id)
  DO UPDATE SET last_number = workshop_receipt_counters.last_number + 1
  RETURNING workshop_receipt_counters.last_number INTO next_number;

  INSERT INTO receipts (
    workshop_id,
    sequential_number,
    client_id,
    client_label,
    period_label,
    items,
    total
  )
  VALUES (
    p_workshop_id,
    next_number,
    p_client_id,
    p_client_label,
    p_period_label,
    COALESCE(p_items, '[]'::jsonb),
    p_total
  )
  RETURNING receipts.id, receipts.sequential_number, receipts.issued_at
  INTO new_id, next_number, new_issued_at;

  id := new_id;
  sequential_number := next_number;
  issued_at := new_issued_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_receipt(uuid, uuid, text, text, jsonb, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_receipt(uuid, uuid, text, text, jsonb, numeric) TO authenticated;

GRANT SELECT ON receipts TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON workshop_receipt_counters FROM PUBLIC, anon, authenticated;
