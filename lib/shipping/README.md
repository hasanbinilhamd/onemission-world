# Shipping Gateway Module

This module exposes reusable internal shipping APIs for ONEMISSION applications.

Architecture:

Commerce → HQ Shipping API → Shipping Service → Provider → RajaOngkir

## Endpoints

### GET `/api/shipping/provinces`

Returns the available shipping provinces.

#### Request

No query parameters.

#### Success Response

```json
{
  "success": true,
  "message": "Shipping provinces retrieved successfully.",
  "data": [
    {
      "id": "9",
      "name": "Jawa Barat"
    }
  ]
}
```

#### Possible Errors

- `503` Shipping provider is unavailable.
- `504` Shipping provider request timed out.
- `502` Shipping provider credentials are invalid.

---

### GET `/api/shipping/cities`

Returns the available cities for a province.

#### Request

Query parameters:

- `province_id` (required)

#### Success Response

```json
{
  "success": true,
  "message": "Shipping cities retrieved successfully.",
  "data": [
    {
      "id": "23",
      "provinceId": "9",
      "name": "Bandung",
      "type": "Kota",
      "postalCode": "40111"
    }
  ]
}
```

#### Validation

- `province_id` must be present.

#### Possible Errors

- `400` Missing or invalid `province_id`.
- `404` Province not found.
- `503` Shipping provider is unavailable.
- `504` Shipping provider request timed out.

---

### GET `/api/shipping/districts`

Returns the available districts for a city.

#### Request

Query parameters:

- `city_id` (required)

#### Success Response

```json
{
  "success": true,
  "message": "Shipping districts retrieved successfully.",
  "data": [
    {
      "id": "1376",
      "cityId": "23",
      "name": "Coblong"
    }
  ]
}
```

#### Validation

- `city_id` must be present.

#### Possible Errors

- `400` Missing or invalid `city_id`.
- `404` City not found.
- `503` Shipping provider is unavailable.
- `504` Shipping provider request timed out.

---

### POST `/api/shipping/cost`

Returns the available shipping cost options.

#### Request

Request body:

- `originDistrict` (required)
- `destinationDistrict` (required)
- `weight` (required, numeric, greater than zero)
- `courier` (required)

#### Success Response

```json
{
  "success": true,
  "message": "Shipping cost retrieved successfully.",
  "data": [
    {
      "courier": "JNE",
      "service": "REG",
      "description": "JNE Regular Service",
      "estimatedDelivery": "2-3 Days",
      "cost": 18000
    }
  ]
}
```

#### Validation

- `originDistrict` must be present.
- `destinationDistrict` must be present.
- `weight` must be numeric and greater than zero.
- `courier` must be present.

#### Possible Errors

- `400` Invalid request body.
- `404` Destination district not found.
- `429` Shipping provider rate limit reached.
- `502` Invalid RajaOngkir credentials.
- `503` Shipping provider is unavailable.
- `504` Shipping provider request timed out.

## Notes

- Province, city, and district requests reuse the internal cache for 7 days.
- Shipping cost is never cached.
- API routes never communicate with RajaOngkir directly.
- RajaOngkir responses are normalized before leaving the Shipping module.
