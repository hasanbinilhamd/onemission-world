function toStringValue(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function toNumberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferCityType(record) {
  const explicitType = toStringValue(record.type);
  if (explicitType) return explicitType;

  const label = toStringValue(record.city_name || record.name || record.city);
  if (label.toLowerCase().startsWith('kota ')) return 'Kota';
  if (label.toLowerCase().startsWith('kabupaten ')) return 'Kabupaten';
  return '';
}

function normalizeCityName(record) {
  const rawName = toStringValue(record.city_name || record.name || record.city);
  if (!rawName) return '';
  return rawName.replace(/^kota\s+/i, '').replace(/^kabupaten\s+/i, '').trim();
}

export function mapProvinceResponse(record) {
  return {
    id: toStringValue(record.id || record.province_id),
    name: toStringValue(record.name || record.province),
  };
}

export function mapCityResponse(record) {
  return {
    id: toStringValue(record.id || record.city_id),
    province_id: toStringValue(record.province_id),
    name: normalizeCityName(record),
    type: inferCityType(record),
    postal_code: toStringValue(record.postal_code || record.zip_code),
  };
}

export function mapDistrictResponse(record) {
  return {
    id: toStringValue(record.id || record.district_id || record.subdistrict_id),
    city_id: toStringValue(record.city_id),
    name: toStringValue(record.name || record.district_name || record.subdistrict_name),
    postal_code: toStringValue(record.postal_code || record.zip_code),
  };
}

export function mapShippingCostResponse(record, fallbackCourier) {
  const courierName = toStringValue(record.name || record.courier_name || fallbackCourier).trim();
  const courierCode = toStringValue(record.code || courierName).trim();

  if (Array.isArray(record.costs) && record.costs.length > 0) {
    return record.costs
      .map((service, index) => {
        const costItem = Array.isArray(service.cost) ? service.cost[0] || {} : {};
        const cost = toNumberValue(costItem.value || costItem.amount || service.value || service.price || record.cost || 0);
        const serviceName = toStringValue(service.service || service.name || service.code || `Service ${index + 1}`);
        if (!serviceName || cost <= 0) return null;

        return {
          courier: courierName || courierCode.toUpperCase(),
          service: serviceName,
          description: toStringValue(service.description || service.name || service.service),
          estimated_delivery: toStringValue(service.etd || service.estimate || service.estimated_delivery),
          cost,
        };
      })
      .filter(Boolean);
  }

  const cost = toNumberValue(record.cost || record.price || 0);
  if (!courierName || cost <= 0) return [];

  return [{
    courier: courierName,
    service: toStringValue(record.service || record.description || 'Service'),
    description: toStringValue(record.description || record.service),
    estimated_delivery: toStringValue(record.etd || record.estimate || record.estimated_delivery),
    cost,
  }];
}
