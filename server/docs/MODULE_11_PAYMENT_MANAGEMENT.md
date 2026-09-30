# MODULE 11: PAYMENT MANAGEMENT

## 1. Introduction & Purpose
Module 11 implements **Payment Management** for Maitri Ceramic, recording money collected from customers against issued Invoices (Module 10) and generating printable/shareable Payment Receipts.

Per the client's explicit business formula:
$$\text{Invoice Amount} - \text{Payment Received} = \text{Outstanding Amount / Balance Due}$$

Payment is an **append-only ledger** against issued Invoices. It fulfills Module 10's `paymentService.hasPayments()` cancellation gate and Module 7's `paymentService.getReceivedAmount()` forward reference stub.

---

## 2. Core Architecture & Design Decisions

```
+-------------------------------------------------------------------------------+
|                             MODULE 11: PAYMENTS                               |
+-------------------------------------------------------------------------------+
|                                                                               |
|   1. Payment Collection & Allocation: POST /api/payments                      |
|      - Single Payment can allocate across multiple Invoices                   |
|      - Validation: Sum of allocations must exactly equal totalAmount          |
|      - Validation: All invoices must belong to the same Customer              |
|      - Validation: All invoices must have status 'ISSUED' (not CANCELLED)     |
|      - Concurrency Guard: Allocated amount <= live balanceDue at write time   |
|      - Auto-numbering: 'RCPT-YYYY-YY-XXXX' via PaymentReceiptNumberSequence   |
|      - Generates Payment document with entryType: 'PAYMENT'                   |
|                                                                               |
|   2. Live Balance Due Engine: GET /api/invoices/:id/balance-due               |
|      - Never stored as a stale field on Invoice or Customer                   |
|      - Live computation: Invoice.grandTotal - Net Payments against Invoice    |
|      - Net Payments = sum(PAYMENT allocations) - sum(REVERSAL allocations)    |
|                                                                               |
|   3. Append-Only Immutability: PUT /api/payments/:id                          |
|      - Strictly limits updates to non-monetary metadata (remarks, ref no)     |
|      - Strips totalAmount, allocations, and financial fields                  |
|                                                                               |
|   4. Reversal Ledger Flow: POST /api/payments/:id/reverse                     |
|      - Double Permission Gate: requires PAYMENT.delete AND PAYMENT.approve    |
|      - Requires mandatory reversal reason                                     |
|      - Creates a NEW offsetting Payment (entryType: 'REVERSAL')               |
|      - Original Payment remains untouched (immutable ledger audit trail)      |
|      - Reopens Invoice Balance Due back to pre-payment state                  |
|                                                                               |
|   5. Customer 360° Outstanding: GET /api/payments/customer/:id/outstanding    |
|      - Aggregates totalInvoiced, totalPaid, totalOutstanding across customer  |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Key Highlights
1. **Append-Only Ledger Discipline**: Financial entries are never mutated or hard-deleted. Corrections are executed exclusively through reversing entries (`entryType: 'REVERSAL'`).
2. **Live Balance Due Join**: `balanceDue` is always computed dynamically on query, preventing stale balance discrepancies and race-condition sync bugs.
3. **Multi-Invoice Splitting**: A customer paying a lump sum (e.g. ₹50,000) can allocate portions across multiple outstanding invoices in a single transaction.
4. **Double Permission Gating**: Undoing financial transactions via reversal requires both `delete` and `approve` permissions on the `PAYMENT` module.
5. **Cross-Module Forward Fulfillment**: Powers real-time financial tracking across Quotation Confirmation (Module 7), Invoices (Module 10), Customer History (Module 4), and Customer Ledger (Module 13).

---

## 3. Database Schema

### `PaymentAllocation` Schema
| Field | Type | Description |
| :--- | :--- | :--- |
| `invoice` | `ObjectId (Ref: Invoice)` | Target issued invoice |
| `invoiceNumberSnapshot` | `String` | Invoice number snapshot at time of payment |
| `allocatedAmount` | `Number (min: 0.01)` | Portion of payment allocated to this invoice |

### `Payment` Schema (`models/Payment.js`)
| Field | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `receiptNumber` | `String` | Required, Unique | Auto-generated sequential receipt number (`RCPT-YYYY-YY-XXXX`) |
| `paymentDate` | `Date` | Default: `Date.now` | Date payment was received |
| `customer` | `ObjectId (Ref: Customer)` | Required, Indexed | Customer making the payment |
| `paymentMode` | `ObjectId (Ref: PaymentModeMaster)` | Required | Mode of payment (Cash, Bank Transfer, UPI, Cheque) |
| `totalAmount` | `Number (min: 0.01)` | Required | Total amount received; must equal sum of allocations |
| `allocations` | `[PaymentAllocation]` | Required | Array of invoice allocation lines |
| `referenceNumber` | `String` | Default: `null` | Cheque number / UPI transaction ID / Bank reference |
| `bankCashAccount` | `String` | Default: `null` | Free-text account or branch label |
| `remarks` | `String` | Default: `null` | Payment remarks / notes |
| `entryType` | `String` | Enum: `['PAYMENT', 'REVERSAL']` | Entry type in ledger |
| `reversalOf` | `ObjectId (Ref: Payment)` | Default: `null` | Original payment ID if entry is a reversal |
| `isActive` | `Boolean` | Default: `true` | Soft active indicator |
| `createdBy` | `ObjectId (Ref: User)` | Required | User who recorded the transaction |
| `updatedBy` | `ObjectId (Ref: User)` | Default: `null` | User who last updated metadata |

### `PaymentReceiptNumberSequence` Schema (`models/PaymentReceiptNumberSequence.js`)
| Field | Type | Constraints / Default | Description |
| :--- | :--- | :--- | :--- |
| `financialYear` | `String` | Required, Unique | Format: `YYYY-YY` (e.g. `2026-27`) |
| `lastNumber` | `Number` | Default: `0` | Atomic counter for receipt generation |

---

## 4. API Contract

### Payment Recording & Management
- `POST /api/payments` — Record payment with allocations across invoices (`PAYMENT:create`)
- `GET /api/payments` — List payments with filtering by customer, invoice, mode, date range, entryType (`PAYMENT:view`, DataScope applied)
- `GET /api/payments/:id` — Get single payment detail (`PAYMENT:view`)
- `PUT /api/payments/:id` — Update non-monetary metadata (remarks, ref no) (`PAYMENT:edit`)
- `POST /api/payments/:id/reverse` — Reverse payment via offsetting entry (`PAYMENT:delete` AND `PAYMENT:approve`)

### Receipts & Outstanding Reporting
- `GET /api/payments/:id/receipt` — Render-ready receipt with letterhead, allocations, and amount in words (`PAYMENT:view`)
- `GET /api/payments/invoice/:id/balance-due` — Live invoice balance due (`PAYMENT:view`)
- `GET /api/invoices/:id/balance-due` — Live invoice balance due on Invoice route (`INVOICE:view` / `PAYMENT:view`)
- `GET /api/payments/customer/:customerId/outstanding` — Aggregated customer-level balance summary (`PAYMENT:view`)
- `GET /api/payments/export` — Export payments to Excel (`PAYMENT:export`)

### Internal Service Methods
- `paymentService.getBalanceDue(invoiceId)` — Returns `{ grandTotal, paymentReceived, balanceDue }`
- `paymentService.hasPayments(invoiceId)` — Returns boolean; blocks cancelling paid invoices
- `paymentService.getReceivedAmount(confirmationId)` — Aggregates live payments across confirmation invoices
- `paymentService.getByCustomer(customerId)` — Returns customer payment history for 360° view

---

## 5. Business Rules & Validation Suite

1. **Receipt Numbering**: Auto-generated as `RCPT-YYYY-YY-XXXX` via atomic increment on `PaymentReceiptNumberSequence`.
2. **Allocation Exact Match**: `totalAmount` must equal the exact sum of all line item `allocatedAmount` entries.
3. **Over-Allocation Prevention**: `allocatedAmount` for an invoice cannot exceed that invoice's live `balanceDue` at write time.
4. **Customer Consistency**: All allocated invoices in a single payment request must belong to the specified `customerId`.
5. **Invoice Status**: Payments can only be recorded against invoices with status `ISSUED` (not `CANCELLED`).
6. **Immutability of Financials**: Update endpoints strip monetary fields (`totalAmount`, `allocations`, `entryType`, `receiptNumber`).
7. **Reversal Auditability**: Reversals create a new document referencing the original; original records are never mutated or deleted.
8. **Double RBAC Gating**: Payment reversal requires both `delete` and `approve` actions on the `PAYMENT` module.
9. **Invoice Cancellation Lock**: Module 10 blocks cancelling any invoice that has active (non-reversed) payment allocations.

---

## 6. Verification & Automated Test Results

The module was verified using an end-to-end automated test runner (`scripts/testRunnerModule11.js`) covering 14 test suites and 41 test assertions against MongoDB Atlas:

- **Suite 1**: Atomic sequential receipt number generation (`RCPT-2026-27-0001` -> `0002`).
- **Suite 2**: Upstream invoice creation (₹1,00,000 and ₹50,000).
- **Suite 3**: Zero-payments live balance due calculation.
- **Suite 4**: Single invoice payment recording (₹70,000 paid against ₹1,00,000; live balance = ₹30,000).
- **Suite 5**: Module 10 invoice cancellation gate protection.
- **Suite 6**: Over-allocation, allocation mismatch, and cross-customer validation engines.
- **Suite 7**: Multi-invoice payment allocation (₹30,000 to Inv 1 + ₹20,000 to Inv 2).
- **Suite 8**: Customer-level outstanding aggregation.
- **Suite 9**: Post-recording immutability enforcement on `PUT /api/payments/:id`.
- **Suite 10**: Payment receipt generation with Indian Rupee amount in words.
- **Suite 11**: Reversal ledger flow and double-gate RBAC verification (`delete` + `approve`).
- **Suite 12**: Downstream forward-reference integration with Module 7 and Module 4.
- **Suite 13**: Excel export validation (binary workbook generation).
- **Suite 14**: Granular RBAC permission checks (`view`, `create`, `edit`, `delete`, `approve`, `export`, `dataScope`).

**Result**: 41/41 Tests Passed (100% Success). Module 10 regression suite also passed 45/45 tests.
