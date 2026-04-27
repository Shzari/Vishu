import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import sql from 'mssql/msnodesqlv8';
import request from 'supertest';
import {
  AUTH_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  hasAuthCookie,
  isSafeHttpMethod,
  isTrustedBrowserOrigin,
} from '../src/common/security/security.utils';
import { MailService } from '../src/mail/mail.service';

const DB_NAME = 'vishu_e2e';
jest.setTimeout(20000);

async function createPool(database: string) {
  const server = process.env.DB_SERVER || 'localhost';
  const instanceName = process.env.DB_INSTANCE || 'MARKET';
  const trusted = (process.env.DB_TRUSTED_CONNECTION || 'true') === 'true';

  const connectionString = trusted
    ? `Driver={ODBC Driver 18 for SQL Server};Server=${server}\\${instanceName};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
    : `Driver={ODBC Driver 18 for SQL Server};Server=${server}\\${instanceName};Database=${database};Uid=${process.env.DB_USER || ''};Pwd=${process.env.DB_PASSWORD || ''};TrustServerCertificate=Yes;`;

  return new sql.ConnectionPool({
    connectionString,
    options: {
      trustServerCertificate: true,
    },
  }).connect();
}

async function resetDatabase() {
  const pool = await createPool(DB_NAME);
  const cleanupStatements = [
    'DELETE FROM dbo.cart_items',
    'DELETE FROM dbo.carts',
    'DELETE FROM dbo.admin_notifications',
    'DELETE FROM dbo.admin_activity_logs',
    'DELETE FROM dbo.homepage_hero_slides',
    'DELETE FROM dbo.product_images',
    'DELETE FROM dbo.vendor_payouts',
    'DELETE FROM dbo.order_items',
    'DELETE FROM dbo.orders',
    'DELETE FROM dbo.customer_payment_methods',
    'DELETE FROM dbo.customer_addresses',
    'DELETE FROM dbo.products',
    'DELETE FROM dbo.email_verifications',
    'DELETE FROM dbo.password_resets',
    'DELETE FROM dbo.vendors',
    'DELETE FROM dbo.users',
    `UPDATE dbo.platform_settings
     SET smtp_host = NULL,
         smtp_port = NULL,
         smtp_secure = 0,
         smtp_user = NULL,
         smtp_pass = NULL,
         mail_from = NULL,
         app_base_url = NULL,
         vendor_verification_emails_enabled = 1,
         admin_vendor_approval_emails_enabled = 1,
         password_reset_emails_enabled = 1,
         homepage_hero_autoplay_enabled = 1,
         homepage_hero_interval_seconds = 6,
         updated_at = SYSDATETIME()
     WHERE id = 1`,
  ];

  for (const statement of cleanupStatements) {
    await pool.query(statement);
  }
  await pool.close();
}

async function registerVerifyAndLoginCustomer(
  app: INestApplication,
  email: string,
  password: string,
  extra: Record<string, unknown> = {},
) {
  const registerResponse = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, ...extra })
    .expect(201);

  const pool = await createPool(DB_NAME);
  const tokenLookup = await pool.request().input('email', email).query<{
    token: string;
  }>(`
    SELECT TOP 1 pr.token
    FROM dbo.password_resets pr
    INNER JOIN dbo.users u ON u.id = pr.user_id
    WHERE u.email = @email
    ORDER BY pr.created_at DESC
  `);
  await pool.close();

  await request(app.getHttpServer())
    .post('/auth/password-reset/confirm')
    .send({
      token: tokenLookup.recordset[0].token,
      newPassword: password,
    })
    .expect(201);

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  await request(app.getHttpServer())
    .post('/account/addresses')
    .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
    .send({
      label: 'Home',
      fullName: extra.fullName || 'Test Customer',
      phoneNumber: '+3550000000',
      line1: 'Demo Street 1',
      city: 'Prishtine',
      postalCode: '10000',
      country: 'Kosovo',
      isDefault: true,
    })
    .expect(201);

  return { registerResponse, loginResponse };
}

async function getStructuredCatalogFixture() {
  const pool = await createPool(DB_NAME);

  const brand = await pool.request().input('name', 'Adidas').query<{
    id: string;
  }>(`
    IF NOT EXISTS (SELECT 1 FROM dbo.brands WHERE name = @name)
      INSERT INTO dbo.brands (name, is_active, sort_order) VALUES (@name, 1, 0);

    SELECT TOP 1 id
    FROM dbo.brands
    WHERE name = @name
  `);

  const primaryCategory = await pool
    .request()
    .input('categoryName', 'tops')
    .input('subcategoryName', 'tops').query<{
    category_id: string;
    subcategory_id: string;
  }>(`
      IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = @categoryName)
        INSERT INTO dbo.categories (name, is_active, sort_order)
        VALUES (@categoryName, 1, 0);

      DECLARE @categoryId UNIQUEIDENTIFIER = (
        SELECT TOP 1 id FROM dbo.categories WHERE name = @categoryName
      );

      IF NOT EXISTS (
        SELECT 1
        FROM dbo.subcategories
        WHERE category_id = @categoryId
          AND name = @subcategoryName
      )
        INSERT INTO dbo.subcategories (category_id, name, is_active, sort_order)
        VALUES (@categoryId, @subcategoryName, 1, 0);

      SELECT TOP 1
        @categoryId AS category_id,
        sc.id AS subcategory_id
      FROM dbo.subcategories sc
      WHERE sc.category_id = @categoryId
        AND sc.name = @subcategoryName
    `);

  const secondaryCategory = await pool
    .request()
    .input('categoryName', 'dresses')
    .input('subcategoryName', 'dresses').query<{
    category_id: string;
    subcategory_id: string;
  }>(`
      IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = @categoryName)
        INSERT INTO dbo.categories (name, is_active, sort_order)
        VALUES (@categoryName, 1, 1);

      DECLARE @categoryId UNIQUEIDENTIFIER = (
        SELECT TOP 1 id FROM dbo.categories WHERE name = @categoryName
      );

      IF NOT EXISTS (
        SELECT 1
        FROM dbo.subcategories
        WHERE category_id = @categoryId
          AND name = @subcategoryName
      )
        INSERT INTO dbo.subcategories (category_id, name, is_active, sort_order)
        VALUES (@categoryId, @subcategoryName, 1, 0);

      SELECT TOP 1
        @categoryId AS category_id,
        sc.id AS subcategory_id
      FROM dbo.subcategories sc
      WHERE sc.category_id = @categoryId
        AND sc.name = @subcategoryName
    `);

  const color = await pool.request().input('name', 'gray').query<{
    id: string;
  }>(`
    IF NOT EXISTS (SELECT 1 FROM dbo.colors WHERE name = @name)
      INSERT INTO dbo.colors (name, is_active, sort_order) VALUES (@name, 1, 0);

    SELECT TOP 1 id
    FROM dbo.colors
    WHERE name = @name
  `);

  const size = await pool
    .request()
    .input('sizeTypeName', 'Apparel')
    .input('sizeLabel', 'one-size').query<{
    size_type_id: string;
    size_id: string;
  }>(`
      IF NOT EXISTS (SELECT 1 FROM dbo.size_types WHERE name = @sizeTypeName)
        INSERT INTO dbo.size_types (name, is_active, sort_order)
        VALUES (@sizeTypeName, 1, 0);

      DECLARE @sizeTypeId UNIQUEIDENTIFIER = (
        SELECT TOP 1 id FROM dbo.size_types WHERE name = @sizeTypeName
      );

      IF NOT EXISTS (
        SELECT 1
        FROM dbo.sizes
        WHERE size_type_id = @sizeTypeId
          AND label = @sizeLabel
      )
        INSERT INTO dbo.sizes (size_type_id, label, is_active, sort_order)
        VALUES (@sizeTypeId, @sizeLabel, 1, 0);

      SELECT TOP 1
        @sizeTypeId AS size_type_id,
        s.id AS size_id
      FROM dbo.sizes s
      WHERE s.size_type_id = @sizeTypeId
        AND s.label = @sizeLabel
    `);

  const genderGroup = await pool.request().input('name', 'Men').query<{
    id: string;
  }>(`
    IF NOT EXISTS (SELECT 1 FROM dbo.gender_groups WHERE name = @name)
      INSERT INTO dbo.gender_groups (name, is_active, sort_order)
      VALUES (@name, 1, 0);

    SELECT TOP 1 id
    FROM dbo.gender_groups
    WHERE name = @name
  `);

  await pool.close();

  return {
    brandId: brand.recordset[0].id,
    primaryCategoryId: primaryCategory.recordset[0].category_id,
    primarySubcategoryId: primaryCategory.recordset[0].subcategory_id,
    secondarySubcategoryId: secondaryCategory.recordset[0].subcategory_id,
    colorId: color.recordset[0].id,
    sizeTypeId: size.recordset[0].size_type_id,
    sizeId: size.recordset[0].size_id,
    genderGroupId: genderGroup.recordset[0].id,
  };
}

async function seedVerifiedCustomer(
  email: string,
  password: string,
  options: {
    fullName?: string;
    phoneNumber?: string;
  } = {},
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const pool = await createPool(DB_NAME);

  const createdUser = await pool
    .request()
    .input('email', email)
    .input('fullName', options.fullName ?? null)
    .input('phoneNumber', options.phoneNumber ?? null)
    .input('passwordHash', passwordHash).query<{ id: string }>(`
      INSERT INTO dbo.users (
        email,
        full_name,
        phone_number,
        password_hash,
        role,
        is_active,
        email_verified_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @email,
        @fullName,
        @phoneNumber,
        @passwordHash,
        'customer',
        1,
        SYSDATETIME()
      )
    `);

  await pool.close();
  return createdUser.recordset[0].id;
}

function attachBootstrapSecurityMiddleware(app: INestApplication) {
  const configService = app.get(ConfigService);

  app.use((req, res, next) => {
    const hasBearerToken = req.headers.authorization?.startsWith('Bearer ');
    const hasCookieSession = hasAuthCookie(req.headers.cookie);
    const requiresCsrfProtection =
      !isSafeHttpMethod(req.method) && hasCookieSession && !hasBearerToken;

    if (requiresCsrfProtection) {
      const csrfHeader = req.header(CSRF_HEADER_NAME);
      const trustedOrigin = isTrustedBrowserOrigin(
        req.header('origin'),
        req.header('referer'),
        configService,
      );

      if (csrfHeader !== CSRF_HEADER_VALUE || !trustedOrigin) {
        res.status(403).json({
          message:
            'Blocked a state-changing cookie-authenticated request that did not pass origin verification.',
        });
        return;
      }
    }

    next();
  });
}

describe('Marketplace API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DB_NAME = DB_NAME;
    process.env.DB_INSTANCE = process.env.DB_INSTANCE || 'MARKET';
    process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
    process.env.DB_TRUSTED_CONNECTION =
      process.env.DB_TRUSTED_CONNECTION || 'true';
    process.env.NODE_ENV = 'test';
    process.env.APP_BASE_URL = 'http://localhost:3001';
    process.env.CORS_ORIGIN = 'http://localhost:3001';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    // Jest runs this suite in CommonJS mode, so require keeps bootstrap compatible.

    const { AppModule } = require('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    attachBootstrapSecurityMiddleware(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    const master = await createPool('master');
    await master.query(`
      IF DB_ID('${DB_NAME}') IS NOT NULL
      BEGIN
        ALTER DATABASE [${DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DB_NAME}];
      END
    `);
    await master.close();
  });

  it('GET /health returns service health', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('multi-vendor-marketplace-api');
  });

  it('GET /branding returns the shared site logo from the database', async () => {
    const response = await request(app.getHttpServer())
      .get('/branding')
      .expect(200);

    expect(response.body.siteName).toBe('Vishu.shop');
    expect(response.body.tagline).toBe('Unified fashion store');
    expect(response.body).toHaveProperty('logoSvg');
    expect(response.body).toHaveProperty('logoDataUrl');
  });

  it('registers customers and returns the current customer profile', async () => {
    const email = 'customer-e2e@example.com';
    const password = 'secret123';

    const { registerResponse, loginResponse } =
      await registerVerifyAndLoginCustomer(app, email, password);

    expect(registerResponse.body.message).toContain('Customer account created');
    expect(loginResponse.body).toHaveProperty('accessToken');

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(meResponse.body.email).toBe(email);
    expect(meResponse.body.role).toBe('customer');
  });

  it('supports cookie-based sessions for profile lookups and logout', async () => {
    const email = 'cookie-session@example.com';
    const password = 'secret123';

    await seedVerifiedCustomer(email, password, {
      fullName: 'Cookie Session Customer',
    });

    const agent = request.agent(app.getHttpServer());
    const loginResponse = await agent
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    expect(loginResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining(`${AUTH_COOKIE_NAME}=`)]),
    );

    const meResponse = await agent.get('/auth/me').expect(200);
    expect(meResponse.body.email).toBe(email);
    expect(meResponse.body.role).toBe('customer');

    await agent
      .post('/auth/logout')
      .set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE)
      .set('Origin', 'http://localhost:3001')
      .expect(201);

    await agent.get('/auth/me').expect(401);
  });

  it('requires csrf proof for cookie-authenticated profile updates', async () => {
    const email = 'cookie-csrf@example.com';
    const password = 'secret123';

    await seedVerifiedCustomer(email, password, {
      fullName: 'Before Update',
    });

    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .patch('/account/profile')
      .send({ fullName: 'Blocked Update' })
      .expect(403);

    await agent
      .patch('/account/profile')
      .set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE)
      .set('Origin', 'http://localhost:3001')
      .send({ fullName: 'Allowed Update' })
      .expect(200);

    await agent.get('/auth/me').expect(200);
  });

  it('shows public vendor identity in storefront product and shop responses', async () => {
    const pool = await createPool(DB_NAME);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('vendor-e2e@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Hidden Shop', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, department, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Privacy Tee', 'Visible product, hidden vendor.', 35.00, 8, 'women', 'tops')
      `);

    await pool.request().input('productId', product.recordset[0].id).query(`
        INSERT INTO dbo.product_images (product_id, image_url, sort_order)
        VALUES (@productId, '/media/demo/privacy-tee.jpg', 0)
      `);

    await pool.close();

    const listResponse = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    const detailResponse = await request(app.getHttpServer())
      .get(`/products/${product.recordset[0].id}`)
      .expect(200);
    const vendorsResponse = await request(app.getHttpServer())
      .get('/products/vendors')
      .expect(200);
    const vendorResponse = await request(app.getHttpServer())
      .get(`/products/vendors/${vendor.recordset[0].id}`)
      .expect(200);

    expect(listResponse.body[0].vendor.shopName).toBe('Hidden Shop');
    expect(listResponse.body[0].department).toBe('women');
    expect(detailResponse.body.vendor.shopName).toBe('Hidden Shop');
    expect(detailResponse.body.title).toBe('Privacy Tee');
    expect(detailResponse.body.department).toBe('women');
    expect(vendorsResponse.body[0].shopName).toBe('Hidden Shop');
    expect(vendorResponse.body.shopName).toBe('Hidden Shop');
    expect(vendorResponse.body.products[0].title).toBe('Privacy Tee');
    expect(vendorResponse.body.products[0].department).toBe('women');
  });

  it('shows approved shops publicly even before they upload products', async () => {
    const pool = await createPool(DB_NAME);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('empty-shop@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Fresh Shop', 1, 1, SYSDATETIME())
    `);

    await pool.close();

    const vendorsResponse = await request(app.getHttpServer())
      .get('/products/vendors')
      .expect(200);
    const vendorResponse = await request(app.getHttpServer())
      .get(`/products/vendors/${vendor.recordset[0].id}`)
      .expect(200);

    expect(vendorsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: vendor.recordset[0].id,
          shopName: 'Fresh Shop',
          productCount: 0,
        }),
      ]),
    );
    expect(vendorResponse.body.shopName).toBe('Fresh Shop');
    expect(vendorResponse.body.products).toEqual([]);
    expect(vendorResponse.body.productCount).toBe(0);
  });

  it('lets admin manage homepage promotions and exposes only active scheduled banners publicly', async () => {
    const adminHash = await bcrypt.hash('adminsecret', 10);

    const pool = await createPool(DB_NAME);
    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      VALUES ('carousel-admin@example.com', @passwordHash, 'admin', 1)
    `);
    await pool.close();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'carousel-admin@example.com', password: 'adminsecret' })
      .expect(201);

    const bannerPayload = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Wm1cAAAAASUVORK5CYII=',
      'base64',
    );

    await request(app.getHttpServer())
      .patch('/admin/promotions/settings')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({
        autoRotate: true,
        intervalSeconds: 8,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/admin/promotions')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .field('internalName', 'Spring Launch')
      .field('customUrl', '/shops')
      .field('isActive', 'true')
      .field('displayOrder', '0')
      .field('startDate', '2020-01-01')
      .field('endDate', '2099-12-31')
      .attach('desktopBannerImage', bannerPayload, {
        filename: 'promo-desktop.png',
        contentType: 'image/png',
      })
      .attach('mobileBannerImage', bannerPayload, {
        filename: 'promo-mobile.png',
        contentType: 'image/png',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/admin/promotions')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .field('internalName', 'Inactive Banner')
      .field('customUrl', '/account')
      .field('isActive', 'false')
      .field('displayOrder', '1')
      .attach('desktopBannerImage', bannerPayload, {
        filename: 'promo-inactive.png',
        contentType: 'image/png',
      })
      .expect(201);

    const heroResponse = await request(app.getHttpServer())
      .get('/homepage-hero')
      .expect(200);

    expect(heroResponse.body.autoRotate).toBe(true);
    expect(heroResponse.body.intervalSeconds).toBe(8);
    expect(heroResponse.body.slides).toHaveLength(1);
    expect(heroResponse.body.slides[0].internalName).toBe('Spring Launch');
    expect(heroResponse.body.slides[0].targetUrl).toBe('/shops');
    expect(heroResponse.body.slides[0].imageUrl).toContain(
      '/media/homepage-promotions/',
    );
    expect(heroResponse.body.slides[0].mobileImageUrl).toContain(
      '/media/homepage-promotions/',
    );
  });

  it('protects vendor product access from unauthenticated users', async () => {
    await request(app.getHttpServer()).get('/products/vendor/me').expect(401);
  });

  it('hides products from vendors who are not active', async () => {
    const pool = await createPool(DB_NAME);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('expired-sub-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Inactive Shop', 0, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Expired Listing Tee', 'Should not appear publicly', 20.00, 5, 'tops')
      `);

    await pool.request().input('productId', product.recordset[0].id).query(`
        INSERT INTO dbo.product_images (product_id, image_url, sort_order)
        VALUES (@productId, '/media/demo/expired-sub.jpg', 0)
      `);

    await pool.close();

    const listResponse = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(
      listResponse.body.find(
        (entry: { id: string }) => entry.id === product.recordset[0].id,
      ),
    ).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/products/${product.recordset[0].id}`)
      .expect(404);
  });

  it('lets vendors hide products from customers and duplicate them as hidden drafts', async () => {
    const pool = await createPool(DB_NAME);
    const vendorPassword = 'listing123';
    const vendorHash = await bcrypt.hash(vendorPassword, 10);

    const vendorUser = await pool.request().input('passwordHash', vendorHash)
      .query<{ id: string }>(`
        INSERT INTO dbo.users (email, password_hash, role, is_active)
        OUTPUT INSERTED.id
        VALUES ('listing-vendor@example.com', @passwordHash, 'vendor', 1)
      `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Listing Control Shop', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, department, category, color, size, is_listed)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Listing Tee', 'Visible listing control product', 42.00, 9, 'men', 'tops', 'black', 'l', 1)
      `);

    await pool.request().input('productId', product.recordset[0].id).query(`
        INSERT INTO dbo.product_images (product_id, image_url, sort_order)
        VALUES (@productId, '/media/demo/listing-tee.jpg', 0)
      `);

    await pool.close();

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'listing-vendor@example.com', password: vendorPassword })
      .expect(201);

    const initiallyPublic = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(
      initiallyPublic.body.find(
        (entry: { id: string }) => entry.id === product.recordset[0].id,
      ),
    ).toBeDefined();

    const hiddenResponse = await request(app.getHttpServer())
      .patch(`/products/${product.recordset[0].id}/listing`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({ isListed: false })
      .expect(200);

    expect(hiddenResponse.body.isListed).toBe(false);

    const hiddenPublicList = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(
      hiddenPublicList.body.find(
        (entry: { id: string }) => entry.id === product.recordset[0].id,
      ),
    ).toBeUndefined();

    await request(app.getHttpServer())
      .get(`/products/${product.recordset[0].id}`)
      .expect(404);

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'listing-customer@example.com',
      'secret123',
      { fullName: 'Listing Customer' },
    );

    await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 1 }],
      })
      .expect(400);

    const vendorsResponse = await request(app.getHttpServer())
      .get('/products/vendors')
      .expect(200);
    expect(vendorsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: vendor.recordset[0].id,
          shopName: 'Listing Control Shop',
          productCount: 0,
        }),
      ]),
    );

    const duplicateResponse = await request(app.getHttpServer())
      .post(`/products/${product.recordset[0].id}/duplicate`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .expect(201);

    expect(duplicateResponse.body.title).toBe('Listing Tee Copy');
    expect(duplicateResponse.body.isListed).toBe(false);
    expect(duplicateResponse.body.images).toEqual([
      '/media/demo/listing-tee.jpg',
    ]);

    const vendorProducts = await request(app.getHttpServer())
      .get('/products/vendor/me')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .expect(200);

    expect(vendorProducts.body.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: product.recordset[0].id,
          isListed: false,
        }),
        expect.objectContaining({
          id: duplicateResponse.body.id,
          isListed: false,
        }),
      ]),
    );

    const relistedDuplicate = await request(app.getHttpServer())
      .patch(`/products/${duplicateResponse.body.id}/listing`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({ isListed: true })
      .expect(200);

    expect(relistedDuplicate.body.isListed).toBe(true);

    const relistedPublicList = await request(app.getHttpServer())
      .get('/products')
      .expect(200);
    expect(
      relistedPublicList.body.find(
        (entry: { id: string }) => entry.id === duplicateResponse.body.id,
      ),
    ).toEqual(
      expect.objectContaining({ title: 'Listing Tee Copy', isListed: true }),
    );
  });

  it('lets vendors bulk update stock for selected products and sends low-stock alerts when needed', async () => {
    const mailService = app.get(MailService);
    const lowStockSpy = jest
      .spyOn(mailService, 'sendVendorLowStockAlert')
      .mockResolvedValue(undefined);

    const pool = await createPool(DB_NAME);
    const vendorPassword = 'bulkstock123';
    const vendorHash = await bcrypt.hash(vendorPassword, 10);

    const vendorUser = await pool.request().input('passwordHash', vendorHash)
      .query<{ id: string }>(`
        INSERT INTO dbo.users (email, password_hash, role, is_active)
        OUTPUT INSERTED.id
        VALUES ('bulk-stock-vendor@example.com', @passwordHash, 'vendor', 1)
      `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, low_stock_threshold, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Bulk Stock Shop', 5, 1, 1, SYSDATETIME())
    `);

    const firstProduct = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, department, category, is_listed)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Bulk Stock Tee', 'Bulk stock test 1', 30.00, 10, 'men', 'tops', 1)
      `);

    const secondProduct = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, department, category, is_listed)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Bulk Stock Hoodie', 'Bulk stock test 2', 65.00, 11, 'men', 'hoodies', 1)
      `);

    await pool.close();

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'bulk-stock-vendor@example.com',
        password: vendorPassword,
      })
      .expect(201);

    const bulkResponse = await request(app.getHttpServer())
      .patch('/products/bulk-stock')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({
        productIds: [
          firstProduct.recordset[0].id,
          secondProduct.recordset[0].id,
        ],
        stock: 3,
      })
      .expect(200);

    expect(bulkResponse.body.updatedCount).toBe(2);
    expect(bulkResponse.body.stock).toBe(3);
    expect(lowStockSpy).toHaveBeenCalledTimes(2);

    const vendorProducts = await request(app.getHttpServer())
      .get('/products/vendor/me')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .expect(200);

    expect(vendorProducts.body.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstProduct.recordset[0].id, stock: 3 }),
        expect.objectContaining({
          id: secondProduct.recordset[0].id,
          stock: 3,
        }),
      ]),
    );

    lowStockSpy.mockRestore();
  });

  it('creates an order from customer cart items and stores sanitized order data', async () => {
    const pool = await createPool(DB_NAME);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('order-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Order Vendor', 1, 1, SYSDATETIME())
    `);

    const productOne = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Order Tee', 'Order test tee', 30.00, 10, 'tops')
      `);

    const productTwo = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Order Pants', 'Order test pants', 70.00, 7, 'pants')
      `);

    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'order-customer@example.com',
      'secret123',
    );

    const accountResponse = await request(app.getHttpServer())
      .get('/account/me')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(200);

    const defaultAddressId = accountResponse.body.addresses[0].id;

    const orderResponse = await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [
          { productId: productOne.recordset[0].id, quantity: 2 },
          { productId: productTwo.recordset[0].id, quantity: 1 },
        ],
        addressId: defaultAddressId,
        paymentMethod: 'cash_on_delivery',
      })
      .expect(201);

    expect(orderResponse.body.totalPrice).toBe(130);
    expect(orderResponse.body.paymentMethod).toBe('cash_on_delivery');
    expect(orderResponse.body.paymentStatus).toBe('cod_pending');
    expect(orderResponse.body.status).toBe('pending');
    expect(orderResponse.body.fulfillment.placedAt).toBeTruthy();
    expect(orderResponse.body.fulfillment.confirmedAt).toBeNull();
    expect(orderResponse.body.fulfillment.shippedAt).toBeNull();
    expect(orderResponse.body.fulfillment.deliveredAt).toBeNull();
    expect(orderResponse.body.shippingAddress.label).toBe('Home');
    expect(orderResponse.body.shippingAddress.line1).toBe('Demo Street 1');
    expect(orderResponse.body.paymentCard).toBeNull();
    expect(orderResponse.body.items).toHaveLength(2);
    expect(orderResponse.body.items[0]).not.toHaveProperty('vendor_id');
    expect(orderResponse.body.items[0].product).not.toHaveProperty('vendor_id');

    const ordersResponse = await request(app.getHttpServer())
      .get('/orders/my')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(200);

    expect(ordersResponse.body).toHaveLength(1);
    expect(ordersResponse.body[0].totalPrice).toBe(130);
    expect(ordersResponse.body[0].fulfillment.placedAt).toBeTruthy();
    expect(ordersResponse.body[0].shippingAddress.city).toBe('Prishtine');
    expect(ordersResponse.body[0].paymentCard).toBeNull();

    const verifyPool = await createPool(DB_NAME);
    const stockCheck = await verifyPool.query<{
      title: string;
      stock: number;
    }>(`
      SELECT title, stock
      FROM dbo.products
      WHERE title IN ('Order Tee', 'Order Pants')
      ORDER BY title ASC
    `);
    const orderItemCheck = await verifyPool.query<{
      quantity: number;
      commission_amount: number;
      vendor_earnings: number;
    }>(`
      SELECT quantity, commission_amount, vendor_earnings
      FROM dbo.order_items
      ORDER BY quantity DESC
    `);
    const orderSnapshotCheck = await verifyPool.query<{
      shipping_label: string;
      shipping_city: string;
      payment_card_last4: string | null;
      payment_card_brand: string | null;
    }>(`
      SELECT TOP 1 shipping_label, shipping_city, payment_card_last4, payment_card_brand
      FROM dbo.orders
      ORDER BY created_at DESC
    `);
    await verifyPool.close();

    expect(stockCheck.recordset).toEqual([
      { title: 'Order Pants', stock: 6 },
      { title: 'Order Tee', stock: 8 },
    ]);
    expect(orderItemCheck.recordset[0].commission_amount).toBe(6);
    expect(orderItemCheck.recordset[0].vendor_earnings).toBe(54);
    expect(orderSnapshotCheck.recordset[0]).toEqual({
      shipping_label: 'Home',
      shipping_city: 'Prishtine',
      payment_card_last4: null,
      payment_card_brand: null,
    });
  });

  it('emails only the vendor when a product reaches the low-stock threshold', async () => {
    const mailService = app.get(MailService);
    const lowStockSpy = jest
      .spyOn(mailService, 'sendVendorLowStockAlert')
      .mockResolvedValue(undefined);

    const pool = await createPool(DB_NAME);
    const vendorPassword = 'lowstock123';
    const vendorHash = await bcrypt.hash(vendorPassword, 10);

    const vendorUser = await pool.request().input('passwordHash', vendorHash)
      .query<{ id: string }>(`
        INSERT INTO dbo.users (email, password_hash, role, is_active)
        OUTPUT INSERTED.id
        VALUES ('low-stock-vendor@example.com', @passwordHash, 'vendor', 1)
      `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, low_stock_threshold, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Low Stock Shop', 5, 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Low Stock Tee', 'Threshold test product', 25.00, 6, 'tops')
      `);

    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'low-stock-customer@example.com',
      'secret123',
    );

    await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 1 }],
      })
      .expect(201);

    expect(lowStockSpy).toHaveBeenCalledTimes(1);
    expect(lowStockSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        email: 'low-stock-vendor@example.com',
        shopName: 'Low Stock Shop',
        productTitle: 'Low Stock Tee',
        stock: 5,
        threshold: 5,
      }),
    );

    await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 1 }],
      })
      .expect(201);

    expect(lowStockSpy).toHaveBeenCalledTimes(1);

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'low-stock-vendor@example.com',
        password: vendorPassword,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/products/${product.recordset[0].id}`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({ stock: 8 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/products/${product.recordset[0].id}`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({ stock: 5 })
      .expect(200);

    expect(lowStockSpy).toHaveBeenCalledTimes(2);
    expect(lowStockSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        email: 'low-stock-vendor@example.com',
        shopName: 'Low Stock Shop',
        productTitle: 'Low Stock Tee',
        stock: 5,
        threshold: 5,
      }),
    );

    lowStockSpy.mockRestore();
  });

  it('lets a customer request cancellation before confirmation and reorder items back into cart', async () => {
    const pool = await createPool(DB_NAME);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('postpurchase-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Post Purchase Vendor', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Reorder Hoodie', 'Reorder and cancel workflow product', 45.00, 6, 'outerwear')
      `);

    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'postpurchase-customer@example.com',
      'secret123',
    );

    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 2 }],
      })
      .expect(201);

    expect(createdOrder.body.status).toBe('pending');

    const cancelRequest = await request(app.getHttpServer())
      .patch(`/orders/${createdOrder.body.id}/cancel-request`)
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({ note: 'Ordered the wrong size' })
      .expect(200);

    expect(cancelRequest.body.cancelRequest.status).toBe('requested');
    expect(cancelRequest.body.cancelRequest.note).toBe(
      'Ordered the wrong size',
    );

    const orderHistory = await request(app.getHttpServer())
      .get('/orders/my')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(200);

    expect(orderHistory.body[0].cancelRequest.status).toBe('requested');

    const reorderResponse = await request(app.getHttpServer())
      .post(`/orders/${createdOrder.body.id}/reorder`)
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(201);

    expect(reorderResponse.body.message).toBe('Items added back to cart');
    expect(reorderResponse.body.addedCount).toBe(2);
    expect(reorderResponse.body.cart.items[0].product.title).toBe(
      'Reorder Hoodie',
    );
    expect(reorderResponse.body.cart.items[0].quantity).toBe(2);

    const cartResponse = await request(app.getHttpServer())
      .get('/cart/my')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(200);

    expect(cartResponse.body.items).toHaveLength(1);
    expect(cartResponse.body.items[0].quantity).toBe(2);
  });

  it('rejects vendor product creation when more than 6 images are uploaded', async () => {
    const vendorPassword = 'vendorimages';
    const vendorRegistration = await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        email: 'images-vendor@example.com',
        password: vendorPassword,
        shopName: 'Images Vendor',
      })
      .expect(201);

    expect(vendorRegistration.body.message).toContain('Vendor account created');

    const pool = await createPool(DB_NAME);
    await pool.query(`
      UPDATE dbo.vendors
      SET is_verified = 1,
          is_active = 1,
          approved_at = SYSDATETIME()
      WHERE shop_name = 'Images Vendor'
    `);
    await pool.close();

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'images-vendor@example.com', password: vendorPassword })
      .expect(201);

    const imagePayload = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Wm1cAAAAASUVORK5CYII=',
      'base64',
    );

    const req = request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .field('title', 'Too Many Images Tee')
      .field('description', 'Upload guard test')
      .field('price', '25')
      .field('stock', '3')
      .field('category', 'tops');

    for (let index = 0; index < 7; index += 1) {
      req.attach('images', imagePayload, {
        filename: `image-${index}.png`,
        contentType: 'image/png',
      });
    }

    const response = await req.expect(400);
    expect(response.body.message).toContain('Unexpected field');
  });

  it('requires vendor email verification before login and allows login after using the verification link', async () => {
    const vendorPassword = 'verifyme123';

    await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        email: 'verify-flow-vendor@example.com',
        password: vendorPassword,
        shopName: 'Verify Flow Shop',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'verify-flow-vendor@example.com',
        password: vendorPassword,
      })
      .expect(401);

    const pool = await createPool(DB_NAME);
    const tokenLookup = await pool.request().query<{ token: string }>(`
      SELECT TOP 1 ev.token
      FROM dbo.email_verifications ev
      INNER JOIN dbo.users u ON u.id = ev.user_id
      WHERE u.email = 'verify-flow-vendor@example.com'
      ORDER BY ev.created_at DESC
    `);
    await pool.close();

    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/vendor/verify')
      .send({ token: tokenLookup.recordset[0].token })
      .expect(201);

    expect(verifyResponse.body.message).toContain('Awaiting admin approval');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'verify-flow-vendor@example.com',
        password: vendorPassword,
      })
      .expect(201);
  });

  it('rejects subcategories that do not belong to the selected category', async () => {
    const vendorPassword = 'departmentguard';
    await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        email: 'department-vendor@example.com',
        password: vendorPassword,
        shopName: 'Department Vendor',
      })
      .expect(201);

    const pool = await createPool(DB_NAME);
    await pool.query(`
      UPDATE dbo.vendors
      SET is_verified = 1,
          is_active = 1,
          approved_at = SYSDATETIME()
      WHERE shop_name = 'Department Vendor'
    `);
    await pool.close();

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'department-vendor@example.com',
        password: vendorPassword,
      })
      .expect(201);

    const catalog = await getStructuredCatalogFixture();

    const imagePayload = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Wm1cAAAAASUVORK5CYII=',
      'base64',
    );

    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .field('title', 'Wrong Department Dress')
      .field('description', 'Category mismatch test')
      .field('price', '39')
      .field('stock', '2')
      .field('brandId', catalog.brandId)
      .field('categoryId', catalog.primaryCategoryId)
      .field('subcategoryId', catalog.secondarySubcategoryId)
      .field('genderGroupId', catalog.genderGroupId)
      .field('colorIds', JSON.stringify([catalog.colorId]))
      .attach('images', imagePayload, {
        filename: 'department-test.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(response.body.message).toContain(
      'Select a valid active subcategory under the chosen category',
    );
  });

  it('normalizes common color and size values when vendors create products', async () => {
    const vendorPassword = 'normalization123';
    await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        email: 'normalized-vendor@example.com',
        password: vendorPassword,
        shopName: 'Normalized Vendor',
      })
      .expect(201);

    const pool = await createPool(DB_NAME);
    await pool.query(`
      UPDATE dbo.users
      SET email_verified_at = SYSDATETIME()
      WHERE email = 'normalized-vendor@example.com'
    `);
    await pool.query(`
      UPDATE dbo.vendors
      SET is_verified = 1,
          is_active = 1,
          approved_at = SYSDATETIME()
      WHERE shop_name = 'Normalized Vendor'
    `);
    await pool.close();

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'normalized-vendor@example.com',
        password: vendorPassword,
      })
      .expect(201);

    const catalog = await getStructuredCatalogFixture();

    const imagePayload = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Wm1cAAAAASUVORK5CYII=',
      'base64',
    );

    const createResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .field('title', 'Normalized Tee')
      .field('description', 'Normalization test')
      .field('price', '39')
      .field('stock', '6')
      .field('brandId', catalog.brandId)
      .field('categoryId', catalog.primaryCategoryId)
      .field('subcategoryId', catalog.primarySubcategoryId)
      .field('genderGroupId', catalog.genderGroupId)
      .field('colorIds', JSON.stringify([catalog.colorId]))
      .field('sizeTypeId', catalog.sizeTypeId)
      .field(
        'sizeVariants',
        JSON.stringify([{ sizeId: catalog.sizeId, stock: 6 }]),
      )
      .attach('images', imagePayload, {
        filename: 'normalized-test.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(createResponse.body.color).toBe('gray');
    expect(createResponse.body.size).toBe('one-size');
    expect(createResponse.body.productCode).toContain('-GRY-');
    expect(createResponse.body.productCode).toContain('-ONE-');
  });

  it('returns item-level commission and vendor data to admins only', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      VALUES ('admin-e2e@example.com', @passwordHash, 'admin', 1)
    `);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('admin-orders-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Admin Visible Shop', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Admin Order Tee', 'Admin order visibility tee', 50.00, 4, 'tops')
      `);
    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'admin-order-customer@example.com',
      'secret123',
    );

    await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 2 }],
      })
      .expect(201);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin-e2e@example.com', password: adminPassword })
      .expect(201);

    const adminOrders = await request(app.getHttpServer())
      .get('/admin/orders')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(adminOrders.body).toHaveLength(1);
    expect(adminOrders.body[0].customerEmail).toBe(
      'admin-order-customer@example.com',
    );
    expect(adminOrders.body[0].items).toHaveLength(1);
    expect(adminOrders.body[0].items[0].vendor.shopName).toBe(
      'Admin Visible Shop',
    );
    expect(adminOrders.body[0].items[0].commission).toBe(10);
    expect(adminOrders.body[0].items[0].vendorEarnings).toBe(90);

    await request(app.getHttpServer())
      .get('/admin/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(403);
  });

  it('returns admin overview and detail drill-down data', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', adminHash).query<{
      id: string;
    }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('ops-admin@example.com', @passwordHash, 'admin', 1)
    `);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('ops-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Ops Vendor', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Ops Tee', 'Ops admin detail tee', 40.00, 9, 'tops')
      `);
    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'ops-customer@example.com',
      'secret123',
    );

    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 2 }],
      })
      .expect(201);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ops-admin@example.com', password: adminPassword })
      .expect(201);

    const overview = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(overview.body.totals.totalUsers).toBeGreaterThanOrEqual(3);
    expect(overview.body.commerce.grossRevenue).toBe(80);
    expect(overview.body.commerce.cashOnDeliveryOrders).toBeGreaterThanOrEqual(
      1,
    );
    expect(overview.body.reporting.averageOrderValue).toBe(80);
    expect(overview.body.reporting.revenueLast7Days).toBe(80);
    expect(overview.body.reporting.revenueLast30Days).toBe(80);
    expect(overview.body.reporting.newUsersLast7Days).toBeGreaterThanOrEqual(3);
    expect(
      overview.body.reporting.newCustomersLast7Days,
    ).toBeGreaterThanOrEqual(1);
    expect(overview.body.reporting.newVendorsLast7Days).toBeGreaterThanOrEqual(
      1,
    );
    expect(overview.body.reporting.topShop.shopName).toBe('Ops Vendor');
    expect(overview.body.reporting.topShop.orderCount).toBe(1);
    expect(overview.body.reporting.topCategory.category).toBe('tops');
    expect(overview.body.reporting.topCategory.unitsSold).toBe(2);
    expect(overview.body.recentOrders[0].id).toBe(createdOrder.body.id);

    const vendorExport = await request(app.getHttpServer())
      .get('/admin/exports/vendors')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(vendorExport.body.filename).toBe('vendors-export.csv');
    expect(vendorExport.body.csv).toContain(
      'Shop name,Vendor email,Vendor active,Vendor verified,Login active,Created at',
    );
    expect(vendorExport.body.csv).toContain('Ops Vendor');

    const orderExport = await request(app.getHttpServer())
      .get('/admin/exports/orders')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(orderExport.body.filename).toBe('orders-export.csv');
    expect(orderExport.body.csv).toContain(
      'Order number,Customer email,Status,Payment method,Payment status,Total price,Created at',
    );
    expect(orderExport.body.csv).toContain(createdOrder.body.orderNumber);

    const reporting = await request(app.getHttpServer())
      .get('/admin/reporting?rangeDays=7')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(reporting.body.rangeDays).toBe(7);
    expect(reporting.body.orderCount).toBe(1);
    expect(reporting.body.revenue).toBe(80);
    expect(reporting.body.topShop.shopName).toBe('Ops Vendor');
    expect(reporting.body.topCategory.category).toBe('tops');

    const userDetail = await request(app.getHttpServer())
      .get(`/admin/users/${vendorUser.recordset[0].id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(userDetail.body.vendor.shopName).toBe('Ops Vendor');
    expect(userDetail.body.vendor.productCount).toBe(1);

    const vendorDetail = await request(app.getHttpServer())
      .get(`/admin/vendors/${vendor.recordset[0].id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(vendorDetail.body.shopName).toBe('Ops Vendor');
    expect(vendorDetail.body.metrics.productCount).toBe(1);

    const orderDetail = await request(app.getHttpServer())
      .get(`/admin/orders/${createdOrder.body.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(orderDetail.body.items[0].vendor.shopName).toBe('Ops Vendor');
    expect(orderDetail.body.items[0].product.title).toBe('Ops Tee');
  });

  it('stores phone numbers, persisted carts, and special requests for admin review', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      VALUES ('detail-admin@example.com', @passwordHash, 'admin', 1)
    `);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('detail-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Detail Vendor', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Detail Tee', 'Detail tee', 22.00, 12, 'tops')
      `);
    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'detail-customer@example.com',
      'secret123',
      { phoneNumber: '+3551234567' },
    );

    expect(customerAuth.registerResponse.body.message).toContain(
      'Customer account created',
    );

    await request(app.getHttpServer())
      .post('/cart/my')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 3 }],
      })
      .expect(201);

    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 2 }],
        specialRequest: 'Please gift wrap this order',
      })
      .expect(201);

    expect(createdOrder.body.specialRequest).toBe(
      'Please gift wrap this order',
    );

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'detail-admin@example.com', password: adminPassword })
      .expect(201);

    const customerUser = await request(app.getHttpServer())
      .get('/auth/me')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(200);

    const userDetail = await request(app.getHttpServer())
      .get(`/admin/users/${customerUser.body.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(userDetail.body.phoneNumber).toBe('+3551234567');
    expect(userDetail.body.customer.recentOrders[0].specialRequest).toBe(
      'Please gift wrap this order',
    );
    expect(userDetail.body.customer.cart.itemCount).toBe(0);

    await request(app.getHttpServer())
      .post('/cart/my')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 1 }],
      })
      .expect(201);

    const refreshedUserDetail = await request(app.getHttpServer())
      .get(`/admin/users/${customerUser.body.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(refreshedUserDetail.body.customer.cart.itemCount).toBe(1);
    expect(refreshedUserDetail.body.customer.cart.items[0].title).toBe(
      'Detail Tee',
    );
  });

  it('lets customers manage their account profile, addresses, cards, and password', async () => {
    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'account-customer@example.com',
      'secret123',
      {
        fullName: 'Account Customer',
        phoneNumber: '+3555551234',
      },
    );

    expect(customerAuth.registerResponse.body.message).toContain(
      'Customer account created',
    );

    const token = customerAuth.loginResponse.body.accessToken as string;
    const mailService = app.get(MailService);
    const ensureVerificationSpy = jest
      .spyOn(mailService, 'ensureVerificationDeliveryConfigured')
      .mockResolvedValue(undefined);
    const emailChangeSpy = jest
      .spyOn(mailService, 'sendCustomerEmailChangeOtp')
      .mockResolvedValue(undefined);

    const initialAccount = await request(app.getHttpServer())
      .get('/account/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(initialAccount.body.profile.fullName).toBe('Account Customer');
    expect(initialAccount.body.profile.phoneNumber).toBe('+3555551234');
    expect(initialAccount.body.addresses).toHaveLength(1);
    expect(initialAccount.body.addresses[0].isDefault).toBe(true);
    expect(initialAccount.body.paymentMethods).toHaveLength(0);

    const updatedProfile = await request(app.getHttpServer())
      .patch('/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Updated Customer',
        email: 'updated-account@example.com',
        phoneNumber: '+3557778888',
      })
      .expect(200);

    expect(updatedProfile.body.fullName).toBe('Updated Customer');
    expect(updatedProfile.body.email).toBe('account-customer@example.com');
    expect(updatedProfile.body.pendingEmail).toBe(
      'updated-account@example.com',
    );
    expect(updatedProfile.body.phoneNumber).toBe('+3557778888');
    expect(updatedProfile.body.emailVerifiedAt).not.toBeNull();

    expect(ensureVerificationSpy).toHaveBeenCalled();
    const otpCode = emailChangeSpy.mock.calls[0]?.[0]?.code;
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    const verifiedEmailChange = await request(app.getHttpServer())
      .post('/account/email-change/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: otpCode })
      .expect(201);

    expect(verifiedEmailChange.body.profile.email).toBe(
      'updated-account@example.com',
    );
    expect(verifiedEmailChange.body.profile.pendingEmail).toBeNull();

    const withAddress = await request(app.getHttpServer())
      .post('/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Home',
        fullName: 'Updated Customer',
        phoneNumber: '+3557778888',
        line1: 'Main Street 1',
        line2: 'Floor 2',
        city: 'Tirane',
        stateRegion: 'Tirane',
        postalCode: '1001',
        country: 'Albania',
        isDefault: true,
      })
      .expect(201);

    expect(withAddress.body.addresses).toHaveLength(2);
    expect(withAddress.body.addresses[0].isDefault).toBe(true);

    const manualCardAttempt = await request(app.getHttpServer())
      .post('/account/payment-methods')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nickname: 'Personal Visa',
        cardholderName: 'Updated Customer',
        cardNumber: '4111111111111111',
        expMonth: 12,
        expYear: 2030,
        isDefault: true,
      })
      .expect(400);

    expect(manualCardAttempt.body.message).toContain(
      'Manual card entry is no longer supported',
    );

    await request(app.getHttpServer())
      .patch('/account/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'secret123',
        newPassword: 'secret456',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'updated-account@example.com',
        password: 'secret456',
      })
      .expect(201);

    ensureVerificationSpy.mockRestore();
    emailChangeSpy.mockRestore();
  });

  it('lets vendors and admins use shared account settings while keeping customer account data private', async () => {
    const pool = await createPool(DB_NAME);
    const vendorPassword = 'vendorsecret';
    const adminPassword = 'adminsecret';
    const vendorHash = await bcrypt.hash(vendorPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', vendorHash).query(`
      INSERT INTO dbo.users (email, full_name, phone_number, password_hash, role, is_active)
      VALUES ('settings-vendor@example.com', 'Vendor User', '+355100200', @passwordHash, 'vendor', 1)
    `);

    await pool.request().query(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      SELECT TOP 1 id, 'Settings Vendor Shop', 1, 1, SYSDATETIME()
      FROM dbo.users
      WHERE email = 'settings-vendor@example.com'
    `);

    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, full_name, phone_number, password_hash, role, is_active)
      VALUES ('settings-admin@example.com', 'Admin User', '+355300400', @passwordHash, 'admin', 1)
    `);
    await pool.close();

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'settings-vendor@example.com', password: vendorPassword })
      .expect(201);

    const vendorSettings = await request(app.getHttpServer())
      .get('/account/settings')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .expect(200);

    expect(vendorSettings.body.role).toBe('vendor');
    expect(vendorSettings.body.fullName).toBe('Vendor User');
    expect(vendorSettings.body.vendor.shopName).toBe('Settings Vendor Shop');
    expect(vendorSettings.body.vendor.lowStockThreshold).toBe(5);

    await request(app.getHttpServer())
      .patch('/account/profile')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({
        fullName: 'Vendor Updated',
        phoneNumber: '+355999000',
      })
      .expect(200);

    const updatedVendorSettings = await request(app.getHttpServer())
      .patch('/account/vendor-profile')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({
        shopName: 'Updated Settings Shop',
        supportEmail: 'shop-support@example.com',
        supportPhone: '+355123000',
        shopDescription: 'Custom tailoring and shipping support.',
        logoUrl: 'https://cdn.example.com/logo.png',
        bannerUrl: 'https://cdn.example.com/banner.jpg',
        businessAddress: 'Main Boulevard 12, Tirane, Albania',
        returnPolicy: 'Returns accepted within 14 days for unworn items.',
        businessHours: 'Mon-Fri 09:00-18:00',
        shippingNotes: 'Orders dispatch within 2 business days.',
        lowStockThreshold: 8,
      })
      .expect(200);

    expect(updatedVendorSettings.body.vendor.shopName).toBe(
      'Updated Settings Shop',
    );
    expect(updatedVendorSettings.body.vendor.supportEmail).toBe(
      'shop-support@example.com',
    );
    expect(updatedVendorSettings.body.vendor.supportPhone).toBe('+355123000');
    expect(updatedVendorSettings.body.vendor.shopDescription).toBe(
      'Custom tailoring and shipping support.',
    );
    expect(updatedVendorSettings.body.vendor.logoUrl).toBe(
      'https://cdn.example.com/logo.png',
    );
    expect(updatedVendorSettings.body.vendor.bannerUrl).toBe(
      'https://cdn.example.com/banner.jpg',
    );
    expect(updatedVendorSettings.body.vendor.businessAddress).toBe(
      'Main Boulevard 12, Tirane, Albania',
    );
    expect(updatedVendorSettings.body.vendor.returnPolicy).toBe(
      'Returns accepted within 14 days for unworn items.',
    );
    expect(updatedVendorSettings.body.vendor.businessHours).toBe(
      'Mon-Fri 09:00-18:00',
    );
    expect(updatedVendorSettings.body.vendor.shippingNotes).toBe(
      'Orders dispatch within 2 business days.',
    );
    expect(updatedVendorSettings.body.vendor.lowStockThreshold).toBe(8);

    const imagePayload = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5Wm1cAAAAASUVORK5CYII=',
      'base64',
    );

    const logoUploadResponse = await request(app.getHttpServer())
      .patch('/account/vendor-profile')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .field('shopName', 'Updated Settings Shop')
      .field('supportEmail', 'shop-support@example.com')
      .field('supportPhone', '+355123000')
      .field('shopDescription', 'Custom tailoring and shipping support.')
      .field('bannerUrl', 'https://cdn.example.com/banner.jpg')
      .field('businessAddress', 'Main Boulevard 12, Tirane, Albania')
      .field(
        'returnPolicy',
        'Returns accepted within 14 days for unworn items.',
      )
      .field('businessHours', 'Mon-Fri 09:00-18:00')
      .field('shippingNotes', 'Orders dispatch within 2 business days.')
      .field('lowStockThreshold', '8')
      .attach('logoImage', imagePayload, {
        filename: 'vendor-logo.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(logoUploadResponse.body.vendor.logoUrl).toMatch(
      /^\/media\/vendors\/vendor-.*\/branding\/logo-/,
    );

    await request(app.getHttpServer())
      .get('/account/me')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .expect(403);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'settings-admin@example.com', password: adminPassword })
      .expect(201);

    const adminSettings = await request(app.getHttpServer())
      .get('/account/settings')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(adminSettings.body.role).toBe('admin');
    expect(adminSettings.body.email).toBe('settings-admin@example.com');

    const initialPlatformSettings = await request(app.getHttpServer())
      .get('/admin/platform-settings')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(initialPlatformSettings.body.email.smtpPasswordConfigured).toBe(
      false,
    );
    expect(
      initialPlatformSettings.body.email.adminVendorApprovalEmailsEnabled,
    ).toBe(true);
    expect(initialPlatformSettings.body.activityLog).toEqual([]);

    const testEmailResponse = await request(app.getHttpServer())
      .post('/admin/platform-settings/test-email')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({ email: 'ops-inbox@example.com' })
      .expect(201);

    expect(testEmailResponse.body.message).toContain('ops-inbox@example.com');

    const updatedPlatformSettings = await request(app.getHttpServer())
      .patch('/admin/platform-settings')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({
        smtpHost: 'sandbox.smtp.mailtrap.io',
        smtpPort: 2525,
        smtpSecure: false,
        smtpUser: 'mailtrap-user',
        smtpPassword: 'mailtrap-pass',
        mailFrom: 'noreply@vishu.local',
        appBaseUrl: 'http://localhost:3001',
        vendorVerificationEmailsEnabled: true,
        adminVendorApprovalEmailsEnabled: true,
        passwordResetEmailsEnabled: false,
      })
      .expect(200);

    expect(updatedPlatformSettings.body.email.smtpHost).toBe(
      'sandbox.smtp.mailtrap.io',
    );
    expect(updatedPlatformSettings.body.email.smtpPort).toBe(2525);
    expect(updatedPlatformSettings.body.email.smtpUser).toBe('mailtrap-user');
    expect(updatedPlatformSettings.body.email.smtpPasswordConfigured).toBe(
      true,
    );
    expect(
      updatedPlatformSettings.body.email.adminVendorApprovalEmailsEnabled,
    ).toBe(true);
    expect(updatedPlatformSettings.body.email.passwordResetEmailsEnabled).toBe(
      false,
    );
    expect(updatedPlatformSettings.body.activityLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: 'platform_settings_updated',
          adminEmail: 'settings-admin@example.com',
        }),
        expect.objectContaining({
          actionType: 'platform_test_email_sent',
          adminEmail: 'settings-admin@example.com',
        }),
      ]),
    );
  });

  it('creates admin notifications when a vendor is verified and clears them after approval', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      VALUES ('notify-admin@example.com', @passwordHash, 'admin', 1)
    `);
    await pool.close();

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/vendor/register')
      .send({
        shopName: 'Notify Shop',
        fullName: 'Notify Vendor',
        email: 'notify-vendor@example.com',
        phoneNumber: '+355123123',
        password: 'secret123',
      })
      .expect(201);

    expect(registerResponse.body.message).toContain('Verify your email');

    const verificationPool = await createPool(DB_NAME);
    const tokenLookup = await verificationPool.request().query<{
      token: string;
    }>(`
      SELECT TOP 1 ev.token
      FROM dbo.email_verifications ev
      INNER JOIN dbo.users u ON u.id = ev.user_id
      WHERE u.email = 'notify-vendor@example.com'
      ORDER BY ev.created_at DESC
    `);
    await verificationPool.close();

    await request(app.getHttpServer())
      .post('/auth/vendor/verify')
      .send({ token: tokenLookup.recordset[0].token })
      .expect(201);

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'notify-admin@example.com', password: adminPassword })
      .expect(201);

    const overviewAfterVerify = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(overviewAfterVerify.body.totals.pendingVendorApprovals).toBe(1);
    expect(overviewAfterVerify.body.totals.unreadNotifications).toBe(1);
    expect(overviewAfterVerify.body.notifications[0].type).toBe(
      'vendor_pending_approval',
    );
    expect(overviewAfterVerify.body.notifications[0].title).toBe(
      'Vendor waiting for approval',
    );
    expect(overviewAfterVerify.body.notifications[0].body).toContain(
      'Notify Shop',
    );

    const vendorId = overviewAfterVerify.body.pendingVendors[0].id;

    await request(app.getHttpServer())
      .patch(`/admin/vendors/${vendorId}/activation`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({ isActive: true })
      .expect(200);

    const overviewAfterApproval = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(overviewAfterApproval.body.totals.pendingVendorApprovals).toBe(0);
    expect(overviewAfterApproval.body.totals.unreadNotifications).toBe(0);
    expect(overviewAfterApproval.body.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionType: 'vendor_activation_updated',
          adminEmail: 'notify-admin@example.com',
          entityLabel: 'Notify Shop',
        }),
      ]),
    );
  });

  it('lets admins mark approval notifications as read manually', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    const admin = await pool.request().input('passwordHash', adminHash).query<{
      id: string;
    }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('manual-notify-admin@example.com', @passwordHash, 'admin', 1)
    `);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('manual-notify-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (user_id, shop_name, is_active, is_verified)
      OUTPUT INSERTED.id
      VALUES (@userId, 'Manual Notify Shop', 0, 1)
    `);

    await pool
      .request()
      .input('adminUserId', admin.recordset[0].id)
      .input('vendorId', vendor.recordset[0].id).query(`
        INSERT INTO dbo.admin_notifications (admin_user_id, vendor_id, notification_type, title, body, action_url)
        VALUES (@adminUserId, @vendorId, 'vendor_pending_approval', 'Vendor waiting for approval', 'Manual notification body', '/admin/vendors/${vendor.recordset[0].id}')
      `);
    await pool.close();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'manual-notify-admin@example.com',
        password: adminPassword,
      })
      .expect(201);

    const beforeRead = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(beforeRead.body.totals.unreadNotifications).toBe(1);

    await request(app.getHttpServer())
      .patch(`/admin/notifications/${beforeRead.body.notifications[0].id}/read`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    const afterRead = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(afterRead.body.totals.unreadNotifications).toBe(0);
    expect(afterRead.body.notifications[0].readAt).toBeTruthy();
  });

  it('lets admins resend a verification email for an unverified vendor', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      VALUES ('verify-admin@example.com', @passwordHash, 'admin', 1)
    `);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active, email_verified_at)
      OUTPUT INSERTED.id
      VALUES ('needs-verify@example.com', 'hash', 'vendor', 1, NULL)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (user_id, shop_name, is_active, is_verified)
      OUTPUT INSERTED.id
      VALUES (@userId, 'Needs Verify Shop', 0, 0)
    `);
    await pool.close();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'verify-admin@example.com', password: adminPassword })
      .expect(201);

    const resendResponse = await request(app.getHttpServer())
      .post(`/admin/vendors/${vendor.recordset[0].id}/verification-resend`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(201);

    expect(resendResponse.body.message).toBe('Verification email sent.');

    const verificationPool = await createPool(DB_NAME);
    const verificationRows = await verificationPool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{
      token: string;
      used_at: Date | null;
    }>(`
        SELECT token, used_at
        FROM dbo.email_verifications
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);

    const activityRows = await verificationPool.query<{
      action_type: string;
      entity_label: string;
    }>(`
      SELECT TOP 1 action_type, entity_label
      FROM dbo.admin_activity_logs
      ORDER BY created_at DESC
    `);
    await verificationPool.close();

    expect(verificationRows.recordset).toHaveLength(1);
    expect(verificationRows.recordset[0].token).toBeTruthy();
    expect(verificationRows.recordset[0].used_at).toBeNull();
    expect(activityRows.recordset[0]).toEqual(
      expect.objectContaining({
        action_type: 'vendor_verification_resent',
        entity_label: 'Needs Verify Shop',
      }),
    );
  });

  it('returns vendor payout summaries including bank details for admin review', async () => {
    const pool = await createPool(DB_NAME);
    const adminPassword = 'adminsecret';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.request().input('passwordHash', adminHash).query(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      VALUES ('payout-admin@example.com', @passwordHash, 'admin', 1)
    `);

    const vendorUser = await pool.request().query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('payout-vendor@example.com', 'hash', 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, bank_account_name, bank_name, bank_iban,
        is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Payout Shop', 'Payout Vendor', 'Raiffeisen', 'AL47212110090000000235698741', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
      OUTPUT INSERTED.id
      VALUES (@vendorId, 'Payout Tee', 'Payout product', 50.00, 10, 'tops')
    `);
    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'payout-customer@example.com',
      'secret123',
    );

    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 2 }],
      })
      .expect(201);

    const shippedPool = await createPool(DB_NAME);
    await shippedPool.query(`
      UPDATE dbo.order_items
      SET status = 'delivered',
          shipping_carrier = 'DHL',
          tracking_number = 'PAYOUT-TRACK-001',
          shipped_at = SYSDATETIME(),
          updated_at = SYSDATETIME();

      UPDATE dbo.orders
      SET status = 'delivered',
          updated_at = SYSDATETIME();
    `);
    await shippedPool.close();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'payout-admin@example.com', password: adminPassword })
      .expect(201);

    const payouts = await request(app.getHttpServer())
      .get('/admin/payouts')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(payouts.body[0].shopName).toBe('Payout Shop');
    expect(payouts.body[0].payableNow).toBe(0);
    expect(payouts.body[0].outstandingShippedBalance).toBe(0);
    expect(payouts.body[0].totalCommission).toBe(10);

    const codCollected = await request(app.getHttpServer())
      .patch(`/admin/orders/${createdOrder.body.id}/cod`)
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({
        paymentStatus: 'cod_collected',
        note: 'Courier handed over cash successfully',
      })
      .expect(200);

    expect(codCollected.body.paymentStatus).toBe('cod_collected');

    const refreshedPayouts = await request(app.getHttpServer())
      .get('/admin/payouts')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .expect(200);

    expect(refreshedPayouts.body[0].outstandingShippedBalance).toBe(90);

    const payoutRecord = await request(app.getHttpServer())
      .post('/admin/payouts')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .send({
        vendorId: refreshedPayouts.body[0].vendorId,
        amount: 90,
        note: 'Bank transfer batch 001',
      });

    expect(payoutRecord.status).toBe(201);

    expect(payoutRecord.body.message).toBe('Vendor payout recorded');
    expect(payoutRecord.body.payouts[0].paidOut).toBe(90);
  });

  it('updates vendor order statuses through the normal fulfillment sequence', async () => {
    const pool = await createPool(DB_NAME);
    const vendorPassword = 'vendorsecret';
    const vendorHash = await bcrypt.hash(vendorPassword, 10);

    const vendorUser = await pool.request().input('passwordHash', vendorHash)
      .query<{ id: string }>(`
      INSERT INTO dbo.users (email, password_hash, role, is_active)
      OUTPUT INSERTED.id
      VALUES ('workflow-vendor@example.com', @passwordHash, 'vendor', 1)
    `);

    const vendor = await pool
      .request()
      .input('userId', vendorUser.recordset[0].id).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id, shop_name, is_active, is_verified, approved_at
      )
      OUTPUT INSERTED.id
      VALUES (@userId, 'Workflow Vendor', 1, 1, SYSDATETIME())
    `);

    const product = await pool
      .request()
      .input('vendorId', vendor.recordset[0].id).query<{ id: string }>(`
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        OUTPUT INSERTED.id
        VALUES (@vendorId, 'Workflow Jacket', 'Vendor workflow jacket', 80.00, 5, 'outerwear')
      `);
    await pool.close();

    const customerAuth = await registerVerifyAndLoginCustomer(
      app,
      'workflow-customer@example.com',
      'secret123',
    );

    const createdOrder = await request(app.getHttpServer())
      .post('/orders')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .send({
        items: [{ productId: product.recordset[0].id, quantity: 1 }],
      })
      .expect(201);

    const vendorLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'workflow-vendor@example.com', password: vendorPassword })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/vendor/orders/${createdOrder.body.id}/status`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({ status: 'confirmed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/vendor/orders/${createdOrder.body.id}/status`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({
        status: 'shipped',
        shippingCarrier: 'DHL',
        trackingNumber: 'TRACK-1234',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/vendor/orders/${createdOrder.body.id}/status`)
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .send({ status: 'delivered' })
      .expect(200);

    const vendorOrders = await request(app.getHttpServer())
      .get('/vendor/orders')
      .set('Authorization', `Bearer ${vendorLogin.body.accessToken}`)
      .expect(200);

    expect(vendorOrders.body[0].status).toBe('delivered');
    expect(vendorOrders.body[0].items[0].status).toBe('delivered');
    expect(vendorOrders.body[0].items[0].shipment.trackingNumber).toBe(
      'TRACK-1234',
    );

    const customerOrders = await request(app.getHttpServer())
      .get('/orders/my')
      .set(
        'Authorization',
        `Bearer ${customerAuth.loginResponse.body.accessToken}`,
      )
      .expect(200);

    expect(customerOrders.body[0].items[0].shipment.shippingCarrier).toBe(
      'DHL',
    );
    expect(customerOrders.body[0].fulfillment.placedAt).toBeTruthy();
    expect(customerOrders.body[0].fulfillment.confirmedAt).toBeTruthy();
    expect(customerOrders.body[0].fulfillment.shippedAt).toBeTruthy();
    expect(customerOrders.body[0].fulfillment.deliveredAt).toBeTruthy();
  });
});
