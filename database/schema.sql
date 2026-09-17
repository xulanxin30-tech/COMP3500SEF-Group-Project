-- Logistics Management System · Database schema template
-- Owner: CEN Yin Chi
-- Compatible with MySQL / PostgreSQL / SQLite; run this file in your database client to create the tables.
-- Note: after the 09-23 design freeze, tables can only be cut, not changed. Confirm with the team lead before altering.

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY,              -- customer id
  name       TEXT NOT NULL,                    -- name
  phone      TEXT,                             -- phone
  address    TEXT                              -- address
);

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY,            -- order id
  customer_id  INTEGER REFERENCES customers(id),
  status       TEXT NOT NULL DEFAULT 'pending',-- pending / shipped / delivered
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id         INTEGER PRIMARY KEY,              -- inventory id
  product    TEXT NOT NULL,                    -- product
  quantity   INTEGER NOT NULL DEFAULT 0        -- quantity
);

CREATE TABLE IF NOT EXISTS transport (
  id         INTEGER PRIMARY KEY,              -- transport id
  order_id   INTEGER REFERENCES orders(id),
  waybill_no TEXT,                             -- waybill number
  status     TEXT DEFAULT 'dispatched'         -- dispatch status
);

-- Sample seed data
INSERT INTO customers (name, phone, address) VALUES ('Alice', '12345678', 'Kowloon');
INSERT INTO inventory (product, quantity) VALUES ('Widget A', 100);
