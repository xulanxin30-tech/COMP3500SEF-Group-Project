-- Logistics Management System schema v1.1 (SQLite).
-- Responsibilities: docs/PROJECT.md. Review changes with affected module owners.

DROP TABLE IF EXISTS tracking_events;
DROP TABLE IF EXISTS shipment_items;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS hubs;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'courier', 'warehouse_admin', 'admin')),
    phone TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hubs (
    hub_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_name TEXT NOT NULL,
    district TEXT NOT NULL,
    address TEXT NOT NULL
);

CREATE TABLE items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    sku TEXT UNIQUE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0.00
);

CREATE TABLE shipments (
    shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number TEXT NOT NULL UNIQUE,
    sender_id INTEGER NOT NULL,
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'shipped', 'delivered')),
    current_hub_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id),
    FOREIGN KEY (current_hub_id) REFERENCES hubs(hub_id)
);

CREATE TABLE shipment_items (
    shipment_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

CREATE TABLE tracking_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    hub_id INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'shipped', 'delivered')),
    description TEXT NOT NULL,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (hub_id) REFERENCES hubs(hub_id)
);

CREATE INDEX idx_tracking_events_lookup ON tracking_events(shipment_id, event_time DESC);

INSERT INTO users (username, password_hash, role, phone) VALUES
('admin_alan', 'hash_pwd_001', 'admin', '+852-91234567'),
('customer_alice', 'hash_pwd_002', 'customer', '+852-94567890'),
('courier_chan', 'hash_pwd_003', 'courier', '+852-92345678');

INSERT INTO hubs (hub_name, district, address) VALUES
('Kowloon Sorting Center', 'Kowloon', 'No. 88 Kwun Tong Road, Kwun Tong'),
('Central Distribution Hub', 'Hong Kong Island', 'No. 12 Connaught Road Central, Central'),
('Shatin Express Facility', 'New Territories', 'No. 6 Shatin Rural Committee Road, Shatin');

INSERT INTO items (item_name, sku, stock_quantity, unit_price) VALUES
('Wireless Optical Mouse', 'TECH-WM-001', 120, 150.00),
('Mechanical Gaming Keyboard', 'TECH-KB-002', 45, 480.00),
('USB-C Fast Charging Cable', 'TECH-CB-003', 300, 65.00);

INSERT INTO shipments (tracking_number, sender_id, receiver_name, receiver_phone, delivery_address, status, current_hub_id) VALUES
('HK202610001', 2, 'David Cheung', '+852-98765432', 'Flat B, 12/F, Nathan Tower, Mong Kok, Kowloon', 'shipped', 1);

INSERT INTO shipment_items (shipment_id, item_id, quantity) VALUES
(1, 2, 1),
(1, 3, 2);

INSERT INTO tracking_events (shipment_id, hub_id, status, description) VALUES
(1, NULL, 'pending', 'Shipping order created by sender.'),
(1, 1, 'shipped', 'Parcel picked up and arrived at Kowloon Sorting Center.');
