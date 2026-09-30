# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 3: PRODUCT IMPORT (EXCEL & PDF)
### Complete Technical Documentation, Architecture, Cloudinary Storage, Preview-Commit Pipeline & API Reference

---

## 1. Executive Summary & Purpose

Module 3 delivers the **High-Performance Bulk Catalog Import Pipeline** for the Maitri Ceramic ERP platform. It enables administrators and inventory operators to ingest large vendor price lists, product catalogs, and tile shade matrices from **Excel (.xlsx, .xls, .csv)** and **PDF** documents directly into the Product Master.

### Core Responsibilities
1. **Cloudinary Cloud Storage**: Every uploaded file is securely streamed to Cloudinary (`maitri-ceramic/imports/`) before parsing. The returned HTTPS URL is permanently recorded on the import batch and accessible across the client UI.
2. **Zero-Write Simulation (Preview Engine)**: The preview endpoint parses uploaded sheets, resolves foreign-key master strings against the database, executes validation rules in memory, and returns a detailed preview without writing a single record to the database.
3. **Partial-Success Bulk Upsert (Commit Engine)**: During commit, valid records are inserted or updated, while invalid records are trapped, isolated, and logged to the batch error log — eliminating all-or-nothing failures.
4. **Repeat Import Stock Protection**: When re-importing updated vendor price lists, product pricing, HSN, names, and descriptions are refreshed, but `currentStock` is **strictly preserved** to prevent inventory drift from Module 8 (Stock Ledger).
5. **Intelligent Header Mapping Profiles**: Computes deterministic SHA-256 signatures of sheet header arrays (`headerSignature`). Custom mapping layouts can be saved per vendor/supplier and are auto-detected upon subsequent uploads.
6. **Downloadable Excel Error Reports**: Operators can download an Excel workbook (`/api/imports/:id/error-report`) containing only the failed rows annotated with exact validation error explanations for rapid correction and re-upload.
7. **PDF Tabular Extraction & Fallback**: Extracts tabular data from digital PDF price sheets using delimiter and token heuristics. Non-tabular or scanned PDFs are flagged with `EXTRACTION_FAILED` prompting Excel submission.
8. **Dual Permission Authorization Guards**: Commit routes enforce chained authorization requiring both `PRODUCT_IMPORT:create` AND `PRODUCT_MASTER:create` permissions.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│         (checkPermission('PRODUCT_IMPORT') + 'PRODUCT_MASTER')         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MODULE 2: MASTER MANAGEMENT                       │
│      (Company, ProductGroup, Vendor, UnitMaster, TaxMaster Lookup)     │
│             & Reusable productValidationService Engine                 │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               MODULE 3: PRODUCT IMPORT (EXCEL & PDF)                   │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Cloudinary Stream│  │  SHA-256 Signatures│ │ Zero-Write Preview  │  │
│  │   Cloud Storage  │  │ & Field Mapping  │  │      Simulation      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Partial-Success  │  │ Stock Protection │  │ Excel Error Report   │  │
│  │   Bulk Upsert    │  │ (Stock Preserved)│  │   Buffer Generator   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               MODULE 2: PRODUCT MASTER (CORE DATA STORE)               │
│                     MODULE 8: STOCK LEDGER TRACKING                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture & Import Pipeline Workflow

```
[ Vendor File (Excel / PDF) ]
              │
              ▼ (POST /api/imports/preview)
    [ Multer Memory Storage ]
              │
              ▼
    [ Cloudinary Uploader ] ───► [ Cloudinary Cloud Storage (Permanent HTTPS URL) ]
              │
              ▼
    [ Format Parser (SheetJS / PDF-Parse) ]
              │
              ├──► Computes deterministic SHA-256 headerSignature
              ├──► Matches saved ImportFieldMapping or generates suggestedMapping
              │
              ▼
    [ Master Reference Resolver ]
              │
              ├──► Matches Company Name ──► Company ObjectId
              ├──► Matches Group Name   ──► ProductGroup ObjectId
              ├──► Matches Vendor Name  ──► Vendor ObjectId
              └──► Matches Unit Name    ──► UnitMaster ObjectId
              │
              ▼
    [ In-Memory ProductValidationService (ZERO DB WRITES) ]
              │
              ├── Validates Mandatory Fields (Product Name, Unit)
              ├── Checks In-File Duplicate SKUs
              ├── Identifies Existing Products in DB (for safe update)
              │
              ▼
    [ Returns Preview Payload + Creates PREVIEWED ImportBatch ]
              │
              ▼ (POST /api/imports/:id/commit)
    [ Dual Permission Verification (PRODUCT_IMPORT + PRODUCT_MASTER) ]
              │
              ▼
    [ Execution Engine ]
              ├── Valid Records ────► Product.create() OR Product.findByIdAndUpdate()
              │                       (Stock STRICTLY preserved on existing products)
              │
              └── Failed Records ───► Recorded in ImportBatch.errors
                                      (Downloadable as .xlsx Error Report)
```

---

## 4. Key Engineering & Business Rules

### 4.1 Cloudinary Storage Lifecycle
- Uploads are streamed as raw buffers directly to Cloudinary folder `maitri-ceramic/imports/`.
- The generated secure URL (e.g., `https://res.cloudinary.com/maitri/...`) and `cloudinaryPublicId` are stored in `ImportBatch`.
- In the frontend, operators can click **View Original File** to open or download the source spreadsheet directly from Cloudinary.

### 4.2 In-File Duplicate SKU Prevention
- If the uploaded file contains the same `companySkuCode` in multiple rows, row 1 is accepted, and row 2+ are immediately flagged with `Duplicate Company SKU Code 'XXX' detected within this file (Row N)`.

### 4.3 Repeat Import Stock Preservation (Critical Rule)
- When re-importing a vendor catalog, existing products are identified by `companySkuCode` (or `vendorSkuCode`).
- The system updates: `productName`, `hsnCode`, `company`, `vendor`, `productGroup`, `unit`, `gstPct`, `mrp`, `purchaseRate`, `costRate`, `salePrice`, `saleDiscount`, and `updatedBy`.
- **`currentStock` is explicitly excluded from the update payload.** Only Module 8 (Stock Management) ledger transactions may modify stock quantities.

### 4.4 Header Signature & Vendor Mapping Profiles
- Column headers are trimmed, uppercased, sorted, and hashed using `SHA-256`.
- If an `ImportFieldMapping` profile exists for that signature, its custom column-to-field mapping is applied automatically.
- Operators can create and save new mapping profiles via `/api/imports/mappings`.

### 4.5 Partial-Success Batch Statuses
- **`PREVIEWED`**: Uploaded and simulated; waiting for user confirmation to commit.
- **`COMMITTED`**: All rows successfully inserted or updated.
- **`PARTIAL_SUCCESS`**: Valid rows imported; failed rows logged in `errors`.
- **`EXTRACTION_FAILED`**: Zero rows imported or unstructured PDF layout.

---

## 5. Module 3 API Reference

### 5.1 POST `/api/imports/preview`
Uploads file to Cloudinary, parses data, runs zero-write validation, and returns preview.
- **Permission**: `PRODUCT_IMPORT:create`
- **Content-Type**: `multipart/form-data`
- **Body**:
  - `file`: Binary file (`.xlsx`, `.xls`, `.csv`, `.pdf`)
  - `mapping`: (Optional) JSON string of custom column mapping `{ "Source Col": "systemField" }`
- **Response**:
```json
{
  "success": true,
  "message": "File preview generated successfully",
  "data": {
    "importBatchId": "6644f1234567890abcdef123",
    "fileUrl": "https://res.cloudinary.com/djn7ivlo7/raw/upload/v1715690000/maitri-ceramic/imports/sample.xlsx",
    "sourceType": "EXCEL",
    "headerSignature": "a1e9f78864bc3ac6...",
    "headers": ["Product Name", "Company SKU", "Unit", "Sale Price"],
    "suggestedMapping": {
      "Product Name": "productName",
      "Company SKU": "companySkuCode",
      "Unit": "unit",
      "Sale Price": "salePrice"
    },
    "hasSavedMapping": true,
    "savedMappingName": "Supplier ABC Format",
    "totalRows": 150,
    "validRowsCount": 145,
    "invalidRowsCount": 5,
    "previewRows": [
      {
        "rowNumber": 1,
        "mappedData": {
          "productName": "Statuario White 600x1200",
          "companySkuCode": "MTR-STAT-6012",
          "salePrice": 650
        },
        "isExisting": false,
        "isValid": true,
        "errors": []
      },
      {
        "rowNumber": 2,
        "mappedData": {
          "productName": "",
          "companySkuCode": "MTR-ERR-001"
        },
        "isExisting": false,
        "isValid": false,
        "errors": ["Product name is mandatory."]
      }
    ]
  }
}
```

---

### 5.2 POST `/api/imports/:id/commit`
Commits cached rows into Product Master with partial-success bulk upsert and stock protection.
- **Permissions**: `PRODUCT_IMPORT:create` **AND** `PRODUCT_MASTER:create`
- **URL Param**: `id` (ImportBatch ID)
- **Body**:
```json
{
  "mapping": {
    "Product Name": "productName",
    "Company SKU": "companySkuCode",
    "Unit": "unit",
    "Sale Price": "salePrice"
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Import completed with status: PARTIAL_SUCCESS",
  "data": {
    "importBatchId": "6644f1234567890abcdef123",
    "status": "PARTIAL_SUCCESS",
    "totalRows": 150,
    "successCount": 145,
    "createdCount": 130,
    "updatedCount": 15,
    "failedCount": 5,
    "errors": [
      {
        "rowNumber": 2,
        "message": "Product name is mandatory."
      }
    ],
    "fileUrl": "https://res.cloudinary.com/djn7ivlo7/raw/upload/sample.xlsx"
  }
}
```

---

### 5.3 GET `/api/imports/:id/error-report`
Streams a dynamically generated Excel workbook (`.xlsx`) containing only the failed rows, annotated with error reasons.
- **Permission**: `PRODUCT_IMPORT:read`
- **Response**: Binary stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- **Headers**: `Content-Disposition: attachment; filename=Import_Errors_6644f1234567890abcdef123.xlsx`

---

### 5.4 GET `/api/imports`
Fetches paginated import batch history with filters for `status` and `sourceType`.
- **Permission**: `PRODUCT_IMPORT:read`
- **Query Params**: `page=1`, `limit=20`, `status=PARTIAL_SUCCESS`, `sourceType=EXCEL`
- **Response**:
```json
{
  "success": true,
  "data": {
    "batches": [
      {
        "_id": "6644f1234567890abcdef123",
        "sourceType": "EXCEL",
        "originalFileName": "Vendor_Price_List_2026.xlsx",
        "fileUrl": "https://res.cloudinary.com/djn7ivlo7/raw/upload/...",
        "status": "PARTIAL_SUCCESS",
        "totalRows": 150,
        "successCount": 145,
        "createdCount": 130,
        "updatedCount": 15,
        "failedCount": 5,
        "uploadedBy": {
          "_id": "6644e0000000000000000001",
          "fullName": "Admin User",
          "username": "admin"
        },
        "committedAt": "2026-09-14T10:30:00.000Z",
        "createdAt": "2026-09-14T10:28:00.000Z"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

---

### 5.5 GET `/api/imports/:id`
Retrieves single import batch details including complete error logs and Cloudinary URL.
- **Permission**: `PRODUCT_IMPORT:read`

---

### 5.6 Mapping Profiles Endpoints

#### POST `/api/imports/mappings`
Saves or updates a custom field mapping profile for a header signature.
- **Permission**: `PRODUCT_IMPORT:create`
- **Body**:
```json
{
  "mappingName": "Somany Tiles Standard Format",
  "sourceType": "EXCEL",
  "headerSignature": "a1e9f78864bc3ac6...",
  "mapping": {
    "Item Name": "productName",
    "Our Code": "companySkuCode",
    "Supplier Code": "vendorSkuCode",
    "UOM": "unit",
    "Selling Rate": "salePrice",
    "Landing Cost": "purchaseRate"
  }
}
```

#### GET `/api/imports/mappings/signature/:signature`
Finds an active mapping profile for an uploaded file's signature.
- **Permission**: `PRODUCT_IMPORT:read`

#### GET `/api/imports/mappings`
Lists all saved mapping profiles.
- **Permission**: `PRODUCT_IMPORT:read`

---

## 6. Verification Suite & Quality Assurance

| # | Test Scenario | Expected Result | Verification Status |
|---|---------------|-----------------|---------------------|
| 1 | `PRODUCT_IMPORT` Registry | Module registered in SystemModule under `MASTERS` | Verified (PASS) |
| 2 | Deterministic Hashing | Identical column lists produce identical SHA-256 signatures | Verified (PASS) |
| 3 | Zero-Write Preview | Product count before preview equals count after preview | Verified (PASS) |
| 4 | In-Memory Validation | Accurately counts valid rows vs invalid rows before write | Verified (PASS) |
| 5 | In-File Duplicate SKU | Catches duplicate SKU occurring in multiple rows of same file | Verified (PASS) |
| 6 | Partial-Success Commit | Imports valid rows (145), isolates invalid rows (5) into batch errors | Verified (PASS) |
| 7 | Initial Stock Setup | New products default to `currentStock = 0` (Stock ledger ready) | Verified (PASS) |
| 8 | Stock Protection | Repeat import updates pricing/attributes but preserves `currentStock` | Verified (PASS) |
| 9 | Error Report Generation | Generates `.xlsx` workbook containing failed rows and error reasons | Verified (PASS) |
| 10| Mapping Profiles | Saves and retrieves header mappings by SHA-256 signature | Verified (PASS) |
| 11| PDF Unstructured Fallback| Flags non-tabular / marketing PDFs with `EXTRACTION_FAILED` | Verified (PASS) |
| 12| Dual Permission Guard | Requires both `PRODUCT_IMPORT` and `PRODUCT_MASTER` permissions | Verified (PASS) |
| 13| Import Batch History | Logs Cloudinary URL, row counts, and status per upload | Verified (PASS) |

---

## 7. Operational Notes for Deployment

1. **Cloudinary Credentials**: Ensure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are present in `.env`.
2. **File Size Limit**: Multer upload middleware defaults to 20MB per upload (`fileSize: 20 * 1024 * 1024`).
3. **Swagger Interactive UI**: Test all endpoints live at `http://localhost:5000/api/docs` under the **Product Import (Excel/PDF)** tag.
