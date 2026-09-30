# MAITRI CERAMIC - CUSTOMER, BILLING & INVENTORY MANAGEMENT SYSTEM
## MODULE 6: FOLLOW-UP MANAGEMENT & PROACTIVE SALES ALERT ENGINE
### Complete Technical Documentation, Architecture, Status Workflow, Alert Rules & API Reference

---

## 1. Executive Summary & Purpose

Module 6 builds **Follow-Up Management** — the operational sales tracking and alert module created to solve the client's explicitly flagged business bottleneck:

> *"Didn't get followup of quotation — Missed follow-ups ના કારણે sales opportunities lost થઈ જાય છે."*

This module attaches a dated, auditable, trackable chronological follow-up journal to every Quotation (Module 5). Furthermore, it establishes strict system discipline: **Module 6 is the primary operational module permitted to drive Quotation's `status` field** throughout its active sales lifecycle (`SENT` &rarr; `FOLLOW_UP_PENDING` &rarr; `CUSTOMER_INTERESTED` &rarr; `NEGOTIATION` &rarr; `REJECTED` / `EXPIRED` / `CLOSED`).

### Core Capabilities
1. **Quotation Status Driving Discipline**: Follow-Up logs act as the state machine driver for Quotation records. Every follow-up recorded atomically updates `Quotation.status` via `quotationService.updateStatus()`.
2. **Resulting Status Restriction & Module Boundaries**: Module 6 owns and sets the 7 operational status values (`FOLLOW_UP_PENDING`, `FOLLOW_UP_COMPLETED`, `CUSTOMER_INTERESTED`, `NEGOTIATION`, `REJECTED`, `EXPIRED`, `CLOSED`). Upstream initial statuses (`DRAFT`, `SENT`) belong to Module 5; terminal conversion statuses (`CONFIRMED`, `PARTIALLY_CONFIRMED`) belong exclusively to Module 7.
3. **Multi-Entry Chronological Timeline**: Each Quotation maintains an immutable, chronological history of customer interactions, communication channels, responses, expected order values, and next action items (newest-first).
4. **Recency-Aware Status Integrity**: Editing an older historical follow-up entry updates its notes/remarks without retroactively corrupting or overriding the current Quotation status. Only editing the **most recent** active follow-up updates the current live Quotation status.
5. **No Auto-Reversion on Soft-Deletion**: Soft-deleting a follow-up log marks it inactive for historical audit but does not trigger fragile automated status rollbacks. Status adjustments are explicitly performed by logging a new follow-up entry.
6. **5-Category Proactive Sales Alert Engine**: On-demand server-side analysis that cross-references active Quotations and Follow-Up logs to identify:
   - **Category 1: No Follow-Up Yet**: Active quotations sent to customers with zero follow-up attempts.
   - **Category 2: Overdue Follow-Ups**: Quotations where scheduled `nextFollowUpDate` is in the past and no subsequent follow-up has occurred.
   - **Category 3: Due Today Follow-Ups**: Quotations scheduled for contact today.
   - **Category 4: Expiring Soon Quotations**: Quotations whose validity date is approaching within 3 days.
   - **Category 5: No Customer Response**: Quotations whose latest contact attempt received no customer feedback.
7. **Customer 360° History Integration**: Seamlessly feeds Module 4's `GET /api/customers/:id/history` endpoint with real follow-up activity.
8. **Granular Role & DataScope Enforcement**: Sales Executives with `dataScope: OWN` see and manage follow-ups only for their assigned quotations, while Sales Managers with `dataScope: ALL` monitor team-wide follow-up pipelines.

---

## 2. Where This Fits in the ERP Ecosystem

```
┌────────────────────────────────────────────────────────────────────────┐
│                     MODULE 1: AUTH & PERMISSION ENGINE                 │
│               (authenticate + checkPermission('FOLLOW_UP'))            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    MODULE 6: FOLLOW-UP MANAGEMENT                      │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Chronological Timeline Log   │    │ 5-Category Alert Engine      │  │
│  │ (Call, WhatsApp, In-Person)  │    │ (Overdue, Due Today, Expire) │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐  │
│  │ Quotation State Driver       │    │ Recency-Aware Status Sync    │  │
│  │ (FOLLOW_UP_PENDING -> NEG)   │    │ (Protects Historical Audits) │  │
│  └──────────────────────────────┘    └──────────────────────────────┘  │
└───────┬────────────────────────────┬────────────────────────────┬──────┘
        │ (read/write status)        │ (customerId)               │ (read context)
        ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    MODULE 5:     │       │    MODULE 4:     │       │    MODULE 7:     │
│    QUOTATION     │       │  CUSTOMER 360°   │       │    QUOTATION     │
│    MANAGEMENT    │       │     JOURNEY      │       │   CONFIRMATION   │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 3. Quotation Status State Machine & Ownership Matrix

| Status Value | Owning Module | Set Via API | Notes & Governance |
| :--- | :--- | :--- | :--- |
| `DRAFT` | **Module 5** (Quotation) | `POST /api/quotations` | Initial state when salesperson creates a quote. |
| `SENT` | **Module 5** (Quotation) | `POST /api/quotations/:id/send` | Dispatched to customer via WhatsApp/Email/Print. |
| `FOLLOW_UP_PENDING` | **Module 6** (Follow-Up) | `POST /api/follow-ups` | Follow-up logged, awaiting customer review. |
| `FOLLOW_UP_COMPLETED`| **Module 6** (Follow-Up) | `POST /api/follow-ups` | Communication completed for current cycle. |
| `CUSTOMER_INTERESTED`| **Module 6** (Follow-Up) | `POST /api/follow-ups` | Customer selected models/designs, moving forward. |
| `NEGOTIATION` | **Module 6** (Follow-Up) | `POST /api/follow-ups` | Price, payment terms, or discount negotiations underway. |
| `REJECTED` | **Module 6** (Follow-Up) | `POST /api/follow-ups` | Customer declined (reason recorded in remarks). |
| `EXPIRED` | **Module 6** (Follow-Up) | `POST /api/follow-ups` | Validity lapsed or customer unresponsive. |
| `CLOSED` | **Module 6** (Follow-Up) | `POST /api/follow-ups` | Deal closed without conversion. |
| `CONFIRMED` | **Module 7** (Confirmation)| `POST /api/quotation-confirmations` | Order confirmed, materials reserved. |
| `PARTIALLY_CONFIRMED`| **Module 7** (Confirmation)| `POST /api/quotation-confirmations` | Partial quantity/items confirmed. |

---

## 4. 5-Category Proactive Sales Alert Engine Architecture

The alert engine (`GET /api/follow-ups/alerts`) runs server-side evaluations across all active quotations:

```
                          ┌──────────────────────────┐
                          │ Active Non-Terminal      │
                          │ Quotations (Module 5)    │
                          └────────────┬─────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
   │ Category 1:     │        │ Category 2:     │        │ Category 3:     │
   │ No Follow-Up Yet│        │ Overdue FollowUp│        │ Due Today       │
   │ (Zero entries logged)    │ (nextDate < Today)       │ (nextDate = Today)      │
   └─────────────────┘        └─────────────────┘        └─────────────────┘
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       ▼
            ┌─────────────────────────────────────────────────────┐
            │ Category 4: Expiring Soon (validityDate <= 3 Days)  │
            │ Category 5: No Customer Response (Null/Empty Resp)  │
            └─────────────────────────────────────────────────────┘
```

1. **Category 1 — No Follow-Up Yet (`noFollowUpYet`)**:
   - Condition: `quotation.isActive == true`, status is non-terminal, and zero active `FollowUp` entries exist.
   - Purpose: Alerts sales manager immediately when a quote was dispatched but never followed up.
2. **Category 2 — Overdue Follow-Up (`overdueFollowUp`)**:
   - Condition: Latest active follow-up has `nextFollowUpDate < startOfToday` and status is non-terminal.
   - Computed Metadata: Returns `daysOverdue` for prioritization.
3. **Category 3 — Due Today Follow-Up (`dueTodayFollowUp`)**:
   - Condition: Latest active follow-up has `startOfToday <= nextFollowUpDate <= endOfToday`.
   - Purpose: Generates the salesperson's daily calling list.
4. **Category 4 — Expiring Soon Quotations (`expiringSoonQuotations`)**:
   - Condition: `quotation.validityDate` falls between today and today + 3 days.
   - Computed Metadata: Returns `daysRemaining`.
5. **Category 5 — No Customer Response (`noCustomerResponse`)**:
   - Condition: Latest active follow-up has empty, null, or whitespace-only `customerResponse`.
   - Purpose: Flags uncontacted or unresponsive customer leads.

---

## 5. Database Schema & Data Dictionary

### Collection: `followups` (`models/FollowUp.js`)

| Field Name | Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `quotation` | `ObjectId` | Ref &rarr; `Quotation`, Required, Indexed | Target Quotation being followed up. |
| `followUpDate` | `Date` | Required, Default: `Date.now` | Date and time communication took place. |
| `nextFollowUpDate` | `Date` | Default: `null`, Indexed | Next scheduled follow-up reminder date. |
| `followUpUser` | `ObjectId` | Ref &rarr; `User`, Required, Indexed | Sales executive conducting the follow-up. |
| `communicationType`| `String` | Enum: `['CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER']`, Required | Channel used for customer interaction. |
| `customerResponse` | `String` | Default: `null`, Trimmed | Summary of customer's feedback and statements. |
| `remarks` | `String` | Default: `null`, Trimmed | Internal sales remarks, competitor info, site notes. |
| `expectedOrderValue`| `Number` | Min: `0`, Default: `null` | Salesperson's projected order value (₹). |
| `nextAction` | `String` | Default: `null`, Trimmed | Next planned operational step (e.g. send samples). |
| `resultingStatus` | `String` | Enum (7 Module-6 Statuses), Required | The state this follow-up transitioned the Quotation to. |
| `isActive` | `Boolean` | Default: `true`, Indexed | Soft-deletion flag preserving auditability. |
| `createdBy` | `ObjectId` | Ref &rarr; `User`, Required | Creator of this record. |
| `updatedBy` | `ObjectId` | Ref &rarr; `User`, Default: `null` | User who last updated remarks or dates. |
| `createdAt` / `updatedAt`| `Date` | Automatic timestamps | Audit timestamps. |

### Indexes
- `{ quotation: 1, followUpDate: -1, createdAt: -1 }` &mdash; Optimized for timeline lookups and recency evaluation.
- `{ nextFollowUpDate: 1 }` &mdash; High-speed index for daily alerts and overdue queries.
- `{ followUpUser: 1 }` &mdash; Scoped performance index for `dataScope: OWN` queries.
- `{ isActive: 1 }` &mdash; Active record filtering.

---

## 6. Business Rules & Validation Suite

| Rule ID | Rule Title | Detailed Specification |
| :--- | :--- | :--- |
| **BR-FU-01** | **Active Quotation Prerequisite** | Logging a follow-up against an inactive or cancelled quotation is rejected with `404 Not Found` / `400 Bad Request`. |
| **BR-FU-02** | **Strict Status Scope Restriction** | `resultingStatus` is restricted exclusively to the 7 Module-6-owned values. Submitting `CONFIRMED`, `PARTIALLY_CONFIRMED`, `DRAFT`, or `SENT` is rejected with `400 Bad Request`. |
| **BR-FU-03** | **Atomic Multi-Collection State Sync** | Creating a follow-up creates the `FollowUp` document and executes `quotationService.updateStatus()`. If the quotation status update fails, the created follow-up is rolled back immediately. |
| **BR-FU-04** | **Recency-Aware Edit Protection** | When an existing follow-up is modified (`PUT /api/follow-ups/:id`), `Quotation.status` is updated **ONLY IF** that record is currently the most recent active follow-up for that quotation. Editing older logs leaves current quotation status untouched. |
| **BR-FU-05** | **No Auto-Reversion on Soft-Delete** | Deactivating a follow-up (`PUT /:id/deactivate`) marks it `isActive: false` but does not auto-revert quotation status. Status adjustments require logging a new follow-up. |
| **BR-FU-06** | **Chronological Date Consistency** | `nextFollowUpDate` must be on or after `followUpDate`. Setting a next-follow-up date in the past relative to contact date is rejected. |
| **BR-FU-07** | **Customer 360° History Supply** | `followUpService.getByCustomer(customerId)` aggregates all follow-up activity across all customer quotations and supplies real data to Module 4. |

---

## 7. Complete API Reference

### 1. Log New Follow-Up
- **Method & Route**: `POST /api/follow-ups`
- **Permission**: `FOLLOW_UP:create`
- **Request Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Request Body**:
```json
{
  "quotationId": "6aa8e9ba9f4e2dfd4bc01550",
  "followUpDate": "2026-09-15T09:00:00.000Z",
  "nextFollowUpDate": "2026-09-18T10:00:00.000Z",
  "communicationType": "CALL",
  "customerResponse": "Client reviewing quotation with their architect.",
  "remarks": "Sent product catalogue PDF on WhatsApp.",
  "expectedOrderValue": 110000,
  "nextAction": "Call back on Thursday morning.",
  "resultingStatus": "FOLLOW_UP_PENDING"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Follow-up logged successfully and quotation status updated.",
  "data": {
    "_id": "6aa8e9bd9f4e2dfd4bc01562",
    "quotation": {
      "_id": "6aa8e9ba9f4e2dfd4bc01550",
      "quotationNumber": "QT-2026-001",
      "status": "FOLLOW_UP_PENDING",
      "grandTotal": 112100
    },
    "followUpDate": "2026-09-15T09:00:00.000Z",
    "nextFollowUpDate": "2026-09-18T10:00:00.000Z",
    "communicationType": "CALL",
    "customerResponse": "Client reviewing quotation with their architect.",
    "resultingStatus": "FOLLOW_UP_PENDING",
    "isActive": true
  }
}
```

---

### 2. Follow-Up Alert Engine
- **Method & Route**: `GET /api/follow-ups/alerts`
- **Permission**: `FOLLOW_UP:view`
- **Query Parameters**: `?salespersonId=` (optional, for manager monitoring)
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Follow-up alerts computed successfully.",
  "data": {
    "summary": {
      "noFollowUpYetCount": 3,
      "overdueFollowUpCount": 2,
      "dueTodayFollowUpCount": 4,
      "expiringSoonCount": 1,
      "noCustomerResponseCount": 2,
      "totalAlerts": 12
    },
    "noFollowUpYet": [
      {
        "quotationId": "6aa8e9ba9f4e2dfd4bc01550",
        "quotationNumber": "QT-2026-003",
        "quotationDate": "2026-09-15T08:00:00.000Z",
        "customer": {
          "id": "6aa8e9ba9f4e2dfd4bc0154c",
          "customerName": "Shreeji Builders",
          "mobile": "9900112233",
          "city": "Surat"
        },
        "status": "SENT",
        "grandTotal": 75000,
        "latestFollowUp": null
      }
    ],
    "overdueFollowUp": [
      {
        "quotationNumber": "QT-2026-004",
        "daysOverdue": 3,
        "latestFollowUp": {
          "nextFollowUpDate": "2026-09-12T10:00:00.000Z",
          "communicationType": "CALL"
        }
      }
    ],
    "dueTodayFollowUp": [],
    "expiringSoonQuotations": [],
    "noCustomerResponse": []
  }
}
```

---

### 3. Chronological Quotation Timeline
- **Method & Route**: `GET /api/follow-ups/quotation/:quotationId/timeline`
- **Permission**: `FOLLOW_UP:view`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Quotation follow-up timeline retrieved successfully.",
  "data": {
    "quotation": {
      "_id": "6aa8e9ba9f4e2dfd4bc01550",
      "quotationNumber": "QT-2026-001",
      "status": "CUSTOMER_INTERESTED",
      "grandTotal": 112100
    },
    "totalEntries": 2,
    "timeline": [
      {
        "_id": "6aa8e9be9f4e2dfd4bc0156e",
        "followUpDate": "2026-09-18T11:00:00.000Z",
        "communicationType": "IN_PERSON",
        "customerResponse": "Architect selected Royal Statuario tile design.",
        "resultingStatus": "CUSTOMER_INTERESTED",
        "followUpUser": { "name": "Lax Savani" }
      },
      {
        "_id": "6aa8e9bd9f4e2dfd4bc01562",
        "followUpDate": "2026-09-15T09:00:00.000Z",
        "communicationType": "CALL",
        "customerResponse": "Client reviewing quotation with their architect.",
        "resultingStatus": "FOLLOW_UP_PENDING",
        "followUpUser": { "name": "Lax Savani" }
      }
    ]
  }
}
```

---

### 4. List Follow-Up Entries
- **Method & Route**: `GET /api/follow-ups`
- **Permission**: `FOLLOW_UP:view` (Filtered by `dataScope: ALL | OWN | TEAM`)
- **Query Parameters**: `?page=1&limit=20&quotationId=&customerId=&followUpUserId=&resultingStatus=&from=&to=`
- **Response `200 OK`**: Standard paginated list.

---

### 5. Update Follow-Up Entry
- **Method & Route**: `PUT /api/follow-ups/:id`
- **Permission**: `FOLLOW_UP:edit`
- **Business Behavior**: Updates fields; re-evaluates Quotation status only if this entry is the most recent active log.

---

### 6. Soft-Deactivate Follow-Up Entry
- **Method & Route**: `PUT /api/follow-ups/:id/deactivate`
- **Permission**: `FOLLOW_UP:delete`
- **Business Behavior**: Sets `isActive: false`; Quotation status is preserved.

---

### 7. Export Follow-Up History
- **Method & Route**: `GET /api/follow-ups/export`
- **Permission**: `FOLLOW_UP:export`
- **Response**: Binary `.xlsx` workbook stream.

---

## 8. Verification & Test Suite Summary

The automated test runner (`scripts/testRunnerModule6.js`) validates all 10 core integration steps:

| Step | Verification Scenario | Result |
| :--- | :--- | :--- |
| **Step 0** | `FOLLOW_UP` moduleKey registered idempotently in SystemModule | `✓ PASS` |
| **Step 1** | SuperAdmin, Scoped Sales Exec (`OWN`), and View-Only user auth | `✓ PASS` |
| **Step 2** | Customer & active/cancelled Quotation fixtures created | `✓ PASS` |
| **Step 3** | Inactive quotation rejection, `CONFIRMED` status rejection, date checks | `✓ PASS` |
| **Step 4** | Atomic creation + status transition (`FOLLOW_UP_PENDING` &rarr; `CUSTOMER_INTERESTED`)| `✓ PASS` |
| **Step 5** | Quotation timeline API returns newest-first chronological entries | `✓ PASS` |
| **Step 6** | Recency check: older edit leaves status intact; recent edit updates status | `✓ PASS` |
| **Step 7** | Soft-deactivation does not auto-revert quotation status | `✓ PASS` |
| **Step 8** | Alert engine calculates all 5 categories (`noFollowUpYet`, `overdue`, etc.) | `✓ PASS` |
| **Step 9** | `followUpService.getByCustomer()` feeds Module 4 Customer 360° History | `✓ PASS` |
| **Step 10**| View-only role receives `403 Forbidden` on create/edit/deactivate + Excel export | `✓ PASS` |

**Total Test Suite Result: 23 Passed, 0 Failed (100% Pass Rate).**

---

## 9. What Comes Next

With Module 6 (Follow-Up Management) completed, verified, documented, and published to Swagger:
- **Module 7 (Quotation Confirmation)**: Takes over Quotation status transitions from `CONFIRMED` and `PARTIALLY_CONFIRMED` onward, introducing Confirmed Quantity tracking, advance token payments, and handoff to Module 8 (Stock Management) and Module 9 (Challan Management).
