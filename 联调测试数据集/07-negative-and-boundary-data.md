# 07 · Negative and Boundary Data

> 🐞 Companion to `06-api-cases.md` · 🧪 **Prepared · not executed**
> 📐 Expected messages copied from `backend/server.py` and `docs/openapi.yaml` 0.3.0

🎯 Positive-only data cannot detect a guard regression. Each row below fixes the
invalid input, the exact status code and the state that must stay unchanged.

## 📏 Boundaries

| ID | Boundary | Valid side | Invalid side | Data / expectation |
| :--- | :--- | :--- | :--- | :--- |
| BD-01 | stock 0 | — | `quantity 1` | `IT-ZS-105` → `409` (008) |
| BD-02 | stock 1 | `quantity 1` | `quantity 2` | `IT-LS-104` → `201` / `409` (007) |
| BD-03 | `quantity` min | `1` | `0`, `-1`, `"1"` | `400` |
| BD-04 | `quantity` max | `2^63−1` | `2^63` | `409` / `400` |
| BD-05 | `unit_price` min | `0.00` | `-0.01` | DB `IntegrityError` |
| BD-06 | line `quantity` | `1` | `0`, negative | DB `IntegrityError` |
| BD-07 | `UNIQUE (shipment_id, item_id)` | distinct | `(102,102)` again | `IntegrityError` (018) |
| BD-08 | `username` UNIQUE | distinct | duplicate | `IntegrityError` |
| BD-09 | `tracking_number` UNIQUE | `IT-2026-000x` | duplicate | `IntegrityError` |
| BD-10 | body size | 65536 B | 65537 B | `413` |
| BD-11 | text fields | non-empty trimmed | `""`, `"  "`, `null`, number | `400` |
| BD-12 | charset | ASCII + accented UTF-8 | invalid UTF-8 | `400 invalid JSON` |
| BD-13 | path `shipment_id` | `101` | `0`, `99999`, `abc`, >19 digits | `400` / `404` |
| BD-14 | `hub_id` | `101` / `null` | `999`, `0`, `-1`, `"1"` | `404` / `400` |
| BD-15 | price snapshot | 145.00 historical | 150.00 current | view returns 145.00 |

## 🚫 400 · Bad Request

| Input | Expected |
| :--- | :--- |
| `{"username":"demo"}` (missing key) | `expected fields: username, password` |
| login with extra `"remember": true` | same error |
| create-shipment with `quantity` omitted / extra key | `expected fields: sender_id, receiver_name, receiver_phone, delivery_address, sku, quantity` |
| `status: "in_transit"` on PATCH or events | `status must be pending, shipped, or delivered` |
| `receiver_name: ""` / `"  "` / `null` / `123` | `receiver_name must be a non-empty string` |
| `sender_id` / `quantity` / `hub_id` as `0`, `-1`, `"1"`, `2^63` | `... must be a positive 64-bit integer` |
| malformed JSON / empty body / `Transfer-Encoding` | `invalid JSON` / `JSON body is required` |
| `sku: ""` or whitespace | `sku must be a non-empty string` |

## 🔑 401 · Unauthorized

| Input | Expected |
| :--- | :--- |
| `wrong-password`, unknown user, or seeded `customer_alice` | `401 invalid credentials` |
| write without / with invalid / with post-restart token | `valid bearer token is required` + `WWW-Authenticate: Bearer` |

## 🔍 404 · Not Found

| Input | Expected |
| :--- | :--- |
| `sender_id: 99999` | `sender not found` |
| `sku: "IT-NOT-EXIST"` | `item not found` |
| `hub_id: 999` on events | `hub not found` |
| unknown shipment on PATCH / events | `shipment not found` |
| `GET /missing` | `not found` |

## ⚠️ 409 · Insufficient inventory

| Input | Invariant |
| :--- | :--- |
| `IT-LS-104` qty 2 (stock 1) | `409`; stock stays **1**; no partial rows |
| `IT-ZS-105` qty 1 (stock 0) | `409`; stock stays **0** |
| `IT-WM-101` qty 121 (stock 120) | `409`; stock stays **120**; atomic UPDATE rolls back |

## 📦 413 / 415 · Transport

| Input | Expected |
| :--- | :--- |
| `Content-Length` > 65536 | `JSON body is too large` |
| `Content-Type: text/plain` (or missing) | `Content-Type must be application/json` |

## 🧱 DB-level guards (SQL, always `ROLLBACK`)

| ID | Statement | Expected |
| :--- | :--- | :--- |
| DB-01 | `items` with `stock_quantity -1` | CHECK `stock_quantity >= 0` |
| DB-02 | `shipment_items` with `quantity 0` | CHECK `quantity > 0` |
| DB-03 | duplicate `(102, 102)` line | UNIQUE violation |
| DB-04 | `users.role = 'merchant'` | CHECK violation — no merchant role |
| DB-05 | `users.role = 'driver'` | CHECK violation — no driver role |
| DB-06 | `shipments.status = 'in_transit'` | CHECK violation |
| DB-07 | `shipments.sender_id = 99999` with FK on | FOREIGN KEY violation |
| DB-08 | `shipment_items.item_id = 999` | FOREIGN KEY violation |

🧾 DB-04/05 are the evidence behind the role mapping in `03-roles-and-accounts.md`.

## ✅ Re-check after every negative case

```sql
SELECT 'users', COUNT(*) FROM users WHERE user_id BETWEEN 101 AND 199
UNION ALL SELECT 'hubs', COUNT(*) FROM hubs WHERE hub_id BETWEEN 101 AND 199
UNION ALL SELECT 'items', COUNT(*) FROM items WHERE item_id BETWEEN 101 AND 199
UNION ALL SELECT 'shipments', COUNT(*) FROM shipments WHERE shipment_id BETWEEN 101 AND 199
UNION ALL SELECT 'shipment_items', COUNT(*) FROM shipment_items WHERE shipment_item_id BETWEEN 101 AND 199
UNION ALL SELECT 'tracking_events', COUNT(*) FROM tracking_events WHERE event_id BETWEEN 101 AND 199;
SELECT sku, stock_quantity FROM items WHERE item_id IN (101, 104, 105, 106) ORDER BY item_id;
PRAGMA integrity_check;      -- ok
PRAGMA foreign_key_check;    -- no rows
```

🎯 Counts must stay **7/3/6/5/6/8**; stock 120 (or 118 after 003), 1, 0, 10.
Any change is a real defect — log the value, commit SHA and a linked Issue.

## 🚦 Known non-errors

| Behaviour | Do not assert as failure |
| :--- | :--- |
| `delivered → pending` accepted | transition order not enforced (A-04) |
| a customer/driver creates a waybill | no role check in `_require_auth` (A-03) |
| `hub_id: null` on events | non-hub-local events are allowed |
| `current_hub_id` stays NULL after PATCH | status updates do not move hubs |
| `GET /api/shipments` without a token | list endpoint is public |

⚠️ Asserting any of these as an error produces a false failure against the
current build. Raise a change request first.
