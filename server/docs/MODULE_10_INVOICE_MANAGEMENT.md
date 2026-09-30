# MODULE 10: INVOICE MANAGEMENT

## 1. Introduction & Purpose
Module 10 implements **Invoice Management** for Maitri Ceramic, digitizing the company's traditional customer tax invoice format and establishing the formal billing layer in the delivery lifecycle:
`Customer → Quotation → Confirmation → Challan → Invoice → Payment → Ledger`

An Invoice is generated from one or more **FINALIZED** delivery Challans (Module 9). It joins the physically dispatched quantities with the pricing snapshots frozen in Quotation Confirmation (Module 7). It serves as the single source of truth for billable monetary obligations prior to payment receipt.

---

## 2. Core Architecture & Design Decisions

```
+-------------------------------------------------------------------------------+
|                             MODULE 10: INVOICES                               |
+-------------------------------------------------------------------------------+
|                                                                               |
|   1. Candidate Discovery: GET /api/invoices/invoiceable-challans              |
|      - Filters: status == 'FINALIZED' && invoiced == false                    |
|                                                                               |
|   2. Invoice Generation: POST /api/invoices                                   |
|      - Cross-customer check: all Challans must belong to the same Customer   |
|      - Pricing Resolution: rates & tax % frozen from Confirmation snapshots   |
|      - Server-Side Calculation: amount, discount, net amount, GST, totals     |
|      - Tax Split Engine: Company State vs Customer State (CGST+SGST vs IGST)  |
|      - Currency Words: Server generates Indian Rupee representation           |
|      - Atomic Sequence: 'INV-YYYY-YY-XXXX' via InvoiceNumberSequence          |
|      - Atomic Flagging: marks all source Challans as invoiced: true           |
|                                                                               |
|   3. Post-Issuance Immutability: PUT /api/invoices/:id                        |
|      - Strictly limits updates to non-monetary header fields                  |
|      - Strips items, rates, quantities, and computed totals                   |
|                                                                               |
|   4. Cancellation & Reopening: PUT /api/invoices/:id/cancel                   |
|      - Blocked if payments exist against the invoice                          |
|      - Soft status: CANCELLED                                                 |
|      - Automatically reopens source Challans (invoiced: false)                |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Key Highlights
1. **First Point of Billing**: While Challans record physical inventory dispatch without pricing, Invoices bind delivered quantities to agreed confirmation pricing snapshots.
2. **Multi-Challan Consolidation**: Allows consolidating deliveries from multiple Challans for the same customer into a single tax invoice, preserving granular item lineage (`sourceChallan` and `sourceChallanItemId`).
3. **State-Based GST Split Engine**: Compares own company state against customer billing/shipping state to automatically calculate either intra-state (50% CGST + 50% SGST) or inter-state (100% IGST) tax breakdowns.
4. **Permanent Immutability**: Financial totals, line item quantities, and tax snapshots cannot be modified via update routes. Invoices must be cancelled and re-issued to rectify billing errors.
5. **Challan Lifecycle Coordination**: Cancellation of an invoice safely reverts the `invoiced` flag on all referenced Challans so they re-enter the invoiceable pool.

---

## 3. Database Schema

### `InvoiceItem` Schema
| Field | Type | Description |
| :--- | :--- | :--- |
| `sourceChallan` | `ObjectId (Ref: Challan)` | Originating delivery Challan |
| `sourceChallanItemId` | `ObjectId` | Reference to item ID inside Challan's items array |
| `product` | `ObjectId (Ref: Product)` | Optional Product Master reference |
| `skuCodeSnapshot` | `String` | Frozen SKU code at issuance time |
| `descriptionSnapshot` | `String` | Frozen product description / name |
| `unit` | `ObjectId (Ref: UnitMaster)` | Measurement unit reference |
| `quantity` | `Number` | Delivered quantity billed |
| `rateSnapshot` | `Number` | Frozen unit price snapshot from Confirmation |
| `discountPct` | `Number` | Discount percentage snapshot |
| `gstPctSnapshot` | `Number` | GST percentage snapshot |
| `amount` | `Number` | Server-computed: `rateSnapshot × quantity` |
| `discountAmount` | `Number` | Server-computed: `amount × (discountPct / 100)` |
| `netAmount` | `Number` | Server-computed: `amount − discountAmount` |
| `gstAmount` | `Number` | Server-computed: `netAmount × (gstPctSnapshot / 100)` |

### `Invoice` Schema
| Field | Type | Description |
| :--- | :--- | :--- |
| `invoiceNumber` | `String (Unique)` | Auto-generated sequential ID (`INV-2026-27-0001`) |
| `invoiceDate` | `Date` | Date of invoice issuance |
| `customer` | `ObjectId (Ref: Customer)` | Customer reference |
| `consigneeShipTo` | `String` | Shipping destination details |
| `buyerBillTo` | `String` | Billing entity details |
| `customerMobile` | `String` | Frozen contact number |
| `customerAddress` | `String` | Frozen address snapshot |
| `customerGstNumber` | `String` | Frozen GSTIN snapshot |
| `referenceNumber` | `String` | Customer PO / Reference number |
| `referenceDate` | `Date` | Customer PO date |
| `buyersOrderNumber` | `String` | Buyer order tracking number |
| `dispatchDocNumber` | `String` | Transport dispatch document number |
| `deliveryNote` | `String` | Delivery note reference |
| `termsOfPayment` | `String` | Agreed payment terms |
| `termsOfDelivery` | `String` | Delivery conditions |
| `sourceChallans` | `[ObjectId (Ref: Challan)]` | List of referenced Challans |
| `sourceConfirmations` | `[ObjectId (Ref: QuotationConfirmation)]` | List of referenced Confirmations |
| `items` | `[InvoiceItem]` | Line items array |
| `subTotal` | `Number` | Server-computed sum of `netAmount` |
| `totalGst` | `Number` | Server-computed sum of `gstAmount` |
| `grandTotal` | `Number` | Server-computed `subTotal + totalGst` |
| `amountInWords` | `String` | Indian numbering words representation |
| `status` | `String (Enum: ['ISSUED', 'CANCELLED'])` | Invoice state |
| `isActive` | `Boolean` | Soft-deletion flag |
| `createdBy` / `updatedBy` | `ObjectId (Ref: User)` | Audit tracking |

---

## 4. API Endpoints

### 4.1 Discovery & Invoice Lifecycle
- **`GET /api/invoices/invoiceable-challans`**
  - **Permission**: `INVOICE:view`
  - **Description**: Returns all `FINALIZED` and un-invoiced Challans. Supports filtering by `customerId`, `confirmationId`, and `search`.
- **`POST /api/invoices`**
  - **Permission**: `INVOICE:create`
  - **Description**: Issues a new tax invoice from one or more finalized Challans, freezes pricing snapshots, computes tax and totals, and marks Challans as invoiced.
- **`GET /api/invoices`**
  - **Permission**: `INVOICE:view`
  - **Description**: Lists invoices with data scope filtering, status, date range, search, and pagination.
- **`GET /api/invoices/:id`**
  - **Permission**: `INVOICE:view`
  - **Description**: Retrieves invoice details with line item breakdown and source Challan lineage.
- **`PUT /api/invoices/:id`**
  - **Permission**: `INVOICE:edit`
  - **Description**: Updates non-monetary header fields (e.g. delivery note, reference numbers). Middleware strips financial and item fields.
- **`PUT /api/invoices/:id/cancel`**
  - **Permission**: `INVOICE:delete`
  - **Description**: Soft cancels invoice (if zero payments exist) and reopens source Challans (`invoiced: false`).
- **`GET /api/invoices/:id/print`**
  - **Permission**: `INVOICE:view`
  - **Description**: Returns render-ready tax invoice dataset with letterhead, CGST/SGST/IGST breakdown, and declaration.
- **`GET /api/invoices/export`**
  - **Permission**: `INVOICE:export`
  - **Description**: Exports filtered invoices list to Excel (`.xlsx`).

---

## 5. Forward-Reference Services
1. **`invoiceService.getFinalAmount(confirmationId)`**: Consumed by Module 7 (`/amount-comparison`) to return actual invoiced sum across all confirmed items.
2. **`invoiceService.getByCustomer(customerId)`**: Consumed by Module 4 (`/history`) to aggregate Customer 360° financial sales history.
3. **`invoiceService.getBalanceDue(invoiceId)`**: Consumed by downstream Module 11 (Payment) and Module 13 (Customer Ledger).

---

## 6. Verification & Test Suite
- Automated test script: `scripts/testRunnerModule10.js`
- Test Results: **45 / 45 Tests Passed (100% Success Rate)**
- Regression Verification: **Module 9 (25/25 Passed)**, **Module 7 (Zero Breaking Changes)**, **Module 4 Customer 360 (Verified)**.
