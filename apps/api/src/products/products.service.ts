import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { algoliasearch } from 'algoliasearch';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuthenticatedUser } from '../common/types';
import {
  assertStoredImageFileMatchesMimeType,
  getSafeImageExtensionForMimeType,
} from '../common/security/security.utils';
import { DatabaseService, QueryRunner } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { VendorAccessService } from '../vendor-access/vendor-access.service';
import {
  type PaginationInput,
  toPaginatedResponse,
} from '../common/dto/pagination.dto';
import {
  ProductBulkStockDto,
  ProductMutationDto,
  ProductUpdateDto,
  ReviewSubmissionDto,
  VendorCatalogRequestDto,
} from './dto';

type UploadedFile = Express.Multer.File;

const DEFAULT_SEARCH_LIMIT = 24;
const DEFAULT_FALLBACK_LIMIT = 10;
const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'the',
  'to',
  'with',
]);

const SEARCH_CATEGORY_ALIASES: Record<string, string[]> = {
  tshirts: [
    'tshirt',
    'tshirts',
    't shirt',
    't shirts',
    'tee shirt',
    'tee shirts',
    'tee',
    'tees',
    't-shirt',
    't-shirts',
  ],
  tops: ['top', 'tops', 'blouse', 'blouses', 'tank top', 'tank tops'],
  shirts: ['shirt', 'shirts', 'button shirt', 'button shirts', 'button down'],
  hoodies: ['hoodie', 'hoodies', 'hooded sweatshirt'],
  sweatshirts: ['sweatshirt', 'sweatshirts', 'crewneck', 'crewnecks'],
  sweaters: ['sweater', 'sweaters', 'knit', 'knits', 'jumper', 'jumpers'],
  jackets: ['jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers'],
  outerwear: ['outerwear', 'outerwears', 'parka', 'parkas'],
  pants: [
    'pant',
    'pants',
    'trouser',
    'trousers',
    'slack',
    'slacks',
    'bottom',
    'bottoms',
  ],
  jeans: ['jean', 'jeans', 'denim', 'denims'],
  shorts: ['short', 'shorts'],
  suits: ['suit', 'suits', 'tailoring', 'formalwear'],
  sportswear: ['sportswear', 'sport', 'sports', 'activewear', 'gymwear'],
  accessories: ['accessory', 'accessories', 'bag', 'bags', 'belt', 'belts'],
  leggings: ['legging', 'leggings', 'tights'],
  dresses: ['dress', 'dresses', 'gown', 'gowns'],
  skirts: ['skirt', 'skirts'],
  bodysuits: ['bodysuit', 'bodysuits', 'body suit', 'body suits'],
  rompers: ['romper', 'rompers', 'onesie', 'onesies'],
  sets: ['set', 'sets', 'outfit', 'outfits'],
  sleepwear: ['sleepwear', 'pajama', 'pajamas', 'pyjama', 'pyjamas'],
  blankets: ['blanket', 'blankets'],
  schoolwear: ['schoolwear', 'school uniform', 'school uniforms'],
};

const SEARCH_CATEGORY_LABELS: Record<string, string> = {
  tshirts: 'T-Shirts',
  sportswear: 'Sportswear',
  schoolwear: 'Schoolwear',
  sleepwear: 'Sleepwear',
};

interface ProductRow {
  id: string;
  title: string;
  description: string;
  price: number | string;
  stock: number;
  is_listed?: boolean;
  department: string;
  category: string;
  color: string | null;
  size: string | null;
  product_code?: string | null;
  low_stock_alert_sent_at?: Date | null;
  vendor_id?: string;
  shop_name?: string;
  logo_url?: string | null;
  created_at: Date;
}

interface ProductStructureRow {
  product_id: string;
  brand_id: string | null;
  brand_name: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory_id: string | null;
  subcategory_name: string | null;
  gender_group_id: string | null;
  gender_group_name: string | null;
}

interface ProductColorRow {
  product_id: string;
  color_id: string;
  color_name: string;
}

interface ProductSizeRow {
  product_id: string;
  size_id: string;
  size_label: string;
  size_stock: number;
  size_type_id: string;
  size_type_name: string;
}

interface HomepageHeroSlideRow {
  id: string;
  internal_name: string | null;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  target_url: string | null;
  sort_order: number;
}

interface SearchableProductRow extends ProductRow {
  total_units_sold: number;
}

interface SearchIndexRecord {
  [key: string]: unknown;
  objectID: string;
  title: string;
  category: string;
  subcategory: string | null;
  color: string | null;
  brand: string | null;
  tags: string[];
  department: string;
  inStock: boolean;
  popularityScore: number;
  totalUnitsSold: number;
  createdAtTimestamp: number;
}

interface PublicCatalogProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  isListed: boolean;
  department: string;
  category: string;
  color: string | null;
  size: string | null;
  brand?: { id: string; name: string } | null;
  categoryRef?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  genderGroup?: { id: string; name: string } | null;
  colors: { id: string; name: string }[];
  sizeVariants: {
    id: string;
    label: string;
    stock: number;
    sizeTypeId: string;
    sizeTypeName: string;
  }[];
  productCode?: string | null;
  ratingSummary: {
    average: number | null;
    count: number;
  };
  vendor?: {
    id: string;
    shopName: string;
    logoUrl?: string | null;
    ratingSummary?: {
      average: number | null;
      count: number;
    };
  };
  images: string[];
  createdAt: Date;
  recentReviews?: PublicReviewEntry[];
}

export interface RatingSummary {
  average: number | null;
  count: number;
}

interface ReviewSummaryRow {
  target_id: string;
  average_rating: number | string | null;
  review_count: number;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  full_name: string | null;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicReviewEntry {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ReviewEligibilityRow {
  delivered_purchase_count: number;
  last_delivered_at: Date | null;
}

export interface ReviewStatusResponse {
  canReview: boolean;
  reason: string | null;
  deliveredPurchaseCount: number;
  lastDeliveredAt: Date | null;
  existingReview: PublicReviewEntry | null;
}

interface SearchLayer {
  id: 'exact' | 'category' | 'color' | 'related';
  title: string;
  products: PublicCatalogProduct[];
}

type SearchableProduct = PublicCatalogProduct & {
  totalUnitsSold: number;
  popularityScore: number;
  brandName: string | null;
  tags: string[];
};

interface AnnotatedSearchProduct {
  product: SearchableProduct;
  algoliaRank: number;
  textScore: number;
  titleScore: number;
  matchesAllTokens: boolean;
  phraseInTitle: boolean;
  categoryMatch: boolean;
  colorMatch: boolean;
}

interface VendorLowStockAlertPayload {
  email: string;
  shopName: string;
  productTitle: string;
  productCode: string | null;
  stock: number;
  threshold: number;
}

@Injectable()
export class ProductsService {
  private algoliaClient: ReturnType<typeof algoliasearch> | null = null;
  private algoliaSettingsEnsured = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly vendorAccessService: VendorAccessService,
  ) {}

  async listPublicProducts(pagination?: PaginationInput | null) {
    const pagingClause = pagination
      ? ` OFFSET ${pagination.offset} ROWS FETCH NEXT ${pagination.pageSize} ROWS ONLY`
      : '';
    const [result, totalCount] = await Promise.all([
      this.databaseService.query<ProductRow>(
        `SELECT p.id, p.title, p.description, p.price, p.stock, p.is_listed, p.department, p.category, p.color, p.size, p.created_at,
              v.id AS vendor_id, v.shop_name, v.logo_url
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       WHERE ${this.publicProductVisibilityClause('p', 'v')}
       ORDER BY p.created_at DESC${pagingClause}`,
      ),
      pagination
        ? this.databaseService.query<{ total: number }>(
            `SELECT COUNT(*) AS total
             FROM products p
             INNER JOIN vendors v ON v.id = p.vendor_id
             WHERE ${this.publicProductVisibilityClause('p', 'v')}`,
          )
        : Promise.resolve({ rows: [] as { total: number }[] }),
    ]);

    const items = await this.attachImages(result.rows);
    if (!pagination) {
      return items;
    }

    return toPaginatedResponse(
      items,
      totalCount.rows[0]?.total ?? 0,
      pagination,
    );
  }

  async searchPublicProducts(input: {
    query: string;
    category?: string;
    department?: string;
    limit?: number;
  }) {
    const query = input.query.trim();
    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    const limit = Math.max(
      1,
      Math.min(Number(input.limit ?? DEFAULT_SEARCH_LIMIT), 48),
    );
    const category = this.normalizeCatalogFilter(input.category);
    const department = this.normalizeCatalogFilter(input.department);
    const fullCatalog = await this.getPublicSearchCatalog({
      category,
      department,
    });
    const queryProfile = this.buildSearchQueryProfile(query, fullCatalog);
    const candidateProducts = await this.getSearchCandidates({
      query,
      category,
      department,
      limit,
      fullCatalog,
    });
    const layers = this.buildSearchLayers(
      candidateProducts.products,
      queryProfile,
      limit,
    );
    const usedProductIds = new Set(
      layers.flatMap((layer) => layer.products.map((product) => product.id)),
    );
    const fallbackProducts = fullCatalog
      .filter((product) => !usedProductIds.has(product.id))
      .sort(
        (left, right) =>
          this.compareSearchableProducts(left, right) ||
          new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
      )
      .slice(0, DEFAULT_FALLBACK_LIMIT);

    return {
      query,
      algorithm: candidateProducts.algorithm,
      hasResults: layers.some((layer) => layer.products.length > 0),
      totalResults: layers.reduce(
        (sum, layer) => sum + layer.products.length,
        0,
      ),
      noResultsMessage: layers.some((layer) => layer.products.length > 0)
        ? null
        : `No results found for "${query}".`,
      sections: layers.filter((layer) => layer.products.length > 0),
      fallbackProducts,
    };
  }

  async getPublicProductById(id: string) {
    const result = await this.databaseService.query<ProductRow>(
      `SELECT TOP 1 p.id, p.title, p.description, p.price, p.stock, p.is_listed, p.department, p.category, p.color, p.size, p.created_at,
                      v.id AS vendor_id, v.shop_name, v.logo_url
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       WHERE p.id = $1
         AND ${this.publicProductVisibilityClause('p', 'v')}`,
      [id],
    );

    const product = result.rows[0];
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [publicProduct, recentReviews] = await Promise.all([
      this.attachImages([product]).then((items) => items[0]),
      this.getRecentProductReviews(id),
    ]);

    return {
      ...publicProduct,
      recentReviews,
    };
  }

  async listPublicVendors(pagination?: PaginationInput | null) {
    const pagingClause = pagination
      ? ` OFFSET ${pagination.offset} ROWS FETCH NEXT ${pagination.pageSize} ROWS ONLY`
      : '';
    const [result, totalCount] = await Promise.all([
      this.databaseService.query<{
      id: string;
      shop_name: string;
      shop_description: string | null;
      logo_url: string | null;
      banner_url: string | null;
      product_count: number;
      category_count: number;
    }>(
      `SELECT
         v.id,
         v.shop_name,
         v.shop_description,
         v.logo_url,
         v.banner_url,
         COUNT(CASE WHEN p.is_listed = 1 THEN p.id END) AS product_count,
         COUNT(DISTINCT CASE WHEN p.is_listed = 1 THEN p.category END) AS category_count
       FROM vendors v
       LEFT JOIN products p ON p.vendor_id = v.id
       WHERE ${this.publicVendorVisibilityClause('v')}
       GROUP BY v.id, v.shop_name, v.shop_description, v.logo_url, v.banner_url
       ORDER BY COUNT(CASE WHEN p.is_listed = 1 THEN p.id END) DESC, v.shop_name ASC${pagingClause}`,
      ),
      pagination
        ? this.databaseService.query<{ total: number }>(
            `SELECT COUNT(*) AS total
             FROM vendors v
             WHERE ${this.publicVendorVisibilityClause('v')}`,
          )
        : Promise.resolve({ rows: [] as { total: number }[] }),
    ]);

    const vendorCatalogRows = await this.databaseService.query<{
      vendor_id: string;
      department: string;
      category: string;
    }>(
      `SELECT
         v.id AS vendor_id,
         p.department,
         p.category
       FROM vendors v
       INNER JOIN products p ON p.vendor_id = v.id
       WHERE ${this.publicProductVisibilityClause('p', 'v')}
       GROUP BY v.id, p.department, p.category`,
    );

    const vendorCatalogMap = new Map<
      string,
      { departments: Set<string>; categories: Set<string> }
    >();

    for (const row of vendorCatalogRows.rows) {
      const current = vendorCatalogMap.get(row.vendor_id) ?? {
        departments: new Set<string>(),
        categories: new Set<string>(),
      };
      current.departments.add(row.department);
      current.categories.add(row.category);
      vendorCatalogMap.set(row.vendor_id, current);
    }

    const vendorRatingMap = await this.getVendorRatingSummaries(
      result.rows.map((row) => row.id),
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      shopName: row.shop_name,
      shopDescription: row.shop_description,
      logoUrl: row.logo_url,
      bannerUrl: row.banner_url,
      productCount: row.product_count,
      categoryCount: row.category_count,
      departments: [...(vendorCatalogMap.get(row.id)?.departments ?? [])],
      categories: [...(vendorCatalogMap.get(row.id)?.categories ?? [])],
      ratingSummary:
        vendorRatingMap.get(row.id) ?? this.createEmptyRatingSummary(),
    }));

    if (!pagination) {
      return items;
    }

    return toPaginatedResponse(
      items,
      totalCount.rows[0]?.total ?? 0,
      pagination,
    );
  }

  async listHomepageHeroSlides() {
    const intervalResult = await this.databaseService.query<{
      homepage_hero_autoplay_enabled: boolean | null;
      homepage_hero_interval_seconds: number | null;
    }>(
      `SELECT TOP 1 homepage_hero_autoplay_enabled, homepage_hero_interval_seconds
       FROM platform_settings
       WHERE id = 1`,
    );

    const slideRows = await this.databaseService.query<HomepageHeroSlideRow>(
      `SELECT
         hs.id,
         hs.internal_name,
         hs.desktop_image_url,
         hs.mobile_image_url,
         hs.target_url,
         hs.sort_order
       FROM homepage_hero_slides hs
       WHERE hs.is_active = 1
         AND hs.desktop_image_url IS NOT NULL
         AND hs.target_url IS NOT NULL
         AND (hs.starts_at IS NULL OR hs.starts_at <= SYSDATETIME())
         AND (hs.ends_at IS NULL OR hs.ends_at >= SYSDATETIME())
       ORDER BY hs.sort_order ASC, hs.created_at ASC`,
    );

    return {
      autoRotate:
        intervalResult.rows[0]?.homepage_hero_autoplay_enabled ?? true,
      intervalSeconds:
        intervalResult.rows[0]?.homepage_hero_interval_seconds ?? 6,
      slides: slideRows.rows.map((slide) => ({
        id: slide.id,
        internalName: slide.internal_name,
        imageUrl: slide.desktop_image_url,
        mobileImageUrl: slide.mobile_image_url,
        targetUrl: slide.target_url,
      })),
    };
  }

  async getPublicVendorById(vendorId: string) {
    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
      shop_description: string | null;
      logo_url: string | null;
      banner_url: string | null;
      support_email: string | null;
      support_phone: string | null;
      business_hours: string | null;
      shipping_notes: string | null;
      return_policy: string | null;
    }>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.shop_description,
         v.logo_url,
         v.banner_url,
         v.support_email,
         v.support_phone,
         v.business_hours,
         v.shipping_notes,
         v.return_policy
       FROM vendors v
       WHERE v.id = $1
         AND ${this.publicVendorVisibilityClause('v')}`,
      [vendorId],
    );

    const row = vendor.rows[0];
    if (!row) {
      throw new NotFoundException('Shop not found');
    }

    const products = await this.databaseService.query<ProductRow>(
      `SELECT p.id, p.title, p.description, p.price, p.stock, p.is_listed, p.department, p.category, p.color, p.size, p.created_at,
              v.id AS vendor_id, v.shop_name, v.logo_url
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       WHERE p.vendor_id = $1
         AND ${this.publicProductVisibilityClause('p', 'v')}
       ORDER BY p.created_at DESC`,
      [vendorId],
    );

    const [productList, vendorRatingSummary, recentReviews] = await Promise.all(
      [
        this.attachImages(products.rows),
        this.getVendorRatingSummaries([vendorId]).then(
          (summaries) =>
            summaries.get(vendorId) ?? this.createEmptyRatingSummary(),
        ),
        this.getRecentVendorReviews(vendorId),
      ],
    );

    return {
      id: row.id,
      shopName: row.shop_name,
      shopDescription: row.shop_description,
      logoUrl: row.logo_url,
      bannerUrl: row.banner_url,
      supportEmail: row.support_email,
      supportPhone: row.support_phone,
      businessHours: row.business_hours,
      shippingNotes: row.shipping_notes,
      returnPolicy: row.return_policy,
      productCount: productList.length,
      categories: [...new Set(productList.map((product) => product.category))],
      products: productList,
      ratingSummary: vendorRatingSummary,
      recentReviews,
    };
  }

  async getCustomerProductReviewStatus(customerId: string, productId: string) {
    await this.assertProductExists(productId);

    const [eligibility, existingReview] = await Promise.all([
      this.getProductReviewEligibility(customerId, productId),
      this.getExistingProductReview(productId, customerId),
    ]);

    return this.buildReviewStatus(
      eligibility,
      existingReview,
      'Reviews unlock after you receive a delivered order for this item.',
    );
  }

  async getCustomerVendorReviewStatus(customerId: string, vendorId: string) {
    await this.assertVendorExists(vendorId);

    const [eligibility, existingReview] = await Promise.all([
      this.getVendorReviewEligibility(customerId, vendorId),
      this.getExistingVendorReview(vendorId, customerId),
    ]);

    return this.buildReviewStatus(
      eligibility,
      existingReview,
      'Reviews unlock after you receive a delivered order from this shop.',
    );
  }

  async upsertProductReview(
    customerId: string,
    productId: string,
    dto: ReviewSubmissionDto,
  ) {
    const reviewStatus = await this.getCustomerProductReviewStatus(
      customerId,
      productId,
    );
    if (!reviewStatus.canReview) {
      throw new ForbiddenException(
        reviewStatus.reason ?? 'You cannot review this product right now.',
      );
    }

    await this.databaseService.withTransaction(async (client) => {
      const existingReview = await client.query<{ id: string }>(
        `SELECT TOP 1 id
         FROM product_reviews
         WHERE product_id = $1
           AND customer_id = $2`,
        [productId, customerId],
      );
      const comment = this.normalizeReviewComment(dto.comment);

      if (existingReview.rows[0]) {
        await client.query(
          `UPDATE product_reviews
           SET rating = $1,
               comment = $2,
               updated_at = SYSDATETIME()
           WHERE id = $3`,
          [dto.rating, comment, existingReview.rows[0].id],
        );
        return;
      }

      await client.query(
        `INSERT INTO product_reviews (
           product_id,
           customer_id,
           rating,
           comment,
           updated_at
         )
         VALUES ($1, $2, $3, $4, SYSDATETIME())`,
        [productId, customerId, dto.rating, comment],
      );
    });

    return {
      message: 'Product review saved.',
      reviewStatus: await this.getCustomerProductReviewStatus(
        customerId,
        productId,
      ),
    };
  }

  async upsertVendorReview(
    customerId: string,
    vendorId: string,
    dto: ReviewSubmissionDto,
  ) {
    const reviewStatus = await this.getCustomerVendorReviewStatus(
      customerId,
      vendorId,
    );
    if (!reviewStatus.canReview) {
      throw new ForbiddenException(
        reviewStatus.reason ?? 'You cannot review this shop right now.',
      );
    }

    await this.databaseService.withTransaction(async (client) => {
      const existingReview = await client.query<{ id: string }>(
        `SELECT TOP 1 id
         FROM vendor_reviews
         WHERE vendor_id = $1
           AND customer_id = $2`,
        [vendorId, customerId],
      );
      const comment = this.normalizeReviewComment(dto.comment);

      if (existingReview.rows[0]) {
        await client.query(
          `UPDATE vendor_reviews
           SET rating = $1,
               comment = $2,
               updated_at = SYSDATETIME()
           WHERE id = $3`,
          [dto.rating, comment, existingReview.rows[0].id],
        );
        return;
      }

      await client.query(
        `INSERT INTO vendor_reviews (
           vendor_id,
           customer_id,
           rating,
           comment,
           updated_at
         )
         VALUES ($1, $2, $3, $4, SYSDATETIME())`,
        [vendorId, customerId, dto.rating, comment],
      );
    });

    return {
      message: 'Shop review saved.',
      reviewStatus: await this.getCustomerVendorReviewStatus(
        customerId,
        vendorId,
      ),
    };
  }

  async getVendorProducts(user: AuthenticatedUser) {
    const vendor = await this.getVendorForUser(user.sub);

    const result = await this.databaseService.query<ProductRow>(
      `SELECT p.id, p.title, p.description, p.price, p.stock, p.is_listed, p.department, p.category, p.color, p.size, p.product_code, p.created_at
       FROM products p
       WHERE p.vendor_id = $1
       ORDER BY p.created_at DESC`,
      [vendor.id],
    );

    return {
      vendor: {
        ...vendor,
      },
      products: await this.attachImages(result.rows),
    };
  }

  async getVendorCatalogOptions(user: AuthenticatedUser) {
    await this.getVendorForUser(user.sub);
    const [genderGroups, categories, brands, colors, sizeTypes, sizes] =
      await Promise.all([
        this.databaseService.query<{
          id: string;
          name: string;
          sort_order: number;
        }>(
          `SELECT id, name, sort_order
           FROM gender_groups
           WHERE is_active = 1
           ORDER BY sort_order ASC, name ASC`,
        ),
        this.databaseService.query<{
          id: string;
          name: string;
          sort_order: number;
        }>(
          `SELECT id, name, sort_order
           FROM categories
           WHERE is_active = 1
           ORDER BY sort_order ASC, name ASC`,
        ),
        this.databaseService.query<{
          id: string;
          name: string;
          sort_order: number;
        }>(
          `SELECT id, name, sort_order
           FROM brands
           WHERE is_active = 1
           ORDER BY sort_order ASC, name ASC`,
        ),
        this.databaseService.query<{
          id: string;
          name: string;
          sort_order: number;
        }>(
          `SELECT id, name, sort_order
           FROM colors
           WHERE is_active = 1
           ORDER BY sort_order ASC, name ASC`,
        ),
        this.databaseService.query<{
          id: string;
          name: string;
          sort_order: number;
        }>(
          `SELECT id, name, sort_order
           FROM size_types
           WHERE is_active = 1
           ORDER BY sort_order ASC, name ASC`,
        ),
        this.databaseService.query<{
          id: string;
          size_type_id: string;
          label: string;
          sort_order: number;
        }>(
          `SELECT id, size_type_id, label, sort_order
           FROM sizes
           WHERE is_active = 1
           ORDER BY sort_order ASC, label ASC`,
        ),
      ]);

    const subcategories = await this.databaseService.query<{
      id: string;
      category_id: string;
      name: string;
      sort_order: number;
    }>(
      `SELECT id, category_id, name, sort_order
       FROM subcategories
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`,
    );

    return {
      genderGroups: genderGroups.rows.map((row) => ({
        id: row.id,
        name: row.name,
      })),
      categories: categories.rows.map((row) => ({
        id: row.id,
        name: row.name,
        subcategories: subcategories.rows
          .filter((entry) => entry.category_id === row.id)
          .map((entry) => ({ id: entry.id, name: entry.name })),
      })),
      brands: brands.rows.map((row) => ({ id: row.id, name: row.name })),
      colors: colors.rows.map((row) => ({ id: row.id, name: row.name })),
      sizeTypes: sizeTypes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        sizes: sizes.rows
          .filter((entry) => entry.size_type_id === row.id)
          .map((entry) => ({ id: entry.id, label: entry.label })),
      })),
    };
  }

  async getVendorCatalogRequests(user: AuthenticatedUser) {
    const vendor = await this.getVendorForUser(user.sub);

    const result = await this.databaseService.query<{
      id: string;
      request_type: string;
      category_id: string | null;
      category_name: string | null;
      subcategory_id: string | null;
      subcategory_name: string | null;
      size_type_id: string | null;
      size_type_name: string | null;
      requested_value: string;
      note: string | null;
      status: string;
      admin_note: string | null;
      reviewed_at: Date | null;
      created_at: Date;
    }>(
      `SELECT
         vr.id,
         vr.request_type,
         vr.category_id,
         c.name AS category_name,
         vr.subcategory_id,
         sc.name AS subcategory_name,
         vr.size_type_id,
         st.name AS size_type_name,
         vr.requested_value,
         vr.note,
         vr.status,
         vr.admin_note,
         vr.reviewed_at,
         vr.created_at
       FROM vendor_requests vr
       LEFT JOIN categories c ON c.id = vr.category_id
       LEFT JOIN subcategories sc ON sc.id = vr.subcategory_id
       LEFT JOIN size_types st ON st.id = vr.size_type_id
       WHERE vendor_id = $1
       ORDER BY created_at DESC`,
      [vendor.id],
    );

    return result.rows.map((row) => ({
      id: row.id,
      requestType: row.request_type,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subcategoryId: row.subcategory_id,
      subcategoryName: row.subcategory_name,
      sizeTypeId: row.size_type_id,
      sizeTypeName: row.size_type_name,
      requestedValue: row.requested_value,
      note: row.note,
      status: row.status,
      adminNote: row.admin_note,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    }));
  }

  async createVendorCatalogRequest(
    user: AuthenticatedUser,
    dto: VendorCatalogRequestDto,
  ) {
    const vendor = await this.getVendorForUser(user.sub);
    const requestType = this.normalizeCatalogRequestType(dto.requestType);
    const requestedValue = dto.requestedValue.trim();
    if (!requestedValue) {
      throw new BadRequestException('Requested value is required');
    }

    const lookupValue = this.normalizeCatalogRequestLookupValue(
      requestType,
      requestedValue,
    );
    if (!lookupValue) {
      throw new BadRequestException('Requested value is invalid');
    }

    if (
      await this.catalogRequestMatchesExistingOption(requestType, lookupValue)
    ) {
      throw new BadRequestException(
        'This option already exists. Select it directly instead of submitting a request.',
      );
    }

    const pendingRows = await this.databaseService.query<{
      id: string;
      requested_value: string;
    }>(
      `SELECT id, requested_value
       FROM vendor_requests
       WHERE vendor_id = $1
         AND request_type = $2
         AND status = 'pending'`,
      [vendor.id, requestType],
    );

    if (
      pendingRows.rows.some(
        (row) =>
          this.normalizeCatalogRequestLookupValue(
            requestType,
            row.requested_value,
          ) === lookupValue,
      )
    ) {
      throw new BadRequestException(
        'You already have a pending request for this option.',
      );
    }

    await this.databaseService.query(
      `INSERT INTO vendor_requests (
         vendor_id,
         request_type,
         requested_value,
         note,
         category_id,
         subcategory_id,
         size_type_id,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, SYSDATETIME())`,
      [
        vendor.id,
        requestType,
        requestedValue,
        dto.note?.trim() || null,
        dto.categoryId?.trim() || null,
        dto.subcategoryId?.trim() || null,
        dto.sizeTypeId?.trim() || null,
      ],
    );

    return {
      message: 'Catalog request submitted.',
      requests: await this.getVendorCatalogRequests(user),
    };
  }

  async createProduct(
    user: AuthenticatedUser,
    dto: ProductMutationDto,
    files: UploadedFile[],
  ) {
    if (!files.length) {
      this.cleanupTemporaryFiles(files);
      throw new BadRequestException('At least one product image is required');
    }

    this.assertImageCount(files.length);

    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);
    const normalizedDto = this.normalizeProductMutationDto(dto);
    const selection =
      await this.resolveStructuredProductSelection(normalizedDto);

    try {
      const product = await this.databaseService.withTransaction(
        async (client) => {
          const created = await client.query<{ id: string }>(
            `INSERT INTO products (
               vendor_id,
               title,
               description,
               price,
               stock,
               is_listed,
               department,
               category,
               brand_id,
               category_id,
               subcategory_id,
               gender_group_id,
               color,
               size
             )
           OUTPUT INSERTED.id
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              vendor.id,
              normalizedDto.title,
              normalizedDto.description,
              normalizedDto.price,
              selection.totalStock,
              true,
              selection.department,
              selection.category,
              selection.brand.id,
              selection.categoryEntity.id,
              selection.subcategory.id,
              selection.genderGroup?.id ?? null,
              selection.primaryColor,
              selection.primarySize,
            ],
          );

          const productCode = this.generateProductCode(
            vendor,
            {
              category: selection.category,
              color: selection.primaryColor,
              size: selection.primarySize,
            },
            created.rows[0].id,
          );
          await client.query(
            'UPDATE products SET product_code = $1, updated_at = SYSDATETIME() WHERE id = $2',
            [productCode, created.rows[0].id],
          );

          for (const [index, color] of selection.colors.entries()) {
            await client.query(
              `INSERT INTO product_colors (product_id, color_id, sort_order)
               VALUES ($1, $2, $3)`,
              [created.rows[0].id, color.id, index],
            );
          }

          for (const variant of selection.sizeVariants) {
            await client.query(
              `INSERT INTO product_sizes (product_id, size_id, stock, sku, updated_at)
               VALUES ($1, $2, $3, $4, SYSDATETIME())`,
              [created.rows[0].id, variant.id, variant.stock, null],
            );
          }

          for (const [index, file] of files.entries()) {
            const imageUrl = this.storeProductImage(
              vendor,
              selection.category,
              file,
            );
            await client.query(
              `INSERT INTO product_images (product_id, image_url, sort_order)
             VALUES ($1, $2, $3)`,
              [created.rows[0].id, imageUrl, index],
            );
          }

          return created.rows[0];
        },
      );

      await this.syncProductToSearchIndexSafely(product.id);
      return this.getVendorProductById(product.id, vendor.id);
    } catch (error) {
      this.cleanupTemporaryFiles(files);
      throw error;
    }
  }

  async updateProduct(
    user: AuthenticatedUser,
    productId: string,
    dto: ProductUpdateDto,
    files: UploadedFile[],
  ) {
    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);
    await this.ensureVendorOwnsProduct(productId, vendor.id);

    const normalizedDto = this.normalizeProductUpdateDto(dto);
    let lowStockAlert: VendorLowStockAlertPayload | null = null;

    try {
      await this.databaseService.withTransaction(async (client) => {
        const currentProduct = await client.query<{
          title: string;
          stock: number;
          department: string;
          category: string;
          brand_id: string | null;
          category_id: string | null;
          subcategory_id: string | null;
          gender_group_id: string | null;
          color: string | null;
          size: string | null;
          product_code: string | null;
          low_stock_alert_sent_at: Date | null;
        }>(
          `SELECT TOP 1 title, stock, department, category, brand_id, category_id, subcategory_id, gender_group_id, color, size, product_code, low_stock_alert_sent_at
           FROM products
           WHERE id = $1`,
          [productId],
        );

        const currentRow = currentProduct.rows[0];
        if (!currentRow) {
          throw new NotFoundException('Product not found');
        }

        const currentColorRows = await client.query<{ color_id: string }>(
          `SELECT color_id FROM product_colors WHERE product_id = $1 ORDER BY sort_order ASC`,
          [productId],
        );
        const currentSizeRows = await client.query<{
          size_id: string;
          stock: number;
        }>(`SELECT size_id, stock FROM product_sizes WHERE product_id = $1`, [
          productId,
        ]);

        const requiresStructuredSelection =
          normalizedDto.brandId !== undefined ||
          normalizedDto.categoryId !== undefined ||
          normalizedDto.subcategoryId !== undefined ||
          normalizedDto.genderGroupId !== undefined ||
          normalizedDto.colorIds !== undefined ||
          normalizedDto.sizeVariants !== undefined ||
          (normalizedDto.stock !== undefined &&
            Boolean(
              currentRow.brand_id &&
              currentRow.category_id &&
              currentRow.subcategory_id,
            ));

        const selection = requiresStructuredSelection
          ? await this.resolveStructuredProductSelection({
              title: normalizedDto.title ?? currentRow.title,
              description: normalizedDto.description ?? '',
              price: normalizedDto.price ?? 0,
              stock: normalizedDto.stock ?? currentRow.stock,
              brandId: normalizedDto.brandId ?? currentRow.brand_id ?? '',
              categoryId:
                normalizedDto.categoryId ?? currentRow.category_id ?? '',
              subcategoryId:
                normalizedDto.subcategoryId ?? currentRow.subcategory_id ?? '',
              genderGroupId:
                normalizedDto.genderGroupId === undefined
                  ? currentRow.gender_group_id
                  : normalizedDto.genderGroupId,
              colorIds:
                normalizedDto.colorIds ??
                currentColorRows.rows.map((entry) => entry.color_id),
              sizeTypeId: normalizedDto.sizeTypeId,
              sizeVariants:
                normalizedDto.sizeVariants ??
                currentSizeRows.rows.map((entry) => ({
                  sizeId: entry.size_id,
                  stock: Number(entry.stock),
                })),
            })
          : null;

        const updates: string[] = [];
        const values: unknown[] = [];
        const currentImageRows = await client.query<{ image_url: string }>(
          'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC',
          [productId],
        );

        const pushUpdate = (column: string, value: unknown) => {
          values.push(value);
          updates.push(`${column} = $${values.length}`);
        };

        if (normalizedDto.title !== undefined)
          pushUpdate('title', normalizedDto.title);
        if (normalizedDto.description !== undefined)
          pushUpdate('description', normalizedDto.description);
        if (normalizedDto.price !== undefined)
          pushUpdate('price', normalizedDto.price);
        if (selection) {
          pushUpdate('stock', selection.totalStock);
          pushUpdate('department', selection.department);
          pushUpdate('category', selection.category);
          pushUpdate('brand_id', selection.brand.id);
          pushUpdate('category_id', selection.categoryEntity.id);
          pushUpdate('subcategory_id', selection.subcategory.id);
          pushUpdate('gender_group_id', selection.genderGroup?.id ?? null);
          pushUpdate('color', selection.primaryColor);
          pushUpdate('size', selection.primarySize);
        } else if (normalizedDto.stock !== undefined) {
          pushUpdate('stock', normalizedDto.stock);
        }

        if (updates.length) {
          values.push(productId);
          await client.query(
            `UPDATE products
             SET ${updates.join(', ')}, updated_at = SYSDATETIME()
             WHERE id = $${values.length}`,
            values,
          );
        }

        if (
          normalizedDto.stock !== undefined ||
          normalizedDto.sizeVariants !== undefined
        ) {
          const threshold = vendor.low_stock_threshold;
          const nextStock = selection?.totalStock ?? normalizedDto.stock ?? 0;

          if (threshold <= 0 || nextStock > threshold) {
            if (currentRow.low_stock_alert_sent_at) {
              await client.query(
                `UPDATE products
                 SET low_stock_alert_sent_at = NULL,
                     updated_at = SYSDATETIME()
                 WHERE id = $1`,
                [productId],
              );
            }
          } else if (!currentRow.low_stock_alert_sent_at) {
            await client.query(
              `UPDATE products
               SET low_stock_alert_sent_at = SYSDATETIME(),
                   updated_at = SYSDATETIME()
               WHERE id = $1`,
              [productId],
            );

            lowStockAlert = {
              email: vendor.email,
              shopName: vendor.shop_name,
              productTitle: normalizedDto.title ?? currentRow.title,
              productCode: currentRow.product_code,
              stock: nextStock,
              threshold,
            };
          }
        }

        if (normalizedDto.colorIds !== undefined) {
          if (!selection) {
            throw new BadRequestException('Select at least one color');
          }

          await client.query(
            'DELETE FROM product_colors WHERE product_id = $1',
            [productId],
          );
          for (const [index, color] of selection.colors.entries()) {
            await client.query(
              `INSERT INTO product_colors (product_id, color_id, sort_order)
               VALUES ($1, $2, $3)`,
              [productId, color.id, index],
            );
          }
        }

        if (normalizedDto.sizeVariants !== undefined) {
          if (!selection) {
            throw new BadRequestException(
              'Select valid sizes before updating stock by size',
            );
          }

          await client.query(
            'DELETE FROM product_sizes WHERE product_id = $1',
            [productId],
          );
          for (const variant of selection.sizeVariants) {
            await client.query(
              `INSERT INTO product_sizes (product_id, size_id, stock, sku, updated_at)
               VALUES ($1, $2, $3, $4, SYSDATETIME())`,
              [productId, variant.id, variant.stock, null],
            );
          }
        }

        if (files.length) {
          const shouldReplace = normalizedDto.replaceImages === true;
          const nextImageCount = shouldReplace
            ? files.length
            : currentImageRows.rows.length + files.length;

          this.assertImageCount(nextImageCount);

          if (shouldReplace) {
            await client.query(
              'DELETE FROM product_images WHERE product_id = $1',
              [productId],
            );
            currentImageRows.rows.forEach((row) =>
              this.deleteStoredImage(row.image_url),
            );
          }

          const baseSortOrder = shouldReplace
            ? 0
            : currentImageRows.rows.length;
          const category =
            selection?.category ??
            (await this.getProductCategory(client, productId));

          for (const [index, file] of files.entries()) {
            const imageUrl = this.storeProductImage(vendor, category, file);
            await client.query(
              `INSERT INTO product_images (product_id, image_url, sort_order)
               VALUES ($1, $2, $3)`,
              [productId, imageUrl, baseSortOrder + index],
            );
          }
        }
      });

      if (lowStockAlert) {
        await this.mailService.sendVendorLowStockAlert(lowStockAlert);
      }

      await this.syncProductToSearchIndexSafely(productId);
      return this.getVendorProductById(productId, vendor.id);
    } catch (error) {
      this.cleanupTemporaryFiles(files);
      throw error;
    }
  }

  async deleteProduct(user: AuthenticatedUser, productId: string) {
    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);
    await this.ensureVendorOwnsProduct(productId, vendor.id);
    const response = await this.deleteProductAndImages(productId);
    await this.syncProductToSearchIndexSafely(productId);
    return response;
  }

  async setProductListing(
    user: AuthenticatedUser,
    productId: string,
    isListed: boolean,
  ) {
    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);
    await this.ensureVendorOwnsProduct(productId, vendor.id);

    await this.databaseService.query(
      `UPDATE products
       SET is_listed = $1,
           updated_at = SYSDATETIME()
       WHERE id = $2`,
      [isListed, productId],
    );

    await this.syncProductToSearchIndexSafely(productId);
    return this.getVendorProductById(productId, vendor.id);
  }

  async bulkUpdateStock(user: AuthenticatedUser, dto: ProductBulkStockDto) {
    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);

    const productIds = [...new Set(dto.productIds)];
    if (!productIds.length) {
      throw new BadRequestException('Select at least one product');
    }

    const productIdsJson = JSON.stringify(productIds);
    const lowStockAlerts: VendorLowStockAlertPayload[] = [];

    await this.databaseService.withTransaction(async (client) => {
      const productRows = await client.query<{
        id: string;
        title: string;
        product_code: string | null;
        low_stock_alert_sent_at: Date | null;
      }>(
        `SELECT id, title, product_code, low_stock_alert_sent_at
         FROM products
         WHERE vendor_id = $1
           AND id IN (SELECT [value] FROM OPENJSON($2))`,
        [vendor.id, productIdsJson],
      );

      if (productRows.rows.length !== productIds.length) {
        throw new ForbiddenException(
          'One or more selected products are invalid',
        );
      }

      await client.query(
        `UPDATE products
         SET stock = $1,
             updated_at = SYSDATETIME()
         WHERE vendor_id = $2
           AND id IN (SELECT [value] FROM OPENJSON($3))`,
        [dto.stock, vendor.id, productIdsJson],
      );

      const threshold = vendor.low_stock_threshold;
      if (threshold <= 0 || dto.stock > threshold) {
        await client.query(
          `UPDATE products
           SET low_stock_alert_sent_at = NULL,
               updated_at = SYSDATETIME()
           WHERE vendor_id = $1
             AND id IN (SELECT [value] FROM OPENJSON($2))
             AND low_stock_alert_sent_at IS NOT NULL`,
          [vendor.id, productIdsJson],
        );
        return;
      }

      await client.query(
        `UPDATE products
         SET low_stock_alert_sent_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE vendor_id = $1
           AND id IN (SELECT [value] FROM OPENJSON($2))
           AND low_stock_alert_sent_at IS NULL`,
        [vendor.id, productIdsJson],
      );

      productRows.rows
        .filter((row) => !row.low_stock_alert_sent_at)
        .forEach((row) => {
          lowStockAlerts.push({
            email: vendor.email,
            shopName: vendor.shop_name,
            productTitle: row.title,
            productCode: row.product_code,
            stock: dto.stock,
            threshold,
          });
        });
    });

    for (const lowStockAlert of lowStockAlerts) {
      await this.mailService.sendVendorLowStockAlert(lowStockAlert);
    }

    await Promise.all(
      productIds.map((productId) =>
        this.syncProductToSearchIndexSafely(productId),
      ),
    );

    return {
      updatedCount: productIds.length,
      stock: dto.stock,
    };
  }

  async duplicateProduct(user: AuthenticatedUser, productId: string) {
    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);
    await this.ensureVendorOwnsProduct(productId, vendor.id);

    const sourceResult = await this.databaseService.query<
      ProductRow & {
        brand_id: string | null;
        category_id: string | null;
        subcategory_id: string | null;
        gender_group_id: string | null;
      }
    >(
      `SELECT TOP 1
         p.id,
         p.title,
         p.description,
         p.price,
         p.stock,
         p.is_listed,
         p.department,
         p.category,
         p.brand_id,
         p.category_id,
         p.subcategory_id,
         p.gender_group_id,
         p.color,
         p.size,
         p.product_code,
         p.created_at
       FROM products p
       WHERE p.id = $1
         AND p.vendor_id = $2`,
      [productId, vendor.id],
    );

    const source = sourceResult.rows[0];
    if (!source) {
      throw new NotFoundException('Product not found');
    }

    const imageRows = await this.databaseService.query<{ image_url: string }>(
      'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC',
      [productId],
    );

    const duplicated = await this.databaseService.withTransaction(
      async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO products (vendor_id, title, description, price, stock, is_listed, department, category, brand_id, category_id, subcategory_id, gender_group_id, color, size)
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            vendor.id,
            `${source.title} Copy`,
            source.description,
            Number(source.price),
            source.stock,
            false,
            source.department,
            source.category,
            source.brand_id,
            source.category_id,
            source.subcategory_id,
            source.gender_group_id,
            source.color,
            source.size,
          ],
        );

        const productCode = this.generateProductCode(
          vendor,
          {
            category: source.category,
            color: source.color,
            size: source.size,
          },
          created.rows[0].id,
        );

        await client.query(
          'UPDATE products SET product_code = $1, updated_at = SYSDATETIME() WHERE id = $2',
          [productCode, created.rows[0].id],
        );

        const sourceColorRows = await client.query<{
          color_id: string;
          sort_order: number;
        }>(
          `SELECT color_id, sort_order
           FROM product_colors
           WHERE product_id = $1
           ORDER BY sort_order ASC`,
          [productId],
        );
        for (const row of sourceColorRows.rows) {
          await client.query(
            `INSERT INTO product_colors (product_id, color_id, sort_order)
             VALUES ($1, $2, $3)`,
            [created.rows[0].id, row.color_id, row.sort_order],
          );
        }

        const sourceSizeRows = await client.query<{
          size_id: string;
          stock: number;
          sku: string | null;
        }>(
          `SELECT size_id, stock, sku
           FROM product_sizes
           WHERE product_id = $1`,
          [productId],
        );
        for (const row of sourceSizeRows.rows) {
          await client.query(
            `INSERT INTO product_sizes (product_id, size_id, stock, sku, updated_at)
             VALUES ($1, $2, $3, $4, SYSDATETIME())`,
            [created.rows[0].id, row.size_id, row.stock, row.sku],
          );
        }

        for (const [index, row] of imageRows.rows.entries()) {
          await client.query(
            `INSERT INTO product_images (product_id, image_url, sort_order)
           VALUES ($1, $2, $3)`,
            [created.rows[0].id, row.image_url, index],
          );
        }

        return created.rows[0];
      },
    );

    await this.syncProductToSearchIndexSafely(duplicated.id);
    return this.getVendorProductById(duplicated.id, vendor.id);
  }

  async adminListProducts(pagination?: PaginationInput | null) {
    const pagingClause = pagination
      ? ` OFFSET ${pagination.offset} ROWS FETCH NEXT ${pagination.pageSize} ROWS ONLY`
      : '';
    const [result, totalCount] = await Promise.all([
      this.databaseService.query<{
      id: string;
      title: string;
      department: string;
      category: string;
      color: string | null;
      size: string | null;
      stock: number;
      price: number | string;
      product_code: string | null;
      vendor_id: string;
      shop_name: string;
    }>(
      `SELECT p.id, p.title, p.department, p.category, p.color, p.size, p.stock, p.price, p.product_code, p.vendor_id, v.shop_name
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       ORDER BY p.created_at DESC${pagingClause}`,
      ),
      pagination
        ? this.databaseService.query<{ total: number }>(
            'SELECT COUNT(*) AS total FROM products',
          )
        : Promise.resolve({ rows: [] as { total: number }[] }),
    ]);

    const items = result.rows.map((row) => ({
      ...row,
      price: Number(row.price),
    }));

    if (!pagination) {
      return items;
    }

    return toPaginatedResponse(
      items,
      totalCount.rows[0]?.total ?? 0,
      pagination,
    );
  }

  async adminDeleteProduct(productId: string) {
    const response = await this.deleteProductAndImages(productId);
    await this.syncProductToSearchIndexSafely(productId);
    return response;
  }

  async reindexPublicSearchCatalog() {
    const client = this.getAlgoliaClient();
    if (!client) {
      return {
        enabled: false,
        indexedCount: 0,
        message: 'Algolia credentials are not configured.',
      };
    }

    await this.ensureAlgoliaSearchSettings();
    const catalog = await this.getPublicSearchCatalog();
    const objects = catalog.map((product) =>
      this.buildSearchIndexObject(product),
    );

    await client.saveObjects({
      indexName: this.getAlgoliaIndexName(),
      objects,
      waitForTasks: true,
    });

    return {
      enabled: true,
      indexedCount: objects.length,
      message: `Indexed ${objects.length} public products.`,
    };
  }

  private async attachImages(products: ProductRow[]) {
    if (!products.length) {
      return [];
    }

    const productIds = products.map((product) => product.id);
    const vendorIds = [
      ...new Set(
        products
          .map((product) => product.vendor_id)
          .filter((vendorId): vendorId is string => Boolean(vendorId)),
      ),
    ];
    const [imageRows, relations, productRatingMap, vendorRatingMap] =
      await Promise.all([
        this.getImagesForProducts(productIds),
        this.getRelationsForProducts(productIds),
        this.getProductRatingSummaries(productIds),
        this.getVendorRatingSummaries(vendorIds),
      ]);
    const imageMap = new Map<string, string[]>();

    for (const image of imageRows) {
      const current = imageMap.get(image.product_id) ?? [];
      current.push(image.image_url);
      imageMap.set(image.product_id, current);
    }

    return products.map((row) => ({
      ...(relations.get(row.id) ?? {
        brand: null,
        categoryRef: null,
        subcategory: null,
        genderGroup: null,
        colors: [],
        sizeVariants: [],
      }),
      id: row.id,
      title: row.title,
      description: row.description,
      price: Number(row.price),
      stock: row.stock,
      isListed: row.is_listed ?? true,
      department: row.department,
      category: row.category,
      color: row.color,
      size: row.size,
      ratingSummary:
        productRatingMap.get(row.id) ?? this.createEmptyRatingSummary(),
      ...(row.product_code ? { productCode: row.product_code } : {}),
      ...(row.vendor_id && row.shop_name
        ? {
            vendor: {
              id: row.vendor_id,
              shopName: row.shop_name,
              logoUrl: row.logo_url ?? null,
              ratingSummary:
                vendorRatingMap.get(row.vendor_id) ??
                this.createEmptyRatingSummary(),
            },
          }
        : {}),
      images: imageMap.get(row.id) ?? [],
      createdAt: row.created_at,
    }));
  }

  private async getProductRatingSummaries(productIds: string[]) {
    if (!productIds.length) {
      return new Map<string, RatingSummary>();
    }

    const result = await this.databaseService.query<ReviewSummaryRow>(
      `SELECT
         pr.product_id AS target_id,
         AVG(CAST(pr.rating AS DECIMAL(10, 2))) AS average_rating,
         COUNT(*) AS review_count
       FROM product_reviews pr
       WHERE pr.product_id IN (${this.buildGuidLiteralClause(productIds)})
       GROUP BY pr.product_id`,
    );

    return new Map(
      result.rows.map((row) => [row.target_id, this.mapRatingSummary(row)]),
    );
  }

  private async getVendorRatingSummaries(vendorIds: string[]) {
    if (!vendorIds.length) {
      return new Map<string, RatingSummary>();
    }

    const result = await this.databaseService.query<ReviewSummaryRow>(
      `SELECT
         vr.vendor_id AS target_id,
         AVG(CAST(vr.rating AS DECIMAL(10, 2))) AS average_rating,
         COUNT(*) AS review_count
       FROM vendor_reviews vr
       WHERE vr.vendor_id IN (${this.buildGuidLiteralClause(vendorIds)})
       GROUP BY vr.vendor_id`,
    );

    return new Map(
      result.rows.map((row) => [row.target_id, this.mapRatingSummary(row)]),
    );
  }

  private async getRecentProductReviews(productId: string, limit = 6) {
    const result = await this.databaseService.query<ReviewRow>(
      `SELECT TOP ${Math.max(1, Math.min(limit, 20))}
         pr.id,
         pr.rating,
         pr.comment,
         u.full_name,
         u.email,
         pr.created_at,
         pr.updated_at
       FROM product_reviews pr
       INNER JOIN users u ON u.id = pr.customer_id
       WHERE pr.product_id = $1
       ORDER BY pr.updated_at DESC, pr.created_at DESC`,
      [productId],
    );

    return result.rows.map((row) => this.mapPublicReview(row));
  }

  private async getRecentVendorReviews(vendorId: string, limit = 6) {
    const result = await this.databaseService.query<ReviewRow>(
      `SELECT TOP ${Math.max(1, Math.min(limit, 20))}
         vr.id,
         vr.rating,
         vr.comment,
         u.full_name,
         u.email,
         vr.created_at,
         vr.updated_at
       FROM vendor_reviews vr
       INNER JOIN users u ON u.id = vr.customer_id
       WHERE vr.vendor_id = $1
       ORDER BY vr.updated_at DESC, vr.created_at DESC`,
      [vendorId],
    );

    return result.rows.map((row) => this.mapPublicReview(row));
  }

  private mapRatingSummary(row: ReviewSummaryRow): RatingSummary {
    const count = Number(row.review_count ?? 0);
    const average =
      count > 0 ? Number(Number(row.average_rating ?? 0).toFixed(1)) : null;

    return {
      average: Number.isFinite(average ?? NaN) ? average : null,
      count,
    };
  }

  private createEmptyRatingSummary(): RatingSummary {
    return {
      average: null,
      count: 0,
    };
  }

  private mapPublicReview(row: ReviewRow): PublicReviewEntry {
    return {
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment,
      customerName: this.formatReviewCustomerName(row.full_name, row.email),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private formatReviewCustomerName(
    fullName: string | null,
    email: string | null,
  ) {
    const normalizedName = fullName?.trim();
    if (normalizedName) {
      const parts = normalizedName.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        return parts[0];
      }

      return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`;
    }

    const emailPrefix = email?.split('@')[0]?.trim();
    if (emailPrefix) {
      return emailPrefix.slice(0, 18);
    }

    return 'Verified buyer';
  }

  private async getRelationsForProducts(productIds: string[]) {
    if (!productIds.length) {
      return new Map<
        string,
        Pick<
          PublicCatalogProduct,
          | 'brand'
          | 'categoryRef'
          | 'subcategory'
          | 'genderGroup'
          | 'colors'
          | 'sizeVariants'
        >
      >();
    }

    const clause = this.buildGuidLiteralClause(productIds);
    const [structureRows, colorRows, sizeRows] = await Promise.all([
      this.databaseService.query<ProductStructureRow>(
        `SELECT
           p.id AS product_id,
           b.id AS brand_id,
           b.name AS brand_name,
           c.id AS category_id,
           c.name AS category_name,
           sc.id AS subcategory_id,
           sc.name AS subcategory_name,
           gg.id AS gender_group_id,
           gg.name AS gender_group_name
         FROM products p
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
         LEFT JOIN gender_groups gg ON gg.id = p.gender_group_id
         WHERE p.id IN (${clause})`,
      ),
      this.databaseService.query<ProductColorRow>(
        `SELECT
           pc.product_id,
           c.id AS color_id,
           c.name AS color_name
         FROM product_colors pc
         INNER JOIN colors c ON c.id = pc.color_id
         WHERE pc.product_id IN (${clause})
         ORDER BY pc.product_id ASC, pc.sort_order ASC, c.name ASC`,
      ),
      this.databaseService.query<ProductSizeRow>(
        `SELECT
           ps.product_id,
           s.id AS size_id,
           s.label AS size_label,
           ps.stock AS size_stock,
           st.id AS size_type_id,
           st.name AS size_type_name
         FROM product_sizes ps
         INNER JOIN sizes s ON s.id = ps.size_id
         INNER JOIN size_types st ON st.id = s.size_type_id
         WHERE ps.product_id IN (${clause})
         ORDER BY ps.product_id ASC, st.sort_order ASC, s.sort_order ASC, s.label ASC`,
      ),
    ]);

    const map = new Map<
      string,
      Pick<
        PublicCatalogProduct,
        | 'brand'
        | 'categoryRef'
        | 'subcategory'
        | 'genderGroup'
        | 'colors'
        | 'sizeVariants'
      >
    >();

    structureRows.rows.forEach((row) => {
      map.set(row.product_id, {
        brand:
          row.brand_id && row.brand_name
            ? { id: row.brand_id, name: row.brand_name }
            : null,
        categoryRef:
          row.category_id && row.category_name
            ? { id: row.category_id, name: row.category_name }
            : null,
        subcategory:
          row.subcategory_id && row.subcategory_name
            ? { id: row.subcategory_id, name: row.subcategory_name }
            : null,
        genderGroup:
          row.gender_group_id && row.gender_group_name
            ? { id: row.gender_group_id, name: row.gender_group_name }
            : null,
        colors: [],
        sizeVariants: [],
      });
    });

    colorRows.rows.forEach((row) => {
      const current = map.get(row.product_id) ?? {
        brand: null,
        categoryRef: null,
        subcategory: null,
        genderGroup: null,
        colors: [],
        sizeVariants: [],
      };
      current.colors.push({ id: row.color_id, name: row.color_name });
      map.set(row.product_id, current);
    });

    sizeRows.rows.forEach((row) => {
      const current = map.get(row.product_id) ?? {
        brand: null,
        categoryRef: null,
        subcategory: null,
        genderGroup: null,
        colors: [],
        sizeVariants: [],
      };
      current.sizeVariants.push({
        id: row.size_id,
        label: row.size_label,
        stock: Number(row.size_stock),
        sizeTypeId: row.size_type_id,
        sizeTypeName: row.size_type_name,
      });
      map.set(row.product_id, current);
    });

    return map;
  }

  private async getPublicSearchCatalog(input?: {
    productIds?: string[];
    category?: string | null;
    department?: string | null;
  }) {
    const filters: string[] = [this.publicProductVisibilityClause('p', 'v')];
    const values: unknown[] = [];

    if (input?.department) {
      values.push(input.department);
      filters.push(`p.department = $${values.length}`);
    }

    if (input?.category) {
      values.push(input.category);
      filters.push(`p.category = $${values.length}`);
    }

    if (input?.productIds?.length) {
      filters.push(
        `p.id IN (${this.buildGuidLiteralClause(input.productIds)})`,
      );
    }

    const result = await this.databaseService.query<SearchableProductRow>(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.price,
         p.stock,
         p.is_listed,
         p.department,
         p.category,
         p.color,
         p.size,
         p.created_at,
         v.id AS vendor_id,
         v.shop_name,
         v.logo_url,
         ISNULL(SUM(oi.quantity), 0) AS total_units_sold
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       WHERE ${filters.join(' AND ')}
       GROUP BY
         p.id,
         p.title,
         p.description,
         p.price,
         p.stock,
         p.is_listed,
         p.department,
         p.category,
         p.color,
         p.size,
         p.created_at,
         v.id,
         v.shop_name,
         v.logo_url`,
      values,
    );

    const products = await this.attachImages(result.rows);
    const unitsSoldById = new Map(
      result.rows.map((row) => [row.id, Number(row.total_units_sold ?? 0)]),
    );

    const searchableProducts = products.map((product) => {
      const totalUnitsSold = unitsSoldById.get(product.id) ?? 0;
      return {
        ...product,
        totalUnitsSold,
        popularityScore: totalUnitsSold * 10 + (product.stock > 0 ? 3 : 0),
        brandName: product.brand?.name ?? product.vendor?.shopName ?? null,
        tags: this.buildSearchTags(product),
      };
    });

    if (!input?.productIds?.length) {
      return searchableProducts;
    }

    const order = new Map(input.productIds.map((id, index) => [id, index]));
    return searchableProducts.sort(
      (left, right) =>
        (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  private async getSearchCandidates(input: {
    query: string;
    category: string | null;
    department: string | null;
    limit: number;
    fullCatalog: SearchableProduct[];
  }) {
    const client = this.getAlgoliaClient();
    if (!client) {
      return {
        algorithm: 'database' as const,
        products: input.fullCatalog,
      };
    }

    try {
      await this.ensureAlgoliaSearchSettings();
      const response = await client.searchSingleIndex<SearchIndexRecord>({
        indexName: this.getAlgoliaIndexName(),
        searchParams: {
          query: input.query,
          hitsPerPage: Math.max(input.limit * 4, 40),
          filters: this.buildAlgoliaFilters(input.department, input.category),
          typoTolerance: true,
          removeWordsIfNoResults: 'allOptional',
        },
      });

      const orderedIds = response.hits
        .map((hit) => hit.objectID)
        .filter((value): value is string => Boolean(value));

      if (!orderedIds.length) {
        return {
          algorithm: 'database' as const,
          products: input.fullCatalog,
        };
      }

      return {
        algorithm: 'algolia' as const,
        products: await this.getPublicSearchCatalog({ productIds: orderedIds }),
      };
    } catch {
      return {
        algorithm: 'database' as const,
        products: input.fullCatalog,
      };
    }
  }

  private buildSearchLayers(
    products: SearchableProduct[],
    queryProfile: ReturnType<ProductsService['buildSearchQueryProfile']>,
    limit: number,
  ): SearchLayer[] {
    const annotated = products
      .map((product, index) =>
        this.annotateSearchProduct(product, queryProfile, index),
      )
      .filter(
        (entry) =>
          entry.matchesAllTokens ||
          entry.categoryMatch ||
          entry.colorMatch ||
          entry.textScore > 0,
      );
    const used = new Set<string>();
    const layers: SearchLayer[] = [];

    const pushLayer = (
      id: SearchLayer['id'],
      title: string,
      items: AnnotatedSearchProduct[],
    ) => {
      const nextProducts = items
        .filter((item) => !used.has(item.product.id))
        .sort((left, right) => this.compareAnnotatedProducts(left, right))
        .slice(0, limit)
        .map((item) => item.product);

      nextProducts.forEach((product) => used.add(product.id));
      layers.push({ id, title, products: nextProducts });
    };

    pushLayer(
      'exact',
      'Exact matches',
      annotated.filter((item) => item.matchesAllTokens),
    );

    if (queryProfile.category) {
      pushLayer(
        'category',
        `More ${this.formatSearchSectionLabel(queryProfile.category)}`,
        annotated.filter(
          (item) => !item.matchesAllTokens && item.categoryMatch,
        ),
      );
    }

    if (queryProfile.color) {
      pushLayer(
        'color',
        `More ${this.formatSearchSectionLabel(queryProfile.color)} styles`,
        annotated.filter(
          (item) =>
            !item.matchesAllTokens && !item.categoryMatch && item.colorMatch,
        ),
      );
    }

    pushLayer(
      'related',
      'Related results',
      annotated.filter(
        (item) =>
          !item.matchesAllTokens && !item.categoryMatch && !item.colorMatch,
      ),
    );

    return layers;
  }

  private buildSearchQueryProfile(query: string, catalog: SearchableProduct[]) {
    const normalizedQuery = this.normalizeSearchText(query);
    const tokens = normalizedQuery
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token && !SEARCH_STOP_WORDS.has(token));
    const category = this.matchCategoryIntent(normalizedQuery, tokens);
    const expandedTokens = this.expandSearchTokens(tokens, category);
    const colors = [
      ...new Set(
        catalog
          .map((product) => this.normalizeSearchText(product.color))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const color = tokens.find((token) => colors.includes(token)) ?? null;

    return {
      normalizedQuery,
      tokens,
      expandedTokens,
      category,
      color,
    };
  }

  private annotateSearchProduct(
    product: SearchableProduct,
    queryProfile: ReturnType<ProductsService['buildSearchQueryProfile']>,
    algoliaRank: number,
  ): AnnotatedSearchProduct {
    const titleText = this.normalizeSearchText(product.title);
    const searchBlob = this.normalizeSearchText([
      product.title,
      product.category,
      product.department,
      product.color,
      product.brandName,
      ...product.tags,
    ]);
    const titleTokens = new Set(titleText.split(' ').filter(Boolean));
    const blobTokens = new Set(searchBlob.split(' ').filter(Boolean));
    const matchedTokens = queryProfile.expandedTokens.filter(
      (token) => titleTokens.has(token) || blobTokens.has(token),
    );
    const phraseInTitle =
      queryProfile.normalizedQuery.length > 0 &&
      titleText.includes(queryProfile.normalizedQuery);
    const categoryMatch =
      queryProfile.category != null &&
      this.productMatchesCategoryIntent(product, queryProfile.category);
    const colorMatch =
      queryProfile.color != null &&
      this.normalizeSearchText(product.color) === queryProfile.color;
    const matchesAllTokens =
      queryProfile.expandedTokens.length > 0 &&
      queryProfile.expandedTokens.every(
        (token) => titleTokens.has(token) || blobTokens.has(token),
      ) &&
      (!queryProfile.category || categoryMatch) &&
      (!queryProfile.color || colorMatch);

    return {
      product,
      algoliaRank,
      textScore: matchedTokens.length,
      titleScore: queryProfile.expandedTokens.filter((token) =>
        titleTokens.has(token),
      ).length,
      matchesAllTokens,
      phraseInTitle,
      categoryMatch,
      colorMatch,
    };
  }

  private compareAnnotatedProducts(
    left: AnnotatedSearchProduct,
    right: AnnotatedSearchProduct,
  ) {
    if (left.phraseInTitle !== right.phraseInTitle) {
      return left.phraseInTitle ? -1 : 1;
    }

    if (left.matchesAllTokens !== right.matchesAllTokens) {
      return left.matchesAllTokens ? -1 : 1;
    }

    if (left.titleScore !== right.titleScore) {
      return right.titleScore - left.titleScore;
    }

    if (left.textScore !== right.textScore) {
      return right.textScore - left.textScore;
    }

    if (left.product.stock > 0 !== right.product.stock > 0) {
      return left.product.stock > 0 ? -1 : 1;
    }

    return (
      this.compareSearchableProducts(left.product, right.product) ||
      left.algoliaRank - right.algoliaRank
    );
  }

  private compareSearchableProducts(
    left: SearchableProduct,
    right: SearchableProduct,
  ) {
    if (left.stock > 0 !== right.stock > 0) {
      return left.stock > 0 ? -1 : 1;
    }

    if (left.popularityScore !== right.popularityScore) {
      return right.popularityScore - left.popularityScore;
    }

    if (left.totalUnitsSold !== right.totalUnitsSold) {
      return right.totalUnitsSold - left.totalUnitsSold;
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  private buildSearchIndexObject(
    product: SearchableProduct,
  ): SearchIndexRecord {
    return {
      objectID: product.id,
      title: product.title,
      category: product.categoryRef?.name ?? product.category,
      subcategory: product.subcategory?.name ?? product.category,
      color: product.colors[0]?.name ?? product.color ?? null,
      brand: product.brandName,
      tags: product.tags,
      department: product.department,
      inStock: product.stock > 0,
      popularityScore: product.popularityScore,
      totalUnitsSold: product.totalUnitsSold,
      createdAtTimestamp: new Date(product.createdAt).getTime(),
    };
  }

  private buildSearchTags(product: PublicCatalogProduct) {
    const categoryToken = this.normalizeCategoryValue(
      product.subcategory?.name ??
        product.categoryRef?.name ??
        product.category,
    );
    const aliasTags = SEARCH_CATEGORY_ALIASES[categoryToken] ?? [];
    return [
      ...new Set([
        product.department,
        product.category,
        ...(product.brand?.name ? [product.brand.name] : []),
        ...(product.categoryRef?.name ? [product.categoryRef.name] : []),
        ...(product.subcategory?.name ? [product.subcategory.name] : []),
        ...(product.colors.length
          ? product.colors.map((entry) => entry.name)
          : product.color
            ? [product.color]
            : []),
        ...(product.sizeVariants.length
          ? product.sizeVariants.map((entry) => entry.label)
          : product.size
            ? [product.size]
            : []),
        ...aliasTags,
      ]),
    ];
  }

  private normalizeCatalogFilter(value?: string | null) {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    return normalized && normalized !== 'all' ? normalized : null;
  }

  private normalizeSearchText(
    value?: string | null | Array<string | null | undefined>,
  ) {
    const source = Array.isArray(value)
      ? value.filter(Boolean).join(' ')
      : (value ?? '');

    return source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private matchCategoryIntent(normalizedQuery: string, tokens: string[]) {
    const tokenSet = new Set(tokens);
    const compactQuery = this.compactSearchText(normalizedQuery);

    for (const [category, aliases] of Object.entries(SEARCH_CATEGORY_ALIASES)) {
      const candidateAliases = [category, ...aliases];

      if (
        candidateAliases.some((alias) =>
          this.searchAliasMatchesQuery({
            alias,
            compactQuery,
            normalizedQuery,
            tokenSet,
          }),
        )
      ) {
        return category;
      }
    }

    return null;
  }

  private searchAliasMatchesQuery(input: {
    alias: string;
    compactQuery: string;
    normalizedQuery: string;
    tokenSet: Set<string>;
  }) {
    const normalizedAlias = this.normalizeSearchText(input.alias);
    if (!normalizedAlias) {
      return false;
    }

    const compactAlias = this.compactSearchText(normalizedAlias);
    const aliasTokens = normalizedAlias.split(' ').filter(Boolean);
    const paddedQuery = ` ${input.normalizedQuery} `;
    const paddedAlias = ` ${normalizedAlias} `;

    return (
      paddedQuery.includes(paddedAlias) ||
      input.compactQuery.includes(compactAlias) ||
      (aliasTokens.length === 1 && input.tokenSet.has(aliasTokens[0])) ||
      (aliasTokens.length > 1 &&
        aliasTokens.every((token) => input.tokenSet.has(token)))
    );
  }

  private expandSearchTokens(tokens: string[], category: string | null) {
    if (!category) {
      return tokens;
    }

    return [...new Set([...tokens, category])];
  }

  private productMatchesCategoryIntent(
    product: SearchableProduct,
    category: string,
  ) {
    const aliases = [category, ...(SEARCH_CATEGORY_ALIASES[category] ?? [])];
    const productValues = [
      product.category,
      product.categoryRef?.name,
      product.subcategory?.name,
      ...product.tags,
    ]
      .map((value) => this.normalizeSearchText(value))
      .filter(Boolean);
    const normalizedValues = new Set(productValues);
    const compactValues = new Set(
      productValues.map((value) => this.compactSearchText(value)),
    );

    return aliases.some((alias) => {
      const normalizedAlias = this.normalizeSearchText(alias);
      return (
        normalizedValues.has(normalizedAlias) ||
        compactValues.has(this.compactSearchText(normalizedAlias))
      );
    });
  }

  private compactSearchText(value: string) {
    return value.replace(/\s+/g, '');
  }

  private formatSearchSectionLabel(value: string) {
    const knownLabel = SEARCH_CATEGORY_LABELS[value];
    if (knownLabel) {
      return knownLabel;
    }

    return value
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ');
  }

  private buildAlgoliaFilters(
    department: string | null,
    category: string | null,
  ) {
    return [
      department ? `department:${department}` : null,
      category ? `category:${category}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' AND ');
  }

  private getAlgoliaClient() {
    const appId = this.configService.get<string>('ALGOLIA_APP_ID')?.trim();
    const adminKey = this.configService
      .get<string>('ALGOLIA_ADMIN_API_KEY')
      ?.trim();

    if (!appId || !adminKey) {
      return null;
    }

    if (!this.algoliaClient) {
      this.algoliaClient = algoliasearch(appId, adminKey);
    }

    return this.algoliaClient;
  }

  private getAlgoliaIndexName() {
    return (
      this.configService.get<string>('ALGOLIA_INDEX_NAME')?.trim() ||
      'vishu_products'
    );
  }

  private async ensureAlgoliaSearchSettings() {
    const client = this.getAlgoliaClient();
    if (!client || this.algoliaSettingsEnsured) {
      return;
    }

    await client.setSettings({
      indexName: this.getAlgoliaIndexName(),
      indexSettings: {
        searchableAttributes: [
          'unordered(title)',
          'unordered(category)',
          'unordered(subcategory)',
          'unordered(color)',
          'unordered(brand)',
          'unordered(tags)',
        ],
        attributesForFaceting: [
          'filterOnly(department)',
          'filterOnly(category)',
          'filterOnly(inStock)',
        ],
        customRanking: [
          'desc(inStock)',
          'desc(popularityScore)',
          'desc(totalUnitsSold)',
          'desc(createdAtTimestamp)',
        ],
        typoTolerance: true,
        removeWordsIfNoResults: 'allOptional',
      },
      forwardToReplicas: false,
    });

    this.algoliaSettingsEnsured = true;
  }

  private async syncProductToSearchIndex(productId: string) {
    const client = this.getAlgoliaClient();
    if (!client) {
      return;
    }

    await this.ensureAlgoliaSearchSettings();
    const [product] = await this.getPublicSearchCatalog({
      productIds: [productId],
    });

    if (!product) {
      await client.deleteObject({
        indexName: this.getAlgoliaIndexName(),
        objectID: productId,
      });
      return;
    }

    await client.saveObjects({
      indexName: this.getAlgoliaIndexName(),
      objects: [this.buildSearchIndexObject(product)],
      waitForTasks: false,
    });
  }

  private async syncProductToSearchIndexSafely(productId: string) {
    try {
      await this.syncProductToSearchIndex(productId);
    } catch {
      // Keep product mutations successful even if Algolia is unavailable.
    }
  }

  private async getImagesForProducts(productIds: string[]) {
    const clause = this.buildGuidLiteralClause(productIds);
    const result = await this.databaseService.query<{
      product_id: string;
      image_url: string;
    }>(
      `SELECT product_id, image_url
       FROM product_images
       WHERE product_id IN (${clause})
       ORDER BY product_id ASC, sort_order ASC`,
    );

    return result.rows;
  }

  private async getVendorProductById(productId: string, vendorId: string) {
    const result = await this.databaseService.query<ProductRow>(
      `SELECT TOP 1
         p.id,
         p.title,
         p.description,
         p.price,
         p.stock,
         p.is_listed,
         p.department,
         p.category,
         p.color,
         p.size,
         p.product_code,
         p.created_at
       FROM products p
       WHERE p.id = $1
         AND p.vendor_id = $2`,
      [productId, vendorId],
    );

    const product = result.rows[0];
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return (await this.attachImages([product]))[0];
  }

  private async deleteProductAndImages(productId: string) {
    const imageRows = await this.databaseService.query<{ image_url: string }>(
      'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC',
      [productId],
    );

    const result = await this.databaseService.query<{ id: string }>(
      'DELETE FROM products OUTPUT DELETED.id WHERE id = $1',
      [productId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Product not found');
    }

    imageRows.rows.forEach((row) => this.deleteStoredImage(row.image_url));
    return { message: 'Product deleted' };
  }

  private async getVendorForUser(userId: string) {
    const access = await this.vendorAccessService.requireVendorAccess(userId);
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      shop_name: string;
      is_active: boolean;
      is_verified: boolean;
      low_stock_threshold: number;
    }>(
      `SELECT TOP 1
         v.id,
         owner.email,
         v.shop_name,
         v.is_active,
         v.is_verified,
         v.low_stock_threshold
       FROM vendors v
       INNER JOIN users owner ON owner.id = v.user_id
       WHERE v.id = $1`,
      [access.id],
    );

    return result.rows[0];
  }

  private assertVendorReady(vendor: {
    is_active: boolean;
    is_verified: boolean;
  }) {
    if (!vendor.is_verified) {
      throw new ForbiddenException('Vendor email is not verified');
    }
    if (!vendor.is_active) {
      throw new ForbiddenException('Vendor account is awaiting admin approval');
    }
  }

  private async ensureVendorOwnsProduct(productId: string, vendorId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM products WHERE id = $1 AND vendor_id = $2',
      [productId, vendorId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Product not found');
    }
  }

  private storeProductImage(
    vendor: { id: string; shop_name: string },
    category: string,
    file: UploadedFile,
  ) {
    const safeShop = vendor.shop_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const safeCategory = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const targetDir = join(
      process.cwd(),
      'uploads',
      'vendors',
      `${safeShop}-${vendor.id}`,
      safeCategory,
    );

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const extension = getSafeImageExtensionForMimeType(file.mimetype);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`;
    const targetPath = join(targetDir, fileName);

    if (!existsSync(file.path)) {
      throw new BadRequestException('Uploaded file could not be processed');
    }

    assertStoredImageFileMatchesMimeType(file.path, file.mimetype);
    renameSync(file.path, targetPath);
    return `/media/vendors/${safeShop}-${vendor.id}/${safeCategory}/${fileName}`;
  }

  private deleteStoredImage(imageUrl: string) {
    const relative = imageUrl.replace(/^\/media\//, '');
    const fullPath = join(process.cwd(), 'uploads', relative);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  private cleanupTemporaryFiles(files: UploadedFile[]) {
    files.forEach((file) => {
      if (file?.path && existsSync(file.path)) {
        unlinkSync(file.path);
      }
    });
  }

  private assertImageCount(imageCount: number) {
    if (imageCount > 6) {
      throw new BadRequestException('A product can have at most 6 images');
    }
  }

  private normalizeProductMutationDto(dto: ProductMutationDto) {
    return {
      title: dto.title.trim(),
      description: dto.description.trim(),
      price: Number(dto.price),
      stock: Number(dto.stock),
      brandId: dto.brandId.trim(),
      categoryId: dto.categoryId.trim(),
      subcategoryId: dto.subcategoryId.trim(),
      genderGroupId: dto.genderGroupId?.trim() || null,
      sizeTypeId: dto.sizeTypeId?.trim() || null,
      colorIds: [
        ...new Set(
          (dto.colorIds ?? []).map((entry) => entry.trim()).filter(Boolean),
        ),
      ],
      sizeVariants: (dto.sizeVariants ?? [])
        .map((entry) => ({
          sizeId: typeof entry?.sizeId === 'string' ? entry.sizeId.trim() : '',
          stock: Number(entry?.stock ?? 0),
        }))
        .filter((entry) => entry.sizeId.length > 0),
    };
  }

  private normalizeProductUpdateDto(dto: ProductUpdateDto) {
    return {
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      price: dto.price === undefined ? undefined : Number(dto.price),
      stock: dto.stock === undefined ? undefined : Number(dto.stock),
      brandId: dto.brandId?.trim(),
      categoryId: dto.categoryId?.trim(),
      subcategoryId: dto.subcategoryId?.trim(),
      genderGroupId:
        dto.genderGroupId === undefined
          ? undefined
          : dto.genderGroupId?.trim() || null,
      sizeTypeId:
        dto.sizeTypeId === undefined
          ? undefined
          : dto.sizeTypeId?.trim() || null,
      colorIds:
        dto.colorIds === undefined
          ? undefined
          : [
              ...new Set(
                dto.colorIds.map((entry) => entry.trim()).filter(Boolean),
              ),
            ],
      sizeVariants:
        dto.sizeVariants === undefined
          ? undefined
          : dto.sizeVariants
              .map((entry) => ({
                sizeId:
                  typeof entry?.sizeId === 'string' ? entry.sizeId.trim() : '',
                stock: Number(entry?.stock ?? 0),
              }))
              .filter((entry) => entry.sizeId.length > 0),
      replaceImages: dto.replaceImages,
    };
  }

  private async resolveStructuredProductSelection(input: {
    title: string;
    description: string;
    price: number;
    stock: number;
    brandId: string;
    categoryId: string;
    subcategoryId: string;
    genderGroupId?: string | null;
    sizeTypeId?: string | null;
    colorIds?: string[];
    sizeVariants?: Array<{ sizeId: string; stock: number }>;
  }) {
    const [brandResult, categoryResult, subcategoryResult] = await Promise.all([
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
      }>(`SELECT TOP 1 id, name, is_active FROM brands WHERE id = $1`, [
        input.brandId,
      ]),
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
      }>(`SELECT TOP 1 id, name, is_active FROM categories WHERE id = $1`, [
        input.categoryId,
      ]),
      this.databaseService.query<{
        id: string;
        category_id: string;
        name: string;
        is_active: boolean;
      }>(
        `SELECT TOP 1 id, category_id, name, is_active FROM subcategories WHERE id = $1`,
        [input.subcategoryId],
      ),
    ]);

    const brand = brandResult.rows[0];
    if (!brand || !brand.is_active) {
      throw new BadRequestException('Select a valid active brand');
    }

    const categoryEntity = categoryResult.rows[0];
    if (!categoryEntity || !categoryEntity.is_active) {
      throw new BadRequestException('Select a valid active category');
    }

    const subcategory = subcategoryResult.rows[0];
    if (
      !subcategory ||
      !subcategory.is_active ||
      subcategory.category_id !== categoryEntity.id
    ) {
      throw new BadRequestException(
        'Select a valid active subcategory under the chosen category',
      );
    }

    let genderGroup:
      | { id: string; name: string; is_active: boolean }
      | undefined;
    if (input.genderGroupId) {
      const genderResult = await this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
      }>(`SELECT TOP 1 id, name, is_active FROM gender_groups WHERE id = $1`, [
        input.genderGroupId,
      ]);
      genderGroup = genderResult.rows[0];
      if (!genderGroup || !genderGroup.is_active) {
        throw new BadRequestException('Select a valid active gender group');
      }
    }

    const colorIds = [...new Set((input.colorIds ?? []).filter(Boolean))];
    if (!colorIds.length) {
      throw new BadRequestException('Select at least one color');
    }
    const colorResult = await this.databaseService.query<{
      id: string;
      name: string;
      is_active: boolean;
    }>(
      `SELECT id, name, is_active
       FROM colors
       WHERE id IN (${this.buildGuidLiteralClause(colorIds)})`,
    );
    const colors = colorResult.rows.filter((row) => row.is_active);
    if (colors.length !== colorIds.length) {
      throw new BadRequestException(
        'One or more selected colors are not available yet',
      );
    }

    const sizeVariants = input.sizeVariants ?? [];
    let resolvedSizeVariants: Array<{
      id: string;
      label: string;
      stock: number;
      sizeTypeId: string;
      sizeTypeName: string;
    }> = [];

    if (sizeVariants.length) {
      const sizeIds = [...new Set(sizeVariants.map((entry) => entry.sizeId))];
      const sizeResult = await this.databaseService.query<{
        id: string;
        label: string;
        is_active: boolean;
        size_type_id: string;
        size_type_name: string;
      }>(
        `SELECT s.id, s.label, s.is_active, st.id AS size_type_id, st.name AS size_type_name
         FROM sizes s
         INNER JOIN size_types st ON st.id = s.size_type_id
         WHERE s.id IN (${this.buildGuidLiteralClause(sizeIds)})`,
      );
      if (
        sizeResult.rows.filter((row) => row.is_active).length !== sizeIds.length
      ) {
        throw new BadRequestException(
          'One or more selected sizes are not available yet',
        );
      }

      const sizeMap = new Map(sizeResult.rows.map((row) => [row.id, row]));
      const sizeTypeId =
        input.sizeTypeId ?? sizeResult.rows[0]?.size_type_id ?? null;
      if (
        sizeTypeId &&
        sizeResult.rows.some((row) => row.size_type_id !== sizeTypeId)
      ) {
        throw new BadRequestException(
          'Selected sizes must belong to the same size type',
        );
      }

      resolvedSizeVariants = sizeVariants.map((entry) => {
        const sizeRow = sizeMap.get(entry.sizeId);
        if (!sizeRow) {
          throw new BadRequestException('A selected size could not be found');
        }

        return {
          id: sizeRow.id,
          label: sizeRow.label,
          stock: Math.max(0, Number(entry.stock ?? 0)),
          sizeTypeId: sizeRow.size_type_id,
          sizeTypeName: sizeRow.size_type_name,
        };
      });
    }

    return {
      brand,
      categoryEntity,
      subcategory,
      genderGroup,
      colors,
      sizeVariants: resolvedSizeVariants,
      totalStock: resolvedSizeVariants.length
        ? resolvedSizeVariants.reduce((sum, entry) => sum + entry.stock, 0)
        : Math.max(0, Number(input.stock ?? 0)),
      department: this.normalizeDepartmentFromGenderGroup(
        genderGroup?.name ?? null,
      ),
      category: this.normalizeCategoryValue(subcategory.name),
      primaryColor: this.normalizeColorValue(colors[0]?.name) ?? null,
      primarySize:
        this.normalizeSizeValue(resolvedSizeVariants[0]?.label) ?? null,
    };
  }

  private normalizeColorValue(value?: string | null) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const aliasMap: Record<string, string> = {
      grey: 'gray',
      offwhite: 'ivory',
      'off-white': 'ivory',
      multi: 'multicolor',
      'multi-color': 'multicolor',
      wine: 'burgundy',
    };

    const aliased = aliasMap[normalized] ?? normalized;
    return aliased.replace(/[^a-z0-9]+/g, '-');
  }

  private normalizeSizeValue(value?: string | null) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const compact = normalized.replace(/\s+/g, '');
    const aliasMap: Record<string, string> = {
      extrasmall: 'xs',
      xsmall: 'xs',
      small: 's',
      medium: 'm',
      large: 'l',
      extralarge: 'xl',
      xlarge: 'xl',
      '2xl': 'xxl',
      '3xl': 'xxxl',
      onesize: 'one-size',
      os: 'one-size',
    };

    return aliasMap[compact] ?? normalized.replace(/[^a-z0-9]+/g, '-');
  }

  private normalizeCategoryValue(value?: string | null) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      return 'catalog';
    }

    return normalized.replace(/[^a-z0-9]+/g, '');
  }

  private normalizeDepartmentFromGenderGroup(value?: string | null) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'women') return 'women';
    if (normalized === 'kids') return 'kids';
    if (normalized === 'babies') return 'babies';
    return 'men';
  }

  private normalizeCatalogRequestType(
    value: string,
  ): 'category' | 'subcategory' | 'brand' | 'size' | 'color' {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'category' ||
      normalized === 'subcategory' ||
      normalized === 'brand' ||
      normalized === 'size' ||
      normalized === 'color'
    ) {
      return normalized;
    }

    throw new BadRequestException('Unsupported request type');
  }

  private normalizeCatalogRequestLookupValue(
    requestType: 'category' | 'subcategory' | 'brand' | 'size' | 'color',
    value?: string | null,
  ) {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    if (requestType === 'color') {
      return this.normalizeColorValue(normalized);
    }

    if (requestType === 'size') {
      return this.normalizeSizeValue(normalized);
    }

    return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private async getResolvedCatalogOptions() {
    const [categories, colors, sizes, brands, subcategories] =
      await Promise.all([
        this.databaseService.query<{ name: string }>(
          `SELECT name FROM categories WHERE is_active = 1`,
        ),
        this.databaseService.query<{ name: string }>(
          `SELECT name FROM colors WHERE is_active = 1`,
        ),
        this.databaseService.query<{ label: string }>(
          `SELECT label FROM sizes WHERE is_active = 1`,
        ),
        this.databaseService.query<{ name: string }>(
          `SELECT name FROM brands WHERE is_active = 1`,
        ),
        this.databaseService.query<{ name: string }>(
          `SELECT name FROM subcategories WHERE is_active = 1`,
        ),
      ]);

    return {
      categories: new Set(
        categories.rows.map(
          (row) =>
            this.normalizeCatalogRequestLookupValue('category', row.name) ?? '',
        ),
      ),
      colors: new Set(
        colors.rows.map(
          (row) =>
            this.normalizeCatalogRequestLookupValue('color', row.name) ?? '',
        ),
      ),
      sizes: new Set(
        sizes.rows.map(
          (row) =>
            this.normalizeCatalogRequestLookupValue('size', row.label) ?? '',
        ),
      ),
      brands: new Set(
        brands.rows.map(
          (row) =>
            this.normalizeCatalogRequestLookupValue('brand', row.name) ?? '',
        ),
      ),
      subcategories: new Set(
        subcategories.rows.map(
          (row) =>
            this.normalizeCatalogRequestLookupValue('subcategory', row.name) ??
            '',
        ),
      ),
    };
  }

  private async catalogRequestMatchesExistingOption(
    requestType: 'category' | 'subcategory' | 'brand' | 'size' | 'color',
    lookupValue: string,
  ) {
    const resolved = await this.getResolvedCatalogOptions();

    if (requestType === 'category') {
      return resolved.categories.has(lookupValue);
    }

    if (requestType === 'color') {
      return resolved.colors.has(lookupValue);
    }

    if (requestType === 'size') {
      return resolved.sizes.has(lookupValue);
    }

    if (requestType === 'brand') {
      return resolved.brands.has(lookupValue);
    }

    return resolved.subcategories.has(lookupValue);
  }

  private generateProductCode(
    _vendor: { shop_name: string },
    product: { category: string; color?: string | null; size?: string | null },
    productId: string,
  ) {
    const categoryCode = this.readableProductCodePart(product.category, 'PRD', {
      top: 'TOP',
      tops: 'TOP',
      tshirt: 'TEE',
      't shirt': 'TEE',
      't-shirt': 'TEE',
      tee: 'TEE',
      tees: 'TEE',
      shirt: 'SHT',
      shirts: 'SHT',
      blouse: 'BLS',
      blouses: 'BLS',
      pants: 'PNT',
      trouser: 'PNT',
      trousers: 'PNT',
      jeans: 'JNS',
      outerwear: 'OUT',
      jacket: 'JKT',
      jackets: 'JKT',
      coat: 'COT',
      coats: 'COT',
      hoodie: 'HOD',
      hoodies: 'HOD',
      sweater: 'SWT',
      sweaters: 'SWT',
      dress: 'DRS',
      dresses: 'DRS',
      skirt: 'SKT',
      skirts: 'SKT',
      suit: 'SUT',
      suits: 'SUT',
    });
    const shortId = productId.replace(/-/g, '').slice(-5).toUpperCase();
    return `${categoryCode}-${shortId}`;
  }

  private readableProductCodePart(
    value: string | null | undefined,
    fallback: string,
    dictionary?: Record<string, string>,
  ) {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }

    if (dictionary?.[normalized]) {
      return dictionary[normalized];
    }

    const cleaned = normalized.replace(/[^a-z0-9]+/gi, '').toUpperCase();
    return (cleaned || fallback).slice(0, 3).padEnd(3, 'X');
  }

  private async assertProductExists(productId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM products WHERE id = $1',
      [productId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Product not found');
    }
  }

  private async assertVendorExists(vendorId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM vendors WHERE id = $1',
      [vendorId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Shop not found');
    }
  }

  private async getProductReviewEligibility(
    customerId: string,
    productId: string,
  ) {
    const result = await this.databaseService.query<ReviewEligibilityRow>(
      `SELECT
         COUNT(*) AS delivered_purchase_count,
         MAX(COALESCE(o.delivered_at, oi.updated_at, o.created_at)) AS last_delivered_at
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = $1
         AND o.customer_id = $2
         AND oi.status = 'delivered'`,
      [productId, customerId],
    );

    return result.rows[0] ?? {
      delivered_purchase_count: 0,
      last_delivered_at: null,
    };
  }

  private async getVendorReviewEligibility(
    customerId: string,
    vendorId: string,
  ) {
    const result = await this.databaseService.query<ReviewEligibilityRow>(
      `SELECT
         COUNT(*) AS delivered_purchase_count,
         MAX(COALESCE(o.delivered_at, oi.updated_at, o.created_at)) AS last_delivered_at
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE oi.vendor_id = $1
         AND o.customer_id = $2
         AND oi.status = 'delivered'`,
      [vendorId, customerId],
    );

    return result.rows[0] ?? {
      delivered_purchase_count: 0,
      last_delivered_at: null,
    };
  }

  private async getExistingProductReview(productId: string, customerId: string) {
    const result = await this.databaseService.query<ReviewRow>(
      `SELECT TOP 1
         pr.id,
         pr.rating,
         pr.comment,
         u.full_name,
         u.email,
         pr.created_at,
         pr.updated_at
       FROM product_reviews pr
       INNER JOIN users u ON u.id = pr.customer_id
       WHERE pr.product_id = $1
         AND pr.customer_id = $2`,
      [productId, customerId],
    );

    return result.rows[0] ? this.mapPublicReview(result.rows[0]) : null;
  }

  private async getExistingVendorReview(vendorId: string, customerId: string) {
    const result = await this.databaseService.query<ReviewRow>(
      `SELECT TOP 1
         vr.id,
         vr.rating,
         vr.comment,
         u.full_name,
         u.email,
         vr.created_at,
         vr.updated_at
       FROM vendor_reviews vr
       INNER JOIN users u ON u.id = vr.customer_id
       WHERE vr.vendor_id = $1
         AND vr.customer_id = $2`,
      [vendorId, customerId],
    );

    return result.rows[0] ? this.mapPublicReview(result.rows[0]) : null;
  }

  private buildReviewStatus(
    eligibility: ReviewEligibilityRow,
    existingReview: PublicReviewEntry | null,
    lockedReason: string,
  ): ReviewStatusResponse {
    const deliveredPurchaseCount = Number(
      eligibility.delivered_purchase_count ?? 0,
    );
    const canReview = deliveredPurchaseCount > 0;

    return {
      canReview,
      reason: canReview ? null : lockedReason,
      deliveredPurchaseCount,
      lastDeliveredAt: eligibility.last_delivered_at,
      existingReview,
    };
  }

  private normalizeReviewComment(comment?: string | null) {
    const normalized = comment?.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, 1500);
  }

  private async getProductCategory(client: QueryRunner, productId: string) {
    const result = await client.query<{ category: string }>(
      'SELECT TOP 1 category FROM products WHERE id = $1',
      [productId],
    );
    return result.rows[0]?.category ?? 'general';
  }

  private buildGuidLiteralClause(values: string[]) {
    return values.map((value) => `'${this.assertGuid(value)}'`).join(', ');
  }

  private publicVendorVisibilityClause(vendorAlias: string) {
    return `${vendorAlias}.is_active = 1
      AND ${vendorAlias}.is_verified = 1`;
  }

  private publicProductVisibilityClause(
    productAlias: string,
    vendorAlias: string,
  ) {
    return `${productAlias}.is_listed = 1
      AND ${this.publicVendorVisibilityClause(vendorAlias)}`;
  }

  private assertGuid(value: string) {
    if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
      throw new BadRequestException('Invalid identifier');
    }

    return value;
  }
}
