# User Stories and Use Cases

## US-1: Customer Order Tracking
- **Role**: As a customer
- **Goal**: I want to track my order status in real-time
- **Benefit**: So that I know the current location and estimated delivery time of my package.

**Scenario**:
1. Customer enters the order number on the tracking page.
2. The system retrieves the latest logistics trajectory.
3. The system displays the current status, location, and ETA.

**Acceptance Criteria**:
- [ ] Input field for order number.
- [ ] Display real-time status and location.
- [ ] Show estimated delivery time.

---

## US-2: Warehouse Staff Inbound Registration
- **Role**: As a warehouse staff member
- **Goal**: I want to register incoming goods by scanning SKU
- **Benefit**: So that the inventory system stays accurate and up-to-date.

**Scenario**:
1. Staff scans the product SKU using a scanner.
2. System auto-fills product details.
3. Staff enters the quantity and storage bin.
4. Staff clicks "Confirm Inbound".

**Acceptance Criteria**:
- [ ] Support SKU scanning.
- [ ] Auto-fill product name.
- [ ] Record quantity and bin location.

---

## US-3: Dispatcher Order Dispatch
- **Role**: As a dispatcher
- **Goal**: I want to assign orders to available vehicles and drivers
- **Benefit**: So that deliveries are efficiently scheduled and executed.

**Scenario**:
1. Dispatcher selects pending orders from the dashboard.
2. Dispatcher chooses an available vehicle and driver.
3. System generates a new waybill and dispatches it.

**Acceptance Criteria**:
- [ ] List of pending orders.
- [ ] List of available vehicles and drivers.
- [ ] Generate and dispatch waybill.

---

## US-4: Admin Dashboard & Reports
- **Role**: As an administrator
- **Goal**: I want to view daily statistics and low-stock alerts
- **Benefit**: So that I can monitor operations and make informed decisions.

**Scenario**:
1. Admin logs into the dashboard.
2. System displays today's inbound/outbound counts and exceptions.
3. System highlights low-stock items.
4. Admin clicks to export daily/weekly reports.

**Acceptance Criteria**:
- [ ] Display key operational metrics.
- [ ] Trigger low-stock warnings.
- [ ] Support report export.

---

## US-5: Driver Delivery Confirmation
- **Role**: As a driver
- **Goal**: I want to check-in upon pickup and get customer signature upon delivery
- **Benefit**: So that the delivery process is verified and recorded.

**Scenario**:
1. Driver views assigned task on mobile.
2. Driver clicks "Pickup Check-in" with location timestamp.
3. Upon arrival, driver clicks "Delivery Confirm".
4. Customer provides an electronic signature.

**Acceptance Criteria**:
- [ ] Record location and timestamp for check-in.
- [ ] Support electronic signature or photo proof.
