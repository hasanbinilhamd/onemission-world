# Commerce Public Product API

## Overview

The Commerce Product API is the dedicated public read-only layer for storefront consumers.

Architecture:

HQ Product Management

↓

Commerce Product API

↓

ONEMISSION Commerce

↓

Future Mobile App / Marketplace Integration

HQ remains the single source of truth. Commerce only consumes this optimized public API layer.

Base path:

`/api/commerce`

No authentication is required for public product browsing.

## Business Rules

- Only products with `status = Active` are returned.
- Draft and archived products are hidden.
- Deleted products are naturally hidden because they no longer exist in HQ.
- Only variants with `status = Active` are returned.
- Stock reflects current active inventory quantity.
- If stock is `0`, `stockStatus = "OUT_OF_STOCK"` and `available = false`.
- Product images are always returned as fully qualified URLs.
- Internal HQ-only fields are never exposed.

## Supported Sort Options

- `newest`
- `price_asc`
- `price_desc`
- `name_asc`
- `name_desc`

## Pagination

Default page size:

- `12`

Maximum page size:

- `48`

Pagination format:

```json
{
  "pagination": {
    "page": 1,
    "limit": 12,
    "totalItems": 24,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Endpoints

### 1. GET /api/commerce/products

Product listing endpoint for storefront product grids.

#### Query Parameters

- `page`
- `limit`
- `search`
- `category`
- `sort`
- `featured`
- `newArrival`
- `minPrice`
- `maxPrice`
- `inStock`

#### Example Request

```http
GET /api/commerce/products?page=1&limit=12&sort=newest
```

#### Example Response

```json
{
  "data": [
    {
      "id": "product-1",
      "slug": "training-jersey-black",
      "name": "Training Jersey Black",
      "shortDescription": "Lightweight breathable jersey designed for training sessions.",
      "thumbnail": "https://hq.onemission.world/icon.svg",
      "price": 199000,
      "compareAtPrice": null,
      "discountPercentage": 0,
      "currency": "IDR",
      "category": "Jerseys",
      "rating": null,
      "reviewCount": 0,
      "stockStatus": "IN_STOCK",
      "featured": true,
      "newArrival": true,
      "hasVariants": true,
      "minimumPrice": 199000,
      "maximumPrice": 199000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "filters": {
    "page": 1,
    "limit": 12,
    "search": "",
    "category": "",
    "sort": "newest",
    "featured": null,
    "newArrival": null,
    "minPrice": null,
    "maxPrice": null,
    "inStock": null
  }
}
```

### 2. GET /api/commerce/products/:slug

Product detail endpoint for storefront PDP pages.

#### Example Request

```http
GET /api/commerce/products/training-jersey-black
```

#### Example Response

```json
{
  "data": {
    "id": "product-1",
    "slug": "training-jersey-black",
    "name": "Training Jersey Black",
    "shortDescription": "Lightweight breathable jersey designed for training sessions.",
    "description": "Full product description.",
    "thumbnail": "https://hq.onemission.world/icon.svg",
    "gallery": [
      "https://hq.onemission.world/icon.svg"
    ],
    "category": {
      "id": "jerseys",
      "name": "Jerseys",
      "slug": "jerseys"
    },
    "price": 199000,
    "compareAtPrice": null,
    "discountPercentage": 0,
    "currency": "IDR",
    "minimumPrice": 199000,
    "maximumPrice": 199000,
    "stockStatus": "IN_STOCK",
    "currentStock": 12,
    "featured": true,
    "newArrival": true,
    "hasVariants": true,
    "availableVariants": [
      {
        "id": "variant-1",
        "sku": "OM-JS-003-BLACK-XL",
        "variantName": "Black / XL",
        "attributes": {
          "color": "Black",
          "size": "XL"
        },
        "price": 199000,
        "stock": 6,
        "weight": 0,
        "image": "https://hq.onemission.world/icon.svg",
        "available": true
      }
    ],
    "availableSizes": ["XL"],
    "availableColors": ["Black"],
    "weight": 0,
    "seo": {
      "slug": "training-jersey-black"
    }
  }
}
```

### 3. GET /api/commerce/categories

Returns active categories derived from published products only.

#### Example Request

```http
GET /api/commerce/categories
```

#### Example Response

```json
{
  "data": [
    {
      "id": "jerseys",
      "name": "Jerseys",
      "slug": "jerseys",
      "thumbnail": "https://hq.onemission.world/icon.svg",
      "productCount": 4
    }
  ]
}
```

### 4. GET /api/commerce/products/featured

Returns featured products only.

#### Example Request

```http
GET /api/commerce/products/featured?limit=8
```

### 5. GET /api/commerce/products/new-arrivals

Returns newest published products.

#### Example Request

```http
GET /api/commerce/products/new-arrivals?limit=8
```

### 6. GET /api/commerce/products/search

Search endpoint for storefront autocomplete or search results.

#### Query Parameters

- `q`
- `page`
- `limit`
- `sort`
- `category`
- `minPrice`
- `maxPrice`
- `inStock`

#### Example Request

```http
GET /api/commerce/products/search?q=jersey&page=1&limit=12
```

## Performance Considerations

- The Commerce API uses eager loading through Prisma `select` and `include` to load:
  - product
  - active inventory variants
- No Product Management endpoint is consumed internally.
- No N+1 variant lookups are performed.
- Category counts are derived from the already loaded published product dataset.
- Detail lookup uses the same published product projection, then resolves the requested slug in-memory.

## New Arrival Strategy

The current Product schema does not contain a `createdAt` field.

To preserve Product Management without schema changes, `newArrival` and `newest` ordering are derived from the latest numeric SKU sequence among active products.

## Source of Truth

HQ Product Management remains the single source of truth.

The Commerce Product API is only a read-only projection optimized for storefront consumption.
