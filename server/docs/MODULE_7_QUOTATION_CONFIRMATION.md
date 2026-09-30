# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 7: QUOTATION CONFIRMATION & MATERIAL REQUIREMENT ENGINE
### Complete Technical Documentation, Architecture, 4-Stage Quantity Ledger, Amount Comparison & API Reference

---

## 1. Executive Summary & Purpose

Module 7 builds **Quotation Confirmation** — the commercial and inventory-commitment bridge that transforms a customer-approved Quotation (Module 5) into an immutable, concrete **MATERIAL REQUIREMENT**.

This module directly addresses the client's explicitly flagged business pain points:
1. > *"Saman lyi jay jaruriyat purto" (Material should be arranged and reserved strictly per actual customer requirement).*
2. > *"Extra saman pn lyi jay" (Additional/extra material beyond the original quotation can also be taken).*
3. > *"Didn't track the quotation amount and actual amount come" (Need exact tracking of Original Quoted Amount vs Confirmed Amount vs Additional Material vs Final Invoice Amount).*

### Core Capabilities
1. **Separate Ledger Architecture**: Quotation Confirmation is an independent document (`QuotationConfirmation`), not an in-place mutation of `Quotation.items`. The original quotation remains frozen as historical evidence of what was quoted, while Confirmation records what was actually agreed.
2. **4-Stage Quantity Ledger (Quoted &rarr; Confirmed &rarr; Extra &rarr; Issued)**:
   - **Quoted Quantity**: Immutable reference to the original Quotation line item.
   - **Confirmed Quantity**: Quantity confirmed by the customer (can be less than, equal to, or 0 if dropped).
   - **Extra Quantity**: Additional quantity of the same item beyond what was originally quoted.
   - **Delivered / Issued Quantity**: Quantity physically dispatched via Module 9 (Challan), write-protected against direct manual manipulation.
   - **Pending Delivery**: Server-calculated balance: `(Confirmed Qty + Extra Qty) - Delivered Qty`.
3. **Extra / Additional Product Support**: Supports adding catalog products (`productId`) or ad-hoc fabricated accessories (`adHocName`, `adHocMrp`) not present on the original quotation (`isExtraProduct: true`, `quotedQuantity: 0`).
4. **Quotation Amount vs Actual Amount Comparison Engine**: Real-time breakdown calculating `originalQuotationAmount`, `confirmedAmount`, `extraProductAmount`, `differenceAmount` (negotiation/drop impact), `totalActualAmount`, and forward stubs for `finalInvoiceAmount`, `paymentReceived`, and `outstandingAmount`.
5. **Manager Approval Gate (`pendingApproval`)**: Create-only sales users can draft confirmations, which sit in `pendingApproval: true` without flipping Quotation status until a manager holding `approve` permission executes `/approve`.
6. **Delivery-Lock Integrity Enforcement**: Pre-delivery modifications and cancellations are allowed. Once any delivery begins (`deliveredQuantity > 0`), confirmation items and quantities are strictly locked to preserve Challan and Billing integrity.
7. **Downstream Supply Engines**:
   - Supplies Module 8 (Stock Management) with committed-but-undelivered quantities for "Management Stock" calculations.
   - Provides Module 9 (Challan Management) with the canonical line items to issue deliveries against.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│         (authenticate + checkPermission('QUOTATION_CONFIRMATION'))     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   MODULE 7: QUOTATION CONFIRMATION                     │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ 4-Stage Quantity Ledger      │    │ Quotation vs Actual Amounts  │  │
│  │ (Quoted->Confirmed->Extra->Dl│    │ (Original vs Realized Total) │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Extra / Added Products       │    │ Delivery Lock Pre-Delivery   │  │
│  │ (Catalog & Ad-Hoc Items)     │    │ (Protects Live Challans)     │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │ (reads items/updates status)│ (feeds management stock)  │ (issues material)
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    MODULE 5:     │       │    MODULE 8:     │       │    MODULE 9:     │
│    QUOTATION     │       │      STOCK       │       │     CHALLAN      │
│    MANAGEMENT    │       │    MANAGEMENT    │       │    MANAGEMENT    │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 3. The 4-Stage Quantity Ledger Model

```
 1. QUOTED QTY (Module 5)
    Original quotation quantity (Frozen reference, e.g. 10 Boxes)
             │
             ▼
 2. CONFIRMED QTY (Module 7)
    Customer agrees to take 10 Boxes (or drops to 8, or declines with 0)
             │
             ├──────────────────────────────────────────────┐
             ▼                                              ▼
 3. EXTRA QTY (Module 7)                            EXTRA PRODUCTS (Module 7)
    Customer adds 2 extra boxes of same item       Adds 4 boxes of Tile Spacers
    Total Committed = 10 + 2 = 12 Boxes             Quoted = 0, Confirmed = 4
             │                                              │
             └──────────────────────┬───────────────────────┘
                                    ▼
 4. ACTUAL ISSUED / DELIVERED QTY (Module 9 Challan)
    Incremented as physical deliveries leave the warehouse
    Pending Delivery = (Confirmed Qty + Extra Qty) - Delivered Qty
```

---

## 4. Confirmation Status Determination & Approval Gate

1. **`confirmationStatus` Determination**:
   - **`FULLY_CONFIRMED`**: Every original line item from Module 5's Quotation is confirmed with `confirmedQuantity === originalItem.quantity` (no items dropped or reduced).
   - **`PARTIALLY_CONFIRMED`**: At least one original item's `confirmedQuantity` differs from its quoted quantity (e.g. reduced quantity or 0 for dropped items), or extra items were added.
2. **Approval Gate (`pendingApproval`)**:
   - **Self-Service Mode (User holds `create` + `approve`)**: Confirmation created &rarr; `pendingApproval: false` &rarr; `Quotation.status` atomically updates to `CONFIRMED` or `PARTIALLY_CONFIRMED`.
   - **Two-Step Approval Mode (User holds `create` only)**: Confirmation created &rarr; `pendingApproval: true` &rarr; `Quotation.status` remains in follow-up stage (`CUSTOMER_INTERESTED`) &rarr; Manager calls `PUT /api/confirmations/:id/approve` &rarr; `Quotation.status` transitions.

---

## 5. Quotation Amount vs Actual Amount Tracking Engine

The financial engine computes the exact commercial comparison requested by the client:

$$\text{Difference Amount} = \text{Original Quotation Amount} - \text{Confirmed Amount}$$

$$\text{Total Actual Amount} = \text{Confirmed Amount} + \text{Extra Product Amount}$$

| Financial Metric | Source / Formula | Description |
| :--- | :--- | :--- |
| **Original Quotation Amount** | `quotation.grandTotal` | Frozen total of the quotation at confirmation time. |
| **Confirmed Amount** | $\sum(\text{Original Confirmed Lines})$ | Realized value from originally quoted items. |
| **Extra Product Amount** | $\sum(\text{Extra Product Lines})$ | Additional revenue from newly added items/accessories. |
| **Difference Amount** | $\text{Original} - \text{Confirmed}$ | Financial impact of dropped items or customer reductions. |
| **Total Actual Amount** | $\text{Confirmed} + \text{Extra}$ | The true commercial value of confirmed materials. |
| **Final Invoice Amount** | Forward Stub &rarr; Module 10 | Billed total from finalized invoices (returns 0 until Module 10). |
| **Payment Received** | Forward Stub &rarr; Module 11 | Collected payments (returns 0 until Module 11). |
| **Outstanding Amount** | $\text{Billed/Actual} - \text{Paid}$ | Unpaid balance remaining on this confirmation. |

---

## 6. Database Schema & Data Dictionary

### Collection: `quotationconfirmations` (`models/QuotationConfirmation.js`)

| Field Name | Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `quotation` | `ObjectId` | Ref &rarr; `Quotation`, Required, Indexed | The source Quotation being confirmed. |
| `confirmationStatus`| `String` | Enum: `['FULLY_CONFIRMED', 'PARTIALLY_CONFIRMED']`, Required | Full vs Partial confirmation status. |
| `pendingApproval` | `Boolean` | Default: `false`, Indexed | Flags if manager approval is required before status flip. |
| `confirmedItems` | `Array` | Subdocument array (schema below) | List of confirmed and extra material items. |
| `originalQuotationAmount`| `Number` | Default: `0` | Frozen copy of `Quotation.grandTotal`. |
| `confirmedAmount` | `Number` | Default: `0` | Sum of original confirmed line items. |
| `extraProductAmount` | `Number` | Default: `0` | Sum of extra line items. |
| `differenceAmount` | `Number` | Default: `0` | Variance between original quote and confirmed items. |
| `totalActualAmount` | `Number` | Default: `0` | Total confirmed commercial commitment. |
| `isFullyDelivered` | `Boolean` | Default: `false` | Flips `true` when all items are 100% delivered. |
| `isActive` | `Boolean` | Default: `true`, Indexed | Soft-cancellation flag preserving audit trail. |
| `confirmedBy` | `ObjectId` | Ref &rarr; `User`, Required | Sales executive logging the confirmation. |
| `createdBy` | `ObjectId` | Ref &rarr; `User`, Required | Creator record reference. |
| `updatedBy` | `ObjectId` | Ref &rarr; `User`, Default: `null` | User who last updated items or approved. |

### Subdocument: `confirmedItems`

| Field Name | Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `originalQuotationItemId`| `ObjectId` | Ref &rarr; `Quotation.items._id`, Default: `null` | Link to original quote line (`null` for extra items). |
| `isExtraProduct` | `Boolean` | Default: `false` | Distinguishes originally quoted vs newly added items. |
| `product` | `ObjectId` | Ref &rarr; `Product`, Default: `null` | Reference to Product Master (if catalog item). |
| `isSkuLessItem` | `Boolean` | Default: `false` | True for ad-hoc custom fabricated items. |
| `skuCodeSnapshot` | `String` | Default: `null` | Company SKU code snapshot at confirmation time. |
| `productNameSnapshot`| `String` | Required | Frozen product name. |
| `imageSnapshot` | `String` | Default: `null` | Product photo URL snapshot. |
| `quotedQuantity` | `Number` | Default: `0` | Original quoted qty (`0` for extra items). |
| `confirmedQuantity` | `Number` | Required, Default: `0` | Quantity confirmed by the customer. |
| `extraQuantity` | `Number` | Default: `0` | Additional quantity of the same item. |
| `deliveredQuantity` | `Number` | Default: `0`, **Write-Protected** | Physically issued quantity (Module 9 only). |
| `unitPriceSnapshot` | `Number` | Required | Unit rate / MRP snapshot. |
| `gstPctSnapshot` | `Number` | Default: `0` | Applicable GST percentage. |
| `confirmedAmount` | `Number` | Required | `(confirmedQuantity + extraQuantity) * unitPrice`. |
| `remarks` | `String` | Default: `null` | Item-specific instructions (e.g. shade, packaging). |

---

## 7. Business Rules & Validation Suite

| Rule ID | Rule Title | Detailed Specification |
| :--- | :--- | :--- |
| **BR-QC-01** | **Single Active Confirmation** | A Quotation can have at most ONE `isActive: true` confirmation at a time. Attempting to create a second active confirmation is rejected with `400 Bad Request`. |
| **BR-QC-02** | **Zero / Reduced Quantity Support** | `confirmedQuantity` can legitimately be less than `quotedQuantity` or `0` (declined item). This drives `PARTIALLY_CONFIRMED` and is never treated as an error. |
| **BR-QC-03** | **Total Committed Quantity Formula** | Total deliverable quantity for any line item is strictly `confirmedQuantity + extraQuantity`. Module 9 (Challan) delivers against this combined total. |
| **BR-QC-04** | **Extra Products Identification** | Extra items not on the original quote store `quotedQuantity: 0`, `originalQuotationItemId: null`, and `isExtraProduct: true`. |
| **BR-QC-05** | **Delivery-Lock on Modifications** | Editing confirmation items (`PUT /api/confirmations/:id`) is permitted ONLY while `deliveredQuantity === 0` across ALL items. Once any Challan issues material, modifications are locked. |
| **BR-QC-06** | **Delivery-Lock on Cancellation** | Cancelling a confirmation (`PUT /api/confirmations/:id/cancel`) is blocked once any delivery has started (`deliveredQuantity > 0`). |
| **BR-QC-07** | **Status Reversion on Cancellation** | Cancelling an undelivered confirmation marks it `isActive: false` and automatically reverts `Quotation.status` back to `CUSTOMER_INTERESTED` so sales follow-up can resume. |
| **BR-QC-08** | **Delivered Quantity Write-Protection** | `deliveredQuantity` is write-protected on all public API routes; it is modified exclusively via internal service calls from Module 9 (Challan). |

---

## 8. Complete API Reference

### 1. Create Quotation Confirmation
- **Method & Route**: `POST /api/confirmations`
- **Permission**: `QUOTATION_CONFIRMATION:create`
- **Request Body**:
```json
{
  "quotationId": "6aa8e9ba9f4e2dfd4bc01550",
  "confirmedItems": [
    {
      "originalQuotationItemId": "6aa8e9ba9f4e2dfd4bc01552",
      "confirmedQuantity": 10,
      "extraQuantity": 2,
      "remarks": "Added 2 extra boxes for cutting wastage."
    },
    {
      "originalQuotationItemId": "6aa8e9ba9f4e2dfd4bc01553",
      "confirmedQuantity": 0,
      "remarks": "Customer dropped this design."
    }
  ],
  "extraItems": [
    {
      "productId": "6aa7cb21dae060d5e389ffea",
      "quantity": 4,
      "remarks": "Tile Spacer accessories"
    }
  ],
  "remarks": "Confirmed with contractor on site."
}
```
- **Response `201 Created`**: Returns full populated confirmation document.

---

### 2. Approve Confirmation (Manager Gate)
- **Method & Route**: `PUT /api/confirmations/:id/approve`
- **Permission**: `QUOTATION_CONFIRMATION:approve`
- **Response `200 OK`**: Sets `pendingApproval: false` and transitions `Quotation.status` to `CONFIRMED` or `PARTIALLY_CONFIRMED`.

---

### 3. Get 4-Stage Quantity Ledger
- **Method & Route**: `GET /api/confirmations/:id/quantity-ledger`
- **Permission**: `QUOTATION_CONFIRMATION:view`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "confirmationId": "6aa8ec1654d56b3bbd9b0d34",
    "quotationNumber": "QT-2026-001",
    "confirmationStatus": "PARTIALLY_CONFIRMED",
    "isFullyDelivered": false,
    "itemsLedger": [
      {
        "productName": "Royal Statuario 600x1200mm",
        "skuCode": "MTR-CONF-001",
        "isExtraProduct": false,
        "quotedQuantity": 10,
        "confirmedQuantity": 10,
        "extraQuantity": 2,
        "totalCommittedQuantity": 12,
        "deliveredQuantity": 5,
        "pendingDeliveryQuantity": 7,
        "unitPrice": 1000,
        "confirmedAmount": 12000
      },
      {
        "productName": "Armani Grey 600x600mm",
        "quotedQuantity": 5,
        "confirmedQuantity": 0,
        "pendingDeliveryQuantity": 0
      },
      {
        "productName": "Tile Spacer 3mm",
        "isExtraProduct": true,
        "quotedQuantity": 0,
        "confirmedQuantity": 4,
        "pendingDeliveryQuantity": 4
      }
    ]
  }
}
```

---

### 4. Quotation vs Actual Amount Comparison
- **Method & Route**: `GET /api/confirmations/:id/amount-comparison`
- **Permission**: `QUOTATION_CONFIRMATION:view`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "confirmationId": "6aa8ec1654d56b3bbd9b0d34",
    "quotationNumber": "QT-2026-001",
    "originalQuotationAmount": 16520,
    "confirmedAmount": 13000,
    "extraProductAmount": 1400,
    "differenceAmount": 3520,
    "totalActualAmount": 14400,
    "finalInvoiceAmount": 0,
    "paymentReceived": 0,
    "outstandingAmount": 0
  }
}
```

---

### 5. Update Confirmation (Pre-Delivery Only)
- **Method & Route**: `PUT /api/confirmations/:id`
- **Permission**: `QUOTATION_CONFIRMATION:edit`
- **Behavior**: Re-evaluates item quantities and amounts. Blocked with `400 Bad Request` if any delivery has started.

---

### 6. Cancel Confirmation (Pre-Delivery Only)
- **Method & Route**: `PUT /api/confirmations/:id/cancel`
- **Permission**: `QUOTATION_CONFIRMATION:delete`
- **Behavior**: Sets `isActive: false` and reverts `Quotation.status` to `CUSTOMER_INTERESTED`.

---

### 7. Export Confirmation & Ledger to Excel
- **Method & Route**: `GET /api/confirmations/:id/export`
- **Permission**: `QUOTATION_CONFIRMATION:export`
- **Response**: Downloadable `.xlsx` spreadsheet buffer.

---

## 9. Internal Forward-Reference Services

1. **`confirmationService.getConfirmedPendingDelivery(productId)`**:
   - Consumed by **Module 8 (Stock Management)** to calculate *Management Stock* (undelivered reserved inventory).
   - Queries all active confirmations where `deliveredQuantity < (confirmedQuantity + extraQuantity)`.
2. **`confirmationService.recordDelivery(confirmationId, itemId, deliveredQty)`**:
   - Consumed exclusively by **Module 9 (Challan Management)** when material is dispatched from warehouse.
   - Atomically increments `deliveredQuantity` and evaluates `isFullyDelivered`.

---

## 10. Verification & Test Suite Summary

The automated test runner (`scripts/testRunnerModule7.js`) validates all 11 core integration steps:

| Step | Verification Scenario | Result |
| :--- | :--- | :--- |
| **Step 0** | `QUOTATION_CONFIRMATION` registered in SystemModule registry | `✓ PASS` |
| **Step 1** | SuperAdmin, Sales User (create-only), and Manager (approve) authentication | `✓ PASS` |
| **Step 2** | Customer, products, and 3-item multi-line quotation fixtures setup | `✓ PASS` |
| **Step 3** | Create-only user confirmation stays in `pendingApproval: true` without flipping status | `✓ PASS` |
| **Step 4** | Single active confirmation rule strictly enforced (duplicate rejected) | `✓ PASS` |
| **Step 5** | Manager `/approve` flips Quotation status to `PARTIALLY_CONFIRMED` | `✓ PASS` |
| **Step 6** | 4-Stage Quantity Ledger returns exact Quoted, Confirmed, Extra, Delivered, Pending values | `✓ PASS` |
| **Step 7** | Amount comparison matches exact formula (Original ₹16,520 vs Actual ₹14,400) | `✓ PASS` |
| **Step 8** | Pre-delivery edit succeeds; post-delivery edit/cancel strictly blocked by delivery-lock | `✓ PASS` |
| **Step 9** | `getConfirmedPendingDelivery()` feeds Module 8 Stock with pending commitments | `✓ PASS` |
| **Step 10**| Pre-delivery cancellation reverts Quotation status to `CUSTOMER_INTERESTED` | `✓ PASS` |
| **Step 11**| View-only role blocked on create/approve + Excel export generates valid `.xlsx` | `✓ PASS` |

**Total Test Suite Result: 28 Passed, 0 Failed (100% Pass Rate).**

---

## 11. What Comes Next

With Module 7 (Quotation Confirmation) complete and verified:
- **Module 8 (Stock Management)**: Consumes Module 7's `confirmationService.getConfirmedPendingDelivery()` to calculate Management Stock (Available Physical Stock vs Committed Stock), stock ins/outs, and reorder alerts.
- **Module 9 (Challan Management)**: Issues delivery challans against Module 7's `confirmedItems`, calling `confirmationService.recordDelivery()` to update actual delivered quantities.
