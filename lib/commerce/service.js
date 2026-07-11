import { prisma } from '@/lib/prisma';
import { getCachedValue } from '@/lib/server-cache';
import { CommerceProductError } from './errors';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;
const DEFAULT_CURRENCY = 'IDR';
const NEW_ARRIVAL_WINDOW = 12;
const MASTER_CATEGORY_CACHE_TTL_MS = 300_000;
const STOCK_STATUS = {
  IN_STOCK: 'IN_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
};

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return null;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildAbsoluteUrl(baseUrl, assetPath = '') {
  const normalized = String(assetPath || '').trim();
  const fallbackPath = '/icon.svg';

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const resolvedPath = normalized || fallbackPath;
  const safePath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
  return `${String(baseUrl || '').replace(/\/$/, '')}${safePath}`;
}

function deriveFeatured(product) {
  const tags = Array.isArray(product.tags) ? product.tags.map((entry) => String(entry || '').toLowerCase()) : [];
  const notes = String(product.notes || '').toLowerCase();

  return tags.some((entry) => ['featured', 'bestseller', 'best-seller', 'best seller'].includes(entry))
    || notes.includes('featured')
    || notes.includes('best seller')
    || notes.includes('bestseller');
}

function extractSkuSequence(sku) {
  const match = String(sku || '').match(/(\d+)(?!.*\d)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function deriveShortDescription(description) {
  const normalized = String(description || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137).trimEnd()}...`;
}

function computeDiscountPercentage(price, compareAtPrice) {
  if (!Number.isFinite(price) || !Number.isFinite(compareAtPrice) || compareAtPrice <= price || compareAtPrice <= 0) {
    return 0;
  }

  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

function mapVariant(product, variant, baseUrl) {
  const stock = Number(variant.quantity) || 0;
  const available = stock > 0;
  const image = buildAbsoluteUrl(baseUrl, product.imageUrl);

  return {
    id: variant.id,
    sku: `${product.sku}-${slugify(variant.color || 'default').toUpperCase()}-${slugify(variant.size || 'default').toUpperCase()}`,
    variantName: [variant.color, variant.size].filter(Boolean).join(' / ') || 'Default',
    attributes: {
      color: variant.color || '',
      size: variant.size || '',
    },
    price: Number(product.sellingPrice) || 0,
    stock,
    weight: 0,
    image,
    available,
  };
}

function buildCategoryValue(categoryName) {
  const name = String(categoryName || '').trim();
  return {
    id: slugify(name),
    name,
    slug: slugify(name),
  };
}

function buildCardProduct({ product, baseUrl, newArrival }) {
  const thumbnail = buildAbsoluteUrl(baseUrl, product.imageUrl);
  const variants = product.inventory.filter((entry) => (entry.status || 'Active') === 'Active');
  const totalStock = variants.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const hasVariants = variants.length > 0;
  const price = Number(product.sellingPrice) || 0;
  const compareAtPrice = null;
  const discountPercentage = computeDiscountPercentage(price, compareAtPrice);

  return {
    id: product.id,
    slug: slugify(product.name),
    name: product.name,
    shortDescription: deriveShortDescription(product.description),
    thumbnail,
    price,
    compareAtPrice,
    discountPercentage,
    currency: DEFAULT_CURRENCY,
    category: product.category,
    rating: null,
    reviewCount: 0,
    stockStatus: totalStock > 0 ? STOCK_STATUS.IN_STOCK : STOCK_STATUS.OUT_OF_STOCK,
    featured: deriveFeatured(product),
    newArrival,
    hasVariants,
    minimumPrice: hasVariants ? price : price,
    maximumPrice: hasVariants ? price : price,
  };
}

function sortProducts(products, sort) {
  const sorted = [...products];

  switch (sort) {
    case 'price_asc':
      sorted.sort((left, right) => left.price - right.price);
      break;
    case 'price_desc':
      sorted.sort((left, right) => right.price - left.price);
      break;
    case 'name_desc':
      sorted.sort((left, right) => right.name.localeCompare(left.name));
      break;
    case 'name_asc':
      sorted.sort((left, right) => left.name.localeCompare(right.name));
      break;
    case 'newest':
    default:
      sorted.sort((left, right) => right.sequence - left.sequence || left.name.localeCompare(right.name));
      break;
  }

  return sorted;
}

function buildPagination({ page, limit, totalItems }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function paginate(items, page, limit) {
  const offset = (page - 1) * limit;
  return items.slice(offset, offset + limit);
}

const PUBLISHED_PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  category: true,
  status: true,
  sellingPrice: true,
  description: true,
  tags: true,
  notes: true,
  imageUrl: true,
  inventory: {
    where: {
      status: 'Active',
    },
    select: {
      id: true,
      color: true,
      size: true,
      quantity: true,
      status: true,
    },
    orderBy: [
      { color: 'asc' },
      { size: 'asc' },
    ],
  },
};

export class CommerceProductService {
  constructor({
    prismaClient = prisma,
  } = {}) {
    this.prisma = prismaClient;
  }

  async fetchPublishedProducts() {
    return this.prisma.product.findMany({
      where: {
        status: 'Active',
      },
      select: PUBLISHED_PRODUCT_SELECT,
      orderBy: [
        { sku: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async fetchPublishedProductSlugIndex() {
    return this.prisma.product.findMany({
      where: {
        status: 'Active',
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }


  buildCommerceSnapshots(products, baseUrl) {
    const orderedByRecency = [...products].sort((left, right) => {
      return extractSkuSequence(right.sku) - extractSkuSequence(left.sku)
        || right.name.localeCompare(left.name);
    });

    const newArrivalIds = new Set(
      orderedByRecency.slice(0, NEW_ARRIVAL_WINDOW).map((entry) => entry.id),
    );

    return products.map((product) => {
      const newArrival = newArrivalIds.has(product.id);
      const variants = product.inventory.map((variant) => mapVariant(product, variant, baseUrl));
      const currentStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
      const card = buildCardProduct({ product, baseUrl, newArrival });

      return {
        ...card,
        sequence: extractSkuSequence(product.sku),
        description: String(product.description || '').trim(),
        gallery: [card.thumbnail],
        categoryObject: buildCategoryValue(product.category),
        availableVariants: variants,
        availableSizes: [...new Set(variants.filter((variant) => variant.available).map((variant) => variant.attributes.size).filter(Boolean))],
        availableColors: [...new Set(variants.filter((variant) => variant.available).map((variant) => variant.attributes.color).filter(Boolean))],
        currentStock,
        weight: 0,
      };
    });
  }

  normalizeListQuery(query = {}) {
    const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
    const requestedLimit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);

    return {
      page,
      limit,
      search: String(query.search || '').trim(),
      category: String(query.category || '').trim(),
      sort: String(query.sort || 'newest').trim(),
      featured: parseBooleanFlag(query.featured),
      newArrival: parseBooleanFlag(query.newArrival),
      minPrice: parseOptionalNumber(query.minPrice),
      maxPrice: parseOptionalNumber(query.maxPrice),
      inStock: parseBooleanFlag(query.inStock),
    };
  }

  filterProducts(products, filters) {
    return products.filter((product) => {
      if (filters.search) {
        const keyword = filters.search.toLowerCase();
        const matches = product.name.toLowerCase().includes(keyword)
          || product.description.toLowerCase().includes(keyword)
          || product.category.toLowerCase().includes(keyword)
          || product.slug.toLowerCase().includes(keyword);

        if (!matches) {
          return false;
        }
      }

      if (filters.category) {
        const requestedCategory = filters.category.toLowerCase();
        const productCategorySlug = product.categoryObject.slug.toLowerCase();
        const productCategoryName = product.category.toLowerCase();

        if (requestedCategory !== productCategorySlug && requestedCategory !== productCategoryName) {
          return false;
        }
      }

      if (filters.featured !== null && product.featured !== filters.featured) {
        return false;
      }

      if (filters.newArrival !== null && product.newArrival !== filters.newArrival) {
        return false;
      }

      if (filters.minPrice !== null && product.minimumPrice < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice !== null && product.maximumPrice > filters.maxPrice) {
        return false;
      }

      if (filters.inStock !== null) {
        const matchesStock = filters.inStock
          ? product.stockStatus === STOCK_STATUS.IN_STOCK
          : product.stockStatus === STOCK_STATUS.OUT_OF_STOCK;
        if (!matchesStock) {
          return false;
        }
      }

      return true;
    });
  }

  async listProducts({ query = {}, baseUrl }) {
    const filters = this.normalizeListQuery(query);
    const products = await this.fetchPublishedProducts();
    const snapshots = this.buildCommerceSnapshots(products, baseUrl);
    const filtered = this.filterProducts(snapshots, filters);
    const sorted = sortProducts(filtered, filters.sort);
    const paginated = paginate(sorted, filters.page, filters.limit);

    return {
      data: paginated.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        thumbnail: product.thumbnail,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        discountPercentage: product.discountPercentage,
        currency: product.currency,
        category: product.category,
        rating: product.rating,
        reviewCount: product.reviewCount,
        stockStatus: product.stockStatus,
        featured: product.featured,
        newArrival: product.newArrival,
        hasVariants: product.hasVariants,
        minimumPrice: product.minimumPrice,
        maximumPrice: product.maximumPrice,
      })),
      pagination: buildPagination({
        page: filters.page,
        limit: filters.limit,
        totalItems: sorted.length,
      }),
      filters,
    };
  }

  async getProductBySlug({ slug, baseUrl }) {
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) {
      throw new CommerceProductError({
        message: 'Product slug is required.',
        statusCode: 400,
        code: 'COMMERCE_PRODUCT_SLUG_REQUIRED',
      });
    }

    const slugIndex = await this.fetchPublishedProductSlugIndex();
    const matchedProduct = slugIndex.find((entry) => slugify(entry.name) === normalizedSlug);

    if (!matchedProduct) {
      throw new CommerceProductError({
        message: 'Commerce product was not found.',
        statusCode: 404,
        code: 'COMMERCE_PRODUCT_NOT_FOUND',
      });
    }

    const allPublishedProducts = await this.fetchPublishedProducts();
    const snapshots = this.buildCommerceSnapshots(allPublishedProducts, baseUrl);
    const product = snapshots.find((entry) => entry.id === matchedProduct.id);

    if (!product) {
      throw new CommerceProductError({
        message: 'Commerce product was not found.',
        statusCode: 404,
        code: 'COMMERCE_PRODUCT_NOT_FOUND',
      });
    }

    return {
      data: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        thumbnail: product.thumbnail,
        gallery: product.gallery,
        category: product.categoryObject,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        discountPercentage: product.discountPercentage,
        currency: product.currency,
        minimumPrice: product.minimumPrice,
        maximumPrice: product.maximumPrice,
        stockStatus: product.stockStatus,
        currentStock: product.currentStock,
        featured: product.featured,
        newArrival: product.newArrival,
        hasVariants: product.hasVariants,
        availableVariants: product.availableVariants,
        availableSizes: product.availableSizes,
        availableColors: product.availableColors,
        weight: product.weight,
        seo: {
          slug: product.slug,
        },
      },
    };
  }

  async listCategories({ baseUrl }) {
    return getCachedValue(`master:commerce-categories:${String(baseUrl || '').replace(/\/$/, '')}`, MASTER_CATEGORY_CACHE_TTL_MS, async () => {
      const products = await this.fetchPublishedProducts();
      const snapshots = this.buildCommerceSnapshots(products, baseUrl);
      const categoryMap = new Map();

      for (const product of snapshots) {
        const key = product.categoryObject.slug;
        const existing = categoryMap.get(key) || {
          id: product.categoryObject.id,
          name: product.categoryObject.name,
          slug: product.categoryObject.slug,
          thumbnail: product.thumbnail,
          productCount: 0,
        };

        existing.productCount += 1;
        categoryMap.set(key, existing);
      }

      return {
        data: Array.from(categoryMap.values()).sort((left, right) => left.name.localeCompare(right.name)),
      };
    });
  }

  async listFeaturedProducts({ query = {}, baseUrl }) {
    return this.listProducts({
      query: {
        ...query,
        featured: 'true',
      },
      baseUrl,
    });
  }

  async listNewArrivalProducts({ query = {}, baseUrl }) {
    return this.listProducts({
      query: {
        ...query,
        newArrival: 'true',
        sort: query.sort || 'newest',
      },
      baseUrl,
    });
  }

  async searchProducts({ query = {}, baseUrl }) {
    const searchValue = String(query.q || query.search || '').trim();

    return this.listProducts({
      query: {
        ...query,
        search: searchValue,
      },
      baseUrl,
    });
  }
}

export const commerceProductService = new CommerceProductService();
