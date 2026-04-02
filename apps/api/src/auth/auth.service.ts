import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { AuthenticatedUser } from '../common/types';
import {
  generateOpaqueToken,
  getJwtSecret,
  hashOpaqueToken,
} from '../common/security/security.utils';
import { DatabaseService } from '../database/database.service';
import { VendorAccessService } from '../vendor-access/vendor-access.service';
import {
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  ResendVerificationDto,
  RegisterCustomerDto,
  RegisterVendorDto,
  VerifyEmailDto,
} from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly vendorAccessService: VendorAccessService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName?.trim() || null;
    const phoneNumber = dto.phoneNumber?.trim() || null;
    const existing = await this.databaseService.query<{
      id: string;
      role: 'admin' | 'vendor' | 'customer';
      email_verified_at: Date | null;
    }>(
      `SELECT TOP 1 id, role, email_verified_at
       FROM users
       WHERE email = $1`,
      [email],
    );

    if (existing.rows[0]) {
      const existingUser = existing.rows[0];
      if (
        existingUser.role === 'customer' &&
        !existingUser.email_verified_at
      ) {
        throw new BadRequestException(
          'An account already exists for this email from a recent purchase. Activate it from your email or use reset password to finish setup.',
        );
      }

      throw new BadRequestException(
        'An account already exists for this email. Sign in or reset your password instead.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      role: 'customer';
    }>(
      `INSERT INTO users (email, full_name, phone_number, password_hash, role, email_verified_at)
       OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
       VALUES ($1, $2, $3, $4, 'customer', NULL)`,
      [email, fullName, phoneNumber, passwordHash],
    );

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.databaseService.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [result.rows[0].id, hashOpaqueToken(token), expiresAt],
    );

    await this.mailService.sendCustomerActivationEmail({
      email,
      fullName,
      token,
    });

    return {
      message:
        'Customer account created. Check your email to activate it and set your password.',
    };
  }

  async registerVendor(dto: RegisterVendorDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName?.trim() || null;
    const shopName = dto.shopName.trim();
    const phoneNumber = dto.phoneNumber?.trim() || null;
    await this.ensureEmailAvailable(email);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const vendorUser = await this.databaseService.withTransaction(
      async (client) => {
        const createdUser = await client.query<{
          id: string;
          email: string;
          role: string;
        }>(
          `INSERT INTO users (email, full_name, phone_number, password_hash, role, email_verified_at)
         OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
         VALUES ($1, $2, $3, $4, 'vendor', NULL)`,
          [email, fullName, phoneNumber, passwordHash],
        );

        await client.query(
          `INSERT INTO vendors (user_id, shop_name, is_active, is_verified)
         VALUES ($1, $2, 0, 0)`,
          [createdUser.rows[0].id, shopName],
        );

        await client.query(
          `INSERT INTO vendor_team_members (vendor_id, user_id, role, status, invited_by_user_id, joined_at)
           SELECT TOP 1 id, $1, 'shop_holder', 'active', $1, SYSDATETIME()
           FROM vendors
           WHERE user_id = $1`,
          [createdUser.rows[0].id],
        );

        await client.query(
          `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
          [createdUser.rows[0].id, hashOpaqueToken(token), expiresAt],
        );

        return createdUser.rows[0];
      },
    );

    await this.mailService.sendVerificationEmail(vendorUser.email, token);

    return {
      message:
        'Vendor account created. Verify your email and wait for admin approval.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const hashedToken = hashOpaqueToken(dto.token);
    const result = await this.databaseService.withTransaction(
      async (client) => {
        const verification = await client.query<{
          id: string;
          user_id: string;
          expires_at: Date;
          used_at: Date | null;
          role: 'vendor' | 'customer';
          email: string;
        }>(
          `SELECT ev.id, ev.user_id, ev.expires_at, ev.used_at, u.role, u.email
         FROM email_verifications ev
         INNER JOIN users u ON u.id = ev.user_id
         WHERE token IN ($1, $2)`,
          [dto.token, hashedToken],
        );

        const record = verification.rows[0];
        if (
          !record ||
          record.used_at ||
          new Date(record.expires_at) < new Date()
        ) {
          throw new BadRequestException(
            'Invalid or expired verification token',
          );
        }

        await client.query(
          'UPDATE email_verifications SET used_at = SYSDATETIME() WHERE id = $1',
          [record.id],
        );
        await client.query(
          'UPDATE users SET email_verified_at = ISNULL(email_verified_at, SYSDATETIME()), updated_at = SYSDATETIME() WHERE id = $1',
          [record.user_id],
        );

        if (record.role === 'customer') {
          return {
            role: record.role,
            message: 'Email verified. You can now sign in.',
            adminEmails: [] as string[],
            vendorId: null as string | null,
            shopName: '',
            vendorEmail: record.email,
          };
        }

        await client.query(
          'UPDATE vendors SET is_verified = 1, updated_at = SYSDATETIME() WHERE user_id = $1',
          [record.user_id],
        );

        const vendor = await client.query<{
          id: string;
          shop_name: string;
          email: string;
        }>(
          `SELECT TOP 1 v.id, v.shop_name, u.email
         FROM vendors v
         INNER JOIN users u ON u.id = v.user_id
         WHERE v.user_id = $1`,
          [record.user_id],
        );

        const vendorRecord = vendor.rows[0];
        const admins = await client.query<{
          id: string;
          email: string;
        }>(
          `SELECT id, email
         FROM users
         WHERE role = 'admin'
           AND is_active = 1`,
        );

        if (vendorRecord) {
          for (const admin of admins.rows) {
            await client.query(
              `INSERT INTO admin_notifications (
               admin_user_id,
               vendor_id,
               notification_type,
               title,
               body,
               action_url
             )
             VALUES ($1, $2, 'vendor_pending_approval', $3, $4, $5)`,
              [
                admin.id,
                vendorRecord.id,
                'Vendor waiting for approval',
                `${vendorRecord.shop_name} has verified their email and is waiting for approval.`,
                `/admin/vendors/${vendorRecord.id}`,
              ],
            );
          }
        }

        return {
          role: record.role,
          message: 'Email verified. Awaiting admin approval.',
          adminEmails: admins.rows.map((admin) => admin.email),
          vendorId: vendorRecord?.id ?? null,
          shopName: vendorRecord?.shop_name ?? 'Vendor shop',
          vendorEmail: vendorRecord?.email ?? '',
        };
      },
    );

    if (result.vendorId) {
      await this.mailService.sendAdminVendorApprovalAlert(result.adminEmails, {
        shopName: result.shopName,
        vendorEmail: result.vendorEmail,
        reviewUrl: `${this.configService.get<string>('APP_BASE_URL', 'http://localhost:3001')}/admin/vendors/${result.vendorId}`,
      });
    }

    return { message: result.message };
  }

  async verifyVendorEmail(dto: VerifyEmailDto) {
    return this.verifyEmail(dto);
  }

  async login(dto: LoginDto) {
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      role: 'admin' | 'vendor' | 'customer';
      password_hash: string;
      is_active: boolean;
      email_verified_at: Date | null;
      vendor_is_verified: boolean | null;
    }>(
      `SELECT TOP 1
         u.id,
         u.email,
         u.role,
         u.password_hash,
         u.is_active,
         u.email_verified_at,
         v.is_verified AS vendor_is_verified
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE u.email = $1`,
      [dto.email.toLowerCase()],
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('User account is disabled');
    }

    if (user.role === 'customer' && !user.email_verified_at) {
      throw new UnauthorizedException(
        'Activate your account from the email we sent you, or use reset password to finish setup.',
      );
    }

    if (user.role === 'vendor') {
      await this.vendorAccessService.activatePendingInvitesForUser(
        user.id,
        user.email,
      );

      const vendorAccess = await this.vendorAccessService.getVendorAccessForUser(
        user.id,
      );

      if (!vendorAccess && !user.vendor_is_verified) {
        throw new UnauthorizedException('Verify your email before signing in');
      }
    }

    return this.buildAuthResponse(user);
  }

  async resendVerificationEmail(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      role: 'admin' | 'vendor' | 'customer';
      email_verified_at: Date | null;
      vendor_is_verified: boolean | null;
    }>(
      `SELECT TOP 1
         u.id,
         u.email,
         u.role,
         u.email_verified_at,
         v.is_verified AS vendor_is_verified
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE u.email = $1`,
      [email],
    );

    const user = result.rows[0];
    if (
      !user ||
      user.role === 'admin' ||
      user.role === 'customer' ||
      user.vendor_is_verified
    ) {
      return {
        message:
          'If the account exists and still needs verification, a new email has been sent.',
      };
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE email_verifications
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.id],
      );

      await client.query(
        `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, hashOpaqueToken(token), expiresAt],
      );
    });

    await this.mailService.sendVerificationEmail(user.email, token, user.role);

    return {
      message:
        'If the account exists and still needs verification, a new email has been sent.',
    };
  }

  async requestPasswordReset(dto: PasswordResetRequestDto) {
    const result = await this.databaseService.query<{
      id: string;
      email: string;
    }>('SELECT TOP 1 id, email FROM users WHERE email = $1', [
      dto.email.toLowerCase(),
    ]);

    const user = result.rows[0];
    if (!user) {
      return { message: 'If the account exists, a reset email has been sent.' };
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.databaseService.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashOpaqueToken(token), expiresAt],
    );

    await this.mailService.sendPasswordResetEmail(user.email, token);
    return { message: 'If the account exists, a reset email has been sent.' };
  }

  async resetPassword(dto: PasswordResetConfirmDto) {
    const hashedToken = hashOpaqueToken(dto.token);
    await this.databaseService.withTransaction(async (client) => {
      const reset = await client.query<{
        id: string;
        user_id: string;
        expires_at: Date;
        used_at: Date | null;
      }>(
        `SELECT id, user_id, expires_at, used_at
         FROM password_resets
         WHERE token IN ($1, $2)`,
        [dto.token, hashedToken],
      );

      const record = reset.rows[0];
      if (
        !record ||
        record.used_at ||
        new Date(record.expires_at) < new Date()
      ) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(dto.newPassword, 10);
      await client.query(
        `UPDATE users
         SET password_hash = $1,
             email_verified_at = CASE
               WHEN role = 'customer' THEN ISNULL(email_verified_at, SYSDATETIME())
               ELSE email_verified_at
             END,
             updated_at = SYSDATETIME()
         WHERE id = $2`,
        [passwordHash, record.user_id],
      );
      await client.query(
        'UPDATE password_resets SET used_at = SYSDATETIME() WHERE id = $1',
        [record.id],
      );
    });

    return { message: 'Password updated successfully.' };
  }

  async issueAdminPasswordReset(userId: string) {
    const result = await this.databaseService.query<{
      id: string;
      email: string;
    }>('SELECT TOP 1 id, email FROM users WHERE id = $1', [userId]);

    const user = result.rows[0];
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await this.databaseService.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashOpaqueToken(token), expiresAt],
    );

    await this.mailService.sendPasswordResetEmail(user.email, token);
    return { message: 'Password reset email sent.' };
  }

  async getProfile(user: AuthenticatedUser) {
    const base = await this.databaseService.query<{
      id: string;
      email: string;
      full_name: string | null;
      role: 'admin' | 'vendor' | 'customer';
      is_active: boolean;
      phone_number: string | null;
      email_verified_at: Date | null;
    }>(
      'SELECT TOP 1 id, email, full_name, role, is_active, phone_number, email_verified_at FROM users WHERE id = $1',
      [user.sub],
    );

    const profile = base.rows[0];
    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    if (profile.role !== 'vendor') {
      return {
        ...profile,
        fullName: profile.full_name,
        phoneNumber: profile.phone_number,
        emailVerifiedAt: profile.email_verified_at,
      };
    }

    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
      is_active: boolean;
      is_verified: boolean;
      approved_at: Date | null;
      access_role: 'shop_holder' | 'employee';
      is_primary_owner: boolean;
    }>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.is_active,
         v.is_verified,
         v.approved_at,
         CASE
           WHEN v.user_id = $1 THEN 'shop_holder'
           ELSE tm.role
         END AS access_role,
         CASE
           WHEN v.user_id = $1 THEN CAST(1 AS BIT)
           ELSE CAST(0 AS BIT)
         END AS is_primary_owner
       FROM vendors v
       LEFT JOIN vendor_team_members tm
         ON tm.vendor_id = v.id
        AND tm.user_id = $1
        AND tm.status = 'active'
       WHERE v.user_id = $1
          OR tm.id IS NOT NULL
       ORDER BY CASE WHEN v.user_id = $1 THEN 0 ELSE 1 END`,
      [user.sub],
    );

    return {
      ...profile,
      fullName: profile.full_name,
      phoneNumber: profile.phone_number,
      emailVerifiedAt: profile.email_verified_at,
      vendor: vendor.rows[0] ?? null,
    };
  }

  private async ensureEmailAvailable(email: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (result.rows[0]) {
      throw new BadRequestException('Email is already in use');
    }
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    role: 'admin' | 'vendor' | 'customer' | string;
  }) {
    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role as AuthenticatedUser['role'],
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: getJwtSecret(this.configService),
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRES_IN',
          '7d',
        ) as any,
      }),
      user: payload,
    };
  }
}
