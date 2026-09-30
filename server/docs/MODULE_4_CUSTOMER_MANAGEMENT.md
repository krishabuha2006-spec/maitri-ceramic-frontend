# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 4: CUSTOMER MANAGEMENT & 360° JOURNEY AGGREGATION ENGINE
### Complete Technical Documentation, Architecture, Aggregation Pipeline & API Reference

---

## 1. Executive Summary & Purpose

Module 4 establishes the **Customer Management Layer** for the Maitri Ceramic ERP platform. It manages customer profiles and acts as the central customer data hub, stitching together a customer's complete business relationship with Maitri Ceramic across all downstream transactional modules (Quotations, Follow-Ups, Challans, Invoices, Payments, and Ledger).

### Core Responsibilities
1. **Customer Profile Master (Layer 1)**: Full CRUD operations for customer entity records (`Customer`), featuring granular permission gating, soft-delete isolation (`isActive: false`), and audit trail stamping (`createdBy`, `updatedBy`).
2. **Customer 360° History Aggregation Engine (Layer 2)**: Stitches together real-time customer journeys across 6 downstream modules via non-blocking parallel service calls (`Promise.allSettled`).
3. **Graceful Zero-Crash Degradation (Forward Reference Pattern)**: The 360° history endpoint gracefully returns empty collections and zeroed counters for pending downstream modules, enabling Module 4 to ship immediately and light up automatically as Modules 5, 6, 9, 10, 11, and 13 are deployed.
4. **dataScope Granular Access Enforcement**: Seamlessly enforces `dataScope: 'OWN'` (sales reps only view/export customers they personally created) versus `dataScope: 'ALL'` (managers/admins view organizational accounts).
5. **Duplicate-Mobile Soft Warning Policy**: Supports family/contractor shared contact numbers by issuing informational warnings without hard-blocking customer creation.
6. **Outstanding Financial Shortcut**: Exposes a low-latency summary endpoint (`/api/customers/:id/outstanding`) designed for instant dashboard widget rendering.
7. **Scoped Excel Reporting**: Generates formatted `.xlsx` workbooks (`/api/customers/export`) applying identical multi-parameter filters and permission dataScopes.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│                 (authenticate + checkPermission('CUSTOMER'))            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MODULE 4: CUSTOMER MANAGEMENT                     │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │   Customer Profile Master    │    │  360° Journey Aggregation    │  │
│  │    (Name, Mobile, GST, Type) │    │  (Quotation -> Pay Ledger)   │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │  dataScope Filter Engine     │    │  Excel Scoped Export Engine  │  │
│  │  (OWN vs TEAM vs ALL)        │    │  (Formatted .xlsx workbook)  │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└───────┬────────────┬────────────┬────────────┬────────────┬────────────┘
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│  MODULE 5:   ││  MODULE 6:   ││  MODULE 9:   ││ MODULE 10:   ││ MODULE 11/13:│
│  QUOTATION   ││  FOLLOW-UP   ││   CHALLAN    ││   INVOICE    ││PAYMENT/LEDGER│
└──────────────┘└──────────────┘└──────────────┘└──────────────┘└──────────────┘
```

---

## 3. Architecture & 360° Journey Aggregation Pipeline

```
[ User / Sales Rep opens Customer Record ]
                   │
                   ▼ (GET /api/customers/:id/history)
         [ Auth & Permission Check ]
                   │
                   ▼
  [ Fetch Customer Profile from DB (Direct Read) ]
                   │
                   ▼
  [ Parallel Forward Service Dispatch (Promise.allSettled) ]
  ┌──────────────────────────────────────────────────────────────────┐
  │ ├── Module 5:  quotationService.getByCustomer(customerId)        │
  │ ├── Module 6:  followUpService.getByCustomer(customerId)         │
  │ ├── Module 9:  challanService.getByCustomer(customerId)          │
  │ ├── Module 10: invoiceService.getByCustomer(customerId)          │
  │ ├── Module 11: paymentService.getByCustomer(customerId)          │
  │ └── Module 13: ledgerService.getByCustomer(customerId)           │
  └──────────────────────────────────────────────────────────────────┘
                   │
                   ▼
  [ Safe Aggregation & Metrics Calculation ]
  ├── Computes totalQuotationValue & actualConvertedValue
  ├── Computes totalInvoiceValue & totalPaymentReceived
  ├── Calculates outstanding (totalInvoiceValue - totalPaymentReceived)
  ├── Aggregates productWiseHistory, totalQuantity & lastPurchaseDate
  └── Gracefully populates defaults [] / 0 for unbuilt modules
                   │
                   ▼
  [ Returns Unified 360° Customer Journey JSON Response (Zero 500s) ]
```

---

## 4. Key Business & Engineering Rules

### 4.1 Soft Deactivation & Historical Integrity (Non-Cascading)
- Deactivating a customer (`PUT /api/customers/:id/deactivate`) sets `isActive: false`.
- Hard deletes are strictly prohibited in database operations.
- Historical Quotations, Challans, and Invoices referencing a deactivated customer remain 100% intact.
- The `/history` endpoint remains **fully functional** on deactivated customers for auditing and billing reconciliation.

### 4.2 Duplicate Mobile Number Handling
- In the ceramic tile distribution industry, builders, contractors, and family members often share a single mobile number across different site accounts.
- The system checks for existing active customers with the same mobile number. If detected, customer creation succeeds and returns an informational notice: `"Customer created with duplicate-mobile notice."` along with the matching customer details.

### 4.3 dataScope Isolation (OWN vs ALL)
- Every customer record is stamped with `createdBy: req.user._id`.
- For users assigned `dataScope: 'OWN'`, query filters automatically restrict search and export results to `{ createdBy: req.user._id }`.
- For users assigned `dataScope: 'ALL'`, query filters span all organizational customer records.

### 4.4 Customer Types (Standard Closed Enum)
- `RETAIL`: Individual walk-in home builders / renovators.
- `DEALER`: Sub-dealers, showroom retailers, and distributors.
- `CONTRACTOR`: Civil contractors and turnkey project builders.
- `PLUMBER`: Sanitaryware plumbers and installation technicians.
- `OTHER`: Institutional, government, or architect accounts.

---

## 5. Module 4 API Reference

### 5.1 POST `/api/customers`
Creates a new customer profile.
- **Permission**: `CUSTOMER:create`
- **Request Body**:
```json
{
  "customerName": "Ramesh Patel",
  "mobile": "9825700001",
  "alternateNumber": "9825700002",
  "email": "ramesh.patel@gmail.com",
  "billingAddress": "Shop 12, Ceramic Plaza",
  "shippingAddress": "Site 4B, Morbi Ring Road",
  "city": "Morbi",
  "state": "Gujarat",
  "gstNumber": "24AAAAA0000A1Z5",
  "customerType": "DEALER",
  "notes": "VIP Gold Dealer with credit terms"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Customer created successfully.",
  "data": {
    "customer": {
      "_id": "6644e1234567890abcdef101",
      "customerName": "Ramesh Patel",
      "mobile": "9825700001",
      "customerType": "DEALER",
      "city": "Morbi",
      "isActive": true,
      "createdBy": "6644e0000000000000000001",
      "createdAt": "2026-09-15T10:30:00.000Z"
    },
    "duplicateWarning": null
  }
}
```

---

### 5.2 GET `/api/customers`
Retrieves paginated customer list filtered by keyword search, status, and user `dataScope`.
- **Permission**: `CUSTOMER:view`
- **Query Parameters**:
  - `search`: Keyword search matching name, mobile, city, email, or GST number
  - `customerType`: `RETAIL`, `DEALER`, `CONTRACTOR`, `PLUMBER`, `OTHER`
  - `city`: Partial/exact city name
  - `state`: Partial/exact state name
  - `isActive`: `true` (default), `false`, or `all`
  - `page`: Page index (default: `1`)
  - `limit`: Records per page (default: `20`, max: `100`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Customers retrieved successfully.",
  "data": {
    "customers": [
      {
        "_id": "6644e1234567890abcdef101",
        "customerName": "Ramesh Patel",
        "mobile": "9825700001",
        "customerType": "DEALER",
        "city": "Morbi",
        "state": "Gujarat",
        "isActive": true,
        "createdBy": {
          "_id": "6644e0000000000000000001",
          "fullName": "Sales Rep Alice"
        }
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

---

### 5.3 GET `/api/customers/:id`
Fetches a single customer profile by ID (respects user `dataScope`).
- **Permission**: `CUSTOMER:view`
- **Response (200 OK)**: Complete customer profile object.

---

### 5.4 PUT `/api/customers/:id`
Updates customer profile attributes and stamps `updatedBy`.
- **Permission**: `CUSTOMER:edit`
- **Response (200 OK)**: Updated customer document.

---

### 5.5 PUT `/api/customers/:id/deactivate`
Soft-deactivates customer profile (`isActive: false`).
- **Permission**: `CUSTOMER:delete`
- **Response (200 OK)**: Deactivated customer document.

---

### 5.6 PUT `/api/customers/:id/reactivate`
Restores previously deactivated customer (`isActive: true`).
- **Permission**: `CUSTOMER:edit`
- **Response (200 OK)**: Reactivated customer document.

---

### 5.7 GET `/api/customers/:id/history`
Aggregates full 360° customer journey across sales, financials, and product purchases.
- **Permission**: `CUSTOMER:view`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Customer 360° history aggregated successfully.",
  "data": {
    "profile": {
      "_id": "6644e1234567890abcdef101",
      "customerName": "Ramesh Patel",
      "mobile": "9825700001",
      "customerType": "DEALER",
      "isActive": true
    },
    "salesHistory": {
      "quotations": [],
      "confirmedOrders": [],
      "followUps": [],
      "challans": [],
      "invoices": [],
      "payments": []
    },
    "financialHistory": {
      "totalQuotationValue": 0,
      "actualConvertedValue": 0,
      "totalInvoiceValue": 0,
      "totalPaymentReceived": 0,
      "outstanding": 0,
      "credit": 0,
      "debit": 0
    },
    "productHistory": {
      "productsPurchased": [],
      "quantityPurchased": 0,
      "productWiseHistory": [],
      "lastPurchaseDate": null
    }
  }
}
```

---

### 5.8 GET `/api/customers/:id/outstanding`
Fast shortcut endpoint returning outstanding financial balances.
- **Permission**: `CUSTOMER:view`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Customer outstanding summary retrieved successfully.",
  "data": {
    "customerId": "6644e1234567890abcdef101",
    "customerName": "Ramesh Patel",
    "totalInvoiced": 0,
    "totalPaid": 0,
    "outstanding": 0
  }
}
```

---

### 5.9 GET `/api/customers/export`
Exports filtered customer list to a downloadable Excel `.xlsx` workbook.
- **Permission**: `CUSTOMER:export`
- **Response**: Binary Excel file stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- **Headers**: `Content-Disposition: attachment; filename=Customers_Export.xlsx`

---

## 6. Verification Suite & Quality Assurance

| # | Test Scenario | Expected Result | Verification Status |
|---|---------------|-----------------|---------------------|
| 1 | `CUSTOMER` Module Registry | Registered in SystemModule registry under `SALES` | Verified (PASS) |
| 2 | Customer Profile Creation | Successfully creates profile with full fields | Verified (PASS) |
| 3 | Duplicate Mobile Soft Warning | Non-blocking creation with informational warning | Verified (PASS) |
| 4 | Keyword Text Search | Matches partial customer names and mobile numbers | Verified (PASS) |
| 5 | Multi-Field Filter Query | Filters by City, State, Type, and Status intersection | Verified (PASS) |
| 6 | `dataScope: 'OWN'` Isolation | Restricts query results strictly to user's own customers | Verified (PASS) |
| 7 | `dataScope: 'ALL'` Visibility | Allows viewing customers created across organization | Verified (PASS) |
| 8 | Profile Update Audit Stamp | Updates fields and stamps `updatedBy` user reference | Verified (PASS) |
| 9 | Soft Deactivation | Sets `isActive: false` (preserved for historical queries) | Verified (PASS) |
| 10| Customer Reactivation | Restores customer to `isActive: true` | Verified (PASS) |
| 11| 360° History Aggregation | Returns full aggregated JSON with zero 500 crashes | Verified (PASS) |
| 12| Deactivated Customer 360° | Successfully aggregates history on deactivated records | Verified (PASS) |
| 13| Outstanding Shortcut | Returns `{ totalInvoiced, totalPaid, outstanding }` | Verified (PASS) |
| 14| Scoped Excel Export | Generates `.xlsx` workbook respecting user dataScope | Verified (PASS) |
| 15| Granular Action Guards | View-only blocks create/edit/delete/export operations | Verified (PASS) |

---

## 7. Next Up: Module 5 (Quotation Management)

With Module 4 (Customer Management) complete, tested, and documented:
- Module 5 (Quotation Management) will reference `customerId` back to this module's `Customer` collection and `productId` back to Module 2.
- Module 5 will implement the first live forward service (`quotationService.getByCustomer()`), instantly lighting up the 360° History aggregation without requiring any changes in Module 4.
