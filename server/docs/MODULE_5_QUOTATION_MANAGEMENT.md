# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 5: QUOTATION MANAGEMENT & MULTI-FORMAT RENDERING ENGINE
### Complete Technical Documentation, Architecture, Snapshot Engine, 8 Presentation Layouts & API Reference

---

## 1. Executive Summary & Purpose

Module 5 builds **Quotation Management** — the central core business-logic layer for the Maitri Ceramic ERP platform. It digitizes the client's manual, Excel, and handwritten quotation workflows into a structured, product-photo-capable, multi-format quotation engine.

Quotation Management serves as the commercial bridge between Customer Management (Module 4) and Product Master (Module 2), feeding directly downstream into Follow-Up Management (Module 6), Quotation Confirmation (Module 7), and Challan/Invoice Billing (Modules 9/10).

### Core Capabilities
1. **Line-Item Product Snapshot Architecture**: Quotation items store a **frozen snapshot** of product details (`productNameSnapshot`, `skuCodeSnapshot`, `imageSnapshot`, `mrpSnapshot`, `gstPctSnapshot`) at the exact moment of quoting. Edits or deactivations in Product Master never alter historical quotation records.
2. **Dual SKU Rule Enforcement**: Quotation line items always display and snapshot `companySkuCode` (quotation-facing), **never `vendorSkuCode`** (purchase-facing).
3. **SKU-Less / Ad-Hoc Item Native Support**: Line items can be added ad-hoc without an existing Product Master record (`isSkuLessItem: true`, `skuCodeSnapshot: null`), supporting custom fabricated items and non-catalog accessories.
4. **Server-Side Financial Engine**: All gross amounts, discount amounts, net taxable amounts, GST amounts, and header totals are computed server-side, eliminating client-side price tampering.
5. **Multi-Format Presentation Transformer (8 Formats)**: Dynamically renders the **same canonical quotation document** under 8 presentation layouts:
   - `STANDARD` — Customer presentation layout
   - `MRP` — MRP rate-based layout
   - `DISCOUNT` — Discount & savings focused layout
   - `PLUMBER` — Trade / contractor layout
   - `DETAILED` — Full specification and financial breakdown
   - `PENDING` — Follow-up and validity review layout
   - `WITHOUT_SKU` — Clean layout suppressing SKU codes for simplified quoting
   - `WITH_GST` — Detailed tax breakdown with CGST/SGST/IGST split
6. **Company-Based Brand Quoting**: Allows selecting a specific Company Master entity (e.g. Somany, Kajaria, Own Brand) to provide convenience product filtering while still allowing mixed-brand line items.
7. **Concurrency-Safe Atomic Auto-Numbering**: Generates sequential quotation numbers (e.g. `Q-2026-27-0001`) atomically per financial year without race conditions.
8. **Cross-Module Forward References**: Immediately supplies live quotation data to:
   - Module 2: `GET /api/products/:id/quotation-usage`
   - Module 4: `GET /api/customers/:id/history` (Customer 360° Journey)

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│               (authenticate + checkPermission('QUOTATION'))            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 5: QUOTATION MANAGEMENT                     │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Snapshot Frozen Line Items   │    │ Multi-Format Render (8 Types)│  │
│  │  (Images, MRP, Company SKU)  │    │  (STANDARD -> WITH_GST)      │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Atomic Sequential Numbering  │    │ Server Financial Calculation │  │
│  │  (Q-2026-27-0001)            │    │  (Gross, Disc, Net, GST, GT) │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │ (customerId)               │ (productId)                │ (quotationId)
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    MODULE 4:     │       │    MODULE 2:     │       │    MODULE 6/7:   │
│  CUSTOMER 360°   │       │  PRODUCT MASTER  │       │    FOLLOW-UP &   │
│     HISTORY      │       │ QUOTATION USAGE  │       │   CONFIRMATION   │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 3. Architecture & Quotation Lifecycle Pipeline

```
[ User Initiates Quotation Creation ]
                   │
                   ▼ (POST /api/quotations)
         [ Auth & Permission Check (QUOTATION:create) ]
                   │
                   ▼
  [ Validate Customer (Module 4) & Salesperson (Module 1) ]
                   │
                   ▼
  [ Line Item Resolution & Snapshot Engine ]
  ├── If productId provided ──► Copy productName, companySkuCode, productImage, mrp, gstPct
  └── If ad-hoc item ────────► Validate adHocName + adHocMrp (isSkuLessItem: true, SKU: null)
                   │
                   ▼
  [ Server Financial Engine ]
  ├── grossAmount = mrp * quantity
  ├── discountAmount = grossAmount * (discountPct / 100)
  ├── netAmount = grossAmount - discountAmount
  ├── gstAmount = netAmount * (gstPct / 100)
  └── grandTotal = totalNetAmount + totalGstAmount
                   │
                   ▼
  [ Atomic Number Generator ] ──► Increments QuotationNumberSequence (Q-YYYY-YY-XXXX)
                   │
                   ▼
  [ Saves Quotation in DRAFT Status ]
                   │
         ┌─────────┴──────────────────────────────────────────┐
         ▼                                                    ▼
 [ PUT /api/quotations/:id/send ]                 [ GET /api/quotations/:id/render ]
 (Permission: QUOTATION:approve)                  (Query: ?format=WITH_GST)
 Transitions DRAFT -> SENT                        Renders any of the 8 presentation formats
 Locks header fields for negotiation              Generates downloadable Excel (.xlsx)
```

---

## 4. Key Business & Engineering Rules

### 4.1 Snapshot Immutability (Zero Historical Drift)
- Each line item stores a frozen snapshot of product name, image URL, company SKU, MRP, and GST%.
- If a product is subsequently updated, renamed, or deactivated in Module 2, the historical quotation maintains its exact figures as agreed with the customer.

### 4.2 SKU Rule: Company SKU vs Vendor SKU
- In accordance with ceramic industry standards, customer quotations **always display `companySkuCode`**.
- `vendorSkuCode` is strictly confidential to purchasing/vendor transactions and is **never** included in quotation snapshots or presentation templates.

### 4.3 Quotation Status Lifecycle
- **`DRAFT`**: Initial editable quotation draft.
- **`SENT`**: Sent to customer (approved via `PUT /:id/send`).
- **`FOLLOW_UP_PENDING` / `FOLLOW_UP_COMPLETED`**: Managed by Module 6 (Follow-Up Management).
- **`CUSTOMER_INTERESTED` / `NEGOTIATION`**: Sales negotiation tracking.
- **`CONFIRMED` / `PARTIALLY_CONFIRMED`**: Confirmed order (Managed by Module 7). Once confirmed, raw quotation item edits are **strictly locked**.
- **`REJECTED` / `EXPIRED` / `CLOSED`**: Terminal states.

### 4.4 Soft Cancellation
- `PUT /api/quotations/:id/cancel` sets `isActive: false`.
- Cancelled quotations remain accessible in Customer 360° History and Product Usage reports for reconciliation.

---

## 5. Module 5 API Reference

### 5.1 POST `/api/quotations`
Creates a new quotation with line item snapshots and server-computed totals.
- **Permission**: `QUOTATION:create`
- **Request Body**:
```json
{
  "customerId": "6644e1234567890abcdef101",
  "companyId": "6644f0000000000000000001",
  "salespersonId": "6644d0000000000000000001",
  "formatKey": "STANDARD",
  "reference": "Ref: Architect Anand Shah",
  "remarks": "Special contractor discount applied",
  "validityDate": "2026-10-30",
  "items": [
    {
      "productId": "6644b0000000000000000001",
      "area": "Master Bedroom",
      "quantity": 50,
      "discountPct": 10
    },
    {
      "adHocName": "Custom Brass Corner Profile 8ft",
      "adHocMrp": 350,
      "adHocGstPct": 18,
      "quantity": 15,
      "discountPct": 0,
      "area": "Bathroom Border"
    }
  ]
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Quotation created successfully.",
  "data": {
    "_id": "6644c1234567890abcdef201",
    "quotationNumber": "Q-2026-27-0001",
    "quotationDate": "2026-09-15T11:00:00.000Z",
    "status": "DRAFT",
    "customer": {
      "_id": "6644e1234567890abcdef101",
      "customerName": "Ramesh Patel",
      "mobile": "9825700001"
    },
    "items": [
      {
        "product": "6644b0000000000000000001",
        "skuCodeSnapshot": "MTR-STAT-6012",
        "productNameSnapshot": "Statuario White 600x1200mm",
        "imageSnapshot": "https://res.cloudinary.com/maitri/image/upload/statuario.jpg",
        "mrpSnapshot": 800,
        "quantity": 50,
        "discountPct": 10,
        "grossAmount": 40000,
        "discountAmount": 4000,
        "netAmount": 36000,
        "gstAmount": 6480
      },
      {
        "product": null,
        "isSkuLessItem": true,
        "skuCodeSnapshot": null,
        "productNameSnapshot": "Custom Brass Corner Profile 8ft",
        "mrpSnapshot": 350,
        "quantity": 15,
        "discountPct": 0,
        "grossAmount": 5250,
        "discountAmount": 0,
        "netAmount": 5250,
        "gstAmount": 945
      }
    ],
    "totalGrossAmount": 45250,
    "totalDiscountAmount": 4000,
    "totalNetAmount": 41250,
    "totalGstAmount": 7425,
    "grandTotal": 48675
  }
}
```

---

### 5.2 GET `/api/quotations`
Retrieves paginated quotation list with keyword search, date range, and user `dataScope`.
- **Permission**: `QUOTATION:view`
- **Query Parameters**:
  - `search`: Keyword search matching quotation number, reference, or remarks
  - `status`: `DRAFT`, `SENT`, `CONFIRMED`, `REJECTED`, etc.
  - `customerId`: Filter by customer
  - `salespersonId`: Filter by sales executive
  - `companyId`: Filter by company
  - `from` / `to`: Date range filters (`YYYY-MM-DD`)
  - `page`: Page index (default: `1`)
  - `limit`: Records per page (default: `20`)

---

### 5.3 GET `/api/quotations/:id`
Retrieves single quotation with populated customer, company, salesperson, format, and line item details.
- **Permission**: `QUOTATION:view`

---

### 5.4 PUT `/api/quotations/:id`
Updates quotation header and line items (Allowed in `DRAFT` or `SENT` status; blocked in `CONFIRMED`/`CLOSED`).
- **Permission**: `QUOTATION:edit`

---

### 5.5 PUT `/api/quotations/:id/send`
Marks quotation as `SENT` to customer.
- **Permission**: `QUOTATION:approve`

---

### 5.6 PUT `/api/quotations/:id/cancel`
Cancels quotation (`isActive: false`).
- **Permission**: `QUOTATION:delete`

---

### 5.7 GET `/api/quotations/:id/render`
Renders the quotation under any of the 8 presentation formats dynamically.
- **Permission**: `QUOTATION:view`
- **Query Parameter**: `format=STANDARD|MRP|DISCOUNT|PLUMBER|DETAILED|PENDING|WITHOUT_SKU|WITH_GST`
- **Response**: Render-ready JSON structure formatted according to the requested layout.

---

### 5.8 GET `/api/quotations/:id/export`
Exports the quotation in any format as a downloadable Excel (`.xlsx`) workbook.
- **Permission**: `QUOTATION:export`
- **Query Parameters**: `format=STANDARD|WITH_GST|...`, `fileType=EXCEL`
- **Response**: Binary stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) with 3 structured sheets: **Line Items**, **Quotation Info**, and **Financial Summary**.

---

### 5.9 GET `/api/quotations/pending`
Returns all active quotations in pending follow-up states.
- **Permission**: `QUOTATION:view`

---

### 5.10 GET `/api/quotations/company-products/:companyId`
Convenience product picker returning active products belonging to the selected company.
- **Permission**: `QUOTATION:view`

---

## 6. Verification Suite & Quality Assurance

| # | Test Scenario | Expected Result | Verification Status |
|---|---------------|-----------------|---------------------|
| 1 | `QUOTATION` Module Registry | Registered in SystemModule registry under `SALES` | Verified (PASS) |
| 2 | Atomic Sequential Numbering | Concurrency-safe unique numbers (`Q-2026-27-0001`) | Verified (PASS) |
| 3 | Line Item SKU Snapshots | Strictly snapshots `companySkuCode`, never `vendorSkuCode` | Verified (PASS) |
| 4 | Snapshot Immutability | Preserves frozen rates even after source Product changes | Verified (PASS) |
| 5 | SKU-Less Ad-Hoc Items | Resolves ad-hoc items without Product Master record | Verified (PASS) |
| 6 | Item Validation | Rejects items missing both `productId` and ad-hoc details | Verified (PASS) |
| 7 | Mathematical Accuracy | Server-computed Gross, Discount, Net, GST, and Grand Total | Verified (PASS) |
| 8 | Dynamic Recalculation | Modifying item quantities updates line and header totals | Verified (PASS) |
| 9 | Status Workflow Lock | Blocks direct item editing in `CONFIRMED`/`CLOSED` status | Verified (PASS) |
| 10| Status Transition | Transitions `DRAFT` -> `SENT` via approve action | Verified (PASS) |
| 11| Soft Cancellation | Sets `isActive: false` (retained for historical audit) | Verified (PASS) |
| 12| 8 Presentation Formats | Renders all 8 formats from single canonical document | Verified (PASS) |
| 13| Excel Export Generation | Generates 3-sheet `.xlsx` matching financial totals | Verified (PASS) |
| 14| Forward Bridge 1 (Module 2)| `getUsageForProduct()` feeds Product Quotation Usage | Verified (PASS) |
| 15| Forward Bridge 2 (Module 4)| `getByCustomer()` feeds Customer 360° History | Verified (PASS) |
| 16| dataScope Isolation | Restricts `OWN` to creator while `ALL` views org records | Verified (PASS) |

---

## 7. Next Up: Module 6 (Follow-Up Management)

With Module 5 (Quotation Management) complete, tested, and documented:
- Module 6 (Follow-Up Management) will attach directly to `quotationId` records created here.
- Module 6 will manage the active sales lifecycle transitions (`FOLLOW_UP_PENDING` -> `FOLLOW_UP_COMPLETED` -> `CUSTOMER_INTERESTED` -> `NEGOTIATION` -> `CONFIRMED` / `REJECTED`).
