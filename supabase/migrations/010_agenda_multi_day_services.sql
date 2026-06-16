-- ============================================================
-- Serviços de múltiplos dias na agenda
-- ============================================================

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS scheduled_end_date DATE;
