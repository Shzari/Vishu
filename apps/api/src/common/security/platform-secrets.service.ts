import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import {
  isStoredSecretProtected,
  protectStoredSecret,
} from './stored-secrets.utils';

@Injectable()
export class PlatformSecretsService {
  private readonly logger = new Logger(PlatformSecretsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  async migrateStoredPlatformSecrets() {
    const result = await this.databaseService.query<{
      smtp_pass: string | null;
      stripe_test_secret_key: string | null;
      stripe_test_webhook_signing_secret: string | null;
      stripe_live_secret_key: string | null;
      stripe_live_webhook_signing_secret: string | null;
    }>(
      `SELECT TOP 1
         smtp_pass,
         stripe_test_secret_key,
         stripe_test_webhook_signing_secret,
         stripe_live_secret_key,
         stripe_live_webhook_signing_secret
       FROM platform_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    if (!row) {
      return;
    }

    const updates: string[] = [];
    const values: string[] = [];
    const migratedColumns: string[] = [];
    const protectIfNeeded = (
      column:
        | 'smtp_pass'
        | 'stripe_test_secret_key'
        | 'stripe_test_webhook_signing_secret'
        | 'stripe_live_secret_key'
        | 'stripe_live_webhook_signing_secret',
      value: string | null,
    ) => {
      if (!value?.trim() || isStoredSecretProtected(value)) {
        return;
      }

      values.push(protectStoredSecret(value, this.configService)!);
      updates.push(`${column} = $${values.length}`);
      migratedColumns.push(column);
    };

    protectIfNeeded('smtp_pass', row.smtp_pass);
    protectIfNeeded('stripe_test_secret_key', row.stripe_test_secret_key);
    protectIfNeeded(
      'stripe_test_webhook_signing_secret',
      row.stripe_test_webhook_signing_secret,
    );
    protectIfNeeded('stripe_live_secret_key', row.stripe_live_secret_key);
    protectIfNeeded(
      'stripe_live_webhook_signing_secret',
      row.stripe_live_webhook_signing_secret,
    );

    if (!updates.length) {
      return;
    }

    const statementValues = [...values, 1];
    await this.databaseService.query(
      `UPDATE platform_settings
       SET ${updates.join(', ')},
           updated_at = SYSDATETIME()
       WHERE id = $${statementValues.length}`,
      statementValues,
    );

    this.logger.log(
      `Migrated plaintext platform secrets to encrypted storage for: ${migratedColumns.join(', ')}`,
    );
  }
}
