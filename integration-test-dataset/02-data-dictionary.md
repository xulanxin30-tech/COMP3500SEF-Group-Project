# 02 · Data Dictionary

> 📐 Source: `database/schema.sql` v1.2 · API names: `docs/openapi.yaml` 0.3.0

## 🔢 Enums and limits

| Name | Values |
| :--- | :--- |
| `users.role` | `customer`, `courier`, `warehouse_admin`, `admin` |
| `shipments.status` / `tracking_events.status` | `pending`, `shipped`, `delivered` |
| Password hash | `pbkdf2_sha256$600000$<32-hex salt>$<64-hex digest>` |
| Generated tracking number | `HK<UTC YYYYMMDD><4-digit seq>` |
| Limits | 65536 B body · `2^63 − 1` max ID |

## 👤 `users`

| Field | Constraint | Dataset values |
| :--- | :--- | :--- |
| `user_id` | PK AUTOINCREMENT | 101–107, explicit |
| `username` | NOT NULL UNIQUE | `it_<role>_<name>` |
| `password_hash` | NOT NULL | real PBKDF2; seed placeholders cannot log in |
| `role` | default `customer` + CHECK | `customer` ×3, `warehouse_admin` ×2, `courier` ×2 |
| `phone` | NOT NULL | fictional `+852-90100xxx` |
| `created_at` | TIMESTAMP | default |

📌 API `User` exposes only `{id, username, role}` — never `phone` / `password_hash`.

## 🏢 `hubs`

| Field | Constraint | Dataset values |
| :--- | :--- | :--- |
| `hub_id` | PK AUTOINCREMENT | 101, 102, 103 |
| `hub_name` | NOT NULL | `IT Kowloon / Central / Shatin Test Hub` |
| `district` | NOT NULL | Kowloon, Hong Kong Island, New Territories |
| `address` | NOT NULL | fictional test addresses |

📌 A non-null `hub_id` on `POST /events` must exist here → else `404 hub not found`.

## 📦 `items`

| Field | Constraint | Dataset values |
| :--- | :--- | :--- |
| `item_id` | PK AUTOINCREMENT | 101–106 |
| `item_name` | NOT NULL | incl. non-ASCII `Café Éclat / Unicode Item` |
| `sku` | NOT NULL UNIQUE | `IT-WM-101` … `IT-UN-106` |
| `stock_quantity` | NOT NULL, CHECK ≥ 0 | 120, 45, 300, **1**, **0**, 10 |
| `unit_price` | NOT NULL, CHECK ≥ 0 | 150.00, 480.00, 65.00, 99.00, 10.00, 88.50 |

📌 Boundary SKUs: `IT-LS-104` (stock 1) and `IT-ZS-105` (stock 0) drive the 409 cases.

## 🚚 `shipments`

| Field | Constraint | Dataset values |
| :--- | :--- | :--- |
| `shipment_id` | PK AUTOINCREMENT | 101–105 |
| `tracking_number` | NOT NULL UNIQUE | `IT-2026-0001` … `0005` |
| `sender_id` | NOT NULL → `users.user_id` | 103 or 104 |
| `receiver_name` | NOT NULL | ASCII + non-ASCII (`José García / Unicode Receiver`) |
| `receiver_phone` | NOT NULL | `+852-9010100x` |
| `delivery_address` | NOT NULL | incl. `Flat B, 12/F, Élan Court, Mong Kok` |
| `status` | default `pending` + CHECK | `pending` ×3, `shipped`, `delivered` |
| `current_hub_id` | nullable → `hubs.hub_id` | `NULL`, 101, 103 |
| `created_at` / `updated_at` | TIMESTAMP, UTC `YYYY-MM-DD HH:mm:ss` | fixed test values |

📌 API adds `sender` (joined username) + an `items` array. Orders and waybills are
two views of this table. `POST /shipments` always inserts `pending` + `NULL` hub.

## 🧾 `shipment_items`

| Field | Constraint | Dataset values |
| :--- | :--- | :--- |
| `shipment_item_id` | PK AUTOINCREMENT | 101–106 |
| `shipment_id` | NOT NULL → `shipments` (CASCADE) | 101–105 |
| `item_id` | NOT NULL → `items` | 101–106 |
| `quantity` | NOT NULL, CHECK > 0 | 1, 2, 3 |
| `unit_price` | nullable, CHECK ≥ 0 | **price snapshot**; 145.00 is historical |
| — | `UNIQUE (shipment_id, item_id)` | all 6 pairs distinct |

📌 Trigger `trg_shipment_items_price` fills `unit_price` **only when NULL**. The
API inserts lines without a price, so trigger-filled rows are covered too.

## 🕒 `tracking_events`

| Field | Constraint | Dataset values |
| :--- | :--- | :--- |
| `event_id` | PK AUTOINCREMENT | 101–108 (tie-break for equal `event_time`) |
| `shipment_id` | NOT NULL → `shipments` (CASCADE) | 101–105 |
| `hub_id` | nullable → `hubs` | `NULL`, 101, 103 |
| `status` | NOT NULL + CHECK | `pending`, `shipped`, `delivered` |
| `description` | NOT NULL | English test text |
| `event_time` | TIMESTAMP UTC | fixed `2026-11-19 01:xx:xx` |

📌 Append-only. `POST /events` does **not** change `shipments.status`;
`PATCH /status` does, and writes an event with `hub_id = NULL`. No read API yet —
verify with SQL (TC-003).

## 📊 `v_shipment_order_summary`

| Column | Meaning |
| :--- | :--- |
| `shipment_id`, `tracking_number`, `status`, `receiver_name`, `created_at` | pass-through |
| `line_count`, `total_quantity` | `COUNT` / `SUM(quantity)` |
| `total_amount` | `SUM(quantity * unit_price)` |

🎯 Expected: `IT-2026-0002` = 2 lines / 4 units / **675.00** (480 + 3×65);
`IT-2026-0003` = 1 line / 1 unit / **145.00** (snapshot, not 150.00).

## 🔗 FK graph

```
users (1) ──< shipments.sender_id
hubs  (1) ──< shipments.current_hub_id        (nullable)
hubs  (1) ──< tracking_events.hub_id          (nullable)
shipments (1) ──< shipment_items.shipment_id  (CASCADE)
items     (1) ──< shipment_items.item_id
shipments (1) ──< tracking_events.shipment_id (CASCADE)
```

🧹 Delete order: `tracking_events` → `shipment_items` → `shipments` → `items` →
`hubs` → `users`. Required because the backend sets `PRAGMA foreign_keys = ON`.

## 🚫 Fields that do not exist

`driver_id`, `merchant_id`, `vehicle_id`, signature/photo, ETA, service type,
shipping fee, address book, registration fields, expanded stages. Never invent
dataset fields for them — see `01-specification.md` A-02 / R-01.
