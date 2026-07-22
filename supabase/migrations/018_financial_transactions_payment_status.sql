-- Payment status on financial transactions (expenses and manual entries)
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'pago';

CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment_status
  ON financial_transactions (workshop_id, type, payment_status, transaction_date DESC);
