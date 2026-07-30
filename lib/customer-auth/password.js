import bcrypt from 'bcryptjs';
import { CustomerAuthError } from './errors';

const BCRYPT_ROUNDS = 12;

export function validateStrongPassword(password) {
  const value = String(password || '');

  if (!value) {
    throw new CustomerAuthError({
      message: 'Password is required.',
      statusCode: 400,
      code: 'CUSTOMER_AUTH_PASSWORD_REQUIRED',
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
