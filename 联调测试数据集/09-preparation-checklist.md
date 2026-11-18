# 09 · Preparation and Acceptance Checklist

> 🚦 **Prepared · not executed** · run from the repository root
> 🧱 Disposable DB only — never a shared or demo database

## 🖥️ Environment

| Item | Check |
| :--- | :--- |
| Python 3.12 | `py -3 --version` (Win) / `python3 --version` |
| Node ≥ 22.12 · `sqlite3` | `node --version`, `sqlite3 --version` |
| Ports 8000 / 3000 free | no other listener |
| Disposable `LMS_DB_PATH` | never shared `backend/lms.db` |
| Branch + SHA | `git status`, `git rev-parse HEAD` |

## 🚀 Build the baseline

**1 · Point at a disposable DB**

```powershell
$env:LMS_DB_PATH = "$PWD\backend\it_lms.db"   # Windows PowerShell
```

```sh
export LMS_DB_PATH="$PWD/backend/it_lms.db"  # macOS / Linux
```

**2 · Start the backend once** to create the schema and `demo`, confirm
`GET /api/health` → `{"status":"ok","service":"lms-backend"}`, then Ctrl+C.

```sh
python3 backend/server.py        # use: py -3 backend/server.py  (Windows)
```

**3 · Load the dataset (idempotent)**

```sh
sqlite3 "$LMS_DB_PATH" ".read '联调测试数据集/04-baseline-data.sql'"
```

Deletes only IDs 101–199 and re-inserts them in one transaction. Never touches
seed rows 1–3 or `demo`.

**4 · Regenerate artefacts (optional)**

```sh
python 联调测试数据集/generate_dataset.py
```

♻️ Rewrites `04-baseline-data.sql` + `05-baseline-data.json`; commit both
together. **5 · Restart backend**, and `cd frontend && npm ci && npm run dev`
for UI cases. Sign in with `demo / demo123` or `It@2026Test`.

## ✅ Post-load verification

```sql
SELECT 'users', COUNT(*) FROM users WHERE user_id BETWEEN 101 AND 199
UNION ALL SELECT 'hubs', COUNT(*) FROM hubs WHERE hub_id BETWEEN 101 AND 199
UNION ALL SELECT 'items', COUNT(*) FROM items WHERE item_id BETWEEN 101 AND 199
UNION ALL SELECT 'shipments', COUNT(*) FROM shipments WHERE shipment_id BETWEEN 101 AND 199
UNION ALL SELECT 'shipment_items', COUNT(*) FROM shipment_items WHERE shipment_item_id BETWEEN 101 AND 199
UNION ALL SELECT 'tracking_events', COUNT(*) FROM tracking_events WHERE event_id BETWEEN 101 AND 199;
PRAGMA integrity_check;        -- ok
PRAGMA foreign_key_check;      -- no rows
PRAGMA user_version;           -- 2
SELECT COUNT(*) FROM users WHERE username = 'demo';   -- 1
```

🎯 Counts **7/3/6/5/6/8**; stock 120/45/300/1/0/10; statuses
`pending, shipped, delivered, pending, pending`.

```sh
python database/db_manager.py verify --db "$LMS_DB_PATH"   # stop backend first
```

## 📝 Evidence template (one row per case)

| Field | Record |
| :--- | :--- |
| Case ID | `IT-TC-xxx` / `NEG-xxx` / `BD-xx` |
| Role · Priority | 👤 / 🏪 / 🚚 · P0/P1/P2 |
| Preconditions | data IDs, token, stock, no other writer |
| Input + Steps | exact JSON / SQL and commands |
| Expected | from `06` / `07` |
| **Actual · Status** | observed code/body/DB values · Pass/Fail/Blocked/Not Run |
| **Evidence** | commit SHA, browser+v, tester, date+TZ, request/response or screenshot |

▶️ Execute `06-api-cases.md` in its stated order, then `07`, then re-run §3.
⚠️ Automated results must **not** mark manual TC-001…005 as passed.

## 🧹 Reset and cleanup

| Situation | Action |
| :--- | :--- |
| Re-run suite | re-run the `.read` command — restores the exact baseline |
| Stock already deducted | reload 04 (`IT-WM-101` → 120) |
| End of session | stop backend, delete `backend/it_lms.db` |
| DB-level probes | always `ROLLBACK` |
| Tokens | discard; re-login after restart |
| Never commit | `*.db`, `database/backups/`, tokens, personal screenshots |

Child-first delete (backend sets `PRAGMA foreign_keys = ON`):

```sql
BEGIN IMMEDIATE;
DELETE FROM tracking_events WHERE event_id BETWEEN 101 AND 199;
DELETE FROM shipment_items WHERE shipment_item_id BETWEEN 101 AND 199;
DELETE FROM shipments WHERE shipment_id BETWEEN 101 AND 199;
DELETE FROM items WHERE item_id BETWEEN 101 AND 199;
DELETE FROM hubs WHERE hub_id BETWEEN 101 AND 199;
DELETE FROM users WHERE user_id BETWEEN 101 AND 199;
COMMIT;
```

## 🚦 Entry criteria

- [ ] Specification reviewed by QA + ≥1 other member (`CONTRIBUTING.md`)
- [ ] Commit SHA, browser/v, tester, date+TZ recorded
- [ ] Disposable `LMS_DB_PATH`; backup taken if any non-disposable DB is involved
- [ ] `/api/health` OK; frontend starts; ports free
- [ ] §3 checks pass: 7/3/6/5/6/8, integrity `ok`, `user_version = 2`, `demo = 1`
- [ ] CI (`.github/workflows/ci.yml`) green for the tested commit
- [ ] All three role accounts can log in
- [ ] No other writer on the DB; out-of-scope features confirmed as non-criteria

## 🏁 Exit criteria

- [ ] Every applicable `IT-TC` case has Actual Result + Status
- [ ] Every applicable negative/boundary probe has Actual Result
- [ ] §3 counts + stock re-checked after negatives; mutations logged as defects
- [ ] Each Fail/Blocked has a linked Issue with owner
- [ ] `08-traceability-matrix.md` filled; summary counts match
- [ ] IT-TC-017 executed with a real restart
- [ ] Evidence includes SHA, browser, tester, date+TZ, request/response
- [ ] DB reset/deleted; no `.db`, token or personal data committed
- [ ] Results + limitations reported in the task/PR; manual cases not marked passed

## ⚠️ Reminders

| Reminder | Source |
| :--- | :--- |
| Stock assumptions break if another tester writes | `docs/ui/docs/test/test-cases.md` |
| Tokens die on restart → re-login for 017 | `docs/openapi.yaml` |
| No status order / no role authorisation → don't assert rejection | A-03, A-04 |
| `merchant` / `driver` role values are rejected by CHECK | DB-04/05 |
| Events verified by SQL only; no timeline UI or read API | manual plan |
| Quote the folder path in shell / SQLite commands | §2 step 3 |
| `docs/PROJECT.md` dates are provisional | project record |

## ✍️ Ownership

| Field | Value |
| :--- | :--- |
| QA owner | ZHANGZHIYUAN |
| Affected owners | Backend XIE Jiayan · Database CEN Yin Chi · Frontend Chi Xuanyi |
| Prepared by | Team lead (AI-assisted, disclosed in `01`) |
| Review / approval | **Pending** |
| Execution | **Not started** |

## 📎 Related

`04-baseline-data.sql` · `05-baseline-data.json` · `06-api-cases.md` ·
`07-negative-and-boundary-data.md` · `08-traceability-matrix.md` ·
`01-specification.md` · `docs/ui/docs/test/test-cases.md` (external manual plan).
