-- Add partial payment status to service order payments
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'parcial';
