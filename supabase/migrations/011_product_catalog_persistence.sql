-- ============================================================
-- Catálogo de produtos persistido no Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS product_types (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  custom      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workshop_id, value)
);

CREATE TABLE IF NOT EXISTS products (
  id                 TEXT PRIMARY KEY,
  workshop_id        UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,
  volume_ml          TEXT NOT NULL DEFAULT '',
  usage_per_wash_ml  TEXT NOT NULL DEFAULT '',
  quantity           TEXT NOT NULL DEFAULT '',
  durability_washes  TEXT NOT NULL DEFAULT '',
  total_cost         TEXT NOT NULL DEFAULT '',
  photo_url          TEXT,
  supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  stock_remaining    TEXT,
  price_history      JSONB NOT NULL DEFAULT '[]'::jsonb,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_product_usages (
  id          TEXT PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_stock_discounts (
  workshop_id        UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  service_order_id   TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workshop_id, service_order_id)
);

CREATE INDEX IF NOT EXISTS idx_products_workshop_type
  ON products (workshop_id, type, name);

CREATE INDEX IF NOT EXISTS idx_products_supplier
  ON products (workshop_id, supplier_id);

CREATE INDEX IF NOT EXISTS idx_service_product_usages_service
  ON service_product_usages (workshop_id, service_id);

CREATE INDEX IF NOT EXISTS idx_service_product_usages_product
  ON service_product_usages (workshop_id, product_id);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_product
  ON financial_transactions (workshop_id, product_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_transactions_product_id_fkey'
  ) THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT financial_transactions_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES products(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_product_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_stock_discounts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'product_types',
    'products',
    'service_product_usages',
    'product_stock_discounts'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || '_select_own_workshop'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (workshop_id IN (SELECT profiles.workshop_id FROM profiles WHERE profiles.id = auth.uid()))',
        table_name || '_select_own_workshop',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || '_insert_own_workshop'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (workshop_id IN (SELECT profiles.workshop_id FROM profiles WHERE profiles.id = auth.uid()))',
        table_name || '_insert_own_workshop',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || '_update_own_workshop'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (workshop_id IN (SELECT profiles.workshop_id FROM profiles WHERE profiles.id = auth.uid())) WITH CHECK (workshop_id IN (SELECT profiles.workshop_id FROM profiles WHERE profiles.id = auth.uid()))',
        table_name || '_update_own_workshop',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = table_name || '_delete_own_workshop'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (workshop_id IN (SELECT profiles.workshop_id FROM profiles WHERE profiles.id = auth.uid()))',
        table_name || '_delete_own_workshop',
        table_name
      );
    END IF;
  END LOOP;
END $$;
