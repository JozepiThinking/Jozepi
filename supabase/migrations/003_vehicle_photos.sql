-- Fotos dos veículos (máx. 2 por veículo)
-- Execute no Supabase → SQL Editor

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS photo_url_1 TEXT,
  ADD COLUMN IF NOT EXISTS photo_url_2 TEXT;

-- Bucket de storage para fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Políticas de storage
DROP POLICY IF EXISTS "Usuários autenticados enviam fotos" ON storage.objects;
DROP POLICY IF EXISTS "Fotos públicas para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados atualizam fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados removem fotos" ON storage.objects;

CREATE POLICY "Usuários autenticados enviam fotos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "Fotos públicas para leitura"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Usuários autenticados atualizam fotos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Usuários autenticados removem fotos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'vehicle-photos');
