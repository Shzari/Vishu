import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sql from 'mssql/msnodesqlv8';
import { SCHEMA_SQL } from './schema';

type QueryParams = unknown[];

export interface QueryRunner {
  query<T = Record<string, unknown>>(text: string, params?: QueryParams): Promise<{ rows: T[] }>;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy, QueryRunner {
  private readonly logger = new Logger(DatabaseService.name);
  private masterPool?: sql.ConnectionPool;
  private appPool?: sql.ConnectionPool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.masterPool = await this.createPool('master');
    await this.masterPool.query(
      `IF DB_ID('${this.getDatabaseName().replace(/'/g, "''")}') IS NULL CREATE DATABASE [${this.getDatabaseName().replace(/]/g, ']]')}]`,
    );

    this.appPool = await this.createPool(this.getDatabaseName());
    await this.query(SCHEMA_SQL);
    this.logger.log(`SQL Server database "${this.getDatabaseName()}" is ready`);
  }

  async onModuleDestroy() {
    await this.appPool?.close();
    await this.masterPool?.close();
  }

  async query<T = Record<string, unknown>>(text: string, params: QueryParams = []) {
    if (!this.appPool) {
      throw new Error('Database pool is not initialized');
    }

    return this.executeQuery<T>(this.appPool.request(), text, params);
  }

  async withTransaction<T>(callback: (client: QueryRunner) => Promise<T>): Promise<T> {
    if (!this.appPool) {
      throw new Error('Database pool is not initialized');
    }

    const transaction = new sql.Transaction(this.appPool);
    await transaction.begin();

    const runner: QueryRunner = {
      query: <TResult = Record<string, unknown>>(text: string, params: QueryParams = []) =>
        this.executeQuery<TResult>(transaction.request(), text, params),
    };

    try {
      const result = await callback(runner);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async createPool(database: string) {
    const server = this.configService.get<string>('DB_SERVER', 'localhost');
    const instanceName = this.configService.get<string>('DB_INSTANCE', '').trim();
    const trusted = this.configService.get<string>('DB_TRUSTED_CONNECTION', 'true') === 'true';
    const serverTarget = instanceName ? `${server}\\${instanceName}` : server;

    const connectionString = trusted
      ? `Driver={ODBC Driver 17 for SQL Server};Server=${serverTarget};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
      : `Driver={ODBC Driver 17 for SQL Server};Server=${serverTarget};Database=${database};Uid=${this.configService.get<string>('DB_USER', '')};Pwd=${this.configService.get<string>('DB_PASSWORD', '')};TrustServerCertificate=Yes;`;

    return new sql.ConnectionPool({
      connectionString,
      options: {
        trustServerCertificate: true,
      },
    }).connect();
  }

  private getDatabaseName() {
    return this.configService.get<string>('DB_NAME', 'vishu');
  }

  private async executeQuery<T>(
    request: sql.Request,
    text: string,
    params: QueryParams = [],
  ): Promise<{ rows: T[] }> {
    const normalizedText = text.replace(/\$(\d+)/g, (_match, index) => `@param${index}`);

    params.forEach((value, index) => {
      request.input(`param${index + 1}`, value as never);
    });

    const result = await request.query<T>(normalizedText);
    return {
      rows: result.recordset ?? [],
    };
  }
}
