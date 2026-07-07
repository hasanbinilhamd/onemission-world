import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { CustomerAccountError } from './errors';

function normalizeValue(value) {
  return String(value || '').trim();
}

function buildCustomerProfileResponse(customer) {
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    customerName: customer.customerName,
    email: customer.email || '',
    phone: customer.phone || '',
    avatarUrl: customer.avatarUrl || '',
    emailVerified: Boolean(customer.emailVerified),
    authProvider: customer.authProvider || 'LOCAL',
    lastLoginAt: customer.lastLoginAt || null,
    provinceId: customer.provinceId || '',
    province: customer.province || '',
    cityId: customer.cityId || '',
    city: customer.city || '',
    districtId: customer.districtId || '',
    district: customer.district || '',
    postalCode: customer.postalCode || '',
    streetAddress: customer.streetAddress || '',
    country: customer.country || 'Indonesia',
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function buildCustomerAddressResponse(address) {
  return {
    id: address.id,
    customerId: address.customerId,
    recipientName: address.recipientName,
    phoneNumber: address.phoneNumber,
    provinceId: address.provinceId,
    province: address.province,
    cityId: address.cityId,
    city: address.city,
    districtId: address.districtId,
    district: address.district,
    postalCode: address.postalCode,
    streetAddress: address.streetAddress,
    notes: address.notes || '',
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

function validateAddressInput(input) {
  const recipientName = normalizeValue(input.recipientName);
  const phoneNumber = normalizeValue(input.phoneNumber);
  const provinceId = normalizeValue(input.provinceId);
  const province = normalizeValue(input.province);
  const cityId = normalizeValue(input.cityId);
  const city = normalizeValue(input.city);
  const districtId = normalizeValue(input.districtId);
  const district = normalizeValue(input.district);
  const postalCode = normalizeValue(input.postalCode);
  const streetAddress = normalizeValue(input.streetAddress);
  const notes = normalizeValue(input.notes);
  const isDefault = Boolean(input.isDefault);

  if (!recipientName) {
    throw new CustomerAccountError({ message: 'Recipient Name is required.', code: 'CUSTOMER_ADDRESS_RECIPIENT_REQUIRED' });
  }
  if (!phoneNumber) {
    throw new CustomerAccountError({ message: 'Phone Number is required.', code: 'CUSTOMER_ADDRESS_PHONE_REQUIRED' });
  }
  if (!provinceId || !province) {
    throw new CustomerAccountError({ message: 'Province is required.', code: 'CUSTOMER_ADDRESS_PROVINCE_REQUIRED' });
  }
  if (!cityId || !city) {
    throw new CustomerAccountError({ message: 'City is required.', code: 'CUSTOMER_ADDRESS_CITY_REQUIRED' });
  }
  if (!districtId || !district) {
    throw new CustomerAccountError({ message: 'District is required.', code: 'CUSTOMER_ADDRESS_DISTRICT_REQUIRED' });
  }
  if (!postalCode) {
    throw new CustomerAccountError({ message: 'Postal Code is required.', code: 'CUSTOMER_ADDRESS_POSTAL_CODE_REQUIRED' });
  }
  if (!streetAddress) {
    throw new CustomerAccountError({ message: 'Street Address is required.', code: 'CUSTOMER_ADDRESS_STREET_REQUIRED' });
  }

  return {
    recipientName,
    phoneNumber,
    provinceId,
    province,
    cityId,
    city,
    districtId,
    district,
    postalCode,
    streetAddress,
    notes,
    isDefault,
  };
}

async function syncDefaultAddressSnapshot(tx, customerId) {
  const defaultAddress = await tx.customerAddress.findFirst({
    where: { customerId, isDefault: true },
    orderBy: { updatedAt: 'desc' },
  });

  await tx.customer.update({
    where: { id: customerId },
    data: {
      provinceId: defaultAddress?.provinceId || '',
      province: defaultAddress?.province || '',
      cityId: defaultAddress?.cityId || '',
      city: defaultAddress?.city || '',
      districtId: defaultAddress?.districtId || '',
      district: defaultAddress?.district || '',
      postalCode: defaultAddress?.postalCode || '',
      streetAddress: defaultAddress?.streetAddress || '',
      country: defaultAddress ? 'Indonesia' : 'Indonesia',
    },
  });
}

async function ensureAddressBelongsToCustomer(prismaClient, customerId, addressId) {
  const address = await prismaClient.customerAddress.findFirst({
    where: {
      id: addressId,
      customerId,
    },
  });

  if (!address) {
    throw new CustomerAccountError({
      message: 'Customer address was not found.',
      statusCode: 404,
      code: 'CUSTOMER_ADDRESS_NOT_FOUND',
    });
  }

  return address;
}

export class CustomerAccountService {
  constructor({ prismaClient = prisma } = {}) {
    this.prisma = prismaClient;
  }

  async getProfile({ customerId }) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      throw new CustomerAccountError({
        message: 'Customer profile was not found.',
        statusCode: 404,
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
      });
    }

    return buildCustomerProfileResponse(customer);
  }

  async updateProfile({ customerId, customerName, phone }) {
    const normalizedCustomerName = normalizeValue(customerName);
    const normalizedPhone = normalizeValue(phone);

    if (!normalizedCustomerName) {
      throw new CustomerAccountError({
        message: 'Full Name is required.',
        code: 'CUSTOMER_PROFILE_NAME_REQUIRED',
      });
    }

    if (!normalizedPhone) {
      throw new CustomerAccountError({
        message: 'Phone Number is required.',
        code: 'CUSTOMER_PROFILE_PHONE_REQUIRED',
      });
    }

    const existingCustomer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!existingCustomer) {
      throw new CustomerAccountError({
        message: 'Customer profile was not found.',
        statusCode: 404,
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
      });
    }

    const duplicatePhone = await this.prisma.customer.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: customerId },
      },
    });

    if (duplicatePhone) {
      throw new CustomerAccountError({
        message: 'Phone Number is already used by another customer.',
        statusCode: 409,
        code: 'CUSTOMER_PROFILE_PHONE_ALREADY_EXISTS',
      });
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        customerName: normalizedCustomerName,
        phone: normalizedPhone,
      },
    });

    return buildCustomerProfileResponse(updatedCustomer);
  }

  async listAddresses({ customerId }) {
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });

    return addresses.map(buildCustomerAddressResponse);
  }

  async createAddress({ customerId, input }) {
    const payload = validateAddressInput(input);

    const address = await this.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const createdAddress = await tx.customerAddress.create({
        data: {
          id: uuid(),
          customerId,
          ...payload,
        },
      });

      await syncDefaultAddressSnapshot(tx, customerId);
      return createdAddress;
    });

    return buildCustomerAddressResponse(address);
  }

  async updateAddress({ customerId, addressId, input }) {
    const payload = validateAddressInput(input);
    await ensureAddressBelongsToCustomer(this.prisma, customerId, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      const updatedAddress = await tx.customerAddress.update({
        where: { id: addressId },
        data: payload,
      });

      await syncDefaultAddressSnapshot(tx, customerId);
      return updatedAddress;
    });

    return buildCustomerAddressResponse(address);
  }

  async deleteAddress({ customerId, addressId }) {
    await ensureAddressBelongsToCustomer(this.prisma, customerId, addressId);

    await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({ where: { id: addressId } });
      await syncDefaultAddressSnapshot(tx, customerId);
    });

    return { ok: true };
  }

  async setDefaultAddress({ customerId, addressId }) {
    await ensureAddressBelongsToCustomer(this.prisma, customerId, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });

      const updatedAddress = await tx.customerAddress.update({
        where: { id: addressId },
        data: { isDefault: true },
      });

      await syncDefaultAddressSnapshot(tx, customerId);
      return updatedAddress;
    });

    return buildCustomerAddressResponse(address);
  }
}

export const customerAccountService = new CustomerAccountService();
