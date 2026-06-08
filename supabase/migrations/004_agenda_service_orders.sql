-- Persistência da agenda usando ordens de serviço
-- Execute no Supabase → SQL Editor

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS scheduled_start TIME,
  ADD COLUMN IF NOT EXISTS scheduled_end TIME;

CREATE INDEX IF NOT EXISTS idx_service_orders_workshop_schedule
  ON service_orders (workshop_id, scheduled_date, scheduled_start);
