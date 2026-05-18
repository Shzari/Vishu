import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import sql from 'mssql/msnodesqlv8';
import { dirname, join } from 'path';
import convertHeic = require('heic-convert');

type ProductImageRow = {
  id: string;
  image_url: string;
};

async function createPool(database: string) {
  const config = new ConfigService();
  const server = config.get<string>('DB_SERVER', 'localhost');
  const instanceName = config.get<string>('DB_INSTANCE', '').trim();
  const trusted =
    config.get<string>('DB_TRUSTED_CONNECTION', 'true') === 'true';
  const serverTarget = instanceName ? `${server}\\${instanceName}` : server;

  const connectionString = trusted
    ? `Driver={ODBC Driver 17 for SQL Server};Server=${serverTarget};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
    : `Driver={ODBC Driver 17 for SQL Server};Server=${serverTarget};Database=${database};Uid=${config.get<string>('DB_USER', '')};Pwd=${config.get<string>('DB_PASSWORD', '')};TrustServerCertificate=Yes;`;

  return new sql.ConnectionPool({
    connectionString,
    options: {
      trustServerCertificate: true,
    },
  }).connect();
}

function getUploadFilePath(imageUrl: string) {
  const relativePath = imageUrl.replace(/^\/media\//, '');
  return join(process.cwd(), 'uploads', relativePath);
}

async function main() {
  const config = new ConfigService();
  const databaseName = config.get<string>('DB_NAME', 'vishu');
  const pool = await createPool(databaseName);

  try {
    const result = await pool.request().query<ProductImageRow>(`
      SELECT id, image_url
      FROM dbo.product_images
      WHERE LOWER(image_url) LIKE '%.heic'
         OR LOWER(image_url) LIKE '%.heif'
    `);

    let converted = 0;
    let skipped = 0;
    let missing = 0;

    for (const row of result.recordset ?? []) {
      const sourcePath = getUploadFilePath(row.image_url);
      const nextImageUrl = row.image_url.replace(/\.(heic|heif)$/i, '.jpg');
      const targetPath = getUploadFilePath(nextImageUrl);

      if (!existsSync(sourcePath)) {
        missing += 1;
        console.warn(`Missing source file: ${sourcePath}`);
        continue;
      }

      if (!existsSync(targetPath)) {
        mkdirSync(dirname(targetPath), { recursive: true });
        const output = await convertHeic({
          buffer: readFileSync(sourcePath),
          format: 'JPEG',
          quality: 0.9,
        });
        writeFileSync(
          targetPath,
          Buffer.isBuffer(output)
            ? output
            : Buffer.from(new Uint8Array(output)),
        );
        converted += 1;
      } else {
        skipped += 1;
      }

      await pool
        .request()
        .input('id', row.id)
        .input('imageUrl', nextImageUrl)
        .query(
          `UPDATE dbo.product_images
           SET image_url = @imageUrl
           WHERE id = @id`,
        );
    }

    console.log(
      `Product HEIC repair complete. Converted: ${converted}. Already converted: ${skipped}. Missing: ${missing}.`,
    );
  } finally {
    await pool.close();
  }
}

void main();
