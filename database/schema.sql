

-- Drop existing tables in reverse dependency order to prevent FK errors
DROP TABLE IF EXISTS tracking_events;
DROP TABLE IF EXISTS shipment_items;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS hubs;
DROP TABLE IF EXISTS users;

-- 1. Users Table (System actors: customers, couriers, admins)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'courier', 'warehouse_admin', 'admin') NOT NULL DEFAULT 'customer',
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Hubs Table (Hong Kong sorting facilities and transit stations)
CREATE TABLE hubs (
    hub_id INT AUTO_INCREMENT PRIMARY KEY,
    hub_name VARCHAR(100) NOT NULL,
    district VARCHAR(50) NOT NULL,
    address VARCHAR(255) NOT NULL
);

-- 3. Items & Inventory Table (Managed by item_id to avoid name collision)
CREATE TABLE items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    sku VARCHAR(50) UNIQUE,
    stock_quantity INT NOT NULL DEFAULT 0,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);

-- 4. Shipments Table (Waybill master table with unique tracking number)
CREATE TABLE shipments (
    shipment_id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_number VARCHAR(32) NOT NULL UNIQUE,
    sender_id INT NOT NULL,
    receiver_name VARCHAR(50) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    delivery_address VARCHAR(255) NOT NULL,
    status ENUM('pending', 'shipped', 'delivered') NOT NULL DEFAULT 'pending',
    current_hub_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id),
    FOREIGN KEY (current_hub_id) REFERENCES hubs(hub_id)
);

-- 5. Shipment Items Table (Line items per shipment: resolves product & quantity)
CREATE TABLE shipment_items (
    shipment_item_id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

-- 6. Tracking Events Table (Append-only audit log for parcel timeline)
CREATE TABLE tracking_events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    hub_id INT,
    status ENUM('pending', 'shipped', 'delivered') NOT NULL,
    description VARCHAR(255) NOT NULL,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    FOREIGN KEY (hub_id) REFERENCES hubs(hub_id)
);

-- Indexing for tracking timeline retrieval optimization
CREATE INDEX idx_tracking_events_lookup ON tracking_events(shipment_id, event_time DESC);

-- =======================================================
-- SEED DATA: Mock Data for Hong Kong Delivery
-- =======================================================

-- Mock Users
INSERT INTO users (username, password_hash, role, phone) VALUES
('admin_alan', 'hash_pwd_001', 'admin', '+852-91234567'),
('customer_alice', 'hash_pwd_002', 'customer', '+852-94567890'),
('courier_chan', 'hash_pwd_003', 'courier', '+852-92345678');

-- Hong Kong Local Distribution Hubs
INSERT INTO hubs (hub_name, district, address) VALUES
('Kowloon Sorting Center', 'Kowloon', 'No. 88 Kwun Tong Road, Kwun Tong'),
('Central Distribution Hub', 'Hong Kong Island', 'No. 12 Connaught Road Central, Central'),
('Shatin Express Facility', 'New Territories', 'No. 6 Shatin Rural Committee Road, Shatin');

-- Inventory Catalog
INSERT INTO items (item_name, sku, stock_quantity, unit_price) VALUES
('Wireless Optical Mouse', 'TECH-WM-001', 120, 150.00),
('Mechanical Gaming Keyboard', 'TECH-KB-002', 45, 480.00),
('USB-C Fast Charging Cable', 'TECH-CB-003', 300, 65.00);

-- Sample Shipment (Waybill)
INSERT INTO shipments (tracking_number, sender_id, receiver_name, receiver_phone, delivery_address, status, current_hub_id) VALUES
('HK202610001', 2, 'David Cheung', '+852-98765432', 'Flat B, 12/F, Nathan Tower, Mong Kok, Kowloon', 'shipped', 1);

-- Shipment Line Items (David ordered 1 Keyboard and 2 Cables)
INSERT INTO shipment_items (shipment_id, item_id, quantity) VALUES
(1, 2, 1),
(1, 3, 2);

-- Tracking Timeline Events
INSERT INTO tracking_events (shipment_id, hub_id, status, description) VALUES
(1, NULL, 'pending', 'Shipping order created by sender.'),
(1, 1, 'shipped', 'Parcel picked up and arrived at Kowloon Sorting Center.');
