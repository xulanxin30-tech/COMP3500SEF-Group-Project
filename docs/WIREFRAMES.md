# Low-Fidelity Wireframes
> These wireframes map directly to the user stories defined in `USER_STORIES.md`.
> Style: ASCII low-fi sketches for early design review.

---

## US-1 · Customer – Track Order Status
### Screen: Order Tracking
+------------------------------+
|  Logistics System            |
|                              |
|  Order No. [____________]    |
|           ( Track )          |
|                              |
|  Status: ● In Transit        |
|  Current: Shenzhen Hub       |
|  ETA: 2026-11-05 18:00       |
|                              |
|  Timeline                    |
|  - 11-02 Picked up           |
|  - 11-03 Arrived GZ hub      |
|  - 11-04 Shenzhen sorting    |
|  - 11-05 Out for delivery    |
+------------------------------+

---

## US-2 · Warehouse Staff – Inbound Registration

### Screen: Inbound Form

+------------------------------+
|  Inbound Registration        |
|                              |
|  SKU      [ MS-001     ] (scan)
|  Product: Wireless Mouse     |
|  Qty       [ 200       ]     |
|  Bin       [ A-03-02   ]     |
|                              |
|        ( Confirm Inbound )    |
|                              |
|  Recent:                     |
|  KB-002 x50   10:32          |
|  HP-005 x100  10:15          |
+------------------------------+

---

## US-3 · Dispatcher – Create & Assign Waybill

### Screen: Dispatch Board

+------------------------------------------+
|  Pending Orders          Available Fleet  |
|  ☑ ORD-001  3pk  Kowloon  Van: HK-881    |
|  ☑ ORD-002  1pk  HK Island Dr: Lee       |
|  ☐ ORD-003  5pk  NT       Van: HK-662    |
|                                          |
|  Vehicle: [ HK-881        ▼ ]            |
|  Driver : [ Lee           ▼ ]            |
|                                          |
|      ( Generate & Dispatch Waybill )      |
+------------------------------------------+

---

## US-4 · Admin – Dashboard & Reports

### Screen: Admin Dashboard

+------------------------------------------+
|  Good morning, Admin                     |
|                                          |
|  Today: In 142 / Out 98 / Errors 3       |
|                                          |
|  ⚠ Low Stock Alerts                      |
|  ! Battery BT-001   15 / threshold 50    |
|  ! Box    BOX-001  40 / threshold 60     |
|                                          |
|  [ Export Daily ] [ Export Weekly ]      |
|                                          |
|  7-day throughput                        |
|  ████████░░░░                            |
+------------------------------------------+

---

## US-5 · Driver – Pickup & Delivery Confirm

### Screen: Driver Mobile (compact)

+-----------------------+
|  My Task              |
|                       |
|  Waybill: W-261102001 |
|  To: Mong Kok, KLN    |
|                       |
|  ( Pickup Check-in )  |
|  ✅ 10:32             |
|                       |
|  ( Delivery Confirm ) |
|                       |
|  Signature: _______   |
+-----------------------+

---

## Navigation Map

Customer Track ──┐
                 ├─ Login ── Admin Dashboard
Warehouse Inbound─┤
Dispatcher Board ─┤
Driver Mobile ────┘

All screens share:
- Top bar: logo + role label
- Bottom: help / logout
- Consistent button size & plain grayscale layout (low-fi)