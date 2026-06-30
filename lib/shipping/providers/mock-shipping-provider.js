import { shippingConfig } from '@/lib/shipping/config';
import { ShippingModuleError } from '@/lib/shipping/errors';
import {
  mapCityResponse,
  mapDistrictResponse,
  mapProvinceResponse,
} from '@/lib/shipping/mappers';

const RAW_PROVINCES = [
  { id: '9', name: 'Jawa Barat' },
  { id: '6', name: 'DKI Jakarta' },
  { id: '11', name: 'Jawa Timur' },
];

const RAW_CITIES = [
  { id: '23', province_id: '9', city_name: 'Bandung', type: 'Kota', postal_code: '40111' },
  { id: '24', province_id: '9', city_name: 'Bekasi', type: 'Kota', postal_code: '17121' },
  { id: '152', province_id: '6', city_name: 'Jakarta Selatan', type: 'Kota', postal_code: '12110' },
  { id: '151', province_id: '6', city_name: 'Jakarta Pusat', type: 'Kota', postal_code: '10110' },
  { id: '444', province_id: '11', city_name: 'Surabaya', type: 'Kota', postal_code: '60111' },
  { id: '445', province_id: '11', city_name: 'Malang', type: 'Kota', postal_code: '65111' },
];

const RAW_DISTRICTS = [
  { id: '1376', city_id: '23', district_name: 'Coblong', postal_code: '40135' },
  { id: '1377', city_id: '23', district_name: 'Lengkong', postal_code: '40261' },
  { id: '1401', city_id: '24', district_name: 'Bekasi Selatan', postal_code: '17148' },
  { id: '1402', city_id: '24', district_name: 'Pondok Gede', postal_code: '17411' },
  { id: '2001', city_id: '152', district_name: 'Kebayoran Baru', postal_code: '12130' },
  { id: '2002', city_id: '152', district_name: 'Tebet', postal_code: '12820' },
  { id: '2101', city_id: '151', district_name: 'Menteng', postal_code: '10310' },
  { id: '2102', city_id: '151', district_name: 'Tanah Abang', postal_code: '10240' },
  { id: '3001', city_id: '444', district_name: 'Wonokromo', postal_code: '60243' },
  { id: '3002', city_id: '444', district_name: 'Sukolilo', postal_code: '60111' },
  { id: '3101', city_id: '445', district_name: 'Klojen', postal_code: '65111' },
  { id: '3102', city_id: '445', district_name: 'Lowokwaru', postal_code: '65141' },
];

const DISTRICT_BASE_COST = {
  '1376': 18000,
  '1377': 19000,
  '1401': 17000,
  '1402': 18500,
  '2001': 16000,
  '2002': 16500,
  '2101': 17500,
  '2102': 18000,
  '3001': 20000,
  '3002': 21000,
  '3101': 19500,
  '3102': 20500,
};

const COURIER_SERVICE_MAP = {
  jne: [
    { service: 'REG', description: 'JNE Regular Service', etd: '2-3 Days', delta: 0 },
    { service: 'YES', description: 'JNE Yakin Esok Sampai', etd: '1 Day', delta: 12000 },
  ],
  jnt: [
    { service: 'EZ', description: 'J&T EZ', etd: '1-2 Days', delta: 4000 },
  ],
  sicepat: [
    { service: 'BEST', description: 'SiCepat BEST', etd: '1 Day', delta: 10000 },
  ],
  pos: [
    { service: 'Paket Kilat Khusus', description: 'POS Indonesia Paket Kilat Khusus', etd: '2-4 Days', delta: 3000 },
  ],
  ninja: [
    { service: 'Standard', description: 'Ninja Express Standard', etd: '2-3 Days', delta: 5000 },
  ],
  anteraja: [
    { service: 'Reguler', description: 'AnterAja Reguler', etd: '2-3 Days', delta: 4500 },
  ],
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRequestedCouriers(courier) {
  if (!courier || courier === 'all') return shippingConfig.supportedCouriers;

  return courier
    .split(/[:,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => shippingConfig.supportedCouriers.includes(item));
}

export class MockShippingProvider {
  async getProvinces() {
    await wait(150);
    return RAW_PROVINCES.map(mapProvinceResponse);
  }

  async getCities(provinceId) {
    await wait(150);
    const cities = RAW_CITIES.filter((item) => item.province_id === String(provinceId));

    if (!cities.length) {
      throw new ShippingModuleError({
        message: 'Province was not found.',
        statusCode: 404,
        code: 'SHIPPING_PROVINCE_NOT_FOUND',
      });
    }

    return cities.map(mapCityResponse);
  }

  async getDistricts(cityId) {
    await wait(150);
    const districts = RAW_DISTRICTS.filter((item) => item.city_id === String(cityId));

    if (!districts.length) {
      throw new ShippingModuleError({
        message: 'City was not found.',
        statusCode: 404,
        code: 'SHIPPING_CITY_NOT_FOUND',
      });
    }

    return districts.map(mapDistrictResponse);
  }

  async getShippingCost({ destinationDistrictId, weight, courier }) {
    await wait(200);

    const destinationDistrict = RAW_DISTRICTS.find((item) => item.id === String(destinationDistrictId));
    if (!destinationDistrict) {
      throw new ShippingModuleError({
        message: 'Destination district was not found.',
        statusCode: 404,
        code: 'SHIPPING_DISTRICT_NOT_FOUND',
      });
    }

    const requestedCouriers = normalizeRequestedCouriers(courier);
    if (!requestedCouriers.length) {
      throw new ShippingModuleError({
        message: 'Courier is not supported.',
        statusCode: 400,
        code: 'SHIPPING_UNSUPPORTED_COURIER',
      });
    }

    const normalizedWeight = Math.max(Number(weight) || 0, 1);
    const weightMultiplier = Math.max(Math.ceil(normalizedWeight / 1000), 1);
    const baseCost = DISTRICT_BASE_COST[destinationDistrict.id] || 18000;

    return requestedCouriers.flatMap((courierCode) => {
      const services = COURIER_SERVICE_MAP[courierCode] || [];
      return services.map((service) => ({
        courier: courierCode.toUpperCase(),
        service: service.service,
        description: service.description,
        estimated_delivery: service.etd,
        cost: (baseCost + service.delta) * weightMultiplier,
      }));
    });
  }
}
