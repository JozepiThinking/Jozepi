-- Campos adicionais de fornecedores (contato, e-mail, CNPJ, cidade/UF)
-- Execute no Supabase -> SQL Editor

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS city_state TEXT;
