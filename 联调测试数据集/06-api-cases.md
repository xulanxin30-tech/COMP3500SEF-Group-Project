# 06 · API Integration Cases

> 🧪 **Prepared · not executed** · base `http://localhost:8000`
> 🔑 Token from `login` at runtime (never stored) · writes need `Authorization: Bearer <token>` + `Content-Type: application/json`
> ▶️ Order: `001 → 002 → 009 → 006 → 003 → 004 → 005 → 015 → 016 → 017 → 018`, then `007 / 008 / 010 / 011 / 012 / 013 / 014`
> 📝 Record Actual Result + Status per case with the template in `09-preparation-checklist.md`

**Legend:** P0 core · P1 supporting · P2 informational.

---

## 👤 A · Customer / end buyer

### IT-TC-001 🔑 Sign in · P1

| Account | Password | `user.id` | `user.role` |
| :--- | :--- | :---: | :--- |
| `it_customer_amy` | `It@2026Test` | 101 | `customer` |
| `it_merchant_ken` | `It@2026Test` | 103 | `warehouse_admin` |
| `it_driver_dan` | `It@2026Test` | 105 | `courier` |
| `demo` | `demo123` | startup-assigned | `admin` |

```http
POST /api/auth/login
{"username": "it_customer_amy", "password": "It@2026Test"}
```

✅ `200` with `token`, `token_type: "Bearer"`, `user = {id, username, role}` (no
`phone` / `password_hash`). 🐞 `wrong-password` → `401 invalid credentials`.

### IT-TC-002 🔑 Profile · P1

`GET /api/auth/profile` + token → `200 {id, username, role}`. No token → `401` +
`WWW-Authenticate: Bearer`.

### IT-TC-006 📋 Order list · P0

`GET /api/shipments` → `200` array by `shipment_id`, containing `IT-2026-0001…0005`;
`sender` = `it_merchant_ken` (101/102/104) or `it_merchant_lily` (103/105); each
row has `items`, UTC timestamps and a valid status. Orders and waybills show the
same rows.

### IT-TC-015 🌐 Non-ASCII round trip · P1

`GET /api/shipments` → `IT-2026-0004` keeps `José García / Unicode Receiver` and
`Flat B, 12/F, Élan Court, Mong Kok` intact (`ensure_ascii=False`). Then create
an order with accented receiver fields and `sku: "IT-UN-106"`, `quantity: 1` →
`201`; list returns text unchanged; stock 10 → 9. 🧹 reload 04.

### IT-TC-017 🔄 Persistence across restart · P0

Stop backend → restart on the **same** `LMS_DB_PATH`. ✅ All five `IT-2026-*`
orders and their lines/events remain; old token → `401`; fresh login works;
`demo` is not duplicated. Matches TASK-python-sqlite-integration.

---

## 🏪 B · Merchant / shipper

### IT-TC-009 📦 Catalogue baseline · P1

`GET /api/items` → `200`; six `IT-*` SKUs with stocks 120/45/300/1/0/10 and
prices 150.00/480.00/65.00/99.00/10.00/88.50; `TECH-*` seed rows untouched.

### IT-TC-003 🧾 Create waybill + atomic deduction · P0

```http
POST /api/shipments
{
  "sender_id": 103,
  "receiver_name": "IT Receiver Create",
  "receiver_phone": "+852-90101999",
  "delivery_address": "Flat D, Integration Test Court, Wan Chai",
  "sku": "IT-WM-101",
  "quantity": 2
}
```

✅ `201` with `status: "pending"`, `sender: "it_merchant_ken"`, one line
`{item_id:101, sku:"IT-WM-101", quantity:2}`, generated `HK<date><seq>` number.
DB checks: stock 120 → **118**; one trigger-filled line (`unit_price 150.00`);
one `pending` event with `hub_id NULL`; shipment count +1; no double deduction on
reload. Aligns with TC-002. 🧹 reload 04.

### IT-TC-007 / 008 🚫 Stock guards · P0 / P1

| Case | SKU | Stock | Qty | Expected |
| :--- | :--- | :---: | :---: | :--- |
| 007 | `IT-LS-104` | 1 | 2 | `409 insufficient inventory`; stock stays 1 |
| 008 | `IT-ZS-105` | 0 | 1 | `409`; stock stays 0 |

✅ No partial rows, shipment count unchanged. Aligns with TC-004.

### IT-TC-016 💰 Snapshot + summary view · P1

```sql
SELECT tracking_number, line_count, total_quantity, total_amount
FROM v_shipment_order_summary WHERE shipment_id IN (102, 103) ORDER BY shipment_id;
```

| tracking_number | lines | units | amount |
| :--- | :---: | :---: | :---: |
| `IT-2026-0002` | 2 | 4 | **675.00** |
| `IT-2026-0003` | 1 | 1 | **145.00** (historical, not 150.00) |

### IT-TC-018 🧱 Duplicate line guard · P2

Scratch SQL `INSERT INTO shipment_items (shipment_id, item_id, quantity)
VALUES (102, 102, 1);` → `IntegrityError: UNIQUE constraint failed`. 🧹 `ROLLBACK`.

---

## 🚚 C · Driver / courier

### IT-TC-004 🔄 Status flow · P0

```http
PATCH /api/shipments/101/status
{"status": "shipped"}      → then {"status": "delivered"}
```

✅ Each `200` updates `status` + `updated_at` and appends exactly one event with
`hub_id NULL`; stock is **not** deducted again. Aligns with TC-003. 🧹 reload 04.

> ⚠️ Only the enum is validated; transition order is **not** enforced. Do not
> assert that `delivered → pending` is rejected (A-04).

### IT-TC-005 📍 Hub event · P1

```http
POST /api/shipments/101/events
{"hub_id": 101, "status": "shipped", "description": "Driver check-in at IT Kowloon Test Hub."}
```

✅ `200` with `{id, shipment_id, hub_id, status, description, event_time}`;
append-only — `shipments.status` unchanged. `hub_id: null` is also valid.

### IT-TC-010 / 011 🐞 Invalid status / hub · P1

| Case | Input | Expected |
| :--- | :--- | :--- |
| 010 | `status: "in_transit"` | `400 status must be pending, shipped, or delivered` |
| 011 | `hub_id: 999` | `404 hub not found` |

Related 404s: `sender_id: 99999` → `sender not found`; unknown `sku` →
`item not found`; `PATCH /api/shipments/99999/status` → `shipment not found`.

---

## 🧩 D · Cross-cutting controls

| Case | Probe | Expected |
| :--- | :--- | :--- |
| 012 · P0 | Writes without / with invalid token | `401 valid bearer token is required`; public GETs still `200` |
| 013 · P1 | Missing key, extra key, empty text, bad ID types | `400` with exact `expected fields:` / validation message |
| 014 · P2 | `text/plain`, > 65536 B, malformed JSON, `Transfer-Encoding` | `415` / `413` / `400` |

---

## 🔗 Map

| Group | Data | Detail |
| :--- | :--- | :--- |
| 👤 Customer | `users` 101/102/107; shipments 101/102/104 | `03-roles-and-accounts.md` |
| 🏪 Merchant | `users` 103/104; items; shipment_items | `02-data-dictionary.md` |
| 🚚 Driver | `users` 105/106; hubs; events | `02-data-dictionary.md` |
| 🧩 Negative | full input list | `07-negative-and-boundary-data.md` |

Full trace: `08-traceability-matrix.md`.
