import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { shippingService } from '@/lib/shipping';
import { calculateGrandTotal, calculateItemSubtotal, calculateSubtotal } from './calculations';
import { CheckoutModuleError } from './errors';

export const CHECKOUT_STATUS = {
  DRAFT: 'DRAFT',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
};

const DEFAULT_CURRENCY = 'IDR';
const DEFAULT_EXPIRATION_HOURS = 24;

function logCheckoutValidation({ checkoutNumber = '', validationResult, durationMs }) {
  const payload = {
    checkoutNumber,
    validationResult,
    durationMs,
  };

  if (validationResult === 'FAILED' || validationResult === 'EXPIRED') {
    console.warn('[CheckoutService]', payload);
    return;
  }

  console.log('[CheckoutService]', payload);
}

function normalizeWeight(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export class CheckoutService {
  constructor({
    prismaClient = prisma,
    shipping = shippingService,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.shippingService = shipping;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
  }

  getShippingCostExecutor() {
    if (typeof this.shippingService.calculateShippingCost === 'function') {
      return this.shippingService.calculateShippingCost.bind(this.shippingService);
    }

    return this.shippingService.getShippingCost.bind(this.shippingService);
  }

  async generateCheckoutNumber() {
    const now = this.nowFactory();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `CHK-${year}${month}-`;

    const existing = await this.prisma.checkoutSession.findMany({
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

  async validateCustomer(customerId) {
    if (!customerId) {
      throw new CheckoutModuleError({
        message: 'customerId is required.',
        statusCode: 400,
        code: 'CHECKOUT_CUSTOMER_REQUIRED',
      });
    }

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.status !== 'Active') {
      throw new CheckoutModuleError({
        message: 'Customer was not found.',
        statusCode: 404,
        code: 'CHECKOUT_CUSTOMER_NOT_FOUND',
      });
    }

    return customer;
  }

  async validateSalesChannel(salesChannelId) {
    if (!salesChannelId) {
      throw new CheckoutModuleError({
        message: 'salesChannelId is required.',
        statusCode: 400,
        code: 'CHECKOUT_SALES_CHANNEL_REQUIRED',
      });
    }

    const salesChannel = await this.prisma.salesChannel.findUnique({ where: { id: salesChannelId } });
    if (!salesChannel || salesChannel.status !== 'Active') {
      throw new CheckoutModuleError({
        message: 'Sales channel was not found.',
        statusCode: 404,
        code: 'CHECKOUT_SALES_CHANNEL_NOT_FOUND',
      });
    }

    return salesChannel;
  }

  async validateItems(items, currency) {
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
      const quantity = Number(item?.qty ?? item?.quantity);

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

      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new CheckoutModuleError({
          message: 'Product was not found.',
          statusCode: 404,
          code: 'CHECKOUT_PRODUCT_NOT_FOUND',
        });
      }

      if (product.status !== 'Active') {
        throw new CheckoutModuleError({
          message: 'Product is inactive.',
          statusCode: 400,
          code: 'CHECKOUT_PRODUCT_INACTIVE',
        });
      }

      const variant = await this.prisma.inventory.findUnique({ where: { id: variantId } });
      if (!variant) {
        throw new CheckoutModuleError({
          message: 'Variant was not found.',
          statusCode: 404,
          code: 'CHECKOUT_VARIANT_NOT_FOUND',
        });
      }

      if (variant.productId !== productId) {
        throw new CheckoutModuleError({
          message: 'Variant does not belong to the selected product.',
          statusCode: 400,
          code: 'CHECKOUT_VARIANT_PRODUCT_MISMATCH',
        });
      }

      if ((variant.status || 'Active') !== 'Active') {
        throw new CheckoutModuleError({
          message: 'Variant is inactive.',
          statusCode: 400,
          code: 'CHECKOUT_VARIANT_INACTIVE',
        });
      }

      if (variant.quantity < quantity) {
        throw new CheckoutModuleError({
          message: 'Requested quantity exceeds available inventory.',
          statusCode: 400,
          code: 'CHECKOUT_INSUFFICIENT_INVENTORY',
        });
      }

      const price = Number(product.sellingPrice);
      const subtotal = calculateItemSubtotal(price, quantity);
      const weight = normalizeWeight(item?.weight);

      snapshots.push({
        id: this.idGenerator(),
        productId,
        variantId,
        productName: product.name,
        variantName: `${variant.color} / ${variant.size}`,
        productImage: product.imageUrl || '',
        weight,
        sku: product.sku,
        qty: quantity,
        price,
        currency,
        subtotal,
      });
    }

    return snapshots;
  }

  async validateShipping({ shipping, courier, address, customer }) {
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
    const recipientName = String(address?.recipientName || customer?.customerName || '').trim();
    const phone = String(address?.phone || customer?.phone || '').trim();
    const shippingWeight = Number(shipping?.weight);

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

    if (!Number.isFinite(shippingWeight) || shippingWeight <= 0) {
      throw new CheckoutModuleError({
        message: 'Shipping weight is invalid.',
        statusCode: 400,
        code: 'CHECKOUT_INVALID_WEIGHT',
      });
    }

    if (!provinceId || !cityId || !districtId || !streetAddress || !recipientName || !phone) {
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

    const provinces = await this.shippingService.getProvinces();
    const province = provinces.find((entry) => entry.id === String(provinceId));
    if (!province) {
      throw new CheckoutModuleError({
        message: 'Shipping province was not found.',
        statusCode: 404,
        code: 'CHECKOUT_PROVINCE_NOT_FOUND',
      });
    }

    const cities = await this.shippingService.getCities(provinceId);
    const city = cities.find((entry) => entry.id === String(cityId));
    if (!city) {
      throw new CheckoutModuleError({
        message: 'Shipping city was not found.',
        statusCode: 404,
        code: 'CHECKOUT_CITY_NOT_FOUND',
      });
    }

    const districts = await this.shippingService.getDistricts(cityId);
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

    const executeShippingCost = this.getShippingCostExecutor();
    const availableRates = await executeShippingCost({
      originDistrict,
      destinationDistrict,
      weight: shippingWeight,
      courier,
    });

    if (!Array.isArray(availableRates) || availableRates.length === 0) {
      throw new CheckoutModuleError({
        message: 'Shipping is unavailable for the selected destination.',
        statusCode: 400,
        code: 'CHECKOUT_SHIPPING_UNAVAILABLE',
      });
    }

    const selectedRate = availableRates.find((rate) => {
      const sameCourier = String(rate.courier).toLowerCase() === String(courier).toLowerCase()
        || String(rate.courier).toUpperCase() === String(courier).toUpperCase();
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
      recipientName,
      phone,
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

  calculateTotals({ items, shippingCost, discount = 0, tax = 0 }) {
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

  buildExpirationDate() {
    const expiresAt = this.nowFactory();
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_EXPIRATION_HOURS);
    return expiresAt;
  }

  buildCheckoutSessionResponse(session, customer, salesChannel) {
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
        sku: item.sku,
        productName: item.productName,
        variantName: item.variantName,
        productImage: item.productImage,
        weight: item.weight,
        currency: item.currency,
        quantity: item.qty,
        qty: item.qty,
        price: item.price,
        subtotal: item.subtotal,
      })),
      shipping: {
        recipientName: session.recipientName,
        phone: session.phone,
        originDistrict: session.originDistrict,
        destinationDistrict: session.destinationDistrict,
        courier: session.courier,
        service: session.courierService,
        description: session.shippingDescription,
        estimatedDelivery: session.estimatedDelivery,
        shippingCost: session.shippingCost,
        address: {
          provinceId: session.provinceId,
          province: session.provinceName,
          cityId: session.cityId,
          city: session.cityName,
          districtId: session.districtId,
          district: session.districtName,
          postalCode: session.postalCode,
          streetAddress: session.streetAddress,
        },
      },
      totals: {
        subtotal: session.subtotal,
        discount: session.discount,
        shipping: session.shippingCost,
        shippingCost: session.shippingCost,
        tax: session.tax,
        grandTotal: session.grandTotal,
        currency: session.currency,
      },
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async getCheckoutSessionForPayment(checkoutSessionId) {
    if (!checkoutSessionId) {
      throw new CheckoutModuleError({
        message: 'checkoutSessionId is required.',
        statusCode: 400,
        code: 'CHECKOUT_SESSION_ID_REQUIRED',
      });
    }

    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: { items: true },
    });

    if (!session) {
      throw new CheckoutModuleError({
        message: 'Checkout session was not found.',
        statusCode: 404,
        code: 'CHECKOUT_SESSION_NOT_FOUND',
      });
    }

    if (session.status === CHECKOUT_STATUS.CANCELLED || session.status === CHECKOUT_STATUS.COMPLETED) {
      throw new CheckoutModuleError({
        message: 'Checkout session is no longer available.',
        statusCode: 400,
        code: 'CHECKOUT_SESSION_UNAVAILABLE',
      });
    }

    if (new Date(session.expiresAt).getTime() <= this.nowFactory().getTime()) {
      if (session.status !== CHECKOUT_STATUS.EXPIRED) {
        await this.prisma.checkoutSession.update({
          where: { id: checkoutSessionId },
          data: { status: CHECKOUT_STATUS.EXPIRED },
        });
      }

      throw new CheckoutModuleError({
        message: 'Checkout session has expired.',
        statusCode: 410,
        code: 'CHECKOUT_SESSION_EXPIRED',
      });
    }

    return session;
  }

  async createCheckoutSession(payload) {
    const startedAt = Date.now();
    let checkoutNumber = '';

    try {
      const currency = payload.currency || DEFAULT_CURRENCY;
      const customer = await this.validateCustomer(payload.customerId);
      const salesChannel = await this.validateSalesChannel(payload.salesChannelId);
      const items = await this.validateItems(payload.items, currency);
      const shipping = await this.validateShipping({
        shipping: payload.shipping,
        courier: payload.courier,
        address: payload.address,
        customer,
      });
      const totals = this.calculateTotals({
        items,
        shippingCost: shipping.shippingCost,
        discount: payload.discount,
        tax: payload.tax,
      });
      checkoutNumber = await this.generateCheckoutNumber();
      const expiresAt = this.buildExpirationDate();

      const session = await this.prisma.checkoutSession.create({
        data: {
          id: this.idGenerator(),
          checkoutNumber,
          status: CHECKOUT_STATUS.DRAFT,
          customerId: customer.id,
          salesChannelId: salesChannel.id,
          currency,
          subtotal: totals.subtotal,
          shippingCost: totals.shippingCost,
          discount: totals.discount,
          tax: totals.tax,
          grandTotal: totals.grandTotal,
          recipientName: shipping.recipientName,
          phone: shipping.phone,
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

      logCheckoutValidation({
        checkoutNumber,
        validationResult: 'PASSED',
        durationMs: Date.now() - startedAt,
      });

      return this.buildCheckoutSessionResponse(session, customer, salesChannel);
    } catch (error) {
      logCheckoutValidation({
        checkoutNumber,
        validationResult: 'FAILED',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}

export const checkoutService = new CheckoutService();
