# MODULE 12: RETURN MANAGEMENT

## 1. Introduction & Purpose
Module 12 implements **Return Management** for Maitri Ceramic, handling both directions of goods movement reversals:
- **Purchase Return**: Material returned by Maitri Ceramic back to a Vendor (Module 2), triggering a **Stock Deduction** in the inventory ledger.
- **Sales Return**: Material returned by a Customer back to Maitri Ceramic (Module 4), triggering a **Stock Addition** in the inventory ledger.

This module serves as the formal, append-only correction mechanism for immutable delivery and billing documents. It maintains complete lineage back to Invoices (Module 10) and Challans (Module 9) without mutating historical records.

---

## 2. Core Architecture & Design Decisions

```
+-------------------------------------------------------------------------------+
|                             MODULE 12: RETURNS                                |
+-------------------------------------------------------------------------------+
|                                                                               |
|   1. Purchase Return: POST /api/returns/purchase-return                        |
|      - Reference to Vendor & optional Purchase Reference Note                 |
|      - Created as 'DRAFT' -> ZERO stock impact                                |
|                                                                               |
|   2. Sales Return: POST /api/returns/sales-return                              |
|      - Reference to Customer & optional Invoice / Challan                     |
|      - Created as 'DRAFT' -> ZERO stock impact                                |
|                                                                               |
|   3. Confirmation (Stock Impact Trigger): PUT /api/returns/:id/confirm        |
|      - Gated by 'RETURN_NOTE:approve'                                         |
|      - PURCHASE_RETURN -> calls stockService.deductStock(reason:PURCHASE_RET) |
|      - SALES_RETURN    -> calls stockService.addStock(reason:SALES_RETURN)    |
|      - Creates immutable StockLedgerEntry referencing RETURN_NOTE             |
|      - Status transitions from 'DRAFT' to 'CONFIRMED'                         |
|                                                                               |
|   4. Post-Confirmation Immutability Lock: PUT /api/returns/:id                |
|      - Strips quantity and product updates once status is 'CONFIRMED'         |
|      - Only non-stock metadata (returnReason, remarks) can be edited          |
|      - Cancellation is strictly blocked post-confirmation                     |
|                                                                               |
|   5. Upstream Immutability Preservation:                                      |
|      - Referenced Invoice and Challan remain byte-for-byte unchanged          |
|      - Net credit balance computed dynamically via getSalesReturnAmount()     |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Key Highlights
1. **Append-Only Inventory Ledger**: All physical stock changes post directly into Module 8's `StockLedgerEntry` with dedicated audit reasons (`PURCHASE_RETURN` and `SALES_RETURN`).
2. **Draft-Then-Confirm Pattern**: Return notes are drafted without altering stock balances until confirmed by an authorized user (`RETURN_NOTE:approve`), mirroring the create-then-finalize pattern of Challans.
3. **Immutability of Originating Documents**: Confirming a Sales Return does not mutate the referenced Invoice (`grandTotal`, `items`, `status`) or Challan, preserving their historical accuracy.
4. **Flexible Lineage Validation**: Sales Returns can reference an Invoice, a Challan, both, or neither (for undocumented returns), while strictly rejecting dangling or cross-customer IDs.
5. **Downstream Integration**:
   - `returnService.getByCustomer(customerId)`: Surfaces return history inside Customer 360° View (Module 4).
   - `returnService.getSalesReturnAmount(invoiceId)`: Computes exact monetary credit values for Module 13 Ledger credit-note entries.

---

## 3. Database Schema

### `ReturnNote` Schema (`models/ReturnNote.js`)
| Field | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `returnNoteNumber` | `String` | Required, Unique | Auto-generated sequential identifier (`RTN-YYYY-YY-XXXX`) |
| `returnType` | `String` | Enum: `['PURCHASE_RETURN', 'SALES_RETURN']` | Type of return transaction |
| `returnDate` | `Date` | Default: `Date.now` | Date goods were returned |
| `vendor` | `ObjectId (Ref: Vendor)` | Default: `null` | Target vendor for Purchase Return |
| `purchaseReferenceNote` | `String` | Default: `null` | Free-text purchase order / vendor invoice reference |
| `customer` | `ObjectId (Ref: Customer)` | Default: `null` | Originating customer for Sales Return |
| `invoice` | `ObjectId (Ref: Invoice)` | Default: `null` | Optional reference to originating tax invoice |
| `challan` | `ObjectId (Ref: Challan)` | Default: `null` | Optional reference to originating delivery challan |
| `product` | `ObjectId (Ref: Product)` | Required, Indexed | Master product returned |
| `skuCodeSnapshot` | `String` | Default: `null` | SKU code snapshot at return creation |
| `productNameSnapshot` | `String` | Required | Product name snapshot at return creation |
| `quantity` | `Number (min: 0.0001)` | Required | Quantity of material returned |
| `unit` | `ObjectId (Ref: UnitMaster)` | Required | Unit of measurement |
| `returnReason` | `String` | Required | Business reason for return |
| `remarks` | `String` | Default: `null` | Additional notes or comments |
| `returnStatus` | `String` | Enum: `['DRAFT', 'CONFIRMED', 'CANCELLED']`, Default: `DRAFT` | Lifecycle state |
| `confirmedAt` | `Date` | Default: `null` | Timestamp when stock impact was posted |
| `confirmedBy` | `ObjectId (Ref: User)` | Default: `null` | User who authorized confirmation |
| `isActive` | `Boolean` | Default: `true` | Soft-deletion flag |
| `createdBy` | `ObjectId (Ref: User)` | Required | User who drafted the return note |
| `updatedBy` | `ObjectId (Ref: User)` | Default: `null` | User who last modified the record |

### `ReturnNoteNumberSequence` Schema (`models/ReturnNoteNumberSequence.js`)
| Field | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `financialYear` | `String` | Required, Unique | Format: `YYYY-YY` (e.g. `2026-27`) |
| `lastNumber` | `Number` | Default: `0` | Atomic sequential counter |

---

## 4. API Contract

### Return Note Operations
- `POST /api/returns/purchase-return` — Log Purchase Return in DRAFT status (`RETURN_NOTE:create`)
- `POST /api/returns/sales-return` — Log Sales Return in DRAFT status (`RETURN_NOTE:create`)
- `GET /api/returns` — List returns with filtering by type, customer, vendor, invoice, challan, status, date range (`RETURN_NOTE:view`, DataScope applied)
- `GET /api/returns/:id` — Get single return note with populated details (`RETURN_NOTE:view`)
- `PUT /api/returns/:id` — Update non-stock metadata (remarks, return reason) (`RETURN_NOTE:edit`)
- `PUT /api/returns/:id/cancel` — Cancel return note while still in DRAFT status (`RETURN_NOTE:delete`)
- `PUT /api/returns/:id/confirm` — Confirm return and post stock movement (`RETURN_NOTE:approve`)
- `GET /api/returns/export` — Export return notes to Excel (.xlsx) (`RETURN_NOTE:export`)

### Forward-Reference Services
- `returnService.getByCustomer(customerId)` — Returns active sales returns for Customer 360° history.
- `returnService.getSalesReturnAmount(invoiceId)` — Sums $\sum(\text{quantity} \times \text{effectiveRate} + \text{GST})$ across confirmed sales returns for Module 13 Ledger credit computation.

---

## 5. Business Rules & Validation Suite

1. **Auto-Numbering**: Single unified sequence (`RTN-YYYY-YY-XXXX`) shared across both Purchase and Sales returns with zero collision under concurrent creation.
2. **Draft State Isolation**: DRAFT return notes produce zero inventory cache adjustments and zero `StockLedgerEntry` records.
3. **Approval Gated Confirmation**: Stock adjustments require `RETURN_NOTE:approve` permission.
4. **Stock Movement Execution**:
   - Purchase Return calls `stockService.deductStock()` with reason `PURCHASE_RETURN`.
   - Sales Return calls `stockService.addStock()` with reason `SALES_RETURN`.
5. **Negative Stock Guard**: Purchase Returns are subject to stock availability checks; attempts to deduct more than available physical stock are rejected (HTTP 400).
6. **Post-Confirmation Immutability**: Once confirmed, `product` and `quantity` fields cannot be altered. Re-confirmation and cancellation of confirmed returns are prohibited.
7. **Document Immutability**: Invoices and Challans referenced in Sales Returns are never modified.
8. **Reference Validation**: If `invoiceId` or `challanId` is provided, it must belong to the same `customerId`.

---

## 6. Verification & Automated Test Results

The module was verified using an end-to-end automated test runner (`scripts/testRunnerModule12.js`) covering 13 test suites and 43 test assertions against MongoDB Atlas:

- **Suite 1**: Atomic sequential return note number generation (`RTN-2026-27-0018` $\rightarrow$ `0019`).
- **Suite 2**: Upstream artifact preparation (Challan and Invoice creation).
- **Suite 3**: DRAFT Purchase Return creation with verified zero stock impact.
- **Suite 4**: DRAFT Sales Return creation with verified zero stock impact and lineage.
- **Suite 5**: Business rules (non-existent reference rejection, cross-customer rejection, optional reference support, vendor requirement).
- **Suite 6**: Purchase Return confirmation (stock deducted from 100 $\rightarrow$ 85, `StockLedgerEntry` verified with direction `OUT` and reason `PURCHASE_RETURN`).
- **Suite 7**: Negative stock protection on Purchase Return (50 stock available, 100 return attempted $\rightarrow$ rejected with HTTP 400).
- **Suite 8**: Sales Return confirmation (stock added from 85 $\rightarrow$ 90, `StockLedgerEntry` verified with direction `IN` and reason `SALES_RETURN`).
- **Suite 9**: Upstream immutability (referenced Invoice and Challan remain byte-for-byte unchanged).
- **Suite 10**: Post-confirmation immutability lock (tampered quantity stripped, cancellation blocked, re-confirmation blocked).
- **Suite 11**: DRAFT cancellation (`status: CANCELLED`, confirmation blocked).
- **Suite 12**: Downstream forward references (Customer 360° history aggregation and credit calculation $\text{₹2,950}$).
- **Suite 13**: Excel binary export generation and RBAC permission checks (`view`, `create`, `edit`, `delete`, `approve`, `export`).

**Result**: 43/43 Tests Passed (100% Success). Module 11 regression (41/41) and Module 8 regression (21/21) also passed with 100% success.
