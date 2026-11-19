# 01 · Specification

> 🎯 Prepared · **not executed** · **not approved** · v1.0.0 · 2026-11-19 (GMT+8)

## 🎯 Objective

One reproducible baseline + three roles + traceable cases for integration testing
of frontend ↔ backend ↔ SQLite v1.2. This is preparation material, not a result.

## ✅ In scope

`login`, `profile`, `health`, `items`, `shipments` (GET/POST), `status`, `events`;
six tables, price trigger, summary view; 400/401/404/409/413/415; non-ASCII
round trip, stock 0/1, price snapshot, UNIQUE guard.

## 🚫 Out of scope

Registration, address book, service types, fees, dispatch UI, signature/photo,
timeline UI, event read API, dashboard reports — all blocked in
`docs/ui/docs/test/test-cases.md`. No data invented for them.

## 📚 Basis

| ID | Source | Fixes |
| :--- | :--- | :--- |
| B-01 | `database/schema.sql` | Tables, CHECK/UNIQUE/FK, enums |
| B-02 | `docs/openapi.yaml` | Field sets, schemas, error codes |
| B-03 | `backend/server.py` | Validation, PBKDF2, tokens, tracking numbers |
| B-04 | `docs/USER_STORIES.md` | US-1…5 intent |
| B-05 | `docs/ui/docs/test/test-cases.md` | TC-001…5, order, evidence template |
| B-06 | `database/README.md` | Disposable DB, `verify` / `backup` |
| B-07 | `CONTRIBUTING.md` | Branch/PR process, English docs, review |
| B-08 | `docs/PROJECT.md` | QA ownership, task templates |

## 🧱 Environment

Python 3.12 · Node ≥ 22.12 · `sqlite3` · ports 8000/3000 free · **disposable**
`LMS_DB_PATH` · `demo / demo123` · fresh browser session.

## ⚠️ Assumptions (from the code, not the wishlist)

| ID | Constraint | Consequence |
| :--- | :--- | :--- |
| A-01 | `role` CHECK = `customer`/`courier`/`warehouse_admin`/`admin` | no `merchant` or `driver` values |
| A-02 | no `driver_id` / `merchant_id` | merchant = `sender_id`; driver via `tracking_events` |
| A-03 | `_require_auth` ignores `role` | any logged-in user can write |
| A-04 | status order not enforced | never assert reverse rejection |
| A-05 | seed hashes are placeholders | accounts use real PBKDF2 hashes |
| A-06 | tokens die on restart | re-login; never store tokens |
| A-07 | `_read_json` needs the exact field set | extra/missing keys → 400 |
| A-08 | `application/json`; 65536 B limit | 415 / 413 cases |
| A-09 | `UNIQUE (shipment_id, item_id)` | distinct pairs only |
| A-10 | `unit_price` snapshot + trigger | historical 145.00 row |
| A-11 | generated `HK<date><seq>` numbers | dataset uses `IT-` prefix |
| A-12 | isolate from seed / `demo` | explicit IDs 101–199 only |

## 👥 Role mapping

| Business role | schema `role` | Representation |
| :--- | :--- | :--- |
| Customer / end buyer | `customer` | `users` 101/102/107; `receiver_*` (US-1) |
| Merchant / shipper | `warehouse_admin` | `users` 103/104; `sender_id`, stock (US-2, US-4) |
| Driver / courier | `courier` | `users` 105/106; events (US-3, US-5) |

⚠️ Test-only mapping. The schema has no merchant role; `warehouse_admin` owns
stock and inbound registration, and `courier` maps directly to the driver.
Independent roles + a `driver_id` FK require their own schema/API task and PR —
never simulate them with values the CHECK rejects.

## 🧪 Design method

Equivalence (roles/statuses) · Boundary (stock 0/1, qty 1/2, price 0) · State
(`pending → shipped → delivered`) · Error guessing (400/401/404/409/413/415) ·
Constraint (CHECK/UNIQUE/FK) · Snapshot (view) · Non-ASCII round trip.

| Dimension | Covered |
| :--- | :--- |
| Roles | `customer` ×3, `warehouse_admin` ×2, `courier` ×2, `demo` (`admin`) |
| Statuses | `pending` ×3, `shipped` ×1, `delivered` ×1 |
| Hub | `NULL`, 101, 103 |
| Stock | 0, 1, 10, 45, 120, 300 |
| Errors | 400, 401, 404, 409, 413, 415 |

## 📊 Volume

| Table | IDs | Rows |
| :--- | :--- | :---: |
| `users` | 101–107 | 7 |
| `hubs` | 101–103 | 3 |
| `items` | 101–106 | 6 |
| `shipments` | 101–105 | 5 |
| `shipment_items` | 101–106 | 6 |
| `tracking_events` | 101–108 | 8 |

**35 rows total.** Every row is consumed by a case in `06` or `07`.

## 🔐 Safety

Fictional personal data · test-only password and deterministic salts · no tokens,
`.db` files or backups committed · AI assistance disclosed, pending team
confirmation of the authoritative course source.

## 🚦 Criteria

**Entry:** reviewed · disposable DB verified (7/3/6/5/6/8, integrity `ok`) ·
services start · CI green · commit SHA recorded.

**Exit:** every case has Actual Result + Status · failures linked to Issues ·
counts re-checked · DB reset · evidence attached. Checklists in `09`.

## ⚠️ Risks

R-01 no merchant/driver roles · R-02 no role authorisation · R-03 no status
order · R-04 not approved or executed · R-05 project dates are provisional.

## ✍️ Ownership

| Field | Value |
| :--- | :--- |
| Prepared by | Team lead (AI-assisted), 2026-11-19 |
| QA owner | ZHANGZHIYUAN (`docs/PROJECT.md`) |
| Affected owners | Backend XIE Jiayan · Database CEN Yin Chi · Frontend Chi Xuanyi |
| Approval | **Pending** — ≥1 other member (`CONTRIBUTING.md`) |
