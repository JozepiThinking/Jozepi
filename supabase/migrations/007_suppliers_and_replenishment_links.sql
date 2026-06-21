-- Fornecedores e vínculos de reposição de estoque ao financeiro
-- Execute no Supabase -> SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID REFERENCES workshops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  category     TEXT NOT NULL DEFAULT 'Outros',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidade: tabela criada antes desta migration pode não ter workshop_id
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES workshops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Outros',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'workshop_id'
      AND is_nullable = 'YES'
  ) THEN
    UPDATE suppliers s
    SET workshop_id = sub.workshop_id
    FROM (
      SELECT workshop_id
      FROM profiles
      WHERE workshop_id IS NOT NULL
      ORDER BY created_at
      LIMIT 1
    ) sub
    WHERE s.workshop_id IS NULL
      AND sub.workshop_id IS NOT NULL;

    ALTER TABLE suppliers
      ALTER COLUMN workshop_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Não foi possível tornar suppliers.workshop_id NOT NULL automaticamente: %', SQLERRM;
END $$;

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'workshop_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_suppliers_workshop_name
      ON suppliers (workshop_id, name);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_transactions'
      AND column_name = 'workshop_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_financial_transactions_supplier
      ON financial_transactions (workshop_id, supplier_id, transaction_date DESC);

    CREATE INDEX IF NOT EXISTS idx_financial_transactions_source
      ON financial_transactions (workshop_id, source, transaction_date DESC);
  END IF;
END $$;

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
