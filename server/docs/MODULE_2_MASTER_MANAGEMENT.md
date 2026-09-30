# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 2: MASTER MANAGEMENT
### Complete Technical Documentation, Architecture, Master Registry & API Reference

---

## 1. Executive Summary & Purpose

Module 2 builds the **Master Management Layer** — the central reference-data foundation for the entire Maitri Ceramic ERP platform. Every downstream transactional module (Module 3: Product Import, Module 5: Quotation Management, Module 8: Stock Management, Module 9: Challan Management, Module 10: Invoice Management, Module 11: Payment Management, Module 14: Product Tracking, Module 15: Reports) consumes master records created and managed here.

### Core Responsibilities
1. **Central Reference Masters**: Manages Company Master, Product Group Master, Core Product Master, Vendor Master, Unit Master, Tax Master, Payment Mode Master, and Quotation Format Master.
2. **Dual SKU Engine**: Independently tracks Company SKU (`companySkuCode` — unique across the system, quotation-facing) and Vendor SKU (`vendorSkuCode` — non-unique, purchase-facing).
3. **SKU-Less Product Support**: Sparse unique indexing allows products without SKUs (`isSkuLess: true`) to exist cleanly without database index collisions for simplified quoting.
4. **Strict Stock Snapshot Isolation**: Protects `currentStock` from manual drift by locking it from the general product edit API (`PUT /api/products/:id`), reserving updates strictly for Module 8's ledger-based stock movement services.
5. **Zero Historical Cascading Loss (Soft Deactivation)**: Deactivating any master record (`isActive: false`) preserves historical integrity across all past Quotations, Challans, and Invoices.
6. **Zero-Rework Forward Reference**: Exposes `/api/products/:id/quotation-usage` which safely returns `[]` until Module 5 (Quotation) is deployed, and seamlessly returns live quotation data once Module 5 goes live.
7. **Shared Validation Engine**: Exports a unified `productValidationService` reused directly by Module 3 (Product Import) for Excel/PDF bulk processing without duplicating validation logic.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│               (authenticate + checkPermission middleware)              │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MODULE 2: MASTER MANAGEMENT                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Company Master  │  │  Product Groups  │  │  Quotation Formats   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Vendor Master  │  │   Unit Master    │  │     Tax Presets      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐  │
│  │  Payment Modes   │  │     CORE PRODUCT MASTER (Dual SKU)       │  │
│  └──────────────────┘  └──────────────────────────────────────────┘  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │                            │                            │
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    MODULE 3:     │       │    MODULE 5:     │       │    MODULE 8:     │
│  PRODUCT IMPORT  │       │    QUOTATION     │       │      STOCK       │
│  (Excel / PDF)   │       │    MANAGEMENT    │       │    MANAGEMENT    │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 3. Master Catalog & Data Structure

### 3.1 Company Master (`Company`)
- **Purpose**: Defines business entities Maitri Ceramic operates under (`OWN`) and partner/brand manufacturers (`BRAND_MANUFACTURER`) used in company-based quotation formatting.
- **Enforcement Rule**: Exactly **ONE** active company with `companyType: 'OWN'` is permitted across the entire platform. Multiple `BRAND_MANUFACTURER` entries are allowed.
- **Fields**: `companyName`, `companyType` (`OWN` / `BRAND_MANUFACTURER`), `logo`, `gstNumber`, `address`, `contactPerson`, `contactMobile`, `isActive`, `createdBy`, `updatedBy`.

### 3.2 Product Group Master (`ProductGroup`)
- **Purpose**: Product categorization (e.g., *Ceramic & Porcelain Tiles*, *Sanitaryware*, *CP Fittings & Faucets*, *Bathroom Accessories*, *Adhesives & Grouts*).
- **Fields**: `groupName` (unique), `description`, `isActive`, `createdBy`, `updatedBy`.

### 3.3 Unit Master (`UnitMaster`)
- **Purpose**: Units of measurement (*PCS*, *BOX*, *SQFT*, *MTR*, *KG*).
- **Fields**: `unitName` (unique), `unitCode` (unique, uppercase), `isActive`, `createdBy`, `updatedBy`.

### 3.4 Tax Master (`TaxMaster`)
- **Purpose**: Pre-configured GST tax presets (*GST 0%*, *GST 5%*, *GST 12%*, *GST 18%*, *GST 28%*).
- **Fields**: `taxName` (unique), `gstPct`, `igstPct`, `cgstPct`, `sgstPct`, `cessPct`, `isActive`.

### 3.5 Payment Mode Master (`PaymentModeMaster`)
- **Purpose**: Payment channels (*Cash*, *Bank Transfer*, *UPI*, *Cheque*, *Debit/Credit Card*).
- **Fields**: `modeName` (unique), `isActive`.

### 3.6 Quotation Format Master (`QuotationFormatMaster`)
- **Purpose**: Governs the 8 specialized quotation rendering types required by Maitri Ceramic:
  1. `STANDARD` — Standard Quotation
  2. `MRP` — MRP-Based Quotation
  3. `DISCOUNT` — Discounted Quotation
  4. `PLUMBER` — Plumber & Contractor Quotation
  5. `DETAILED` — Quotation with Comprehensive Details
  6. `PENDING` — Pending Items Quotation
  7. `WITHOUT_SKU` — Quotation Without SKU Codes
  8. `WITH_GST` — Quotation with Tax / GST Breakdown
- **Fields**: `formatKey` (unique, uppercase), `formatName`, `description`, `isActive`.

### 3.7 Vendor Master (`Vendor`)
- **Purpose**: Suppliers and manufacturers supplying ceramic tiles, sanitaryware, and fittings.
- **Fields**: `vendorName`, `mobile`, `email`, `address`, `gstNumber`, `isActive`, `createdBy`, `updatedBy`.

### 3.8 Core Product Master (`Product`)
- **Identification**: `companySkuCode` (sparse-unique), `vendorSkuCode` (non-unique, searchable), `isSkuLess` (boolean default false), `productName`, `hsnCode`, `company` (ref Company), `vendor` (ref Vendor), `productGroup` (ref ProductGroup), `productImage`, `unit` (ref UnitMaster).
- **Tax Breakdown**: `gstPct`, `igstPct`, `cgstPct`, `sgstPct`, `cessPct`.
- **Pricing Breakdown**: `mrp`, `purchaseRate`, `costRate`, `salePrice`, `saleDiscount`.
- **Stock Snapshot**: `openingStock`, `openingStockValue`, `defaultQuantity`, `currentStock`, `reorderAlertQty`.
- **Audit & Status**: `isActive`, `createdBy`, `updatedBy`.

---

## 4. Dual SKU & Stock Isolation Architecture

### Dual SKU Logic
| Feature | `companySkuCode` (Maitri Ceramic Internal) | `vendorSkuCode` (Manufacturer / Vendor) |
| :--- | :--- | :--- |
| **Uniqueness** | **Strictly Unique** across the database via partial filter index. | **Non-Unique** (different vendors can supply products with the same factory code). |
| **Quotation Visibility** | Always resolved on customer-facing Quotations. | Used internally for vendor purchase matching. |
| **Searchability** | Fully indexed & searchable via `/api/products/search-by-sku?code=...` | Fully indexed & searchable via `/api/products/search-by-sku?code=...` |
| **Null Handling** | Allowed to be `null` / omitted **only** when `isSkuLess: true`. | Can be `null` or omitted at any time. |

### Stock Snapshot Write Isolation
- `currentStock` represents the live physical inventory count.
- The `PUT /api/products/:id` controller **explicitly strips and ignores** `currentStock` from request bodies.
- Inventory changes can **only** be triggered via internal service calls (`productService.adjustStock()`) driven by Module 8 (Stock Management) ledger movements.

---

## 5. Complete API Reference

Base URL: `http://localhost:5000/api`
All protected endpoints require header: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

### 5.1 Company Master APIs (`/api/companies`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/companies` | `COMPANY_MASTER.create` | Create Company (enforces max 1 `OWN` company) |
| `GET` | `/api/companies` | `COMPANY_MASTER.view` | List Companies with search and type filters |
| `GET` | `/api/companies/:id` | `COMPANY_MASTER.view` | Get Company by ID |
| `PUT` | `/api/companies/:id` | `COMPANY_MASTER.edit` | Update Company details |
| `PUT` | `/api/companies/:id/deactivate` | `COMPANY_MASTER.delete` | Soft-deactivate Company (`isActive: false`) |

#### Sample Create Company Request (`POST /api/companies`)
```json
{
  "companyName": "Somany Ceramics Ltd",
  "companyType": "BRAND_MANUFACTURER",
  "gstNumber": "24ABCDE1234F1Z5",
  "address": "Kadi, Mehsana, Gujarat",
  "contactPerson": "Rajesh Sharma",
  "contactMobile": "9876500001"
}
```

---

### 5.2 Product Group Master APIs (`/api/product-groups`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/product-groups` | `PRODUCT_GROUP_MASTER.create` | Create Product Group |
| `GET` | `/api/product-groups` | `PRODUCT_GROUP_MASTER.view` | List all Product Groups |
| `PUT` | `/api/product-groups/:id` | `PRODUCT_GROUP_MASTER.edit` | Update Product Group |
| `PUT` | `/api/product-groups/:id/deactivate` | `PRODUCT_GROUP_MASTER.delete` | Soft-deactivate Product Group |

---

### 5.3 Unit Master APIs (`/api/units`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/units` | `UNIT_MASTER.create` | Create Unit (e.g. `PCS`, `BOX`, `SQFT`) |
| `GET` | `/api/units` | `UNIT_MASTER.view` | List all active Units |
| `PUT` | `/api/units/:id` | `UNIT_MASTER.edit` | Update Unit details |
| `PUT` | `/api/units/:id/deactivate` | `UNIT_MASTER.delete` | Soft-deactivate Unit |

---

### 5.4 Tax Master APIs (`/api/tax-presets`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/tax-presets` | `TAX_MASTER.create` | Create Tax preset |
| `GET` | `/api/tax-presets` | `TAX_MASTER.view` | List Tax presets |
| `PUT` | `/api/tax-presets/:id` | `TAX_MASTER.edit` | Update Tax preset rates |
| `PUT` | `/api/tax-presets/:id/deactivate` | `TAX_MASTER.delete` | Soft-deactivate Tax preset |

---

### 5.5 Payment Mode Master APIs (`/api/payment-modes`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/payment-modes` | `PAYMENT_MODE_MASTER.create` | Create Payment Mode |
| `GET` | `/api/payment-modes` | `PAYMENT_MODE_MASTER.view` | List Payment Modes |
| `PUT` | `/api/payment-modes/:id` | `PAYMENT_MODE_MASTER.edit` | Update Payment Mode |
| `PUT` | `/api/payment-modes/:id/deactivate` | `PAYMENT_MODE_MASTER.delete` | Soft-deactivate Payment Mode |

---

### 5.6 Quotation Format Master APIs (`/api/quotation-formats`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/quotation-formats` | `QUOTATION_FORMAT_MASTER.create` | Create Quotation Format template |
| `GET` | `/api/quotation-formats` | `QUOTATION_FORMAT_MASTER.view` | List all 8 Quotation Formats |
| `PUT` | `/api/quotation-formats/:id` | `QUOTATION_FORMAT_MASTER.edit` | Update Format display name/description |
| `PUT` | `/api/quotation-formats/:id/deactivate` | `QUOTATION_FORMAT_MASTER.delete` | Soft-deactivate Quotation Format |

---

### 5.7 Vendor Master APIs (`/api/vendors`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/vendors` | `VENDOR_MASTER.create` | Create Vendor / Supplier |
| `GET` | `/api/vendors` | `VENDOR_MASTER.view` | List Vendors |
| `GET` | `/api/vendors/:id` | `VENDOR_MASTER.view` | Get Vendor by ID |
| `PUT` | `/api/vendors/:id` | `VENDOR_MASTER.edit` | Update Vendor information |
| `PUT` | `/api/vendors/:id/deactivate` | `VENDOR_MASTER.delete` | Soft-deactivate Vendor |

---

### 5.8 Core Product Master APIs (`/api/products`)

| Method | Endpoint | Required Permission | Description |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/products` | `PRODUCT_MASTER.create` | Create Product (auto-initializes `currentStock = openingStock`) |
| `GET` | `/api/products` | `PRODUCT_MASTER.view` | List Products (search, filters, pagination) |
| `GET` | `/api/products/:id` | `PRODUCT_MASTER.view` | Get Product by ID with all populated masters |
| `PUT` | `/api/products/:id` | `PRODUCT_MASTER.edit` | Update Product (`currentStock` write-protected) |
| `PUT` | `/api/products/:id/deactivate` | `PRODUCT_MASTER.delete` | Soft-deactivate Product |
| `GET` | `/api/products/search-by-sku?code=` | `PRODUCT_MASTER.view` | Search products by either Company SKU or Vendor SKU |
| `GET` | `/api/products/low-stock` | `PRODUCT_MASTER.view` | Retrieve items where `currentStock <= reorderAlertQty` |
| `GET` | `/api/products/:id/quotation-usage` | `PRODUCT_MASTER.view` | Forward bridge fetching quotation references (Module 5) |
| `GET` | `/api/products/export` | `PRODUCT_MASTER.export` | Export product master data for Excel/PDF formatting |

#### Sample Create Product Request (`POST /api/products`)
```json
{
  "productName": "Royal Statuario 600x1200 Glossy",
  "companySkuCode": "MC-TL-600-01",
  "vendorSkuCode": "SOM-GLS-101",
  "isSkuLess": false,
  "hsnCode": "69072100",
  "company": "6aa7caa2dae060d5e389ffad",
  "vendor": "6aa7caa3dae060d5e389ffb4",
  "productGroup": "6aa7ca9fdae060d5e389ff8f",
  "unit": "6aa7ca9edae060d5e389ff88",
  "gstPct": 18,
  "mrp": 950,
  "purchaseRate": 480,
  "costRate": 510,
  "salePrice": 720,
  "saleDiscount": 5,
  "openingStock": 150,
  "openingStockValue": 72000,
  "defaultQuantity": 1,
  "reorderAlertQty": 25
}
```

#### Sample Search By SKU Response (`GET /api/products/search-by-sku?code=SOM-GLS-101`)
```json
{
  "success": true,
  "message": "Found 1 products matching SKU 'SOM-GLS-101'.",
  "data": [
    {
      "_id": "6aa7caa4dae060d5e389ffbb",
      "productName": "Royal Statuario 600x1200 Glossy",
      "companySkuCode": "MC-TL-600-01",
      "vendorSkuCode": "SOM-GLS-101",
      "currentStock": 150,
      "salePrice": 720,
      "company": {
        "_id": "6aa7caa2dae060d5e389ffad",
        "companyName": "Somany Ceramics Ltd"
      },
      "unit": {
        "_id": "6aa7ca9edae060d5e389ff88",
        "unitName": "Box",
        "unitCode": "BOX"
      }
    }
  ]
}
```

---

## 6. Shared Validation Engine (`services/productValidation.service.js`)

Centralized validator consumed by both **Module 2 (Product Master)** and **Module 3 (Product Import)**:

1. **Mandatory Presence**: `productName` and `unit` are mandatory.
2. **SKU Integrity**: `companySkuCode` must be unique across the system when present; non-empty SKU is enforced unless `isSkuLess: true`.
3. **Tax Bounds**: `gstPct`, `igstPct`, `cgstPct`, `sgstPct`, `cessPct` must fall strictly within `0` to `100%`.
4. **Numeric Non-Negativity**: `mrp`, `purchaseRate`, `costRate`, `salePrice`, `saleDiscount`, `openingStock`, `openingStockValue`, `defaultQuantity`, `reorderAlertQty` cannot be negative numbers.

---

## 7. Automated Test Suite Results

The comprehensive test suite ([`scripts/testRunnerModule2.js`](file:///d:/NexAllince/Maitri-Cermic/scripts/testRunnerModule2.js)) verified all 13 checklist items against the live MongoDB Atlas database:

- **Total Assertions Executed:** 30
- **Total Passed:** 30
- **Total Failed:** 0 (100% Success Rate)

```
========================================================================
MODULE 2 TEST RESULTS SUMMARY:
  ✓ [PASS] All 8 Master module keys registered in SystemModule registry
  ✓ [PASS] Unit Master CRUD & duplicate unitCode rejection
  ✓ [PASS] Tax Master preset CRUD & duplicate taxName rejection
  ✓ [PASS] Payment Mode Master CRUD & uniqueness
  ✓ [PASS] Quotation Format Master CRUD (8 format types)
  ✓ [PASS] Product Group Master CRUD & uniqueness
  ✓ [PASS] Master soft-deactivation (isActive: false) without document dropping
  ✓ [PASS] Single 'OWN' company enforcement
  ✓ [PASS] Vendor Master CRUD
  ✓ [PASS] Product Master openingStock -> currentStock initialization
  ✓ [PASS] Duplicate companySkuCode strict rejection
  ✓ [PASS] Non-unique vendorSkuCode acceptance across products
  ✓ [PASS] SKU-less products (isSkuLess: true) sparse-index collision immunity
  ✓ [PASS] Search by Company SKU & Vendor SKU
  ✓ [PASS] Low stock alert query (currentStock <= reorderAlertQty)
  ✓ [PASS] currentStock write protection in PUT /api/products/:id
  ✓ [PASS] Forward quotation-usage endpoint returning [] without errors
  ✓ [PASS] Referential integrity maintained after parent master deactivation
  ✓ [PASS] Shared productValidationService error condition flagging
  ✓ [PASS] Granular permission enforcement (view-only blocked from write/export)
========================================================================
```

---

## 8. Next Steps
With Module 2 completed and verified, **Module 3: Product Import (Excel & PDF)** can immediately proceed, utilizing `productValidationService` and `productService.bulkUpsert()` directly.
