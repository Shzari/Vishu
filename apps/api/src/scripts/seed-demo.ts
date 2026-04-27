import * as bcrypt from 'bcrypt';
import { existsSync, readFileSync } from 'fs';
import sql from 'mssql/msnodesqlv8';
import { resolve } from 'path';

type DemoVendorSeed = {
  email: string;
  fullName: string;
  shopName: string;
  shopDescription: string;
  logoUrl: string;
  bannerUrl: string;
  products: {
    title: string;
    description: string;
    price: number;
    stock: number;
    department: 'men' | 'women';
    category: string;
    color: string | null;
    size: string | null;
    images: string[];
  }[];
};

const envPath = resolve(__dirname, '../../.env');

const demoVendors: DemoVendorSeed[] = [
  {
    email: 'vendor@vishu.local',
    fullName: 'Shkelqa Gashi',
    shopName: 'Shkelqa Studio',
    shopDescription:
      'Minimal everyday essentials with a clean city look for men and women.',
    logoUrl:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    bannerUrl:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80',
    products: [
      {
        title: 'Sandstone Overshirt',
        description:
          'Layered streetwear overshirt with a relaxed fit and soft cotton finish.',
        price: 79.9,
        stock: 18,
        department: 'men',
        category: 'outerwear',
        color: 'beige',
        size: 'l',
        images: [
          'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=900&q=80',
          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Tailored Black Trousers',
        description:
          'Clean-cut everyday trousers designed for formal and casual styling.',
        price: 64.5,
        stock: 22,
        department: 'men',
        category: 'pants',
        color: 'black',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Minimal Ivory Tee',
        description:
          'Heavyweight tee with a minimal silhouette for a polished basics wardrobe.',
        price: 29,
        stock: 35,
        department: 'men',
        category: 'tshirts',
        color: 'ivory',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Urban Zip Hoodie',
        description:
          'Soft brushed hoodie for cooler evenings and casual layering.',
        price: 58,
        stock: 14,
        department: 'men',
        category: 'hoodies',
        color: 'gray',
        size: 'xl',
        images: [
          'https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=80',
        ],
      },
    ],
  },
  {
    email: 'test12@test.com',
    fullName: 'Arta Berisha',
    shopName: 'Testing',
    shopDescription:
      'Soft color palettes, polished womenswear, and occasion-ready pieces.',
    logoUrl:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80',
    bannerUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    products: [
      {
        title: 'Blush Satin Dress',
        description:
          'Elegant satin dress with a fluid silhouette for evening and event styling.',
        price: 92,
        stock: 12,
        department: 'women',
        category: 'dresses',
        color: 'pink',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80',
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Soft Knit Cardigan',
        description:
          'Easy layering cardigan with a comfortable knit and clean finish.',
        price: 55,
        stock: 17,
        department: 'women',
        category: 'sweaters',
        color: 'cream',
        size: 's',
        images: [
          'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Everyday Wide-Leg Pants',
        description:
          'Wide-leg trousers with a draped fit for office and weekend wear.',
        price: 61,
        stock: 20,
        department: 'women',
        category: 'pants',
        color: 'navy',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1506629905607-d9f9b3d7d54d?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Cityline Shoulder Bag',
        description:
          'Structured shoulder bag that pairs with both tailored and relaxed outfits.',
        price: 48,
        stock: 16,
        department: 'women',
        category: 'accessories',
        color: 'burgundy',
        size: 'one-size',
        images: [
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
        ],
      },
    ],
  },
  {
    email: 'uz@gm.com',
    fullName: 'Uran Zeka',
    shopName: 'Urim butik',
    shopDescription:
      'Sharp menswear with outerwear, denim, and smart everyday pieces.',
    logoUrl:
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
    bannerUrl:
      'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1400&q=80',
    products: [
      {
        title: 'Graphite Bomber Jacket',
        description:
          'Light bomber jacket with a smooth finish and easy transitional weight.',
        price: 88,
        stock: 15,
        department: 'men',
        category: 'jackets',
        color: 'gray',
        size: 'l',
        images: [
          'https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Slim Indigo Jeans',
        description: 'Flexible denim with a clean tapered fit for daily wear.',
        price: 52,
        stock: 28,
        department: 'men',
        category: 'jeans',
        color: 'blue',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Classic Oxford Shirt',
        description:
          'A crisp oxford shirt suitable for business-casual and polished outfits.',
        price: 46,
        stock: 21,
        department: 'men',
        category: 'shirts',
        color: 'white',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Weekend Sweatshirt',
        description:
          'Relaxed sweatshirt for layering with denim, joggers, or shorts.',
        price: 41,
        stock: 19,
        department: 'men',
        category: 'sweatshirts',
        color: 'green',
        size: 'l',
        images: [
          'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
        ],
      },
    ],
  },
  {
    email: 'hgashi@live.com',
    fullName: 'Hana Gashi',
    shopName: 'major boutique',
    shopDescription:
      'Bright lifestyle picks with activewear, layers, and giftable fashion pieces.',
    logoUrl:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    bannerUrl:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=80',
    products: [
      {
        title: 'Active Zip Set',
        description:
          'Sport-ready zip layer built for errands, walks, and quick training sessions.',
        price: 67,
        stock: 13,
        department: 'women',
        category: 'sportswear',
        color: 'black',
        size: 's',
        images: [
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Ribbed Neutral Top',
        description:
          'Minimal ribbed top that works on its own or under jackets and cardigans.',
        price: 24,
        stock: 30,
        department: 'women',
        category: 'tops',
        color: 'beige',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Pleated Midi Skirt',
        description:
          'Flowing midi skirt with light movement and easy day-to-evening styling.',
        price: 58,
        stock: 14,
        department: 'women',
        category: 'skirts',
        color: 'burgundy',
        size: 'm',
        images: [
          'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&w=900&q=80',
        ],
      },
      {
        title: 'Soft Lounge Hoodie',
        description:
          'Relaxed hoodie for cozy at-home wear or casual weekend outfits.',
        price: 44,
        stock: 24,
        department: 'women',
        category: 'hoodies',
        color: 'gray',
        size: 'l',
        images: [
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
        ],
      },
    ],
  },
];

function loadEnvFile() {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function createPool(database: string) {
  const server = process.env.DB_SERVER || 'localhost';
  const instanceName = (process.env.DB_INSTANCE || 'MARKET').trim();
  const trusted = (process.env.DB_TRUSTED_CONNECTION || 'true') === 'true';
  const serverTarget = instanceName ? `${server}\\${instanceName}` : server;
  const drivers = [
    process.env.DB_DRIVER?.trim(),
    'ODBC Driver 18 for SQL Server',
    'ODBC Driver 17 for SQL Server',
  ].filter(
    (value, index, array): value is string =>
      Boolean(value) && array.indexOf(value) === index,
  );

  let lastError: unknown;

  for (const driver of drivers) {
    const connectionString = trusted
      ? `Driver={${driver}};Server=${serverTarget};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
      : `Driver={${driver}};Server=${serverTarget};Database=${database};Uid=${process.env.DB_USER || ''};Pwd=${process.env.DB_PASSWORD || ''};TrustServerCertificate=Yes;`;

    try {
      return await new sql.ConnectionPool({
        connectionString,
        options: {
          trustServerCertificate: true,
        },
      }).connect();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function ensureUser(
  pool: sql.ConnectionPool,
  {
    email,
    fullName,
    role,
    passwordHash,
  }: {
    email: string;
    fullName: string;
    role: 'vendor' | 'customer';
    passwordHash: string;
  },
) {
  const existing = await pool
    .request()
    .input('email', sql.NVarChar, email)
    .query<{
      id: string;
    }>('SELECT TOP 1 id FROM dbo.users WHERE email = @email');

  if (existing.recordset[0]) {
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, existing.recordset[0].id)
      .input('email', sql.NVarChar, email)
      .input('fullName', sql.NVarChar, fullName)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('role', sql.NVarChar, role).query(`
        UPDATE dbo.users
        SET email = @email,
            full_name = @fullName,
            password_hash = @passwordHash,
            role = @role,
            email_verified_at = CASE WHEN @role = 'customer' THEN ISNULL(email_verified_at, SYSDATETIME()) ELSE SYSDATETIME() END,
            is_active = 1,
            updated_at = SYSDATETIME()
        WHERE id = @id
      `);

    return existing.recordset[0].id;
  }

  const inserted = await pool
    .request()
    .input('email', sql.NVarChar, email)
    .input('fullName', sql.NVarChar, fullName)
    .input('passwordHash', sql.NVarChar, passwordHash)
    .input('role', sql.NVarChar, role).query<{ id: string }>(`
      INSERT INTO dbo.users (email, full_name, password_hash, role, email_verified_at, is_active)
      OUTPUT INSERTED.id
      VALUES (
        @email,
        @fullName,
        @passwordHash,
        @role,
        CASE WHEN @role = 'customer' THEN SYSDATETIME() ELSE SYSDATETIME() END,
        1
      )
    `);

  return inserted.recordset[0].id;
}

async function ensureVendor(
  pool: sql.ConnectionPool,
  userId: string,
  vendor: DemoVendorSeed,
) {
  const existing = await pool
    .request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query<{
      id: string;
    }>('SELECT TOP 1 id FROM dbo.vendors WHERE user_id = @userId');

  if (existing.recordset[0]) {
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, existing.recordset[0].id)
      .input('shopName', sql.NVarChar, vendor.shopName)
      .input('shopDescription', sql.NVarChar, vendor.shopDescription)
      .input('logoUrl', sql.NVarChar, vendor.logoUrl)
      .input('bannerUrl', sql.NVarChar, vendor.bannerUrl).query(`
        UPDATE dbo.vendors
        SET shop_name = @shopName,
            shop_description = @shopDescription,
            logo_url = @logoUrl,
            banner_url = @bannerUrl,
            is_active = 1,
            is_verified = 1,
            approved_at = ISNULL(approved_at, SYSDATETIME()),
            updated_at = SYSDATETIME()
        WHERE id = @id
      `);

    return existing.recordset[0].id;
  }

  const inserted = await pool
    .request()
    .input('userId', sql.UniqueIdentifier, userId)
    .input('shopName', sql.NVarChar, vendor.shopName)
    .input('shopDescription', sql.NVarChar, vendor.shopDescription)
    .input('logoUrl', sql.NVarChar, vendor.logoUrl)
    .input('bannerUrl', sql.NVarChar, vendor.bannerUrl).query<{ id: string }>(`
      INSERT INTO dbo.vendors (
        user_id,
        shop_name,
        shop_description,
        logo_url,
        banner_url,
        is_active,
        is_verified,
        approved_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @userId,
        @shopName,
        @shopDescription,
        @logoUrl,
        @bannerUrl,
        1,
        1,
        SYSDATETIME()
      )
    `);

  return inserted.recordset[0].id;
}

async function ensureProduct(
  pool: sql.ConnectionPool,
  vendorId: string,
  product: DemoVendorSeed['products'][number],
) {
  const existing = await pool
    .request()
    .input('vendorId', sql.UniqueIdentifier, vendorId)
    .input('title', sql.NVarChar, product.title)
    .query<{
      id: string;
    }>('SELECT TOP 1 id FROM dbo.products WHERE vendor_id = @vendorId AND title = @title');

  let productId = existing.recordset[0]?.id;

  if (productId) {
    await pool
      .request()
      .input('id', sql.UniqueIdentifier, productId)
      .input('description', sql.NVarChar, product.description)
      .input('price', sql.Decimal(10, 2), product.price)
      .input('stock', sql.Int, product.stock)
      .input('department', sql.NVarChar, product.department)
      .input('category', sql.NVarChar, product.category)
      .input('color', sql.NVarChar, product.color)
      .input('size', sql.NVarChar, product.size).query(`
        UPDATE dbo.products
        SET description = @description,
            price = @price,
            stock = @stock,
            is_listed = 1,
            department = @department,
            category = @category,
            color = @color,
            size = @size,
            updated_at = SYSDATETIME()
        WHERE id = @id
      `);
  } else {
    const inserted = await pool
      .request()
      .input('vendorId', sql.UniqueIdentifier, vendorId)
      .input('title', sql.NVarChar, product.title)
      .input('description', sql.NVarChar, product.description)
      .input('price', sql.Decimal(10, 2), product.price)
      .input('stock', sql.Int, product.stock)
      .input('department', sql.NVarChar, product.department)
      .input('category', sql.NVarChar, product.category)
      .input('color', sql.NVarChar, product.color)
      .input('size', sql.NVarChar, product.size).query<{ id: string }>(`
        INSERT INTO dbo.products (
          vendor_id,
          title,
          description,
          price,
          stock,
          is_listed,
          department,
          category,
          color,
          size
        )
        OUTPUT INSERTED.id
        VALUES (
          @vendorId,
          @title,
          @description,
          @price,
          @stock,
          1,
          @department,
          @category,
          @color,
          @size
        )
      `);

    productId = inserted.recordset[0].id;
  }

  await pool
    .request()
    .input('productId', sql.UniqueIdentifier, productId)
    .query('DELETE FROM dbo.product_images WHERE product_id = @productId');

  for (const [index, imageUrl] of product.images.entries()) {
    await pool
      .request()
      .input('productId', sql.UniqueIdentifier, productId)
      .input('imageUrl', sql.NVarChar, imageUrl)
      .input('sortOrder', sql.Int, index).query(`
        INSERT INTO dbo.product_images (product_id, image_url, sort_order)
        VALUES (@productId, @imageUrl, @sortOrder)
      `);
  }

  return productId;
}

async function ensureHomepageHeroSlide(
  pool: sql.ConnectionPool,
  slide: {
    internalName: string;
    customUrl: string;
    desktopImageUrl: string;
    mobileImageUrl?: string;
  },
  sortOrder: number,
) {
  await pool
    .request()
    .input('internalName', sql.NVarChar, slide.internalName)
    .input('customUrl', sql.NVarChar, slide.customUrl)
    .input('desktopImageUrl', sql.NVarChar, slide.desktopImageUrl)
    .input('mobileImageUrl', sql.NVarChar, slide.mobileImageUrl ?? null)
    .input('sortOrder', sql.Int, sortOrder).query(`
      INSERT INTO dbo.homepage_hero_slides (internal_name, desktop_image_url, mobile_image_url, target_url, is_active, sort_order)
      VALUES (@internalName, @desktopImageUrl, @mobileImageUrl, @customUrl, 1, @sortOrder)
    `);
}

async function main() {
  loadEnvFile();

  const databaseName = process.env.DB_NAME || 'vishu';
  const pool = await createPool(databaseName);
  const passwordHash = await bcrypt.hash('123456', 10);

  const customerEmail = 'customer@vishu.local';
  await ensureUser(pool, {
    email: customerEmail,
    fullName: 'Vishu Demo Customer',
    role: 'customer',
    passwordHash,
  });

  await pool.request().query('DELETE FROM dbo.homepage_hero_slides');

  for (const vendor of demoVendors) {
    const userId = await ensureUser(pool, {
      email: vendor.email,
      fullName: vendor.fullName,
      role: 'vendor',
      passwordHash,
    });

    await pool
      .request()
      .input('id', sql.UniqueIdentifier, userId)
      .query(
        'UPDATE dbo.users SET email_verified_at = SYSDATETIME(), is_active = 1, updated_at = SYSDATETIME() WHERE id = @id',
      );

    const vendorId = await ensureVendor(pool, userId, vendor);

    for (const product of vendor.products) {
      await ensureProduct(pool, vendorId, product);
    }
  }

  const homepagePromos = [
    {
      internalName: 'Spring layers',
      customUrl: '/#posted-products',
      desktopImageUrl:
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80',
    },
    {
      internalName: 'Women promotion',
      customUrl: '/?department=women',
      desktopImageUrl:
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80',
    },
    {
      internalName: 'Men promotion',
      customUrl: '/?department=men',
      desktopImageUrl:
        'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1400&q=80',
    },
  ];

  for (const [index, slide] of homepagePromos.entries()) {
    await ensureHomepageHeroSlide(pool, slide, index);
  }

  await pool.close();

  console.log('Demo marketplace data ready.');
  console.log('Customer login: customer@vishu.local / 123456');
  for (const vendor of demoVendors) {
    console.log(`Vendor login: ${vendor.email} / 123456`);
  }
}

void main().catch((error) => {
  console.error('Failed to seed demo data');
  console.error(error);
  process.exitCode = 1;
});
