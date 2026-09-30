# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 8: STOCK MANAGEMENT & INVENTORY LEDGER ENGINE
### Complete Technical Documentation, Architecture, 3-Tier Stock Model, Ledger Immutability & API Reference

---

## 1. Executive Summary & Purpose

Module 8 builds **Stock Management** — the central, authoritative inventory subsystem that owns the **APPEND-ONLY, IMMUTABLE STOCK LEDGER** for every product in Maitri Ceramic's ERP.

This module resolves the client's critical inventory tracking and procurement requirements:
1. > *"Actual Stock, Management Stock, Available Stock — clear identification of physical stock vs committed customer stock."*
2. > *"Stock Ledger is the truth, Product.currentStock is a cache."*
3. > *"Complete auditability: Date, SKU, Product, Transaction, Quantity, Running Balance."*
4. > *"Advance warning on stock shortfalls to fulfill pending confirmed quotations before dispatch."*

### Core Principles & Mathematical Formulas

1. **Actual Stock (Physical Warehouse Stock)**:
   - Represents the physical units present on the warehouse floor.
   - Mathematically equals the sum of all immutable ledger movements:
     $$\text{Actual Stock} = \text{Opening Stock} + \sum \text{Stock In} - \sum \text{Stock Out (Challans / Deductions)}$$
   - Denormalized onto Module 2's `Product.currentStock` as a read-cache for fast lookups.
   
2. **Management Stock (Committed Customer Stock)**:
   - Represents total product units legally committed across all active confirmed quotations, but not yet physically delivered to job sites.
   - Computed **LIVE** in real-time from Module 7's confirmed pending deliveries (`confirmationService.getConfirmedPendingDelivery(productId)`):
     $$\text{Management Stock} = \sum_{\text{Active Confirmations}} (\text{Confirmed Qty} + \text{Extra Qty} - \text{Delivered Qty})$$
   - **Never statically stored or cached** on the Product schema to prevent stale allocation drift.

3. **Available Stock (Free to Promise)**:
   - Represents true uncommitted physical stock available for new customer quotations or walk-in orders:
     $$\text{Available Stock} = \text{Actual Stock} - \text{Management Stock}$$
   - When $\text{Available Stock} < 0$, a critical purchase shortfall alert is triggered.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│                 (authenticate + checkPermission('STOCK'))              │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       MODULE 8: STOCK MANAGEMENT                       │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Immutable StockLedgerEntry   │    │ 3-Tier Stock Calculator      │  │
│  │ (Append-Only Transaction Log)│    │ (Actual, Management, Avail)  │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Low-Stock & Reorder Alerts   │    │ Purchase Shortfall Engine    │  │
│  │ (currentStock <= reorderQty) │    │ (Avail Stock < 0 Shortfall)  │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │ (updates currentStock cache)│ (reads pending commitments)│ (deducts stock upon issue)
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    MODULE 2:     │       │    MODULE 7:     │       │    MODULE 9:     │
│  PRODUCT MASTER  │       │    QUOTATION     │       │     CHALLAN      │
│  (currentStock)  │       │   CONFIRMATION   │       │    MANAGEMENT    │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 3. Database Architecture & Schema Design

### 3.1. `StockLedgerEntry` Collection (`models/StockLedgerEntry.js`)
*Append-only, write-once immutable transaction ledger. Updates and deletions are forbidden.*

| Field | Type | Description |
| :--- | :--- | :--- |
| `product` | `ObjectId (ref: Product)` | Target product reference (Indexed, Required). |
| `skuCodeSnapshot` | `String` | Historical snapshot of `companySkuCode` at write time. |
| `entryNumber` | `String` | Unique sequential identifier (`SE-2026-27-0001`, collision-proof). |
| `entryDate` | `Date` | Date of physical movement (Default: `Date.now`). |
| `direction` | `String (Enum: ['IN', 'OUT'])` | Movement direction. |
| `quantity` | `Number` | Positive movement quantity ($\ge 0.0001$). |
| `reason` | `String (Enum)` | Transaction reason: `OPENING_STOCK`, `PURCHASE_ENTRY`, `MANUAL_ADDITION`, `MANUAL_DEDUCTION`, `CHALLAN_ISSUE`, `PURCHASE_RETURN`, `SALES_RETURN`, `OTHER`. |
| `referenceDocType` | `String (Enum: ['CHALLAN', 'RETURN_NOTE', 'MANUAL', null])` | Source document classification. |
| `referenceDocId` | `ObjectId` | Reference document ID (Challan ID, Return Note ID). |
| `referenceDocNote` | `String` | Human-readable document string (e.g., PO #, Invoice #). |
| `balanceAfter` | `Number` | **Running Actual Stock immediately following this movement.** |
| `remarks` | `String` | Operational notes or audit comments. |
| `postedBy` | `ObjectId (ref: User)` | User who authorized and posted the movement. |

### 3.2. `StockEntryNumberSequence` Collection (`models/StockEntryNumberSequence.js`)
*Atomic sequence counter per financial year for collision-proof entry number generation.*
- Pattern: `SE-YYYY-YY-XXXX` (e.g. `SE-2026-27-0001`).

---

## 4. Business Rules & Validation Logic

1. **Strict Immutability**:
   - `StockLedgerEntry` documents can never be modified or deleted via any HTTP endpoint.
   - Any correction requires an offsetting entry (e.g., an `OTHER`-reason IN entry to reverse a mistaken OUT entry).
2. **Atomic Product Cache Synchronization**:
   - Every ledger entry creation synchronously adjusts `Product.currentStock` via `productService.adjustStock(productId, delta)`.
   - If either write fails, the entire transaction is rolled back.
3. **Negative Balance Protection**:
   - Stock-Out operations are rejected by default if the resulting balance would drop below zero.
   - In documented emergency situations, `allowNegative: true` can be explicitly passed and is logged with an audit flag.
4. **Conditional Approval Gate for `MANUAL_DEDUCTION`**:
   - Standard stock removals (`OTHER`) require `STOCK.delete`.
   - Sensitive manual adjustments (`MANUAL_DEDUCTION`) strictly require `STOCK.approve` permission.
5. **Mandatory Automated Attribution**:
   - Forward-reference automated movements (`CHALLAN_ISSUE`, `PURCHASE_RETURN`, `SALES_RETURN`) must supply `referenceDocType` and `referenceDocId` to prevent orphaned entries.

---

## 5. API Reference & Endpoint Specifications

### Base Path: `/api/stock`

#### 5.1. Manual Stock In
- **Route**: `POST /entries/in`
- **Permission**: `STOCK.create`
- **Request Body**:
  ```json
  {
    "productId": "6aa7cb21dae060d5e389ffea",
    "quantity": 100,
    "reason": "OPENING_STOCK",
    "referenceDocNote": "Warehouse opening verification",
    "remarks": "Verified by inventory head"
  }
  ```
- **Response**: `201 Created` with updated `balanceAfter` and entry details.

#### 5.2. Manual Stock Out
- **Route**: `POST /entries/out`
- **Permission**: `STOCK.delete` *(+ `STOCK.approve` if reason is `MANUAL_DEDUCTION`)*
- **Request Body**:
  ```json
  {
    "productId": "6aa7cb21dae060d5e389ffea",
    "quantity": 10,
    "reason": "MANUAL_DEDUCTION",
    "remarks": "Broken box during transport",
    "allowNegative": false
  }
  ```
- **Response**: `201 Created` with updated `balanceAfter`.

#### 5.3. Stock Entries List & Filtering
- **Route**: `GET /entries`
- **Permission**: `STOCK.view`
- **Query Parameters**: `productId`, `reason`, `direction`, `from`, `to`, `page`, `limit`.

#### 5.4. Product Stock Summary (3-Tier Figures)
- **Route**: `GET /:productId/summary`
- **Permission**: `STOCK.view`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "productId": "6aa7cb21dae060d5e389ffea",
      "productName": "Maitri Onyx Marble 600x1200",
      "skuCode": "MOM-6012-01",
      "unit": "BOX",
      "actualStock": 120,
      "managementStock": 20,
      "availableStock": 100,
      "reorderAlertQty": 10,
      "isLowStock": false,
      "purchaseRequired": false,
      "shortfallQuantity": 0
    }
  }
  ```

#### 5.5. Product Movement History (Chronological Ledger)
- **Route**: `GET /:productId/movement-history`
- **Permission**: `STOCK.view`
- **Response**: Chronological transaction rows matching the client's documented audit table (`Date`, `SKU`, `Product`, `Transaction`, `Qty`, `Balance`).

#### 5.6. Low Stock Report
- **Route**: `GET /low-stock-report`
- **Permission**: `STOCK.view`
- **Criteria**: Returns all products where `currentStock <= reorderAlertQty`.

#### 5.7. Purchase Alerts Engine
- **Route**: `GET /purchase-alerts`
- **Permission**: `STOCK.view`
- **Criteria**: Evaluates products where `Available Stock < 0` to suggest exact procurement quantities.

#### 5.8. Stock Cache Reconciliation Utility (Admin Safety Net)
- **Route**: `POST /:productId/reconcile`
- **Permission**: `STOCK.approve`
- **Action**: Sums all immutable ledger entries from scratch, fixes cache drift on `Product.currentStock`, and returns drift audit metrics.

#### 5.9. Excel Export
- **Route**: `GET /export?reportType=movement|low-stock|purchase-alert`
- **Permission**: `STOCK.export`
- **Response**: Downloadable `.xlsx` spreadsheet buffer.

---

## 6. Forward-Reference Service Contracts

Module 8 exports internal services consumed by downstream modules:

```javascript
// Consumed by Module 9 (Challan Finalization) & Module 12 (Purchase Returns)
stockService.deductStock(productId, quantity, reason, referenceDocType, referenceDocId, options);

// Consumed by Module 12 (Sales Returns) & Module 8 internal flows
stockService.addStock(productId, quantity, reason, referenceDocType, referenceDocId, options);

// Consumed by Module 14 (Product Tracking) & Module 15 (Reports)
stockService.getActualStock(productId);
stockService.getManagementStock(productId);
stockService.getAvailableStock(productId);
```

---

## 7. Automated Test Suite Verification

Comprehensive test runner executed via `scripts/testRunnerModule8.js`:
- **Total Tests**: 21
- **Passed**: 21
- **Failed**: 0
- **Coverage**:
  - `STOCK` SystemModule registration & RBAC enforcement.
  - Collision-proof `StockEntryNumberSequence` generation.
  - Atomic stock-in with product cache update.
  - Live Management Stock calculation via Module 7.
  - Available Stock computation ($150 - 50 = 100$).
  - Challan deduction forward-reference integration ($120$ balance).
  - Negative balance rejection & override mechanism.
  - `MANUAL_DEDUCTION` approval gate.
  - Movement history chronology and balance verification.
  - Low stock & Purchase shortfall alert calculation.
  - Cache drift reconciliation utility.
  - Excel workbook export.
