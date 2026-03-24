import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import sql from 'mssql/msnodesqlv8';

async function createPool(database: string) {
  const config = new ConfigService();
  const server = config.get<string>('DB_SERVER', 'localhost');
  const instanceName = config.get<string>('DB_INSTANCE', '').trim();
  const trusted = config.get<string>('DB_TRUSTED_CONNECTION', 'true') === 'true';
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

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    throw new Error('Usage: npm run create-admin -- <email> <password>');
  }

  const config = new ConfigService();
  const databaseName = config.get<string>('DB_NAME', 'vishu');
  const masterPool = await createPool('master');
  await masterPool.query(
    `IF DB_ID('${databaseName.replace(/'/g, "''")}') IS NULL CREATE DATABASE [${databaseName.replace(/]/g, ']]')}]`,
  );
  await masterPool.close();

  const pool = await createPool(databaseName);
  await pool.query(`
    IF OBJECT_ID('dbo.users', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.users (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'vendor', 'customer')),
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      );
    END;
  `);

  const passwordHash = await bcrypt.hash(password, 10);
  const request = pool.request();
  request.input('email', email.toLowerCase());
  request.input('passwordHash', passwordHash);
  await request.query(`
    MERGE dbo.users AS target
    USING (SELECT @email AS email) AS source
      ON target.email = source.email
    WHEN MATCHED THEN
      UPDATE SET password_hash = @passwordHash, role = 'admin', is_active = 1, updated_at = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (email, password_hash, role, is_active)
      VALUES (@email, @passwordHash, 'admin', 1);
  `);

  await pool.close();
  console.log(`Admin user ready for ${email}`);
}

void main();
