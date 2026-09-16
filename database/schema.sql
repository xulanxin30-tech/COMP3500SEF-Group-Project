-- Logistics Management System - example database schema.
-- Responsibilities and provisional dates: docs/PROJECT.md.
-- Checked with SQLite; other database engines have not been verified.
-- Review schema changes with affected module owners; see CONTRIBUTING.md.
-- The sample inserts add new rows each time this script is run.

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY,              -- 客户ID / customer id
  name       TEXT NOT NULL,                    -- 姓名 / name
  phone      TEXT,                             -- 电话 / phone
  address    TEXT                              -- 地址 / address
);

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY,            -- 订单ID / order id
  customer_id  INTEGER REFERENCES customers(id),
  status       TEXT NOT NULL DEFAULT 'pending',-- pending / shipped / delivered
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id         INTEGER PRIMARY KEY,              -- 库存ID / inventory id
  product    TEXT NOT NULL,                    -- 商品 / product
  quantity   INTEGER NOT NULL DEFAULT 0        -- 数量 / quantity
);

CREATE TABLE IF NOT EXISTS transport (
  id         INTEGER PRIMARY KEY,              -- 运单ID / transport id
  order_id   INTEGER REFERENCES orders(id),
  waybill_no TEXT,                             -- 运单号 / waybill no.
  status     TEXT DEFAULT 'dispatched'         -- 配送状态 / dispatch status
);

-- 示例种子数据 / Sample seed data
INSERT INTO customers (name, phone, address) VALUES ('Alice', '12345678', 'Kowloon');
INSERT INTO inventory (product, quantity) VALUES ('Widget A', 100);
