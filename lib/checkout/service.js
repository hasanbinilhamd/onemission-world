import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { shippingService } from '@/lib/shipping';
import { calculateGrandTotal, calculateItemSubtotal, calculateSubtotal } from './calculations';
import { CheckoutModuleError } from './errors';

const CHECKOUT_STATUS = {
  DRAFT: 'DRAFT',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
};

const DEFAULT_CURRENCY = 'IDR';
const DEFAULT_EXPIRATION_HOURS = 24;

function getShippingCostExecutor() {
  if (typeof shippingService.calculateShippingCost === 'function') {
    return shippingService.calculateShippingCost.bind(shippingService);
  }

  return shippingService.getShippingCost.bind(shippingService);
}

async function generateCheckoutNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `CHK-${year}${month}-`;

  const existing = await prisma.checkoutSession.findMany({
    where: { checkoutNumber: { startsWith: prefix } },
    select: { checkoutNumber: true },
    orderBy: { checkoutNumber: 'desc' },
  });

  let maxSeq = 0;
  for (const entry of existing) {
    const parts = entry.checkoutNumber.split('-');
    const seq = parseInt(parts[parts.length - 1] || '0', 10);
    if (!Number.isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

async function validateCustomer(customerId) {
  if (!customerId) {
    throw new CheckoutModuleError({
      message: 'customerId is required.',
      statusCode: 400,
      code: 'CHECKOUT_CUSTOMER_REQUIRED',
    });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.status !== 'Active') {
    throw new CheckoutModuleError({
      message: 'Customer was not found.',
      statusCode: 404,
      code: 'CHECKOUT_CUSTOMER_NOT_FOUND',
    });
  }

  return customer;
}

async function validateSalesChannel(salesChannelId) {
  if (!salesChannelId) {
    throw new CheckoutModuleError({
      message: 'salesChannelId is required.',
      statusCode: 400,
      code: 'CHECKOUT_SALES_CHANNEL_REQUIRED',
    });
  }

  const salesChannel = await prisma.salesChannel.findUnique({ where: { id: salesChannelId } });
  if (!salesChannel || salesChannel.status !== 'Active') {
    throw new CheckoutModuleError({
      message: 'Sales channel was not found.',
      statusCode: 404,
      code: 'CHECKOUT_SALES_CHANNEL_NOT_FOUND',
    });
  }

  return salesChannel;
}

async function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutModuleError({
      message: 'At least one checkout item is required.',
      statusCode: 400,
      code: 'CHECKOUT_ITEMS_REQUIRED',
    });
  }

  const snapshots = [];

  for (const item of items) {
    const productId = item?.productId;
    const variantId = item?.variantId;
    const quantity = Number(item?.qty);

    if (!productId || !variantId) {
      throw new CheckoutModuleError({
        message: 'productId and variantId are required for each item.',
        statusCode: 400,
        code: 'CHECKOUT_ITEM_IDENTIFIERS_REQUIRED',
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CheckoutModuleError({
        message: 'qty must be a positive integer for each item.',
        statusCode: 400,
        code: 'CHECKOUT_INVALID_QUANTITY',
      });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'Active') {
      throw new CheckoutModuleError({
        message: 'Product was not found.',
        statusCode: 404,
        code: 'CHECKOUT_PRODUCT_NOT_FOUND',
      });
    }

    const variant = await prisma.inventory.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      throw new CheckoutModuleError({
        message: 'Variant was not found.',
        statusCode: 404,
        code: 'CHECKOUT_VARIANT_NOT_FOUND',
      });
    }

    if (variant.quantity < quantity) {
      throw new CheckoutModuleError({
        message: 'Requested quantity exceeds available stock.',
        statusCode: 400,
        code: 'CHECKOUT_INSUFFICIENT_STOCK',
      });
    }

    const price = Number(product.sellingPrice);
    const subtotal = calculateItemSubtotal(price, quantity);

    snapshots.push({
      id: uuid(),
      productId,
      variantId,
      productName: product.name,
      variantName: `${variant.color} / ${variant.size}`,
      sku: product.sku,
      qty: quantity,
      price,
      subtotal,
    });
  }

  return snapshots;
}

async function validateShipping({ shipping, courier, address }) {
  const originDistrict = shipping?.originDistrict;
  const destinationDistrict = shipping?.destinationDistrict;
  const shippingCost = Number(shipping?.cost);
  const service = shipping?.service;
  const description = shipping?.description || '';
  const estimatedDelivery = shipping?.estimatedDelivery || '';
  const provinceId = address?.provinceId;
  const cityId = address?.cityId;
  const districtId = address?.districtId;
  const postalCode = address?.postalCode || '';
  const streetAddress = address?.streetAddress || '';

  if (!originDistrict || !destinationDistrict) {
    throw new CheckoutModuleError({
      message: 'Shipping originDistrict and destinationDistrict are required.',
      statusCode: 400,
      code: 'CHECKOUT_SHIPPING_ROUTE_REQUIRED',
    });
  }

  if (!courier) {
    throw new CheckoutModuleError({
      message: 'courier is required.',
      statusCode: 400,
      code: 'CHECKOUT_COURIER_REQUIRED',
    });
  }

  if (!provinceId || !cityId || !districtId || !streetAddress) {
    throw new CheckoutModuleError({
      message: 'Shipping address is incomplete.',
      statusCode: 400,
      code: 'CHECKOUT_ADDRESS_REQUIRED',
    });
  }

  if (!Number.isFinite(shippingCost) || shippingCost < 0) {
    throw new CheckoutModuleError({
      message: 'Shipping cost is invalid.',
      statusCode: 400,
      code: 'CHECKOUT_INVALID_SHIPPING_COST',
    });
  }

  const provinces = await shippingService.getProvinces();
  const province = provinces.find((entry) => entry.id === String(provinceId));
  if (!province) {
    throw new CheckoutModuleError({
      message: 'Shipping province was not found.',
      statusCode: 404,
      code: 'CHECKOUT_PROVINCE_NOT_FOUND',
    });
  }

  const cities = await shippingService.getCities(provinceId);
  const city = cities.find((entry) => entry.id === String(cityId));
  if (!city) {
    throw new CheckoutModuleError({
      message: 'Shipping city was not found.',
      statusCode: 404,
      code: 'CHECKOUT_CITY_NOT_FOUND',
    });
  }

  const districts = await shippingService.getDistricts(cityId);
  const district = districts.find((entry) => entry.id === String(districtId));
  if (!district) {
    throw new CheckoutModuleError({
      message: 'Shipping district was not found.',
      statusCode: 404,
      code: 'CHECKOUT_DISTRICT_NOT_FOUND',
    });
  }

  if (postalCode && district.postal_code && String(postalCode) !== String(district.postal_code)) {
    throw new CheckoutModuleError({
      message: 'Shipping postal code is invalid.',
      statusCode: 400,
      code: 'CHECKOUT_INVALID_POSTAL_CODE',
    });
  }

  const executeShippingCost = getShippingCostExecutor();
  const availableRates = await executeShippingCost({
    originDistrict,
    destinationDistrict,
    weight: shipping.weight,
    courier,
  });

  const selectedRate = availableRates.find((rate) => {
    const sameCourier = String(rate.courier).toLowerCase() === String(courier).toLowerCase() || String(rate.courier).toUpperCase() === String(courier).toUpperCase();
    const sameService = service ? String(rate.service).toLowerCase() === String(service).toLowerCase() : true;
    return sameCourier && sameService && Number(rate.cost) === shippingCost;
  });

  if (!selectedRate) {
    throw new CheckoutModuleError({
      message: 'Shipping rate is invalid.',
      statusCode: 400,
      code: 'CHECKOUT_SHIPPING_RATE_INVALID',
    });
  }

  return {
    originDistrict: String(originDistrict),
    destinationDistrict: String(destinationDistrict),
    courier: String(selectedRate.courier),
    service: String(selectedRate.service),
    description: String(description || selectedRate.description || ''),
    estimatedDelivery: String(estimatedDelivery || selectedRate.estimated_delivery || ''),
    shippingCost,
    provinceId: String(provinceId),
    provinceName: String(province.name),
    cityId: String(cityId),
    cityName: String(city.name),
    districtId: String(districtId),
    districtName: String(district.name),
    postalCode: String(postalCode || district.postal_code || ''),
    streetAddress: String(streetAddress),
  };
}

function calculateTotals({ items, shippingCost, discount = 0, tax = 0 }) {
  const subtotal = calculateSubtotal(items);
  const normalizedDiscount = Number(discount) || 0;
  const normalizedTax = Number(tax) || 0;
  const grandTotal = calculateGrandTotal({
    subtotal,
    discount: normalizedDiscount,
    shippingCost,
    tax: normalizedTax,
  });

  return {
    subtotal,
    discount: normalizedDiscount,
    shippingCost,
    tax: normalizedTax,
    grandTotal,
  };
}

function buildExpirationDate() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DEFAULT_EXPIRATION_HOURS);
  return expiresAt;
}

export class CheckoutService {
  async createCheckoutSession(payload) {
    const customer = await validateCustomer(payload.customerId);
    const salesChannel = await validateSalesChannel(payload.salesChannelId);
    const items = await validateItems(payload.items);
    const shipping = await validateShipping({
      shipping: payload.shipping,
      courier: payload.courier,
      address: payload.address,
    });
    const totals = calculateTotals({
      items,
      shippingCost: shipping.shippingCost,
      discount: payload.discount,
      tax: payload.tax,
    });
    const checkoutNumber = await generateCheckoutNumber();
    const expiresAt = buildExpirationDate();

    const session = await prisma.checkoutSession.create({
      data: {
        id: uuid(),
        checkoutNumber,
        status: CHECKOUT_STATUS.DRAFT,
        customerId: customer.id,
        salesChannelId: salesChannel.id,
        currency: payload.currency || DEFAULT_CURRENCY,
        subtotal: totals.subtotal,
        shippingCost: totals.shippingCost,
        discount: totals.discount,
        tax: totals.tax,
        grandTotal: totals.grandTotal,
        originDistrict: shipping.originDistrict,
        destinationDistrict: shipping.destinationDistrict,
        courier: shipping.courier,
        courierService: shipping.service,
        shippingDescription: shipping.description,
        estimatedDelivery: shipping.estimatedDelivery,
        provinceId: shipping.provinceId,
        provinceName: shipping.provinceName,
        cityId: shipping.cityId,
        cityName: shipping.cityName,
        districtId: shipping.districtId,
        districtName: shipping.districtName,
        postalCode: shipping.postalCode,
        streetAddress: shipping.streetAddress,
        expiresAt,
        items: {
          create: items,
        },
      },
      include: {
        items: true,
      },
    });

    return {
      id: session.id,
      checkoutNumber: session.checkoutNumber,
      status: session.status,
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        email: customer.email,
        phone: customer.phone,
      },
      salesChannel: {
        id: salesChannel.id,
        channelCode: salesChannel.channelCode,
        channelName: salesChannel.channelName,
      },
      currency: session.currency,
      items: session.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        qty: item.qty,
        price: item.price,
        subtotal: item.subtotal,
      })),
      shipping: {
        originDistrict: session.originDistrict,
        destinationDistrict: session.destinationDistrict,
        courier: session.courier,
        service: session.courierService,
        description: session.shippingDescription,
        estimatedDelivery: session.estimatedDelivery,
        address: {
          provinceId: session.provinceId,
          provinceName: session.provinceName,
          cityId: session.cityId,
          cityName: session.cityName,
          districtId: session.districtId,
          districtName: session.districtName,
          postalCode: session.postalCode,
          streetAddress: session.streetAddress,
        },
      },
      totals,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

export const checkoutService = new CheckoutService();
