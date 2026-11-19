# 03 · Roles and Accounts

> 👥 Three business roles · 🔑 real, login-capable credentials · 🧪 test-only

## ⚠️ Why new accounts

Seed users (`admin_alan`, `customer_alice`, `courier_chan`) use placeholder
`hash_pwd_00x` values and **cannot log in** (`docs/openapi.yaml`). The only real
account is `demo / demo123` (`admin`), added at first startup. So this dataset
creates 7 accounts with valid PBKDF2 hashes.

## 👥 Role mapping

| Business role | schema `role` | Why this mapping | Data |
| :--- | :--- | :--- | :--- |
| Customer / end buyer | `customer` | US-1; buyer is the receiver | 101/102/107, `receiver_*` |
| Merchant / shipper | `warehouse_admin` | no `merchant` role exists; this role owns stock + inbound (US-2/4) | 103/104, `sender_id` |
| Driver / courier | `courier` | US-3/5; pickup, transfer, delivery | 105/106, events |

⚠️ Test-only mapping, not a claim that the product model is complete.

## 🔑 Accounts

Common password **`It@2026Test`** · hash
`pbkdf2_sha256$600000$<32-hex salt from user_id>$<64-hex digest>`
(deterministic, reproducible, **not production-safe**).

| ID | `username` | Role | `phone` | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| 101 | `it_customer_amy` | `customer` | `+852-90100001` | Buyer of pending `IT-2026-0001` |
| 102 | `it_customer_bob` | `customer` | `+852-90100002` | Buyer of `shipped` `IT-2026-0002` |
| 107 | `it_customer_edge` | `customer` | `+852-90100003` | Non-ASCII boundary account |
| 103 | `it_merchant_ken` | `warehouse_admin` | `+852-90100101` | Primary shipper; creates the waybill |
| 104 | `it_merchant_lily` | `warehouse_admin` | `+852-90100102` | Delivered + low-stock order; 409 cases |
| 105 | `it_driver_dan` | `courier` | `+852-90100201` | Pickup, status flow, hub events |
| 106 | `it_driver_eva` | `courier` | `+852-90100202` | Driver-side negative cases |

| Built-in | Password | Role | Created by |
| :--- | :--- | :--- | :--- |
| `demo` | `demo123` | `admin` | `initialize_database()` at startup |

🐞 Wrong-password control: `wrong-password`.

## 🔌 Login contract

```http
POST /api/auth/login
Content-Type: application/json

{"username": "it_merchant_ken", "password": "It@2026Test"}
```

`200` → `{"token": "...", "token_type": "Bearer",
"user": {"id": 103, "username": "it_merchant_ken", "role": "warehouse_admin"}}`

- Both fields non-empty strings; key set must be **exactly** `{username, password}`.
- Unknown user / bad hash → `401 invalid credentials`.
- Tokens are in-memory and **expire on restart** → re-login; never stored here.
- `GET /api/auth/profile` returns the same `{id, username, role}`.

## 🔐 Permission matrix (observed behaviour / gap)

`_require_auth()` validates the token only — it **does not check `role`**.

| Endpoint | Auth | customer | merchant | driver | admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `GET /api/health`, `/api/items`, `/api/shipments` | No | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/login` | No | ✅ | ✅ | ✅ | ✅ |
| `GET /api/auth/profile` | Yes | ✅ | ✅ | ✅ | ✅ |
| `POST /api/shipments` | Yes | ✅ * | ✅ * | ✅ * | ✅ * |
| `PATCH /api/shipments/{id}/status` | Yes | ✅ * | ✅ * | ✅ * | ✅ * |
| `POST /api/shipments/{id}/events` | Yes | ✅ * | ✅ * | ✅ * | ✅ * |

`*` Every authenticated role is currently allowed. Cases use the realistic
account but **must not assert** that another role is rejected. Role-based
authorisation would be a separate backend task + new cases.

## 🔗 Role → cases

| Role | Rows owned | Cases |
| :--- | :--- | :--- |
| Customer | 101/102/107; shipments 101/102/104 | 001, 002, 006, 015, 017 |
| Merchant | 103/104; items; shipments 101–105 | 003, 007, 008, 016, 018 |
| Driver | 105/106; hubs 101/103; events | 004, 005, 010, 011 |

## 🚫 Known model gaps

- No `driver_id` → a driver cannot be assigned to an order via API.
- No `merchant` role value → do not insert one (CHECK rejects it).
- No role authorisation → any logged-in user can mutate data.
- No signature / photo / ETA → delivery cases record status + text only.
- No dispatch UI, no status-order enforcement → both out of scope.

## ♻️ Lifecycle

1. Inserted by `04-baseline-data.sql` into a disposable DB only.
2. Removed by its `DELETE ... BETWEEN 101 AND 199` block, or by deleting the `.db`.
3. Never load into a shared `backend/lms.db`.
4. Never reuse the password, salts or fictional phones outside test scope.
5. Keep `demo / demo123` as the TC-005 control account.
