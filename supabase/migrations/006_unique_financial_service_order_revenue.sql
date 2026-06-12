-- Evita receitas duplicadas para a mesma ordem de serviço concluída.
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_unique_service_order_revenue
  ON financial_transactions (service_order_id)
  WHERE type = 'receita' AND service_order_id IS NOT NULL;
