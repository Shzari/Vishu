import * as bcrypt from 'bcrypt';
import sql from 'mssql/msnodesqlv8';

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

async function main() {
  const databaseName = process.env.DB_NAME || 'vishu';
  const pool = await createPool(databaseName);

  const vendorEmail = 'vendor@vishu.local';
  const customerEmail = 'customer@vishu.local';
  const passwordHash = await bcrypt.hash('123456', 10);

  const vendorUserRequest = pool.request();
  vendorUserRequest.input('email', vendorEmail);
  vendorUserRequest.input('passwordHash', passwordHash);
  const vendorUser = await vendorUserRequest.query<{ id: string }>(`
    MERGE dbo.users AS target
    USING (SELECT @email AS email) AS source
      ON target.email = source.email
    WHEN MATCHED THEN
      UPDATE SET password_hash = @passwordHash, role = 'vendor', is_active = 1, updated_at = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (email, password_hash, role, is_active)
      VALUES (@email, @passwordHash, 'vendor', 1)
    OUTPUT INSERTED.id;
  `);

  const customerRequest = pool.request();
  customerRequest.input('email', customerEmail);
  customerRequest.input('passwordHash', passwordHash);
  await customerRequest.query(`
    MERGE dbo.users AS target
    USING (SELECT @email AS email) AS source
      ON target.email = source.email
    WHEN MATCHED THEN
      UPDATE SET password_hash = @passwordHash, role = 'customer', is_active = 1, updated_at = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (email, password_hash, role, is_active)
      VALUES (@email, @passwordHash, 'customer', 1);
  `);

  const vendorRecordRequest = pool.request();
  vendorRecordRequest.input('userId', vendorUser.recordset[0].id);
  const vendorRecord = await vendorRecordRequest.query<{ id: string }>(`
    MERGE dbo.vendors AS target
    USING (SELECT @userId AS user_id) AS source
      ON target.user_id = source.user_id
    WHEN MATCHED THEN
      UPDATE SET shop_name = 'Shkelqa Studio', is_active = 1, is_verified = 1, updated_at = SYSDATETIME(), approved_at = COALESCE(target.approved_at, SYSDATETIME())
    WHEN NOT MATCHED THEN
      INSERT (user_id, shop_name, is_active, is_verified, approved_at)
      VALUES (@userId, 'Shkelqa Studio', 1, 1, SYSDATETIME())
    OUTPUT INSERTED.id;
  `);

  const vendorId = vendorRecord.recordset[0].id;
  const products = [
    {
      title: 'Sandstone Overshirt',
      description: 'Layered streetwear overshirt with a relaxed fit and soft cotton finish.',
      price: 79.9,
      stock: 18,
      category: 'outerwear',
    },
    {
      title: 'Tailored Black Trousers',
      description: 'Clean-cut everyday trousers designed for formal and casual styling.',
      price: 64.5,
      stock: 22,
      category: 'pants',
    },
    {
      title: 'Minimal Ivory Tee',
      description: 'Heavyweight tee with a minimal silhouette for a polished basics wardrobe.',
      price: 29.0,
      stock: 35,
      category: 'tops',
    },
  ];

  for (const product of products) {
    const request = pool.request();
    request.input('vendorId', vendorId);
    request.input('title', product.title);
    request.input('description', product.description);
    request.input('price', product.price);
    request.input('stock', product.stock);
    request.input('category', product.category);
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.products WHERE vendor_id = @vendorId AND title = @title)
      BEGIN
        INSERT INTO dbo.products (vendor_id, title, description, price, stock, category)
        VALUES (@vendorId, @title, @description, @price, @stock, @category);
      END
    `);
  }

  await pool.close();

  console.log('Demo data ready');
  console.log('Vendor login: vendor@vishu.local / 123456');
  console.log('Customer login: customer@vishu.local / 123456');
}

void main();
