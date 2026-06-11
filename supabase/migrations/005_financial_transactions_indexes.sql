-- Financeiro: lançamentos manuais e índices de consulta
-- Execute no Supabase → SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  CREATE TYPE transaction_type AS ENUM ('receita', 'despesa');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS financial_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id       UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  type              transaction_type NOT NULL,
  description       TEXT NOT NULL,
  amount            NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  category          TEXT,
  service_order_id  UUID REFERENCES service_orders(id) ON DELETE SET NULL,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_workshop_date
  ON financial_transactions (workshop_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_workshop_type_date
  ON financial_transactions (workshop_id, type, transaction_date DESC);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_transactions'
      AND policyname = 'financial_transactions_select_own_workshop'
  ) THEN
    CREATE POLICY financial_transactions_select_own_workshop
      ON financial_transactions
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
      AND tablename = 'financial_transactions'
      AND policyname = 'financial_transactions_insert_own_workshop'
  ) THEN
    CREATE POLICY financial_transactions_insert_own_workshop
      ON financial_transactions
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
      AND tablename = 'financial_transactions'
      AND policyname = 'financial_transactions_update_own_workshop'
  ) THEN
    CREATE POLICY financial_transactions_update_own_workshop
      ON financial_transactions
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
      AND tablename = 'financial_transactions'
      AND policyname = 'financial_transactions_delete_own_workshop'
  ) THEN
    CREATE POLICY financial_transactions_delete_own_workshop
      ON financial_transactions
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
