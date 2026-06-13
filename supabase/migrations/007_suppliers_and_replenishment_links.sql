-- Fornecedores e vínculos de reposição de estoque ao financeiro
-- Execute no Supabase -> SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  category     TEXT NOT NULL DEFAULT 'Outros',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_workshop_name
  ON suppliers (workshop_id, name);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_supplier
  ON financial_transactions (workshop_id, supplier_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_source
  ON financial_transactions (workshop_id, source, transaction_date DESC);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'suppliers'
      AND policyname = 'suppliers_select_own_workshop'
  ) THEN
    CREATE POLICY suppliers_select_own_workshop
      ON suppliers
      FOR SELECT
      USING (
        workshop_id IN (
          SELECT profiles.workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'suppliers'
      AND policyname = 'suppliers_insert_own_workshop'
  ) THEN
    CREATE POLICY suppliers_insert_own_workshop
      ON suppliers
      FOR INSERT
      WITH CHECK (
        workshop_id IN (
          SELECT profiles.workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'suppliers'
      AND policyname = 'suppliers_update_own_workshop'
  ) THEN
    CREATE POLICY suppliers_update_own_workshop
      ON suppliers
      FOR UPDATE
      USING (
        workshop_id IN (
          SELECT profiles.workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      )
      WITH CHECK (
        workshop_id IN (
          SELECT profiles.workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'suppliers'
      AND policyname = 'suppliers_delete_own_workshop'
  ) THEN
    CREATE POLICY suppliers_delete_own_workshop
      ON suppliers
      FOR DELETE
      USING (
        workshop_id IN (
          SELECT profiles.workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;
END $$;
