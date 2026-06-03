-- ============================================================
-- AutoEstética SaaS — Schema inicial
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE service_order_status AS ENUM (
  'aberta', 'em_andamento', 'finalizada', 'cancelada'
);

CREATE TYPE transaction_type AS ENUM ('receita', 'despesa');

CREATE TYPE payment_status AS ENUM ('pendente', 'pago', 'cancelado');

CREATE TABLE workshops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  email       TEXT,
  phone       TEXT,
  document    TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'owner',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT,
  phone        TEXT NOT NULL,
  document     TEXT,
  address      TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vehicles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand        TEXT NOT NULL,
  model        TEXT NOT NULL,
  year         INTEGER,
  color        TEXT,
  plate        TEXT NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id       UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  price             NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_minutes  INTEGER DEFAULT 60 CHECK (duration_minutes > 0),
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE service_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id     UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  order_number    SERIAL,
  status          service_order_status NOT NULL DEFAULT 'aberta',
  notes           TEXT,
  total_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  payment_status  payment_status NOT NULL DEFAULT 'pendente',
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE service_order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id  UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  service_id        UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price        NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal          NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workshop_id       UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  type              transaction_type NOT NULL,
  description       TEXT NOT NULL,
  amount            NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  category          TEXT,
  service_order_id  UUID REFERENCES service_orders(id) ON DELETE SET NULL,
  transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers, views, RLS e handle_new_user — ver versão completa no repositório
