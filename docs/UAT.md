# ONEMISSION HQ UAT

## Overview

This guide prepares the ONEMISSION HQ repository for repeated User Acceptance Testing of the complete checkout-to-order flow with Midtrans Sandbox.

The UAT flow covers:

1. Seed deterministic test data
2. Load provinces
3. Load cities
4. Load districts
5. Calculate shipping cost
6. Create a checkout session
7. Create a payment attempt
8. Generate a Midtrans Snap token
9. Complete payment in Midtrans Sandbox
10. Receive Midtrans callback
11. Verify payment attempt and order records
12. Replay callback safely

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running and reachable from `DATABASE_URL`
- All Prisma migrations applied
- ONEMISSION HQ dependencies installed with `npm install`
- A public tunnel for local callback testing, such as ngrok or Cloudflare Tunnel
- A Midtrans Sandbox account

## Required Environment Variables

Set the following variables before starting the server:

- `DATABASE_URL`
- `CORS_ORIGINS`
- `SHIPPING_PROVIDER`
- `SHIPPING_SUPPORTED_COURIERS`
- `RAJAONGKIR_API_KEY`
- `RAJAONGKIR_BASE_URL`
- `RAJAONGKIR_TIMEOUT`
- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY`
- `MIDTRANS_IS_PRODUCTION`

Suggested local values are already documented in `.env.example`.

## Deterministic UAT Seed

Run the deterministic UAT seed:

```bash
npm run seed:uat
```

This script is idempotent and uses upsert semantics. Running it multiple times does not duplicate records.

The seed prepares:

- Customer: `John Doe`
- Email: `john@example.com`
- Product: `Training Jersey`
- Variant inventory row: `Black XL`
- SKU: `OM-TSHIRT-BLK-XL`
- Inventory quantity: `20`
- Sales channel: `Website`
- Country: `Indonesia`

### Seeded Identifiers

- `customerId`: `uat-customer-john-doe`
- `salesChannelId`: `uat-sales-channel-website`
- `productId`: `uat-product-training-jersey`
- `variantId`: `uat-variant-training-jersey-black-xl`

## Start the Server

```bash
npm run dev
```

The default local base URL is:

```text
http://localhost:3000
```

## Optional Automated Verification

You can run the current automated UAT-aligned test suite with:

```bash
npm run test:uat
```

## Postman Assets

Import the following files into Postman:

- Collection: `testing/postman/onemission-hq-uat.collection.json`
- Environment: `testing/postman/onemission-hq-uat.environment.json`

## Postman Environment Variables

The local environment contains these variables:

- `baseUrl`
- `checkoutSessionId`
- `paymentAttemptId`
- `orderId`
- `customerId`
- `variantId`
- `snapToken`
- `providerReference`

## Shipping Flow

Province

↓

City

↓

District

↓

Calculate Shipping

## Request Execution Guide

### 1. Health → Get Health Check

**Request**

`GET {{baseUrl}}/api/health`

**Expected Result**

- HTTP `200`
- Response contains `status: "ok"`

### 2. Shipping → Get Provinces

**Request**

`GET {{baseUrl}}/api/shipping/provinces`

**Expected Result**

- HTTP `200`
- Province list is returned
- `Jawa Barat` should be present when mock shipping is active

### 3. Shipping → Get Cities

**Request**

`GET {{baseUrl}}/api/shipping/cities?provinceId=9`

**Expected Result**

- HTTP `200`
- Bandung city data is returned

### 4. Shipping → Get Districts

**Request**

`GET {{baseUrl}}/api/shipping/districts?cityId=23`

**Expected Result**

- HTTP `200`
- District list is returned
- `Coblong` should be present in mock mode
- Response contains `id`, `cityId`, `name`, `code`, and `provider`

### 5. Shipping → Calculate Shipping Cost

**Request**

`POST {{baseUrl}}/api/shipping/cost`

**Expected Result**

- HTTP `200`
- At least one shipping option is returned
- JNE should be present when mock shipping is active

### 6. Checkout → Create Checkout Session

**Request**

`POST {{baseUrl}}/api/checkout/session`

**Expected Result**

- HTTP `200`
- Checkout Session is created
- Postman stores `checkoutSessionId`
- Checkout status is `DRAFT`

### 7. Checkout → Get Checkout Session

**Request**

`GET {{baseUrl}}/api/checkout/session/{{checkoutSessionId}}`

**Expected Result**

- HTTP `200`
- Immutable checkout snapshot is returned
- Product, shipping, and totals match the creation step

### 8. Payment → Create Payment Attempt

**Request**

`POST {{baseUrl}}/api/payment-attempt`

**Expected Result**

- HTTP `200`
- Payment attempt status is `CREATED`
- Postman stores `paymentAttemptId`

### 9. Payment → Generate Snap Token

**Request**

`POST {{baseUrl}}/api/payment-attempt/{{paymentAttemptId}}/snap`

**Expected Result**

- HTTP `200`
- Payment attempt status becomes `PENDING`
- `snapToken` exists
- `providerReference` is stored for later callback checks

### 10. Payment → Get Payment Attempt

**Request**

`GET {{baseUrl}}/api/payment-attempt/{{paymentAttemptId}}`

**Expected Result**

- HTTP `200`
- Snap token and redirect URL are persisted
- Status remains `PENDING` before callback

### 11. Midtrans Sandbox Payment

Open Midtrans Sandbox using the returned `snapRedirectUrl` or load the Snap widget using `snapToken` from Commerce in the future.

**Expected Result**

- Payment is completed successfully in sandbox
- Midtrans sends a callback to your exposed callback URL

### 12. Midtrans → Payment Callback (Sample)

Use this request only if you need to replay or simulate a callback manually.

**Request**

`POST {{baseUrl}}/api/payment/callback`

**Expected Result**

- HTTP `200`
- PaymentAttempt moves to `PAID` when the payload and signature are valid
- Exactly one Order is created

### 13. Midtrans → Duplicate Callback

Replay the exact same callback body.

**Expected Result**

- HTTP `200`
- PaymentAttempt remains `PAID`
- Still exactly one Order exists
- No duplicate Order is created

### 14. Midtrans → Invalid Signature Callback

Send the callback with an invalid `signature_key`.

**Expected Result**

- HTTP `401`
- PaymentAttempt status is unchanged
- No new Order is created

### 15. Order → Get Order

**Request**

`GET {{baseUrl}}/api/orders/{{orderId}}`

**Expected Result**

- HTTP `200`
- One order exists for the paid payment attempt
- Status should be `READY_FOR_FULFILLMENT`

### 16. Order → Get Order Items

**Request**

`GET {{baseUrl}}/api/orders/{{orderId}}/items`

**Expected Result**

- HTTP `200`
- Order items match immutable checkout snapshots
- Product name, image, price, weight, quantity, and subtotal remain unchanged

## UAT Checklist

### Step 1

Seed data

**Expected**

- Customer exists
- Product exists
- Variant exists
- Inventory quantity is `20`
- Sales channel exists

### Step 2

Load Province

**Expected**

- Province list is available

### Step 3

Load City

**Expected**

- City list is available for selected province

### Step 4

Load District

**Expected**

- District list is available for selected city

### Step 5

Calculate Shipping

**Expected**

- Shipping options are returned using district identifiers

### Step 6

Create Checkout Session

**Expected**

- Checkout Session status = `DRAFT`

### Step 7

Create Payment Attempt

**Expected**

- PaymentAttempt status = `CREATED`

### Step 8

Generate Snap Token

**Expected**

- PaymentAttempt status = `PENDING`
- `snapToken` exists

### Step 9

Open Midtrans Sandbox and complete payment

**Expected**

- Midtrans accepts the payment in sandbox

### Step 10

Receive Callback

**Expected**

- PaymentAttempt status = `PAID`

### Step 11

Verify Order

**Expected**

- Exactly one Order exists
- Exactly correct Order Items exist

### Step 12

Repeat Callback

**Expected**

- Still one Order exists
- No duplicate Order is created

## Negative Test Notes

### Expired Checkout

Use an intentionally expired checkout session ID.

**Expected**

- Checkout retrieval or payment progression is rejected

### Duplicate PaymentAttempt

Send `Create Payment Attempt` twice for the same `checkoutSessionId`.

**Expected**

- Existing active attempt is returned
- No duplicate attempt is created

### Invalid Checkout ID

Send a fake `checkoutSessionId`.

**Expected**

- HTTP `404`

### Invalid PaymentAttempt ID

Send a fake `paymentAttemptId` to Snap generation or payment-attempt fetch.

**Expected**

- HTTP `404`
