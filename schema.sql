-- MPR JEWELLERY — PostgreSQL schema (idempotent)

CREATE TABLE IF NOT EXISTS owners (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT 'Owner',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin')),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  pincode     TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON customer_addresses(customer_id);

CREATE TABLE IF NOT EXISTS products (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  sku          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL CHECK (category IN ('gold','silver','diamond','rings','necklaces','earrings','bangles','bracelets','chains','other')),
  metal_type   TEXT NOT NULL CHECK (metal_type IN ('gold','silver','diamond','platinum','other')),
  purity       TEXT NOT NULL DEFAULT '',
  weight_grams NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (weight_grams >= 0),
  price        NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  availability TEXT NOT NULL DEFAULT 'in_stock' CHECK (availability IN ('in_stock','out_of_stock','made_to_order')),
  is_featured  BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_metal ON products(metal_type);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE TABLE IF NOT EXISTS product_images (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumb_path   TEXT,
  storage_id   TEXT NOT NULL,
  storage_driver TEXT NOT NULL DEFAULT 'local',
  mime         TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  size_bytes   INTEGER,
  alt          TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);

CREATE TABLE IF NOT EXISTS product_videos (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  poster_path  TEXT,
  storage_id   TEXT NOT NULL,
  storage_driver TEXT NOT NULL DEFAULT 'local',
  mime         TEXT NOT NULL,
  size_bytes   BIGINT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_videos_product ON product_videos(product_id, sort_order);

CREATE TABLE IF NOT EXISTS collections (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_visible   BOOLEAN NOT NULL DEFAULT true,
  show_on_home BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_media (
  id            SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  media_type    TEXT NOT NULL CHECK (media_type IN ('image','video')),
  storage_path  TEXT NOT NULL,
  thumb_path    TEXT,
  poster_path   TEXT,
  storage_id    TEXT NOT NULL,
  storage_driver TEXT NOT NULL DEFAULT 'local',
  mime          TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  size_bytes    BIGINT,
  alt           TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collection_media_collection ON collection_media(collection_id, sort_order);

CREATE TABLE IF NOT EXISTS order_counters (
  day TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  order_number    TEXT NOT NULL UNIQUE,
  access_token    TEXT NOT NULL,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT NOT NULL,
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'INR',
  subtotal        NUMERIC(12,2) NOT NULL,
  delivery_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_mode        TEXT NOT NULL DEFAULT 'none',
  total_amount    NUMERIC(12,2) NOT NULL,
  payment_method  TEXT NOT NULL DEFAULT 'upi',
  payment_status  TEXT NOT NULL DEFAULT 'awaiting_payment'
                  CHECK (payment_status IN ('awaiting_payment','pending_verification','paid','failed','cancelled')),
  order_status    TEXT NOT NULL DEFAULT 'placed'
                  CHECK (order_status IN ('placed','processing','ready','dispatched','delivered','cancelled')),
  stock_restored  BOOLEAN NOT NULL DEFAULT false,
  upi_id_snapshot TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  sku          TEXT NOT NULL,
  purity       TEXT NOT NULL DEFAULT '',
  weight_grams NUMERIC(10,3) NOT NULL DEFAULT 0,
  unit_price   NUMERIC(12,2) NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  line_total   NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- One payment record per order attempt (manual UPI today, gateway later)
CREATE TABLE IF NOT EXISTS payments (
  id                    SERIAL PRIMARY KEY,
  order_id              INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL,
  method                TEXT NOT NULL DEFAULT 'upi',
  provider              TEXT NOT NULL DEFAULT 'manual_upi',
  provider_reference    TEXT,
  customer_reference    TEXT,
  status                TEXT NOT NULL DEFAULT 'awaiting_payment'
                        CHECK (status IN ('awaiting_payment','pending_verification','paid','failed','cancelled')),
  customer_confirmed_at TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  verified_by           INTEGER REFERENCES owners(id) ON DELETE SET NULL,
  owner_note            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Immutable audit trail for payment + order status changes
CREATE TABLE IF NOT EXISTS payment_audit_log (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id  INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  event       TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('customer','owner','system','gateway')),
  actor_id    INTEGER,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_order ON payment_audit_log(order_id, created_at);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate history: the latest row per metal_key is the current rate
CREATE TABLE IF NOT EXISTS metal_rates (
  id          SERIAL PRIMARY KEY,
  metal_key   TEXT NOT NULL CHECK (metal_key IN ('gold_24k','gold_22k','gold_916','gold_18k','silver','diamond')),
  value       NUMERIC(12,2) NOT NULL CHECK (value >= 0),
  unit        TEXT NOT NULL,
  source      TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'owner' CHECK (source_type IN ('owner','api')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  INTEGER REFERENCES owners(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_metal_rates_key ON metal_rates(metal_key, recorded_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
