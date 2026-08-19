-- Fuso horário da oficina: agenda, dashboard e comprovantes usam esta região.
-- Execute no Supabase → SQL Editor

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

ALTER TABLE workshops
  DROP CONSTRAINT IF EXISTS workshops_timezone_not_blank;

ALTER TABLE workshops
  ADD CONSTRAINT workshops_timezone_not_blank
  CHECK (char_length(trim(timezone)) > 0);
