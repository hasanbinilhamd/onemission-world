export function logCustomerAuthAudit(eventName, details = {}) {
  console.info('[customer-auth-audit]', JSON.stringify({
    scope: 'CUSTOMER_AUTH',
    eventName,
    timestamp: new Date().toISOString(),
    ...details,
  }));
}
