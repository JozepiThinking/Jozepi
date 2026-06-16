-- ============================================================
-- Capacidade simultânea da agenda por oficina
-- ============================================================

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS agenda_capacity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE workshops
  DROP CONSTRAINT IF EXISTS workshops_agenda_capacity_positive;

ALTER TABLE workshops
  ADD CONSTRAINT workshops_agenda_capacity_positive
  CHECK (agenda_capacity > 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workshops'
      AND policyname = 'workshops_update_own_workshop'
  ) THEN
    CREATE POLICY workshops_update_own_workshop
      ON workshops
      FOR UPDATE
      TO authenticated
      USING (
        id IN (
          SELECT workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      )
      WITH CHECK (
        id IN (
          SELECT workshop_id
          FROM profiles
          WHERE profiles.id = auth.uid()
        )
      );
  END IF;
END $$;
