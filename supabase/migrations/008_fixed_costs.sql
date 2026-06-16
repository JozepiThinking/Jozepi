-- Custos fixos reais e estimados
-- Execute no Supabase -> SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS fixed_costs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'real' CHECK (kind IN ('real', 'estimated')),
  amount       NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_workshop_active
  ON fixed_costs (workshop_id, active);

CREATE INDEX IF NOT EXISTS idx_fixed_costs_workshop_kind
  ON fixed_costs (workshop_id, kind);

ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fixed_costs'
      AND policyname = 'fixed_costs_select_own_workshop'
  ) THEN
    CREATE POLICY fixed_costs_select_own_workshop
      ON fixed_costs
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
      AND tablename = 'fixed_costs'
      AND policyname = 'fixed_costs_insert_own_workshop'
  ) THEN
    CREATE POLICY fixed_costs_insert_own_workshop
      ON fixed_costs
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
      AND tablename = 'fixed_costs'
      AND policyname = 'fixed_costs_update_own_workshop'
  ) THEN
    CREATE POLICY fixed_costs_update_own_workshop
      ON fixed_costs
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
      AND tablename = 'fixed_costs'
      AND policyname = 'fixed_costs_delete_own_workshop'
  ) THEN
    CREATE POLICY fixed_costs_delete_own_workshop
      ON fixed_costs
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
