import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuthenticatedUser } from '../common/types';
import { DatabaseService, QueryRunner } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { ProductBulkStockDto, ProductMutationDto, ProductUpdateDto } from './dto';

type UploadedFile = Express.Multer.File;

const PRODUCT_DEPARTMENTS = ['men', 'women', 'unisex'] as const;

const PRODUCT_CATEGORY_GROUPS: Record<(typeof PRODUCT_DEPARTMENTS)[number], string[]> = {
  men: [
    'tshirts',
    'tops',
    'shirts',
    'hoodies',
    'sweatshirts',
    'sweaters',
    'jackets',
    'outerwear',
    'pants',
    'jeans',
    'shorts',
    'suits',
    'sportswear',
    'accessories',
  ],
  women: [
    'tshirts',
    'tops',
    'shirts',
    'hoodies',
    'sweatshirts',
    'sweaters',
    'jackets',
    'outerwear',
    'pants',
    'jeans',
    'shorts',
    'leggings',
    'dresses',
    'skirts',
    'suits',
    'sportswear',
    'accessories',
  ],
  unisex: [
    'tshirts',
    'tops',
    'shirts',
    'hoodies',
    'sweatshirts',
    'sweaters',
    'jackets',
    'outerwear',
    'pants',
    'jeans',
    'shorts',
    'sportswear',
    'accessories',
  ],
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

interface HomepageHeroSlideRow extends ProductRow {
  slide_id: string;
  headline: string | null;
  subheading: string | null;
  cta_label: string | null;
  sort_order: number;
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
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: MailService,
  ) {}

  async listPublicProducts() {
    const result = await this.databaseService.query<ProductRow>(
      `SELECT p.id, p.title, p.description, p.price, p.stock, p.is_listed, p.department, p.category, p.color, p.size, p.created_at,
              v.id AS vendor_id, v.shop_name, v.logo_url
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       WHERE ${this.publicProductVisibilityClause('p', 'v')}
       ORDER BY p.created_at DESC`,
    );

    return this.attachImages(result.rows);
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

    return (await this.attachImages([product]))[0];
  }

  async listPublicVendors() {
    const result = await this.databaseService.query<{
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
       ORDER BY COUNT(CASE WHEN p.is_listed = 1 THEN p.id END) DESC, v.shop_name ASC`,
    );

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

    return result.rows.map((row) => ({
      id: row.id,
      shopName: row.shop_name,
      shopDescription: row.shop_description,
      logoUrl: row.logo_url,
      bannerUrl: row.banner_url,
      productCount: row.product_count,
      categoryCount: row.category_count,
      departments: [...(vendorCatalogMap.get(row.id)?.departments ?? [])],
      categories: [...(vendorCatalogMap.get(row.id)?.categories ?? [])],
    }));
  }

  async listHomepageHeroSlides() {
    const intervalResult = await this.databaseService.query<{
      homepage_hero_interval_seconds: number | null;
    }>(
      `SELECT TOP 1 homepage_hero_interval_seconds
       FROM platform_settings
       WHERE id = 1`,
    );

    const slideRows = await this.databaseService.query<HomepageHeroSlideRow>(
      `SELECT
         hs.id AS slide_id,
         hs.headline,
         hs.subheading,
         hs.cta_label,
         hs.sort_order,
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
         v.logo_url
       FROM homepage_hero_slides hs
       INNER JOIN products p ON p.id = hs.product_id
       INNER JOIN vendors v ON v.id = p.vendor_id
       WHERE hs.is_active = 1
         AND ${this.publicProductVisibilityClause('p', 'v')}
       ORDER BY hs.sort_order ASC, hs.created_at ASC`,
    );

    const products = await this.attachImages(slideRows.rows);

    return {
      intervalSeconds:
        intervalResult.rows[0]?.homepage_hero_interval_seconds ?? 6,
      slides: products.map((product, index) => ({
        id: slideRows.rows[index].slide_id,
        headline: slideRows.rows[index].headline,
        subheading: slideRows.rows[index].subheading,
        ctaLabel: slideRows.rows[index].cta_label,
        product,
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

    const productList = await this.attachImages(products.rows);

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
        has_active_subscription: this.isVendorSubscriptionActive(vendor),
        is_publicly_visible:
          vendor.is_active &&
          vendor.is_verified &&
          this.isVendorSubscriptionActive(vendor),
      },
      products: await this.attachImages(result.rows),
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
    this.assertValidCatalogPlacement(
      normalizedDto.department,
      normalizedDto.category,
    );

    try {
      const product = await this.databaseService.withTransaction(async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO products (vendor_id, title, description, price, stock, is_listed, department, category, color, size)
           OUTPUT INSERTED.id
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            vendor.id,
            normalizedDto.title,
            normalizedDto.description,
            normalizedDto.price,
            normalizedDto.stock,
            true,
            normalizedDto.department,
            normalizedDto.category,
            normalizedDto.color,
            normalizedDto.size,
          ],
        );

        const productCode = this.generateProductCode(vendor, normalizedDto, created.rows[0].id);
        await client.query(
          'UPDATE products SET product_code = $1, updated_at = SYSDATETIME() WHERE id = $2',
          [productCode, created.rows[0].id],
        );

        for (const [index, file] of files.entries()) {
          const imageUrl = this.storeProductImage(vendor, normalizedDto.category, file);
          await client.query(
            `INSERT INTO product_images (product_id, image_url, sort_order)
             VALUES ($1, $2, $3)`,
            [created.rows[0].id, imageUrl, index],
          );
        }

        return created.rows[0];
      });

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
          product_code: string | null;
          low_stock_alert_sent_at: Date | null;
        }>(
          `SELECT TOP 1 title, stock, department, category, product_code, low_stock_alert_sent_at
           FROM products
           WHERE id = $1`,
          [productId],
        );

        const currentRow = currentProduct.rows[0];
        if (!currentRow) {
          throw new NotFoundException('Product not found');
        }

        this.assertValidCatalogPlacement(
          normalizedDto.department ?? currentRow.department,
          normalizedDto.category ?? currentRow.category,
        );

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

        if (normalizedDto.title !== undefined) pushUpdate('title', normalizedDto.title);
        if (normalizedDto.description !== undefined) pushUpdate('description', normalizedDto.description);
        if (normalizedDto.price !== undefined) pushUpdate('price', normalizedDto.price);
        if (normalizedDto.stock !== undefined) pushUpdate('stock', normalizedDto.stock);
        if (normalizedDto.department !== undefined) pushUpdate('department', normalizedDto.department);
        if (normalizedDto.category !== undefined) pushUpdate('category', normalizedDto.category);
        if (normalizedDto.color !== undefined) pushUpdate('color', normalizedDto.color);
        if (normalizedDto.size !== undefined) pushUpdate('size', normalizedDto.size);

        if (updates.length) {
          values.push(productId);
          await client.query(
            `UPDATE products
             SET ${updates.join(', ')}, updated_at = SYSDATETIME()
             WHERE id = $${values.length}`,
            values,
          );
        }

        if (normalizedDto.stock !== undefined) {
          const threshold = vendor.low_stock_threshold;
          const nextStock = normalizedDto.stock;

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

        if (files.length) {
          const shouldReplace = normalizedDto.replaceImages === true;
          const nextImageCount = shouldReplace
            ? files.length
            : currentImageRows.rows.length + files.length;

          this.assertImageCount(nextImageCount);

          if (shouldReplace) {
            await client.query('DELETE FROM product_images WHERE product_id = $1', [productId]);
            currentImageRows.rows.forEach((row) => this.deleteStoredImage(row.image_url));
          }

          const baseSortOrder = shouldReplace ? 0 : currentImageRows.rows.length;
          const category =
            normalizedDto.category ?? (await this.getProductCategory(client, productId));

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
    return this.deleteProductAndImages(productId);
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
        throw new ForbiddenException('One or more selected products are invalid');
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

    return {
      updatedCount: productIds.length,
      stock: dto.stock,
    };
  }

  async duplicateProduct(user: AuthenticatedUser, productId: string) {
    const vendor = await this.getVendorForUser(user.sub);
    this.assertVendorReady(vendor);
    await this.ensureVendorOwnsProduct(productId, vendor.id);

    const sourceResult = await this.databaseService.query<ProductRow>(
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

    const duplicated = await this.databaseService.withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO products (vendor_id, title, description, price, stock, is_listed, department, category, color, size)
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          vendor.id,
          `${source.title} Copy`,
          source.description,
          Number(source.price),
          source.stock,
          false,
          source.department,
          source.category,
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

      for (const [index, row] of imageRows.rows.entries()) {
        await client.query(
          `INSERT INTO product_images (product_id, image_url, sort_order)
           VALUES ($1, $2, $3)`,
          [created.rows[0].id, row.image_url, index],
        );
      }

      return created.rows[0];
    });

    return this.getVendorProductById(duplicated.id, vendor.id);
  }

  async adminListProducts() {
    const result = await this.databaseService.query<{
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
       ORDER BY p.created_at DESC`,
    );

    return result.rows.map((row) => ({
      ...row,
      price: Number(row.price),
    }));
  }

  async adminDeleteProduct(productId: string) {
    return this.deleteProductAndImages(productId);
  }

  private async attachImages(products: ProductRow[]) {
    if (!products.length) {
      return [];
    }

    const imageRows = await this.getImagesForProducts(products.map((product) => product.id));
    const imageMap = new Map<string, string[]>();

    for (const image of imageRows) {
      const current = imageMap.get(image.product_id) ?? [];
      current.push(image.image_url);
      imageMap.set(image.product_id, current);
    }

    return products.map((row) => ({
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
      ...(row.product_code ? { productCode: row.product_code } : {}),
      ...(row.vendor_id && row.shop_name
        ? {
            vendor: {
              id: row.vendor_id,
              shopName: row.shop_name,
              logoUrl: row.logo_url ?? null,
            },
          }
        : {}),
      images: imageMap.get(row.id) ?? [],
      createdAt: row.created_at,
    }));
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
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      shop_name: string;
      is_active: boolean;
      is_verified: boolean;
      low_stock_threshold: number;
      subscription_status: 'inactive' | 'active' | 'expired';
      subscription_ends_at: Date | null;
      subscription_override_status: 'active' | 'expired' | null;
      subscription_override_ends_at: Date | null;
    }>(
      `SELECT TOP 1
         v.id,
         u.email,
         v.shop_name,
         v.is_active,
         v.is_verified,
         v.low_stock_threshold,
         v.subscription_status,
         v.subscription_ends_at,
         v.subscription_override_status,
         v.subscription_override_ends_at
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       WHERE user_id = $1`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new ForbiddenException('Vendor profile not found');
    }

    return result.rows[0];
  }

  private isVendorSubscriptionActive(vendor: {
    subscription_status: 'inactive' | 'active' | 'expired';
    subscription_ends_at: Date | null;
    subscription_override_status: 'active' | 'expired' | null;
    subscription_override_ends_at: Date | null;
  }) {
    if (
      vendor.subscription_override_status === 'active' &&
      vendor.subscription_override_ends_at &&
      vendor.subscription_override_ends_at >= new Date()
    ) {
      return true;
    }

    if (vendor.subscription_override_status === 'expired') {
      return false;
    }

    return (
      vendor.subscription_status === 'active' &&
      vendor.subscription_ends_at !== null &&
      vendor.subscription_ends_at >= new Date()
    );
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

    const extension = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.'))
      : '.jpg';
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`;
    const targetPath = join(targetDir, fileName);

    if (!existsSync(file.path)) {
      throw new BadRequestException('Uploaded file could not be processed');
    }

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
      ...dto,
      title: dto.title.trim(),
      description: dto.description.trim(),
      department: dto.department?.trim().toLowerCase() || 'unisex',
      category: dto.category.trim().toLowerCase(),
      color: this.normalizeColorValue(dto.color),
      size: this.normalizeSizeValue(dto.size),
    };
  }

  private normalizeProductUpdateDto(dto: ProductUpdateDto) {
    return {
      ...dto,
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      department: dto.department?.trim().toLowerCase(),
      category: dto.category?.trim().toLowerCase(),
      color: dto.color === undefined ? undefined : this.normalizeColorValue(dto.color),
      size: dto.size === undefined ? undefined : this.normalizeSizeValue(dto.size),
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

  private assertValidCatalogPlacement(department: string, category: string) {
    if (!PRODUCT_DEPARTMENTS.includes(department as (typeof PRODUCT_DEPARTMENTS)[number])) {
      throw new BadRequestException('Invalid product gender');
    }

    const allowedCategories =
      PRODUCT_CATEGORY_GROUPS[
        department as (typeof PRODUCT_DEPARTMENTS)[number]
      ] ?? [];

    if (!allowedCategories.includes(category)) {
      throw new BadRequestException(
        `Category "${category}" is not available under the ${department} gender`,
      );
    }
  }

  private generateProductCode(
    vendor: { shop_name: string },
    product: { category: string; color?: string | null; size?: string | null },
    productId: string,
  ) {
    return [
      this.readableProductCodePart(
        product.category,
        'GEN',
        {
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
        },
      ),
      this.readableProductCodePart(
        product.color,
        'NA',
        {
          black: 'BLK',
          white: 'WHT',
          ivory: 'IVR',
          cream: 'CRM',
          beige: 'BEI',
          brown: 'BRN',
          tan: 'TAN',
          gray: 'GRY',
          grey: 'GRY',
          blue: 'BLU',
          navy: 'NVY',
          red: 'RED',
          orange: 'ORG',
          yellow: 'YLW',
          green: 'GRN',
          pink: 'PNK',
          purple: 'PRP',
          gold: 'GLD',
          silver: 'SLV',
        },
      ),
      this.readableProductCodePart(
        product.size,
        'NA',
        {
          xs: 'XSM',
          s: 'SML',
          m: 'MED',
          l: 'LRG',
          xl: 'XLG',
          xxl: 'XXL',
          xxxl: '3XL',
          'one size': 'ONE',
          onesize: 'ONE',
          os: 'ONE',
        },
      ),
      this.readableProductCodePart(vendor.shop_name, 'VEN'),
      productId.replace(/-/g, '').slice(-6).toUpperCase(),
    ].join('-');
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
      AND ${vendorAlias}.is_verified = 1
      AND ${this.activeSubscriptionClause(vendorAlias)}`;
  }

  private publicProductVisibilityClause(
    productAlias: string,
    vendorAlias: string,
  ) {
    return `${productAlias}.is_listed = 1
      AND ${this.publicVendorVisibilityClause(vendorAlias)}`;
  }

  private activeSubscriptionClause(vendorAlias: string) {
    return `CASE
      WHEN ${vendorAlias}.subscription_override_status = 'expired' THEN 0
      WHEN ${vendorAlias}.subscription_override_status = 'active'
        AND ${vendorAlias}.subscription_override_ends_at IS NOT NULL
        AND ${vendorAlias}.subscription_override_ends_at >= SYSDATETIME()
        THEN 1
      WHEN ${vendorAlias}.subscription_status = 'active'
        AND ${vendorAlias}.subscription_ends_at IS NOT NULL
        AND ${vendorAlias}.subscription_ends_at >= SYSDATETIME()
        THEN 1
      ELSE 0
    END = 1`;
  }

  private assertGuid(value: string) {
    if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
      throw new BadRequestException('Invalid identifier');
    }

    return value;
  }
}
