-- =======================================================
-- LOGISTICS MANAGEMENT SYSTEM - SCHEMA (v1.1 Compatible)
-- =======================================================

DROP TABLE IF EXISTS tracking_events;
DROP TABLE IF EXISTS shipment_items;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS hubs;
DROP TABLE IF EXISTS users;

-- 1. Users Table
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Hubs Table
CREATE TABLE hubs (
    hub_id INTEGER PRIMARY KEY AUTOINCREMENT,
    hub_name VARCHAR(100) NOT NULL,
    district VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL
);

-- 3. Items & Inventory Table
CREATE TABLE items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name VARCHAR(100) NOT NULL,
    sku VARCHAR(50) UNIQUE,
    stock_quantity INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);

-- 4. Shipments Table
CREATE TABLE shipments (
    shipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_number VARCHAR(32) NOT NULL UNIQUE,
    sender_id INT NOT NULL,
    receiver_name VARCHAR(50) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    delivery_address VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    current_hub_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id),
    FOREIGN KEY (current_hub_id) REFERENCES hubs(hub_id)
);

-- 5. Shipment Items Table
CREATE TABLE shipment_items (
    shipment_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

-- 6. Tracking Events Table
CREATE TABLE tracking_events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INT NOT NULL,
    hub_id INT,
    status VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (hub_id) REFERENCES hubs(hub_id)
);

CREATE INDEX idx_tracking_events_lookup ON tracking_events(shipment_id, event_time DESC);

-- =======================================================
-- SEED DATA
-- =======================================================
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
