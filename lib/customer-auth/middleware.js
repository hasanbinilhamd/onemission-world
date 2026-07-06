import { customerAuthService } from './service';

export async function authenticateCustomerRequest(request, options = {}) {
  return customerAuthService.authenticateRequest(request, options);
}

export async function requireAuthenticatedCustomer(request) {
  return customerAuthService.authenticateRequest(request, { optional: false });
}
