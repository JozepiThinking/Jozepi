-- ============================================================
-- Categoria de serviços + políticas RLS da tabela services
-- ============================================================

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Outros';

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOREACH policy_name IN ARRAY ARRAY[
    'services_select_own_workshop',
    'services_insert_own_workshop',
    'services_update_own_workshop',
    'services_delete_own_workshop'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'services'
        AND policyname = policy_name
    ) THEN
      EXECUTE format('DROP POLICY %I ON services', policy_name);
    END IF;
  END LOOP;
END $$;

CREATE POLICY services_select_own_workshop
  ON services
  FOR SELECT
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY services_insert_own_workshop
  ON services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY services_update_own_workshop
  ON services
  FOR UPDATE
  TO authenticated
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

CREATE POLICY services_delete_own_workshop
  ON services
  FOR DELETE
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );
