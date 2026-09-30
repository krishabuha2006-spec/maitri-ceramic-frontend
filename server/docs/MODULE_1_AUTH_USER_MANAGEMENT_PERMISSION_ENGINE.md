# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 1: AUTH, USER MANAGEMENT & USER-WISE PERMISSION ENGINE
### Comprehensive Technical Documentation, System Architecture, Workflow Diagrams & API Reference

---

## 1. Executive Summary & Purpose

Module 1 is the foundational **Access Control & Identity Layer** for the **Maitri Ceramic ERP & Billing Platform**. All subsequent 15 business modules (Master Management, Customer Management, Quotations, Follow-Ups, Stock, Challans, Invoicing, Payments, Ledgers, Reports, Audit Logs, etc.) rely directly on this module for:

1. **Authentication & Session Security**: Secure mobile/email login, JWT access tokens (15-min lifespan), cryptographic rotating refresh tokens (7-day lifespan, SHA-256 hashed), and instant session invalidation upon logout or user deactivation.
2. **Role Master (Template Layer)**: Centralized management of roles (`Super Admin`, `Sales Executive`, `Sales Manager`, `Store User`, `Accounts User`) with default permission templates used solely at user creation time.
3. **User-Wise Granular Permission Enforcement (Runtime Layer)**: Enforces 6 independent granular actions (`view`, `create`, `edit`, `delete`, `export`, `approve`) and data scoping (`ALL`, `OWN`, `TEAM`) stored per individual user per module.
4. **Dynamic Menu Generation (`/my-menu`)**: Dynamically generates menu structures containing only modules where at least one action is granted. Zero-action modules remain completely invisible.

---

## 2. System Architecture & Two-Layer Permission Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT / UI                               │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Authorization: Bearer <JWT>
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATE MIDDLEWARE                         │
│   - Validates JWT signature & expiry                                   │
│   - Verifies user exists in DB and isActive === true                  │
│   - Attaches req.user                                                  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      CHECK PERMISSION MIDDLEWARE                       │
│                   checkPermission(moduleKey, action)                   │
│                                                                        │
│   1. If req.user.role.isSystemRole === true (Super Admin) ──► ALLOW   │
│   2. Query UserPermission for (req.user._id, moduleKey)                │
│   3. If UserPermission.actions[action] === true ────────────► ALLOW   │
│   4. Else ──────────────────────────────────────────────────► 403     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     DATA SCOPE ENGINE (applyDataScope)                 │
│   - 'ALL'  ──► Unconstrained query                                     │
│   - 'OWN'  ──► Injects { createdBy: req.user._id }                     │
│   - 'TEAM' ──► Injects { createdBy: { $in: teamMemberIds } }           │
└────────────────────────────────────────────────────────────────────────┘
```

### The Two-Layer Design
- **Layer 1: Role Master (Templates Only)**
  - Stores roles and default action sets (`RoleDefaultPermission`).
  - Act as quick-start templates during user creation.
  - **Crucial Rule:** Modifying a Role's default template later does **NOT** retroactively alter already-created users.
- **Layer 2: UserPermission (Runtime Source of Truth)**
  - The `checkPermission` middleware queries `UserPermission` exclusively.
  - Two users with the exact same Role can hold completely distinct permissions.

---

## 3. Granular Action Independence Rules

| Action Flag | Allowed Operations | Blocked Operations |
| :--- | :--- | :--- |
| `view` | View listing and details. | Cannot create, update, delete, export, or approve. |
| `create` | Add new records. | Cannot update existing or delete unless flags are set. |
| `edit` | Modify existing records. | **Does NOT grant delete or approve.** |
| `delete` | Soft delete or deactivate records. | Independent flag; requires explicit grant. |
| `export` | Generate Excel / PDF exports. | Gated separately from view. |
| `approve` | Sensitive approvals (Confirm Quote, Finalize Challan, Approve Return). | Never implied by `edit`. |

> **Zero-Action Principle:** If all 6 action flags on a module are `false`, that module is completely excluded from the `/api/permissions/my-menu` response, and any direct URL navigation or API call returns `403 Forbidden`.

---

## 4. End-to-End System Flows

### A. Authentication & Session Rotation Flow
```
User (Mobile + Password)
       │
       ▼
[POST /api/auth/login] ──► Verify Bcrypt Password + isActive: true
       │
       ├─► Returns: Access Token (15m) + Refresh Token (7d plain)
       └─► Stores in DB: RefreshToken { tokenHash: SHA256(plain), isRevoked: false }
       │
Session Active (Protected API Calls using Authorization: Bearer <AccessToken>)
       │
Access Token Expired (401 TokenExpiredError)
       │
       ▼
[POST /api/auth/refresh-token]
       │
       ├─► Verify incoming Refresh Token hash in DB
       ├─► Check: isRevoked === false AND expiresAt > Date.now()
       ├─► Check: User isActive === true
       ├─► Invalidate old token: oldToken.isRevoked = true
       ├─► Generate and save new Refresh Token (Rotation)
       └─► Returns: New Access Token + New Refresh Token
```

### B. User Creation & Permission Lifecycle Flow
```
1. Super Admin creates Role (e.g., 'Sales Executive')
       │
2. Super Admin sets Role Default Template:
   - PRODUCT_MASTER: view=true
   - QUOTATION: view=true, create=true, edit=false
       │
3. Super Admin creates User 'Ramesh' (Role: 'Sales Executive')
   - System auto-copies RoleDefaultPermission ──► UserPermission for Ramesh
       │
4. Super Admin can later customize Ramesh individually:
   - [POST /api/permissions/assign] -> grants Ramesh PRODUCT_MASTER edit=true
   - Other users with 'Sales Executive' remain view-only.
```

---

## 5. System Modules Registry (All 18 Modules)

| # | Module Key | Module Name | Category / Parent |
| :---: | :--- | :--- | :--- |
| 1 | `USER_MANAGEMENT` | User & Permission Management | SETTINGS |
| 2 | `COMPANY_SETTINGS` | Company Settings | SETTINGS |
| 3 | `AUDIT_LOG` | Audit & Activity Log | SETTINGS |
| 4 | `MASTER_MANAGEMENT` | Master Management | MASTERS |
| 5 | `PRODUCT_MASTER` | Product Master | MASTERS |
| 6 | `PRODUCT_IMPORT` | Product Import (Excel/PDF) | MASTERS |
| 7 | `CUSTOMER` | Customer Management | SALES |
| 8 | `QUOTATION` | Quotation Management | SALES |
| 9 | `FOLLOW_UP` | Follow-Up Management | SALES |
| 10 | `QUOTATION_CONFIRMATION` | Quotation Confirmation | SALES |
| 11 | `STOCK` | Stock Management | INVENTORY |
| 12 | `CHALLAN` | Challan Management | INVENTORY |
| 13 | `INVOICE` | Invoice Management | BILLING |
| 14 | `PAYMENT` | Payment Management | BILLING |
| 15 | `RETURN_NOTE` | Return Management | BILLING |
| 16 | `CUSTOMER_LEDGER` | Customer Ledger & Accounts | ACCOUNTS |
| 17 | `PRODUCT_TRACKING` | Product Tracking | REPORTS |
| 18 | `REPORTS` | Reports & Analytics | REPORTS |

---

## 6. Complete API Reference

Base URL: `http://localhost:5000/api`

### 6.1 Health Check API
- **Endpoint:** `GET /health`
- **Access:** Public
- **Description:** Returns operational status of the backend service.
- **Sample Response (200 OK):**
```json
{
  "success": true,
  "message": "Maitri Ceramic ERP Backend is healthy and operational.",
  "data": {
    "service": "Maitri Ceramic API",
    "version": "1.0.0",
    "timestamp": "2026-09-14T10:06:40.123Z"
  }
}
```

---

### 6.2 Authentication APIs (`/api/auth`)

#### 1. User Login
- **Endpoint:** `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "mobile": "9825702369",
  "password": "YourPassword123"
}
```
*(Or login via `email` and `password`)*
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "_id": "6aa7c7101beff4363ba1f01c",
      "name": "Piyush Bhai (Super Admin)",
      "mobile": "9825702369",
      "email": "admin@maitriceramic.com",
      "role": {
        "_id": "6aa7c7101beff4363ba1f01a",
        "roleName": "Super Admin",
        "isSystemRole": true
      },
      "isActive": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d8f1e29c8e9b41829e84b2a8d4e9c7f1a3b5c7d9...",
    "expiresIn": "15m"
  }
}
```

#### 2. Refresh Token Rotation
- **Endpoint:** `POST /api/auth/refresh-token`
- **Access:** Public
- **Request Body:**
```json
{
  "refreshToken": "d8f1e29c8e9b41829e84b2a8d4e9c7f1a3b5c7d9..."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed successfully.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "b7a9c8e21f43a09e5d6c8b1a2f3e4d5c6b7a8d9e..."
  }
}
```

#### 3. User Logout
- **Endpoint:** `POST /api/auth/logout`
- **Access:** Authenticated (or provide `refreshToken` in body)
- **Request Body (Optional):**
```json
{
  "refreshToken": "b7a9c8e21f43a09e5d6c8b1a2f3e4d5c6b7a8d9e..."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

#### 4. Current User Profile (`/me`)
- **Endpoint:** `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully.",
  "data": {
    "user": {
      "_id": "6aa7c7101beff4363ba1f01c",
      "name": "Piyush Bhai",
      "mobile": "9825702369",
      "role": {
        "_id": "6aa7c7101beff4363ba1f01a",
        "roleName": "Super Admin",
        "isSystemRole": true
      }
    },
    "permissions": [ ... ]
  }
}
```

---

### 6.3 Role Master APIs (`/api/roles`)

| Endpoint | Method | Required Permission | Description |
| :--- | :---: | :--- | :--- |
| `/api/roles` | `POST` | `USER_MANAGEMENT.create` | Create a new Role |
| `/api/roles` | `GET` | `USER_MANAGEMENT.view` | List all Roles |
| `/api/roles/:id` | `PUT` | `USER_MANAGEMENT.edit` | Update Role details |
| `/api/roles/:id` | `DELETE` | `USER_MANAGEMENT.delete` | Delete Role (System role protected) |
| `/api/roles/:id/default-permissions` | `POST` | `USER_MANAGEMENT.approve` | Set Role default permission template |
| `/api/roles/:id/default-permissions` | `GET` | `USER_MANAGEMENT.view` | Get Role default permission template |

#### Example: Setting Role Default Template
- **Endpoint:** `POST /api/roles/6aa7c72ad1d8b643cb1326e6/default-permissions`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "permissions": [
    {
      "moduleKey": "PRODUCT_MASTER",
      "actions": {
        "view": true,
        "create": false,
        "edit": false,
        "delete": false,
        "export": false,
        "approve": false
      }
    },
    {
      "moduleKey": "QUOTATION",
      "actions": {
        "view": true,
        "create": true,
        "edit": true,
        "delete": false,
        "export": true,
        "approve": false
      }
    }
  ]
}
```

---

### 6.4 User Management APIs (`/api/users`)

| Endpoint | Method | Required Permission | Description |
| :--- | :---: | :--- | :--- |
| `/api/users` | `POST` | `USER_MANAGEMENT.create` | Create User (auto-copies Role template) |
| `/api/users` | `GET` | `USER_MANAGEMENT.view` | List Users (with search, pagination & filters) |
| `/api/users/:id` | `GET` | `USER_MANAGEMENT.view` | Get User details & assigned permissions |
| `/api/users/:id` | `PUT` | `USER_MANAGEMENT.edit` | Update User profile |
| `/api/users/:id/deactivate` | `PUT` | `USER_MANAGEMENT.delete` | Deactivate User & revoke all sessions |
| `/api/users/:id/reset-password` | `PUT` | `USER_MANAGEMENT.edit` | Reset password & invalidate sessions |

#### Example: Create User
- **Endpoint:** `POST /api/users`
- **Request Body:**
```json
{
  "name": "Ramesh Patel",
  "mobile": "9876543210",
  "email": "ramesh@maitriceramic.com",
  "password": "SecurePassword123",
  "roleId": "6aa7c72ad1d8b643cb1326e6"
}
```

---

### 6.5 Permission Engine & Menu APIs (`/api/permissions`)

| Endpoint | Method | Required Permission | Description |
| :--- | :---: | :--- | :--- |
| `/api/permissions/modules/seed` | `POST` | System / Super Admin | Idempotently seed all 18 modules |
| `/api/permissions/modules` | `GET` | `USER_MANAGEMENT.view` | List all System Modules |
| `/api/permissions/assign` | `POST` | `USER_MANAGEMENT.approve` | Assign/update individual user permissions |
| `/api/permissions/user/:userId` | `GET` | `USER_MANAGEMENT.view` | Get all permissions for target user |
| `/api/permissions/revoke` | `PUT` | `USER_MANAGEMENT.approve` | Revoke a user's access to a module |
| `/api/permissions/my-menu` | `GET` | Authenticated (Self) | Returns active menu for logged-in user |

#### Example: Assigning Granular Permissions
- **Endpoint:** `POST /api/permissions/assign`
- **Request Body:**
```json
{
  "userId": "6aa7c72ed1d8b643cb132700",
  "permissions": [
    {
      "moduleKey": "QUOTATION",
      "dataScope": "OWN",
      "actions": {
        "view": true,
        "create": true,
        "edit": true,
        "delete": false,
        "export": true,
        "approve": false
      }
    },
    {
      "moduleKey": "CUSTOMER",
      "dataScope": "ALL",
      "actions": {
        "view": true,
        "create": true,
        "edit": false,
        "delete": false,
        "export": false,
        "approve": false
      }
    }
  ]
}
```

#### Example: `GET /api/permissions/my-menu` Output
```json
{
  "success": true,
  "message": "My Menu retrieved successfully.",
  "data": [
    {
      "moduleKey": "QUOTATION",
      "moduleName": "Quotation Management",
      "parentModule": "SALES",
      "dataScope": "OWN",
      "actions": {
        "view": true,
        "create": true,
        "edit": true,
        "delete": false,
        "export": true,
        "approve": false
      }
    },
    {
      "moduleKey": "CUSTOMER",
      "moduleName": "Customer Management",
      "parentModule": "SALES",
      "dataScope": "ALL",
      "actions": {
        "view": true,
        "create": true,
        "edit": false,
        "delete": false,
        "export": false,
        "approve": false
      }
    }
  ]
}
```

---

## 7. Integration Guide for Modules 2 to 16

Every route created across the entire Maitri Ceramic system plugs directly into this module:

### Route Protection Pattern
```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');
const productController = require('../controllers/product.controller');

router.use(authenticate);

// List products (view permission)
router.get('/', checkPermission('PRODUCT_MASTER', 'view'), productController.list);

// Create product (create permission)
router.post('/', checkPermission('PRODUCT_MASTER', 'create'), productController.create);

// Update product (edit permission)
router.put('/:id', checkPermission('PRODUCT_MASTER', 'edit'), productController.update);

// Delete product (delete permission)
router.delete('/:id', checkPermission('PRODUCT_MASTER', 'delete'), productController.remove);

// Export products to Excel (export permission)
router.get('/export', checkPermission('PRODUCT_MASTER', 'export'), productController.exportExcel);

// Approve / Confirm action (approve permission)
router.put('/:id/confirm', checkPermission('QUOTATION', 'approve'), productController.confirm);
```

### Controller Data Scoping Pattern
```javascript
const { applyDataScope } = require('../utils/dataScope.util');
const Quotation = require('../models/Quotation');

const listQuotations = async (req, res, next) => {
  try {
    // Automatically adds { createdBy: req.user._id } for OWN or keeps open for ALL
    const queryFilter = applyDataScope({ isDeleted: false }, req.userPermission, req.user);

    const quotations = await Quotation.find(queryFilter);
    return sendSuccess(res, 'Quotations retrieved.', quotations);
  } catch (err) {
    next(err);
  }
};
```

---

## 8. Automated Test Suite Results

The comprehensive test suite (`scripts/testRunner.js`) verified all 19 checklist items against the live database:

- **Total Assertions Executed:** 37
- **Total Passed:** 37
- **Total Failed:** 0 (100% Success Rate)

```
========================================================================
TEST RESULTS SUMMARY:
  ✓ [PASS] Health check returns 200 OK
  ✓ [PASS] SystemModule seed idempotency
  ✓ [PASS] Super Admin role protection from deletion
  ✓ [PASS] Duplicate role and duplicate mobile rejection
  ✓ [PASS] Password hashing & exclusion from API responses
  ✓ [PASS] Wrong password rejection (401)
  ✓ [PASS] Refresh token rotation & single-use enforcement
  ✓ [PASS] Logout session revocation
  ✓ [PASS] Role template auto-copying to new users
  ✓ [PASS] User-wise permission customization (identical roles, different rights)
  ✓ [PASS] Granular action independence (edit !== delete)
  ✓ [PASS] Zero-action module exclusion from /my-menu
  ✓ [PASS] Instant permission revocation on subsequent API calls
  ✓ [PASS] User deactivation session invalidation
  ✓ [PASS] DataScope query filtering (ALL / OWN / TEAM)
  ✓ [PASS] Role template edits do NOT mutate existing users
========================================================================
```

---

## 9. Next Steps
With Module 1 fully operational, verified, and documented, development of **Module 2: Master Management (Company, Product, Vendor, Customer, Unit, Tax, Payment Mode, Quotation Format)** can proceed smoothly.
