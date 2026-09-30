# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 9: CHALLAN MANAGEMENT & DELIVERY DISPATCH ENGINE
### Complete Technical Documentation, Architecture, Atomic Dual-Write Pipeline, Multi-Challan Race Protection & API Reference

---

## 1. Executive Summary & Purpose

Module 9 builds **Challan Management** — the physical execution and dispatch subsystem representing the exact real-world moment material leaves Maitri Ceramic's warehouse to be delivered to a customer site.

A Challan is generated **from an active Quotation Confirmation (Module 7)**. Its finalization is the **single atomic trigger** in the entire system that simultaneously:
1. **Deducts Physical Stock**: Appends an immutable `CHALLAN_ISSUE` entry to the Stock Ledger (Module 8) and updates `Product.currentStock`.
2. **Records Delivered Quantity**: Updates `deliveredQuantity` against the corresponding confirmed items on `QuotationConfirmation` (Module 7) and recalculates `isFullyDelivered`.

These two side-effects are bound inside a single atomic database transaction: **either both succeed, or both roll back with zero partial state**.

### Key Highlights
- **Staged Lifecycle (`DRAFT` &rarr; `FINALIZED` / `CANCELLED`)**: Draft Challans allow editing transport and quantity details without altering stock or delivery ledgers.
- **Atomic Dual-Write Finalization**: Irreversible real-world movement triggers simultaneous atomic updates across Modules 7 and 8.
- **Multi-Challan Partial Delivery**: Supports issuing the same confirmed line item across multiple separate delivery trips over time (e.g., 4 units on Challan A, 6 units on Challan B against a 10-unit confirmation).
- **Concurrent Race-Condition Protection**: Re-validates remaining pending delivery live inside the finalization transaction, preventing concurrent draft over-deliveries.
- **Post-Finalization Immutability**: Once finalized, items, quantities, and customer details are strictly locked. Any subsequent real-world return must be processed via Module 12 (Return Management).
- **Delivery Note Printing & Excel Export**: Provides structured delivery note payloads for gate passes and `.xlsx` reporting.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│                 (authenticate + checkPermission('CHALLAN'))            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MODULE 9: CHALLAN MANAGEMENT                      │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Staged Challan Lifecycle     │    │ Multi-Challan Partial Delivery│  │
│  │ (DRAFT -> FINALIZED/CANCEL)  │    │ (Additive Accumulation)      │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Atomic Dual-Write Finalize   │    │ Immutability Lock Post-Final │  │
│  │ (Stock Deduct + Delivery Rec)│    │ (Guarantees Audit Integrity) │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │ (reads confirmed items)    │ (deducts stock upon issue) │ (pulls delivered quantities)
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    MODULE 7:     │       │    MODULE 8:     │       │    MODULE 10:    │
│    QUOTATION     │       │      STOCK       │       │     INVOICE      │
│   CONFIRMATION   │       │    MANAGEMENT    │       │    MANAGEMENT    │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 3. Database Architecture & Schema Design

### 3.1. `Challan` Collection (`models/Challan.js`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `challanNumber` | `String` | Unique sequential identifier (`CH-2026-27-0001`, collision-proof). |
| `challanDate` | `Date` | Date and time of dispatch creation (Default: `Date.now`). |
| `customer` | `ObjectId (ref: Customer)` | Customer receiving the delivery (Indexed, Required). |
| `customerContact` | `String` | Contact number snapshot at dispatch. |
| `customerAddress` | `String` | Destination site address snapshot. |
| `quotation` | `ObjectId (ref: Quotation)` | Parent quotation reference. |
| `confirmation` | `ObjectId (ref: QuotationConfirmation)` | Originating confirmation reference (Indexed, Required). |
| `salesperson` | `ObjectId (ref: User)` | Salesperson handling the order. |
| `remarks` | `String` | Operational dispatch instructions. |
| `deliveryDetails` | `String` | Vehicle registration, driver name, transporter information. |
| `status` | `String (Enum)` | Lifecycle status: `DRAFT`, `FINALIZED`, `CANCELLED` (Default: `DRAFT`). |
| `items` | `Array<ChallanItem>` | Dispatched line items (detailed below). |
| `finalizedAt` | `Date` | Timestamp when finalization dual-write executed. |
| `finalizedBy` | `ObjectId (ref: User)` | Authorized user who finalized the dispatch. |
| `isActive` | `Boolean` | Soft-delete status flag (Default: `true`). |
| `createdBy` | `ObjectId (ref: User)` | User who prepared the draft. |
| `updatedBy` | `ObjectId (ref: User)` | Last user who modified the document. |

#### Subdocument: `ChallanItem`
- `confirmedItem`: `ObjectId` &mdash; Pointer to specific line item in `QuotationConfirmation.confirmedItems._id`.
- `product`: `ObjectId (ref: Product)` &mdash; Product reference (null for ad-hoc fabricated accessories).
- `skuCodeSnapshot`: `String` &mdash; Historical SKU snapshot.
- `productNameSnapshot`: `String` &mdash; Product name snapshot.
- `unit`: `ObjectId (ref: UnitMaster)` &mdash; Unit of measurement.
- `quantityToIssue`: `Number` &mdash; Units dispatched in this delivery ($> 0$).
- `remarks`: `String` &mdash; Item-specific packing notes.

### 3.2. `ChallanNumberSequence` Collection (`models/ChallanNumberSequence.js`)
*Atomic sequence counter per Indian Financial Year (April–March).*
- Pattern: `CH-YYYY-YY-XXXX` (e.g. `CH-2026-27-0001`).

---

## 4. Lifecycle Workflow & Atomic Dual-Write Pipeline

```
[ Active Quotation Confirmation (Pending Delivery > 0) ]
                          │
                          ▼
             POST /api/challans (DRAFT)
   (Validates items against live pendingDelivery)
   (Zero stock change; zero deliveredQty change)
                          │
                          ▼
             [ Review / Edit DRAFT Challan ]
        (Items & quantities editable while DRAFT)
                          │
                          ▼
            PUT /api/challans/:id/finalize
  ┌────────────────────────────────────────────────────────┐
  │         SINGLE MONGO TRANSACTION / DUAL-WRITE          │
  │                                                        │
  │ 1. Re-validate live pendingDelivery (Race Protection)  │
  │ 2. stockService.deductStock(CHALLAN_ISSUE)             │
  │ 3. confirmationService.recordDelivery()                │
  │ 4. Set Challan.status = 'FINALIZED'                    │
  │ 5. Lock document from all future modifications         │
  └────────────────────────────────────────────────────────┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
  [ If ANY item fails ]     [ If ALL items succeed ]
  • Entire TX rolls back     • Stock deducted in Module 8
  • Challan remains DRAFT    • Delivered qty updated in Module 7
  • Returns item error       • Challan ready for Module 10 Invoice
```

---

## 5. Business Rules & Integrity Enforcements

1. **Originating Confirmation Constraint**:
   - Every Challan must originate from an active, approved `QuotationConfirmation`.
   - All `confirmedItemId` line items in a Challan must belong to that same confirmation.
2. **Pre-Finalization Zero Footprint**:
   - Creating or editing a `DRAFT` Challan has zero impact on `Product.currentStock` or `QuotationConfirmation.confirmedItems.deliveredQuantity`.
3. **Multi-Challan Cumulative Delivery**:
   - Multiple separate Challans can be created against one confirmation as long as each item's total delivered quantity does not exceed $(confirmedQuantity + extraQuantity)$.
4. **Live Race-Condition Guard**:
   - `quantityToIssue` is re-validated against real-time remaining pending delivery inside the finalization transaction, preventing concurrent draft over-delivery.
5. **Post-Finalization Lock**:
   - Once `FINALIZED`, a Challan is permanently immutable. Attempts to edit, cancel, or re-finalize return HTTP 400.
   - Any physical return of material must be processed via Module 12 (Return Management).
6. **Separation of Preparation vs Dispatch Authorization**:
   - Preparing a draft Challan requires `CHALLAN.create`.
   - Triggering finalization and physical stock deduction requires `CHALLAN.approve`.

---

## 6. API Reference & Endpoint Specifications

### Base Path: `/api/challans`

#### 6.1. Create DRAFT Challan
- **Route**: `POST /`
- **Permission**: `CHALLAN.create`
- **Request Body**:
  ```json
  {
    "confirmationId": "6aa908181fa4b2844fea8553",
    "deliveryDetails": "Tata Ace (GJ-05-BX-4321) Driver: Naresh Bhai",
    "remarks": "First phase living room tiles delivery",
    "items": [
      {
        "confirmedItemId": "6aa908181fa4b2844fea8554",
        "quantityToIssue": 25,
        "remarks": "Box condition verified intact"
      }
    ]
  }
  ```
- **Response**: `201 Created` with Challan in `status: DRAFT`.

#### 6.2. List Challans
- **Route**: `GET /`
- **Permission**: `CHALLAN.view`
- **Query Parameters**: `customerId`, `confirmationId`, `quotationId`, `status`, `search`, `from`, `to`, `page`, `limit`.

#### 6.3. Get Challan Details
- **Route**: `GET /:id`
- **Permission**: `CHALLAN.view`
- **Response**: Populated Challan document including customer, confirmation, salesperson, and item details.

#### 6.4. Update DRAFT Challan
- **Route**: `PUT /:id`
- **Permission**: `CHALLAN.edit`
- **Constraint**: Permitted only while `status === 'DRAFT'`.

#### 6.5. Cancel DRAFT Challan
- **Route**: `PUT /:id/cancel`
- **Permission**: `CHALLAN.delete`
- **Constraint**: Permitted only while `status === 'DRAFT'`.

#### 6.6. Finalize Challan (Atomic Dual-Write)
- **Route**: `PUT /:id/finalize`
- **Permission**: `CHALLAN.approve`
- **Action**: Executes dual-write transaction, deducts physical stock, records delivery, and locks Challan.

#### 6.7. Delivery Note Print Data
- **Route**: `GET /:id/print`
- **Permission**: `CHALLAN.view`
- **Response**: Structured delivery note dataset for gate pass generation.

#### 6.8. Export to Excel
- **Route**: `GET /export`
- **Permission**: `CHALLAN.export`
- **Response**: Downloadable `.xlsx` workbook of filtered dispatches.

---

## 7. Forward-Reference Service Contracts

Module 9 exports internal methods consumed by other modules:

```javascript
// Consumed by Module 4: Customer 360° Sales History
challanService.getByCustomer(customerId);

// Consumed by Module 10: Invoice Generation from delivered Challans
challanService.getByConfirmation(confirmationId);
```

---

## 8. Automated Test Suite Verification

Comprehensive test suite executed via `scripts/testRunnerModule9.js`:
- **Total Tests**: 25
- **Passed**: 25
- **Failed**: 0
- **Verification Scenarios**:
  - `CHALLAN` SystemModule registration and RBAC enforcement.
  - Atomic sequence generation (`CH-2026-27-XXXX`).
  - DRAFT creation validation against live pending delivery.
  - Rejection of foreign/invalid `confirmedItemId`.
  - Confirmation that DRAFT Challans have zero stock/delivery impact.
  - DRAFT Challan item editing and cancellation.
  - Finalization atomic dual-write (stock deduction + confirmation delivery record).
  - Strict immutability lock on finalized Challans (edit/cancel/re-finalize rejected).
  - Multi-Challan partial delivery and concurrent race-condition protection.
  - Role-based approval gating for finalization.
  - Delivery note dataset formatting and Excel workbook export.
  - Customer 360° history and downstream invoice generation contracts.
