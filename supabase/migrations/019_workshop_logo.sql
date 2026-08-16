-- Logo da empresa: nova coluna em workshops + bucket de storage dedicado (2MB)
-- Execute no Supabase → SQL Editor

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Bucket de storage para o logo da empresa
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];

-- Políticas de storage
DROP POLICY IF EXISTS "Usuários autenticados enviam logos" ON storage.objects;
DROP POLICY IF EXISTS "Logos públicos para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados atualizam logos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados removem logos" ON storage.objects;

CREATE POLICY "Usuários autenticados enviam logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Logos públicos para leitura"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY "Usuários autenticados atualizam logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos');

CREATE POLICY "Usuários autenticados removem logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');
