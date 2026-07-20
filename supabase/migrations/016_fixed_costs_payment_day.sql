-- Dia de pagamento mensal dos custos fixos
-- Execute no Supabase -> SQL Editor

ALTER TABLE fixed_costs
  ADD COLUMN IF NOT EXISTS payment_day INTEGER
    CHECK (payment_day IS NULL OR (payment_day >= 1 AND payment_day <= 31));
