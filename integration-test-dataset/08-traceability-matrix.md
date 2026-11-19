# 08 · Traceability Matrix

> 🔗 **Prepared · not executed** · fill the last columns during the run with the
> template in `09-preparation-checklist.md`

**Legend:** US = `docs/USER_STORIES.md` · TC = `docs/ui/docs/test/test-cases.md` ·
API = `openapi.yaml` operationId · D = dataset IDs · IT-TC = `06-api-cases.md`.

## 🎯 Requirement → data → case

| ID | Requirement | Role | API | Data | Case | Expected evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TR-01 | US-1 tracking | 👤 Customer | `listShipments` | SH-101…105, U-101/102 | 006, 017 | all five orders listed; survive restart | Not Run |
| TR-02 | US-1 / TC-005 login | 👤 Customer | `login` | U-101/102/107, `demo` | 001, 002 | 200 + user object; 401 on bad password | Not Run |
| TR-03 | US-2 stock accuracy | 🏪 Merchant | `listItems` | IT-101…106 | 009, 003 | 120/45/300/1/0/10; 120 → 118 | Not Run |
| TR-04 | US-2 / TC-002 waybill | 🏪 Merchant | `createShipment` | U-103, IT-101, SI-101, TE-101 | 003 | 201, atomic deduction, line + event | Not Run |
| TR-05 | TC-004 stock guard | 🏪 Merchant | `createShipment` | IT-104/105 | 007, 008, 409 probes | 409; stock + count unchanged | Not Run |
| TR-06 | US-3 dispatch (partial) | 🚚 Driver | `updateShipmentStatus` | U-105, SH-101 | 004 | status flow works; assignment UI out of scope | Not Run |
| TR-07 | US-5 delivery | 🚚 Driver | `appendTrackingEvent` | U-105/106, HUB-101/103, TE-103/105/106 | 004, 005 | event appended; signature out of scope | Not Run |
| TR-08 | US-5 / TC-003 flow | 🚚 Driver | `updateShipmentStatus` | SH-101, TE-101 | 004, 010 | 3 statuses + events; invalid enum → 400 | Not Run |
| TR-09 | US-4 read-only view | 🏪 Merchant / `demo` | `getHealth`, `listItems`, `listShipments` | all | 006, 009 | public GETs 200; dashboard blocked | Not Run |
| TR-10 | auth errors | all | `login`, `getProfile`, writes | U-101…107 | 012, 401 probes | 401 + `WWW-Authenticate` | Not Run |
| TR-11 | validation errors | all | writes | all | 013, 014, 400/413/415 | exact messages | Not Run |
| TR-12 | not found | all | writes | HUB-101/103, SH-101 | 011, 404 probes | exact messages | Not Run |
| TR-13 | v1.2 price snapshot | 🏪 Merchant | SQL view | SI-104, IT-101 | 016 | `IT-2026-0003` = **145.00** | Not Run |
| TR-14 | v1.2 guards | 🏪 Merchant | SQL | SI-101…106 | 018, DB-01…08 | IntegrityError each | Not Run |
| TR-15 | persistence | 👤 Customer | `login`, `listShipments` | all | 017 | rows survive restart; token expires | Not Run |
| TR-16 | non-ASCII | 👤 Customer | `createShipment`, `listShipments` | SH-104, IT-106 | 015 | accented text round-trips | Not Run |
| TR-17 | startup protection | environment | `getHealth` | — | `09` §2 | backend starts on disposable DB | Not Run |

## 🧾 No orphan data

| Rows | Consumed by |
| :--- | :--- |
| `users` 101/102/107 | 001, 002, 006, 015, 017 |
| `users` 103/104 | 003, 007, 008, 009, 016, 018 |
| `users` 105/106 | 004, 005, 010, 011 |
| `hubs` 101/102/103 | 005, 011, 016, shipments 102/103 |
| `items` 101 / 102+103 / 104+105 / 106 | 003, 016, 409 probes / 016 / 007, 008 / 015 |
| `shipments` 101 / 102 / 103 / 104 / 105 | 004, 005, 006 / 016, 018 / 006, 016 / 015 / 007, 009 |
| `shipment_items` 101–106 | 016, 018 |
| `tracking_events` 101–108 | 004, 005, 006, 016 |

✅ All 35 rows are referenced. Removing a row requires updating its case in the
same PR.

## 🔌 API coverage

| Operation | Positive | Negative | ✅ |
| :--- | :--- | :--- | :---: |
| `getHealth` | `09` §2 | — | ✅ |
| `login` | 001 | 401 probes, 400 probes | ✅ |
| `getProfile` | 002 | 012 | ✅ |
| `listItems` | 009 | — | ✅ |
| `listShipments` | 006 | — | ✅ |
| `createShipment` | 003, 015 | 007/008, 400/401/404/409/413/415 | ✅ |
| `updateShipmentStatus` | 004 | 010, 011, 012, 013 | ✅ |
| `appendTrackingEvent` | 005 | 010, 011, 012, 013 | ✅ |

✅ All 8 operations in `openapi.yaml` 0.3.0.

## 📋 Manual plan alignment

| Manual | Status there | Here | Note |
| :--- | :--- | :--- | :--- |
| TC-001 registration | Blocked | — | no data invented |
| TC-002 create waybill | Not Run | 003 | same 120 → 118 assumption, `IT-WM-101` |
| TC-003 status flow | Not Run | 004 | same 3-status scenario + event SQL |
| TC-004 stock guard | Not Run | 007 | same 409, boundary stock 1 |
| TC-005 demo login | Not Run | 001 | `demo / demo123` retained |

⚠️ This dataset complements the manual plan. Its passing results must **not**
mark manual browser cases as passed.

## 🚫 Blocked requirements

US-1 ETA/location · US-2 SKU scanning/bin · US-3 vehicle assignment · US-4
report export/alerts · US-5 signature/photo · TC-001 registration · address
book, service types, fees · timeline UI / event read API. All future scope —
verify events by read-only SQL instead.

## 📊 Execution summary (fill in)

| Metric | Prepared | Executed | Passed | Failed | Blocked |
| :--- | :---: | :---: | :---: | :---: | :---: |
| IT-TC cases (18) | 18 | 0 | 0 | 0 | 0 |
| Negative / boundary probes | 40+ | 0 | 0 | 0 | 0 |
| Trace lines (TR-01…17) | 17 | 0 | 0 | 0 | 0 |

| Evidence field | Value |
| :--- | :--- |
| Commit SHA · browser/v · tester · date+TZ | *record at execution* |
| Disposable DB path · CI result | *record at execution* |
