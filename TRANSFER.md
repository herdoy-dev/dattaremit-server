# Simulate & Transfer Feature

## Overview

US users send money to IN users via DattaRemit. A single API call from mobile triggers two sequential Zynk API requests: **simulate** (get quote) then **transfer** (execute). Every step is saved to the database.

---

## API Endpoint

```
POST /api/transfers/send
```

**Headers:**
- `x-auth-token` (required) — Clerk auth token
- `Idempotency-Key` (required) — 16-255 char unique key to prevent duplicate transfers

**Request Body:**
```json
{
  "contactId": "uuid-of-receiver",
  "amountCents": 1000,
  "note": "maintenance"
}
```

| Field | Type | Validation |
|---|---|---|
| `contactId` | UUID | Required, must be a valid user ID |
| `amountCents` | integer | Required, min 100 ($1), max 1000000 ($10,000) |
| `note` | string | Optional, max 255 chars |

**Success Response (201):**
```json
{
  "success": true,
  "message": "Transfer initiated successfully",
  "data": {
    "transactionId": "db-uuid",
    "zynkTransactionId": "txn_abc123",
    "status": "ACCEPTED",
    "quote": {
      "sendAmount": { "amount": 10, "currency": "USD" },
      "receiveAmount": { "amount": 942.94, "currency": "INR" },
      "exchangeRate": { "rate": 95.208486, "conversion": "1 USD = 95.208486 INR" },
      "fees": { "amount": 0.096, "currency": "USD" }
    }
  }
}
```

---

## Flow

```
Mobile                     Server                          Zynk API
  |                          |                                |
  |-- POST /transfers/send ->|                                |
  |                          |-- validate sender/receiver --> |
  |                          |-- generate txn_<uuid> -------> |
  |                          |                                |
  |                          |-- POST /transaction/simulate ->|
  |                          |<-- { executionId, quote } -----|
  |                          |                                |
  |                          |-- save Transaction (SIMULATED) |
  |                          |                                |
  |                          |-- POST /transaction/transfer ->|
  |                          |<-- { message: "success" } -----|
  |                          |                                |
  |                          |-- update Transaction (ACCEPTED)|
  |                          |-- log activities & notify ---->|
  |                          |                                |
  |<-- { transactionId,  ---|                                |
  |      quote, status }     |                                |
```

---

## Zynk API Calls

### 1. Simulate Transaction

**Endpoint:** `POST /api/v1/transformer/transaction/simulate`

**Request:**
```json
{
  "transactionId": "txn_<uuid>",
  "fromEntityId": "sender's zynkEntityId",
  "fromAccountId": "sender's zynkExternalAccountId",
  "toEntityId": "receiver's zynkEntityId",
  "toAccountId": "receiver's zynkDepositAccountId",
  "exactAmountIn": 10,
  "depositMemo": "maintenance"
}
```

**Where values come from:**
- `transactionId` — server generates `txn_<uuid>`
- `fromEntityId` — sender's `user.zynkEntityId` (US user)
- `fromAccountId` — sender's `user.zynkExternalAccountId` (Plaid-linked bank)
- `toEntityId` — receiver's `user.zynkEntityId` (IN user)
- `toAccountId` — receiver's `user.zynkDepositAccountId` (IN bank account)
- `exactAmountIn` — `amountCents / 100` from mobile input
- `depositMemo` — `note` from mobile input

**Success Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_6f151d4d_c178_4e3e_bb2a_b8de1047a212",
    "quote": {
      "inAmount": { "amount": 10, "currency": "USD" },
      "outAmount": { "amount": 942.944844, "currency": "INR" },
      "exchangeRate": { "rate": 95.208486, "conversion": "1 USD = 95.208486 INR" },
      "fees": {
        "partnerFees": { "amount": 0, "currency": "USD" },
        "zynkGasFees": { "amount": 0.0162, "currency": "USD" },
        "zynkNetworkFees": { "amount": 0, "currency": "USD" },
        "infraProviderFees": { "amount": 0.0799, "currency": "USD" },
        "bankingFees": { "amount": 0, "currency": "USD" },
        "txFees": { "amount": 0, "currency": "USD" },
        "totalFees": { "amount": 0.096, "currency": "USD" }
      }
    },
    "validUntil": "2026-03-27T03:45:28.872Z",
    "message": "Transaction simulation successful",
    "depositAccount": {}
  }
}
```

### 2. Execute Transfer

**Endpoint:** `POST /api/v1/transformer/transaction/transfer`

**Request:**
```json
{
  "executionId": "exec_6f151d4d_c178_4e3e_bb2a_b8de1047a212",
  "transferAcknowledgement": "ACCEPTED"
}
```

- `executionId` is extracted from the simulate response

---

## Database Schema

### Transaction Model

```prisma
model Transaction {
  id                String            @id @default(uuid())
  senderId          String            — references User (sender)
  receiverId        String            — references User (receiver)
  zynkTransactionId String            @unique — "txn_<uuid>" we generate
  zynkExecutionId   String?           — from simulate response
  sendAmount        Decimal(18,6)     — amount in sender currency
  sendCurrency      String            — default "USD"
  receiveAmount     Decimal(18,6)?    — amount in receiver currency
  receiveCurrency   String            — default "INR"
  exchangeRate      Decimal(18,6)?    — rate from quote
  totalFees         Decimal(18,6)?    — total fees from quote
  feeCurrency       String?           — default "USD"
  status            TransactionStatus — SIMULATED → ACCEPTED or FAILED
  depositMemo       String?           — user's note
  simulateResponse  Json?             — full Zynk simulate response
  transferResponse  Json?             — full Zynk transfer response
  failureReason     String?           — error message if failed
  created_at        DateTime
  updated_at        DateTime
}

enum TransactionStatus {
  SIMULATED   — simulate succeeded, transfer not yet called
  ACCEPTED    — transfer succeeded
  PROCESSING  — reserved for async processing
  COMPLETED   — final settlement confirmed
  FAILED      — transfer call failed
}
```

### What Gets Saved at Each Step

**After simulate succeeds:**

| Field | Example Value |
|---|---|
| senderId | `"user-uuid-sender"` |
| receiverId | `"user-uuid-receiver"` |
| zynkTransactionId | `"txn_abc123def456"` |
| zynkExecutionId | `"exec_6f151d4d_..."` |
| sendAmount | `10.000000` |
| sendCurrency | `"USD"` |
| receiveAmount | `942.944844` |
| receiveCurrency | `"INR"` |
| exchangeRate | `95.208486` |
| totalFees | `0.096000` |
| feeCurrency | `"USD"` |
| status | `SIMULATED` |
| depositMemo | `"maintenance"` |
| simulateResponse | Full JSON (quote, fees, validUntil, etc.) |

**After transfer succeeds — updates:**

| Field | Updated Value |
|---|---|
| status | `ACCEPTED` |
| transferResponse | Full Zynk transfer JSON |

**If transfer fails — updates:**

| Field | Updated Value |
|---|---|
| status | `FAILED` |
| failureReason | Error message |

---

## Activity Logs (saved to `activities` table)

### On Success

**Sender activity:**
- type: `TRANSFER`
- status: `COMPLETE`
- description: `"Sent $10 to ReceiverName"`
- amount: `10`
- referenceId: transaction ID
- metadata: `{ zynkTransactionId, executionId, receiverId, receiverName }`

**Receiver activity:**
- type: `DEPOSIT`
- status: `COMPLETE`
- description: `"Received INR 942.94 from SenderName"`
- amount: `942.94`
- referenceId: transaction ID
- metadata: `{ zynkTransactionId, executionId, senderId, senderName }`

### On Failure

**Sender activity:**
- type: `TRANSFER`
- status: `FAILED`
- description: `"Transfer of $10 failed"`
- amount: `10`
- referenceId: transaction ID
- metadata: `{ zynkTransactionId, executionId }`

---

## Notifications (saved to `notifications` table)

### On Success

**Sender:** "Money Sent" — `"$10 has been sent to ReceiverName. The recipient will receive INR 942.94."`

**Receiver:** "Money Received" — `"SenderName sent you INR 942.94."`

### On Failure

**Sender:** "Transfer Failed" — `"Your transfer of $10 could not be completed. Please try again."`

---

## Error Handling

All Zynk errors go through `handleZynkError()` in `lib/zynk-error.ts`:

| Zynk Status | Our Response | Message |
|---|---|---|
| 400 | 400 | "An error occurred processing your request" |
| 401 | 401 | "An error occurred processing your request" |
| 404 | 404 | "An error occurred processing your request" |
| 500 | 502 (Bad Gateway) | "An error occurred processing your request" |
| Timeout | 504 | "Zynk API request timed out" |
| Connection refused | 503 | "Unable to reach Zynk API" |

Zynk error details are never leaked to the client.

---

## Validation Rules

| Field | Rule |
|---|---|
| contactId | Valid UUID, required |
| amountCents | Integer, min 100 ($1), max 1,000,000 ($10,000), required |
| note | String, max 255 chars, optional |
| Sender | Must have `zynkEntityId` + `zynkExternalAccountId` |
| Receiver | Must have `zynkEntityId` + `zynkDepositAccountId` |
| Account status | Sender must be `ACTIVE` (enforced by `isApproved` middleware) |

---

## Middleware Stack

```
POST /api/transfers/send
  → auth (verify x-auth-token via Clerk)
  → dbUser (load full user from DB)
  → isApproved (account must be ACTIVE)
  → sensitiveRateLimit
  → withIdempotency (Idempotency-Key header required)
  → transferController.send

GET /api/transfers/receive-info
  → auth (verify x-auth-token via Clerk)
  → dbUser (load full user from DB)
  → transferController.getReceiveInfo

GET /api/contacts?q={query}
  → auth (verify x-auth-token via Clerk)
  → dbUser (load full user from DB)
  → isApproved (account must be ACTIVE)
  → contactController.search
```

---

## Contacts Search Endpoint

### `GET /api/contacts?q={query}`

Search for recipients (IN users with linked deposit accounts) by name or email.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (min 2 characters) |

**Search Behavior:**
- **By name** — case-insensitive partial match on `firstName` or `lastName` (not encrypted, searchable directly)
- **By email** — exact match only via `emailHash` (email is encrypted at rest, so only exact lookups work)
- **Phone search** — not supported (phone is encrypted)
- Excludes the requesting user from results
- Only returns users who have a `zynkDepositAccountId` (IN users with a linked bank account)
- Returns max 20 results

**Success Response (200):**
```json
{
  "success": true,
  "message": "Contacts retrieved successfully",
  "data": [
    {
      "id": "user-uuid",
      "name": "Srikanth Siddi",
      "email": "srikanth@example.com",
      "phone": "+919000944498",
      "country": "IN"
    }
  ]
}
```

**Files:**
- `controllers/contact.controller.ts` — HTTP handler
- `services/contact.service.ts` — search logic (email hash lookup + name search)
- `routes/contact.routes.ts` — route definition

---

## Receive Info Endpoint

### `GET /api/transfers/receive-info`

Returns the authenticated user's receiving details for display on the receive screen and QR code.

**Success Response (200):**
```json
{
  "success": true,
  "message": "Receive info retrieved successfully",
  "data": {
    "accountId": "acc_0c48e4b9_b220_4ed9_9d82_21e225089fa4",
    "email": "srikanth@example.com",
    "phone": "+919000944498",
    "name": "Srikanth Siddi"
  }
}
```

**Error (400):** Returned if user has no `zynkDepositAccountId` linked.

---

## Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Transaction model + TransactionStatus enum |
| `repositories/zynk.repository.ts` | `simulateTransaction()` + `executeTransfer()` |
| `schemas/zynk-response.schema.ts` | Joi schemas for simulate + transfer responses |
| `schemas/transfer.schema.ts` | Joi input validation for send endpoint |
| `services/transfer.service.ts` | Business logic: validate, simulate, transfer, save, notify |
| `services/contact.service.ts` | Contact search logic (name + email hash) |
| `controllers/transfer.controller.ts` | HTTP handler for send + receive-info |
| `controllers/contact.controller.ts` | HTTP handler for contact search |
| `routes/transfer.routes.ts` | Transfer route definitions |
| `routes/contact.routes.ts` | Contact route definition |
| `routes/index.ts` | Mounts `/transfers` and `/contacts` with `dbUser` middleware |

---

## Migration

```
prisma/migrations/20260327164443_add_transaction_model/migration.sql
```
