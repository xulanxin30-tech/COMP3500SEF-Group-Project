# Integration Test Dataset · 联调测试数据集

> **Branch:** `联调测试` · **Status:** Prepared / **not executed** · **Version:** 1.0.0
> **Baseline:** `database/schema.sql` v1.2 (`PRAGMA user_version = 2`) · `docs/openapi.yaml` 0.3.0

This folder is a **test-preparation deliverable** for integration (联调) testing of
the Logistics Management System. It supplies the data, accounts, API cases and
checks that must exist *before* an integration run starts. Nothing here is a test
result: no case has been executed, and actual results must be recorded separately
with the template in [09-数据准备与验收清单.md](09-数据准备与验收清单.md).

## 1. Purpose

The implemented system joins three components: the React/TypeScript frontend, the
Python standard-library HTTP backend and the SQLite v1.2 database. This dataset
makes that join **repeatable** by fixing:

- the three business roles that drive an end-to-end shipment;
- a clean, isolated, reproducible baseline for all six tables;
- the exact API calls and expected responses that exercise the join;
- negative and boundary inputs proving the database/API guards still hold;
- and an unbroken trace from user stories to data to cases.

## 2. The three roles

| 中文 | English | schema v1.2 `role` | Where the role appears in the data |
| :--- | :--- | :--- | :--- |
| 购买物流服务的用户 | Customer / end buyer | `customer` | `users` 101 / 102 / 107; `shipments.receiver_*` |
| 使用物流服务的商家 | Merchant / shipper | `warehouse_admin` | `users` 103 / 104; `shipments.sender_id`; `items.stock_quantity` |
| 运送货物的司机 | Driver / courier | `courier` | `users` 105 / 106; `tracking_events.hub_id` and `description` |

The v1.2 schema has **no `merchant` or `driver` role** and **no `driver_id`
column** on `shipments`. The mapping above and the resulting gaps are recorded as
explicit assumptions in [01-数据集规格说明.md](01-数据集规格说明.md) and
[03-角色与账号数据.md](03-角色与账号数据.md). Do not silently treat them as
implemented features.

## 3. Folder index

| # | File | Contents | 内容 |
| :--- | :--- | :--- | :--- |
| — | [README.md](README.md) | This index, glossary and quick start | 索引与使用说明 |
| 01 | [01-数据集规格说明.md](01-数据集规格说明.md) | Objectives, scope, test basis, assumptions, data design method, ownership | 数据集规格说明 |
| 02 | [02-数据字典.md](02-数据字典.md) | Field-by-field dictionary for all six tables and the summary view | 数据字典 |
| 03 | [03-角色与账号数据.md](03-角色与账号数据.md) | Role mapping, accounts, credentials, permission matrix | 角色与账号数据 |
| 04 | [04-联调基础数据.sql](04-联调基础数据.sql) | Idempotent SQLite load script (the executable baseline) | 联调基础数据 SQL |
| 05 | [05-联调基础数据.json](05-联调基础数据.json) | The same rows as JSON for parameterised runners | 联调基础数据 JSON |
| 06 | [06-接口联调用例.md](06-接口联调用例.md) | IT-TC cases grouped by role, with requests and expected results | 接口联调用例 |
| 07 | [07-异常与边界数据.md](07-异常与边界数据.md) | Negative / boundary inputs and expected error codes | 异常与边界数据 |
| 08 | [08-可追溯性矩阵.md](08-可追溯性矩阵.md) | Requirements → data → cases → expected evidence | 可追溯性矩阵 |
| 09 | [09-数据准备与验收清单.md](09-数据准备与验收清单.md) | Environment setup, load, verification, reset, entry/exit criteria | 数据准备与验收清单 |
| — | [generate_dataset.py](generate_dataset.py) | Regenerates 04 and 05 from one source of truth | 数据复现脚本 |

`04` and `05` are **generated**; edit `generate_dataset.py`, never the outputs.

## 4. Glossary · 中英对照

| 中文 | English | Notes |
| :--- | :--- | :--- |
| 联调测试 | Integration testing | Branch name; joins frontend + backend + database |
| 联调测试数据集 | Integration test dataset | This folder |
| 购买物流服务的用户 | Customer / end buyer | Buys the service; receiver of the parcel |
| 使用物流服务的商家 | Merchant / shipper | Sends goods; owns stock; `sender_id` |
| 运送货物的司机 | Driver / courier | Executes pickup, hub transfer and delivery |
| 待揽收 | `pending` | Shipment status |
| 运输中 | `shipped` | Shipment status |
| 已签收 | `delivered` | Shipment status |
| 网点 / 中转仓 | Hub | `hubs`; 3 test hubs in this dataset |
| 运单 / 订单 | Shipment / Order / Waybill | All three UI names read the same `shipments` rows |
| 轨迹事件 | Tracking event | `tracking_events`; append-only |
| 库存扣减 | Stock deduction | Atomic with shipment creation |
| 测试用例 | Test case | IT-TC-xxx in file 06 |
| 准入 / 准出准则 | Entry / exit criteria | Defined in file 09 |

## 5. Test basis · 依据

| Reference | What it fixes |
| :--- | :--- |
| `database/schema.sql` (v1.2) | Six tables, CHECK/UNIQUE/FK constraints, role and status enums, price trigger, `v_shipment_order_summary` |
| `docs/openapi.yaml` (0.3.0) | Paths, exact required field sets, response schemas, error codes 400/401/404/409/413/415 |
| `backend/server.py` | Real validation behaviour, PBKDF2 hash format, token lifetime, tracking-number generation |
| `docs/USER_STORIES.md` | US-1 … US-5 business roles and acceptance criteria |
| `docs/ui/docs/test/test-cases.md` | TC-001 … TC-005 manual plan, execution order, evidence template |
| `database/README.md` | Disposable-database rule, `verify` / `backup` / `rebuild` commands |
| `CONTRIBUTING.md` | Branch/PR workflow, English documents, evidence and review requirements |
| `docs/PROJECT.md` | QA ownership (ZHANGZHIYUAN) and task/evidence templates |

## 6. Quick start · 使用流程

1. Create a **disposable** SQLite file via `LMS_DB_PATH`; never reuse a shared DB
   (`docs/ui/docs/test/test-cases.md`, `database/README.md`).
2. Start `python backend/server.py` once so the schema and the `demo` account are
   created, then stop it.
3. Load [04-联调基础数据.sql](04-联调基础数据.sql) into that file and run the
   verification queries in [09-数据准备与验收清单.md](09-数据准备与验收清单.md).
4. Execute [06-接口联调用例.md](06-接口联调用例.md) in the stated order, then the
   negative cases in [07-异常与边界数据.md](07-异常与边界数据.md).
5. Record commit / browser / tester / date / actual result in file 09, then reset
   the database. Full commands and entry/exit criteria are in file 09.

## 7. Language note

Per `CONTRIBUTING.md` ("Use English for project documents, commit messages and PR
descriptions"), the contents are written in English. Chinese is retained in the
branch, folder and file names as requested by the team lead, and in the glossary
and role labels above so the dataset stays readable for the whole team.

## 8. Data safety and isolation

All names, phone numbers, addresses and SKUs are **fictional**. `+852-9010xxxx`
is used only as a test number block; no real personal data is stored. Passwords
and their deterministic salts are test-only values and must never be reused
outside a disposable local database. All integration rows use explicit IDs in the
**101–199** band with `IT-` prefixed SKUs and tracking numbers, so the schema
seed rows (1–3) and the startup `demo` account are never modified.
