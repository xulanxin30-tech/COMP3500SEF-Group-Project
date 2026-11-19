# Integration Test Dataset

> 🧪 **Prepared · not executed** · v1.0.0
> 🌿 Branch `integration-testing` · 📐 `schema.sql` v1.2 · 🔌 `openapi.yaml` 0.3.0

🎯 A fixed, reproducible data baseline for integration testing of the React
frontend + Python HTTP backend + SQLite v1.2 database. **No case here has been
run** — record results with the template in `09-preparation-checklist.md`.

## 🗂️ Files

| File | Purpose |
| :--- | :--- |
| [01-specification.md](01-specification.md) | 🎯 Scope, basis, assumptions, method, ownership |
| [02-data-dictionary.md](02-data-dictionary.md) | 📐 Field dictionary for all six tables |
| [03-roles-and-accounts.md](03-roles-and-accounts.md) | 👥 Roles, accounts, credentials, permission matrix |
| [04-baseline-data.sql](04-baseline-data.sql) | 💾 Idempotent SQLite load script |
| [05-baseline-data.json](05-baseline-data.json) | 📄 Same rows as JSON |
| [06-api-cases.md](06-api-cases.md) | 🧪 18 API cases grouped by role |
| [07-negative-and-boundary-data.md](07-negative-and-boundary-data.md) | 🐞 Negative and boundary inputs |
| [08-traceability-matrix.md](08-traceability-matrix.md) | 🔗 Requirements → data → cases |
| [09-preparation-checklist.md](09-preparation-checklist.md) | 🚦 Setup, checks, entry/exit criteria |
| [generate_dataset.py](generate_dataset.py) | ♻️ Regenerates 04 + 05 |

♻️ `04` and `05` are generated — edit `generate_dataset.py`, never the outputs.

## 👥 Roles

| Business role | schema `role` | Data |
| :--- | :--- | :--- |
| Customer / end buyer | `customer` | `users` 101/102/107; `receiver_*` |
| Merchant / shipper | `warehouse_admin` | `users` 103/104; `sender_id`; stock |
| Driver / courier | `courier` | `users` 105/106; `tracking_events` |

⚠️ v1.2 has **no** `merchant` / `driver` role and **no** `driver_id`. See
`01-specification.md` → ⚠️ Assumptions.

## 📚 Basis

`database/schema.sql` · `docs/openapi.yaml` · `backend/server.py` ·
`docs/USER_STORIES.md` (US-1…5) · `docs/ui/docs/test/test-cases.md` (TC-001…5) ·
`database/README.md` · `CONTRIBUTING.md` · `docs/PROJECT.md`.

## 🚀 Quick start

1. 🧱 Point `LMS_DB_PATH` at a **disposable** DB; start the backend once to create the schema and `demo`.
2. 💾 Stop it, then load `04-baseline-data.sql` (command in `09-preparation-checklist.md`).
3. ✅ Run the checks in `09`, then execute `06`, then `07`.
4. 📝 Record commit / browser / tester / date in `09`; reset the DB.

## 🔐 Safety

All names, phones and addresses are fictional. Password `It@2026Test` and its
deterministic salts are test-only. Rows use IDs **101–199** with `IT-` prefixes,
so seed rows (1–3) and `demo` are never touched.

📄 Per `CONTRIBUTING.md`, documents, file names, folder name and branch name
are all in English.
