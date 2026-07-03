# Payment Attempt Module

## Midtrans Snap Observability

The Checkout module is feature-complete. This document only covers Snap resiliency, logging, and troubleshooting.

### Structured Snap Logging

Snap generation emits structured logs through the existing `console.log('[PaymentAttemptService]', payload)` convention.

#### Before requesting Midtrans Snap

Logged fields:

- `checkoutNumber`
- `paymentAttemptNumber`
- `providerReference`
- `grossAmount`
- `currency`
- `customerId`
- `timestamp`
- `validationResult: 'SNAP_REQUEST_STARTED'`

#### After Midtrans responds successfully

Logged fields:

- `checkoutNumber`
- `paymentAttemptNumber`
- `providerReference`
- `snapToken` (masked)
- `redirectUrl`
- `providerTransactionId`
- `durationMs`
- `status`
- `httpStatus`
- `validationResult: 'SNAP_REQUEST_SUCCEEDED'`

#### When Snap generation fails

Logged fields:

- `checkoutNumber`
- `paymentAttemptNumber`
- `providerReference`
- `durationMs`
- `httpStatus`
- `errorMessage`
- `errorCode`
- `errorCategory`
- `validationResult: 'SNAP_REQUEST_FAILED'`

Stack traces are logged only when `NODE_ENV === 'development'`.

## Failure Scenarios

### 1. Validation errors

Examples:

- Payment attempt not found
- Payment attempt status is not eligible for Snap generation
- Checkout session is expired or invalid

Behavior:

- Request fails immediately
- No provider call is made
- No checkout state changes
- No payment attempt state changes

### 2. Duplicate `order_id` at Midtrans

Example provider message:

- `transaction_details.order_id has already been taken`

Behavior:

- Application error code: `PAYMENT_ATTEMPT_PROVIDER_REFERENCE_CONFLICT`
- Existing `providerReference` remains unchanged
- Existing `PaymentAttempt` remains unchanged
- Retry reuses the same persisted `providerReference`

### 3. Network timeout

Behavior:

- Application error code: `PAYMENT_ATTEMPT_PROVIDER_TIMEOUT`
- Existing `providerReference` remains unchanged
- Existing `PaymentAttempt` remains unchanged
- Retry reuses the same persisted `providerReference`

### 4. Provider unavailable

Examples:

- Midtrans returns `5xx`
- Network connection fails before response

Behavior:

- Application error code: `PAYMENT_ATTEMPT_PROVIDER_UNAVAILABLE`
- Existing `providerReference` remains unchanged
- Existing `PaymentAttempt` remains unchanged
- Retry reuses the same persisted `providerReference`

### 5. Unexpected internal errors

Behavior:

- Application error code: `PAYMENT_ATTEMPT_INTERNAL_ERROR` after normalization
- Existing `providerReference` remains unchanged
- Existing `PaymentAttempt` remains unchanged

## Retry Behavior

Snap generation is retry-safe.

Guaranteed behavior:

- No duplicate `PaymentAttempt` is created
- Existing `providerReference` is never deleted on failure
- Existing `providerReference` is never regenerated on retry when already present
- Checkout status is not changed when Midtrans Snap request fails
- PaymentAttempt status is not changed when Midtrans Snap request fails

## Production Troubleshooting

### If Midtrans Snap fails

1. Check the structured `SNAP_REQUEST_FAILED` log.
2. Confirm `providerReference` is already persisted.
3. Inspect `errorCode` and `errorCategory`.
4. If `httpStatus` is available, compare it with Midtrans dashboard activity.
5. Retry using the same `PaymentAttempt`.

### If retry still fails

1. Confirm Midtrans credentials are valid.
2. Confirm `MIDTRANS_IS_PRODUCTION` matches the environment.
3. Confirm `MIDTRANS_TIMEOUT` is sufficient for network conditions.
4. Inspect provider availability and dashboard notifications.
5. For `PAYMENT_ATTEMPT_PROVIDER_REFERENCE_CONFLICT`, verify whether the same `providerReference` was already registered externally.

## Environment Variable

- `MIDTRANS_TIMEOUT`
  - Default: `15000`
  - Unit: milliseconds
