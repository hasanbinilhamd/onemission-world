import bcrypt from 'bcryptjs';
import { CustomerAuthError } from './errors';

const BCRYPT_ROUNDS = 12;

export function validateStrongPassword(password) {
  const value = String(password || '');

  if (value.length < 8) {
    throw new CustomerAuthError({
      message: 'Password must be at least 8 characters long.',
      statusCode: 400,
      code: 'CUSTOMER_AUTH_PASSWORD_TOO_SHORT',
    });
  }

  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    throw new CustomerAuthError({
      message: 'Password must include uppercase, lowercase, and numeric characters.',
      statusCode: 400,
      code: 'CUSTOMER_AUTH_PASSWORD_TOO_WEAK',
    });
  }
}

export async function hashCustomerPassword(password) {
  return bcrypt.hash(String(password || ''), BCRYPT_ROUNDS);
}

export async function compareCustomerPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(String(password || ''), passwordHash);
}
