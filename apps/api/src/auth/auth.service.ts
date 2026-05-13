import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import type { StringValue } from 'ms';
import { MailService } from '../mail/mail.service';
import { AuthenticatedUser } from '../common/types';
import {
  generateOpaqueToken,
  getJwtSecret,
  hashOpaqueToken,
  isAdminPortRequest,
} from '../common/security/security.utils';
import { DatabaseService } from '../database/database.service';
import { VendorAccessService } from '../vendor-access/vendor-access.service';
import {
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  ResendVendorLoginOtpDto,
  ResendVerificationDto,
  RegisterCustomerDto,
  RegisterVendorDto,
  VerifyCustomerRegistrationCodeDto,
  VerifyEmailDto,
  VerifyVendorLoginOtpDto,
} from './dto';

@Injectable()
export class AuthService {
  private static readonly CUSTOMER_REGISTRATION_OTP_MINUTES = 10;
  private static readonly VENDOR_LOGIN_OTP_SECONDS = 10 * 60;
  private static readonly PASSWORD_RESET_MINUTES = 20;
  private static readonly VENDOR_INACTIVITY_DISABLE_MONTHS = 6;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly vendorAccessService: VendorAccessService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName?.trim() || null;
    const lastName = dto.lastName?.trim() || null;
    const fullName = this.composeFullName(firstName, lastName, dto.fullName);
    const phoneNumber = dto.phoneNumber?.trim() || null;

    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required');
    }
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
      if (existingUser.role === 'customer' && !existingUser.email_verified_at) {
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const otp = this.generateCustomerRegistrationOtp();

        await this.databaseService.withTransaction(async (client) => {
          await client.query(
            `UPDATE users
             SET first_name = $1,
                 last_name = $2,
                 full_name = $3,
                 phone_number = COALESCE($4, phone_number),
                 password_hash = $5,
                 is_active = 1,
                 updated_at = SYSDATETIME()
             WHERE id = $6`,
            [
              firstName,
              lastName,
              fullName,
              phoneNumber,
              passwordHash,
              existingUser.id,
            ],
          );

          await client.query(
            `UPDATE customer_registration_verifications
             SET used_at = COALESCE(used_at, SYSDATETIME())
             WHERE user_id = $1
               AND used_at IS NULL`,
            [existingUser.id],
          );

          await client.query(
            `INSERT INTO customer_registration_verifications (
               user_id,
               code_hash,
               expires_at
             )
             VALUES ($1, $2, $3)`,
            [
              existingUser.id,
              hashOpaqueToken(otp),
              new Date(
                Date.now() +
                  1000 * 60 * AuthService.CUSTOMER_REGISTRATION_OTP_MINUTES,
              ),
            ],
          );
        });

        this.queueMailTask(
          () => this.mailService.sendCustomerRegistrationOtp({
            email,
            fullName,
            code: otp,
            expiresInMinutes: AuthService.CUSTOMER_REGISTRATION_OTP_MINUTES,
          }),
          `customer activation email for ${email}`,
        );

        return {
          email,
          message:
            'Customer account created. Enter the 6-digit verification code we sent to your email.',
        };
      }

      throw new BadRequestException(
        'An account already exists for this email. Sign in or reset your password instead.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const otp = this.generateCustomerRegistrationOtp();
    const createdUser = await this.databaseService.withTransaction(
      async (client) => {
        const result = await client.query<{
          id: string;
          email: string;
          role: 'customer';
        }>(
          `INSERT INTO users (email, first_name, last_name, full_name, phone_number, password_hash, role, email_verified_at)
           OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
           VALUES ($1, $2, $3, $4, $5, $6, 'customer', NULL)`,
          [email, firstName, lastName, fullName, phoneNumber, passwordHash],
        );

        await client.query(
          `INSERT INTO customer_registration_verifications (
             user_id,
             code_hash,
             expires_at
           )
           VALUES ($1, $2, $3)`,
          [
            result.rows[0].id,
            hashOpaqueToken(otp),
            new Date(
              Date.now() +
                1000 * 60 * AuthService.CUSTOMER_REGISTRATION_OTP_MINUTES,
            ),
          ],
        );

        return result.rows[0];
      },
    );

    this.queueMailTask(
      () => this.mailService.sendCustomerRegistrationOtp({
        email,
        fullName,
        code: otp,
        expiresInMinutes: AuthService.CUSTOMER_REGISTRATION_OTP_MINUTES,
      }),
      `customer activation email for ${email}`,
    );

    return {
      email: createdUser.email,
      message:
        'Customer account created. Enter the 6-digit verification code we sent to your email.',
    };
  }

  async registerVendor(dto: RegisterVendorDto) {
    const email = dto.email.trim().toLowerCase();
    const firstName = dto.firstName?.trim() || null;
    const lastName = dto.lastName?.trim() || null;
    const fullName = this.composeFullName(firstName, lastName, dto.fullName);
    const shopName = dto.shopName.trim();
    const phoneNumber = dto.phoneNumber?.trim() || null;

    if (!firstName || !lastName) {
      throw new BadRequestException('First name and last name are required');
    }
    if (dto.acceptedTerms !== true) {
      throw new BadRequestException(
        'Vendors must accept Vishu terms, marketplace policy, and refund policy.',
      );
    }
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
          `INSERT INTO users (email, first_name, last_name, full_name, phone_number, password_hash, role, email_verified_at)
         OUTPUT INSERTED.id, INSERTED.email, INSERTED.role
         VALUES ($1, $2, $3, $4, $5, $6, 'vendor', NULL)`,
          [email, firstName, lastName, fullName, phoneNumber, passwordHash],
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

    this.queueMailTask(
      () => this.mailService.sendVerificationEmail(vendorUser.email, token),
      `vendor verification email for ${vendorUser.email}`,
    );

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
          `UPDATE vendors
           SET is_verified = 1,
               is_active = CASE WHEN inactivity_disabled_at IS NULL THEN is_active ELSE 0 END,
               admin_status = CASE WHEN inactivity_disabled_at IS NULL THEN admin_status ELSE 'under_review' END,
               reactivation_requested_at = CASE WHEN inactivity_disabled_at IS NULL THEN reactivation_requested_at ELSE SYSDATETIME() END,
               updated_at = SYSDATETIME()
           WHERE user_id = $1`,
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
      try {
        await this.mailService.sendAdminVendorApprovalAlert(
          result.adminEmails,
          {
            shopName: result.shopName,
            vendorEmail: result.vendorEmail,
            reviewUrl: `${this.configService.get<string>('APP_BASE_URL', 'http://localhost:3001')}/admin/vendors/${result.vendorId}`,
          },
        );
      } catch (error) {
        this.logger.warn(
          `Vendor ${result.vendorId} verified, but admin approval alert email could not be sent: ${
            error instanceof Error ? error.message : 'Unknown mail error'
          }`,
        );
      }
    }

    return { message: result.message };
  }

  async verifyVendorEmail(dto: VerifyEmailDto) {
    return this.verifyEmail(dto);
  }

  async verifyCustomerRegistrationCode(
    dto: VerifyCustomerRegistrationCodeDto,
  ) {
    const email = dto.email.trim().toLowerCase();
    const code = dto.code.trim();

    await this.databaseService.withTransaction(async (client) => {
      const verification = await client.query<{
        id: string;
        user_id: string;
        email_verified_at: Date | null;
        code_hash: string;
        expires_at: Date;
      }>(
        `SELECT TOP 1
           crv.id,
           u.id AS user_id,
           u.email_verified_at,
           crv.code_hash,
           crv.expires_at
         FROM users u
         INNER JOIN customer_registration_verifications crv
           ON crv.user_id = u.id
         WHERE u.email = $1
           AND u.role = 'customer'
           AND crv.used_at IS NULL
         ORDER BY crv.created_at DESC`,
        [email],
      );

      const record = verification.rows[0];
      if (record?.email_verified_at) {
        return;
      }

      if (!record || new Date(record.expires_at) < new Date()) {
        throw new BadRequestException(
          'That verification code is invalid or expired. Request a new code.',
        );
      }

      if (record.code_hash !== hashOpaqueToken(code)) {
        throw new BadRequestException(
          'That verification code is invalid or expired. Request a new code.',
        );
      }

      await client.query(
        `UPDATE users
         SET email_verified_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE id = $1`,
        [record.user_id],
      );

      await client.query(
        `UPDATE customer_registration_verifications
         SET used_at = SYSDATETIME()
         WHERE id = $1`,
        [record.id],
      );
    });

    return { message: 'Email verified. You can now sign in.' };
  }

  async login(
    dto: LoginDto,
    request?: { headers?: Record<string, string | string[] | undefined> },
  ) {
    await this.disableInactiveVendors();

    const result = await this.databaseService.query<{
      id: string;
      email: string;
      role: 'admin' | 'vendor' | 'customer';
      password_hash: string;
      is_active: boolean;
      email_verified_at: Date | null;
      vendor_is_verified: boolean | null;
      vendor_id: string | null;
      vendor_is_active: boolean | null;
      vendor_is_test: boolean | null;
      vendor_inactivity_disabled_at: Date | null;
      full_name: string | null;
    }>(
      `SELECT TOP 1
         u.id,
         u.email,
         u.role,
         u.password_hash,
         u.is_active,
         u.email_verified_at,
         u.full_name,
         v.is_verified AS vendor_is_verified,
         v.id AS vendor_id,
         v.is_active AS vendor_is_active,
         v.is_test AS vendor_is_test,
         v.inactivity_disabled_at AS vendor_inactivity_disabled_at
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

    if (
      user.role === 'admin' &&
      !isAdminPortRequest(request ?? {}, this.configService)
    ) {
      throw new UnauthorizedException(
        'Admin login is only available through the admin port.',
      );
    }

    if (user.role === 'customer' && !user.email_verified_at) {
      throw new UnauthorizedException(
        'Verify your email with the 6-digit code we sent before signing in.',
      );
    }

    if (user.role === 'vendor') {
      if (
        user.vendor_id &&
        user.vendor_inactivity_disabled_at &&
        (user.vendor_is_active === false || user.vendor_is_verified === false)
      ) {
        await this.sendVendorReactivationVerification(user.id, user.email);
        return {
          requiresVendorReactivation: true,
          message:
            'This vendor account was disabled for inactivity. We sent a verification link to your email. Verify it, then wait for admin activation.',
        };
      }

      if (user.vendor_is_verified === false) {
        throw new UnauthorizedException('Verify your email before signing in');
      }

      await this.vendorAccessService.activatePendingInvitesForUser(
        user.id,
        user.email,
      );

      const vendorAccess =
        await this.vendorAccessService.getVendorAccessForUser(user.id);

      if (!vendorAccess && !user.vendor_is_verified) {
        throw new UnauthorizedException('Verify your email before signing in');
      }
    }

    if (user.role === 'vendor') {
      if (user.vendor_is_test === true) {
        await this.databaseService.query(
          `UPDATE vendors
           SET last_login_at = SYSDATETIME(),
               last_activity_at = SYSDATETIME(),
               updated_at = SYSDATETIME()
           WHERE user_id = $1`,
          [user.id],
        );
        return this.buildAuthResponse(user);
      }

      return this.createVendorLoginOtpChallenge(user);
    }

    return this.buildAuthResponse(user);
  }

  async verifyVendorLoginOtp(dto: VerifyVendorLoginOtpDto) {
    const code = dto.code.trim();
    const user = await this.databaseService.withTransaction(async (client) => {
      const verification = await client.query<{
        id: string;
        user_id: string;
        code_hash: string;
        expires_at: Date;
        used_at: Date | null;
        email: string;
        role: 'admin' | 'vendor' | 'customer';
        is_active: boolean;
        vendor_is_active: boolean | null;
        vendor_is_verified: boolean | null;
      }>(
        `SELECT TOP 1
           vlo.id,
           vlo.user_id,
           vlo.code_hash,
           vlo.expires_at,
           vlo.used_at,
           u.email,
           u.role,
           u.is_active,
           v.is_active AS vendor_is_active,
           v.is_verified AS vendor_is_verified
         FROM vendor_login_otps vlo
         INNER JOIN users u ON u.id = vlo.user_id
         LEFT JOIN vendors v ON v.user_id = u.id
         WHERE vlo.id = $1`,
        [dto.challengeId],
      );

      const record = verification.rows[0];
      if (
        !record ||
        record.used_at ||
        record.role !== 'vendor' ||
        new Date(record.expires_at) < new Date() ||
        record.code_hash !== hashOpaqueToken(code)
      ) {
        throw new BadRequestException(
          'That login code is invalid or expired. Request a new code.',
        );
      }

      if (!record.is_active) {
        throw new UnauthorizedException('User account is disabled');
      }
      if (!record.vendor_is_verified) {
        throw new UnauthorizedException(
          'Verify your email before signing in.',
        );
      }

      await client.query(
        `UPDATE vendor_login_otps
         SET used_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE id = $1`,
        [record.id],
      );

      await client.query(
        `UPDATE vendors
         SET last_login_at = SYSDATETIME(),
             last_activity_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE user_id = $1`,
        [record.user_id],
      );

      return {
        id: record.user_id,
        email: record.email,
        role: record.role,
      };
    });

    return this.buildAuthResponse(user);
  }

  async resendVendorLoginOtp(dto: ResendVendorLoginOtpDto) {
    const challenge = await this.databaseService.query<{
      id: string;
      user_id: string;
      email: string;
      full_name: string | null;
      role: 'admin' | 'vendor' | 'customer';
      is_active: boolean;
      vendor_is_active: boolean | null;
      vendor_is_verified: boolean | null;
    }>(
      `SELECT TOP 1
         vlo.id,
         vlo.user_id,
         u.email,
         u.full_name,
         u.role,
         u.is_active,
         v.is_active AS vendor_is_active,
         v.is_verified AS vendor_is_verified
       FROM vendor_login_otps vlo
       INNER JOIN users u ON u.id = vlo.user_id
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE vlo.id = $1`,
      [dto.challengeId],
    );

    const record = challenge.rows[0];
    if (
      !record ||
      record.role !== 'vendor' ||
      !record.is_active ||
      !record.vendor_is_verified
    ) {
      throw new BadRequestException('Start vendor login again.');
    }

    const code = this.generateOtp();
    await this.databaseService.query(
      `UPDATE vendor_login_otps
       SET code_hash = $1,
           expires_at = $2,
           used_at = NULL,
           updated_at = SYSDATETIME()
       WHERE id = $3`,
      [
        hashOpaqueToken(code),
        new Date(
          Date.now() + 1000 * AuthService.VENDOR_LOGIN_OTP_SECONDS,
        ),
        record.id,
      ],
    );

    this.queueMailTask(
      () => this.mailService.sendVendorLoginOtp({
        email: record.email,
        fullName: record.full_name,
        code,
        expiresInSeconds: AuthService.VENDOR_LOGIN_OTP_SECONDS,
      }),
      `vendor login OTP for ${record.email}`,
    );

    return {
      message: 'We sent a new vendor login code.',
      expiresInSeconds: AuthService.VENDOR_LOGIN_OTP_SECONDS,
    };
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
    if (!user || user.role === 'admin') {
      return {
        message:
          'If the account exists and still needs verification, a new email has been sent.',
      };
    }

    if (user.role === 'customer') {
      if (user.email_verified_at) {
        return {
          message:
            'If the account exists and still needs verification, a new email has been sent.',
        };
      }

      const otp = this.generateCustomerRegistrationOtp();
      await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `UPDATE customer_registration_verifications
           SET used_at = COALESCE(used_at, SYSDATETIME())
           WHERE user_id = $1
             AND used_at IS NULL`,
          [user.id],
        );

        await client.query(
          `INSERT INTO customer_registration_verifications (
             user_id,
             code_hash,
             expires_at
           )
           VALUES ($1, $2, $3)`,
          [
            user.id,
            hashOpaqueToken(otp),
            new Date(
              Date.now() +
                1000 * 60 * AuthService.CUSTOMER_REGISTRATION_OTP_MINUTES,
            ),
          ],
        );
      });

      this.queueMailTask(
        () => this.mailService.sendCustomerRegistrationOtp({
          email: user.email,
          code: otp,
          expiresInMinutes: AuthService.CUSTOMER_REGISTRATION_OTP_MINUTES,
        }),
        `customer registration verification code for ${user.email}`,
      );

      return {
        message:
          'If the account exists and still needs verification, a new email has been sent.',
      };
    }

    if (user.vendor_is_verified) {
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

    this.queueMailTask(
      () => this.mailService.sendVerificationEmail(user.email, token, 'vendor'),
      `verification email for ${user.email}`,
    );

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
    const expiresAt = new Date(
      Date.now() + 1000 * 60 * AuthService.PASSWORD_RESET_MINUTES,
    );

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE password_resets
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.id],
      );
      await client.query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, hashOpaqueToken(token), expiresAt],
      );
    });

    this.queueMailTask(
      () => this.mailService.sendPasswordResetEmail(user.email, token),
      `password reset email for ${user.email}`,
    );
    return { message: 'If the account exists, a reset email has been sent.' };
  }

  async resetPassword(dto: PasswordResetConfirmDto) {
    const hashedToken = hashOpaqueToken(dto.token);
    const resetUser = await this.databaseService.withTransaction(async (client) => {
      const reset = await client.query<{
        user_id: string;
      }>(
        `UPDATE password_resets
         SET used_at = SYSDATETIME()
         OUTPUT inserted.user_id
         WHERE token IN ($1, $2)
           AND used_at IS NULL
           AND expires_at >= SYSDATETIME()`,
        [dto.token, hashedToken],
      );

      const record = reset.rows[0];
      if (!record) {
        throw new BadRequestException('This link has expired');
      }

      const passwordHash = await bcrypt.hash(dto.newPassword, 10);
      const updatedUser = await client.query<{
        id: string;
        email: string;
        role: 'admin' | 'vendor' | 'customer';
        is_active: boolean;
      }>(
        `UPDATE users
         SET password_hash = $1,
             email_verified_at = CASE
               WHEN role = 'customer' THEN ISNULL(email_verified_at, SYSDATETIME())
               ELSE email_verified_at
             END,
             updated_at = SYSDATETIME()
         OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.is_active
         WHERE id = $2`,
        [passwordHash, record.user_id],
      );

      return updatedUser.rows[0];
    });

    if (!resetUser?.is_active) {
      throw new UnauthorizedException('User account is disabled');
    }

    return {
      message: 'Password updated successfully.',
      ...this.buildAuthResponse(resetUser),
    };
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
    const expiresAt = new Date(
      Date.now() + 1000 * 60 * AuthService.PASSWORD_RESET_MINUTES,
    );
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE password_resets
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.id],
      );
      await client.query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, hashOpaqueToken(token), expiresAt],
      );
    });

    this.queueMailTask(
      () => this.mailService.sendPasswordResetEmail(user.email, token),
      `admin password reset email for ${user.email}`,
    );
    return { message: 'Password reset email sent.' };
  }

  async getProfile(user: AuthenticatedUser) {
    const base = await this.databaseService.query<{
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      role: 'admin' | 'vendor' | 'customer';
      is_active: boolean;
      phone_number: string | null;
      email_verified_at: Date | null;
    }>(
      'SELECT TOP 1 id, email, first_name, last_name, full_name, role, is_active, phone_number, email_verified_at FROM users WHERE id = $1',
      [user.sub],
    );

    const profile = base.rows[0];
    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    if (profile.role !== 'vendor') {
      return {
        ...profile,
        firstName: profile.first_name,
        lastName: profile.last_name,
        fullName: profile.full_name,
        phoneNumber: profile.phone_number,
        emailVerifiedAt: profile.email_verified_at,
      };
    }

    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
      logo_url: string | null;
      is_active: boolean;
      is_verified: boolean;
      approved_at: Date | null;
      access_role: 'shop_holder' | 'manager' | 'employee';
      is_primary_owner: boolean;
    }>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.logo_url,
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
      firstName: profile.first_name,
      lastName: profile.last_name,
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
    role: AuthenticatedUser['role'];
  }) {
    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const expiresIn = this.configService.get<StringValue>(
      'JWT_EXPIRES_IN',
      '7d' as StringValue,
    );

    return {
      accessToken: this.jwtService.sign(payload, {
        secret: getJwtSecret(this.configService),
        expiresIn,
      }),
      user: payload,
    };
  }

  private async createVendorLoginOtpChallenge(user: {
    id: string;
    email: string;
    full_name?: string | null;
  }) {
    const code = this.generateOtp();
    const challenge = await this.databaseService.withTransaction(
      async (client) => {
        await client.query(
          `UPDATE vendor_login_otps
           SET used_at = COALESCE(used_at, SYSDATETIME()),
               updated_at = SYSDATETIME()
           WHERE user_id = $1
             AND used_at IS NULL`,
          [user.id],
        );

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO vendor_login_otps (user_id, code_hash, expires_at)
           OUTPUT INSERTED.id
           VALUES ($1, $2, $3)`,
          [
            user.id,
            hashOpaqueToken(code),
            new Date(
              Date.now() + 1000 * AuthService.VENDOR_LOGIN_OTP_SECONDS,
            ),
          ],
        );

        return inserted.rows[0];
      },
    );

    this.queueMailTask(
      () => this.mailService.sendVendorLoginOtp({
        email: user.email,
        fullName: user.full_name ?? null,
        code,
        expiresInSeconds: AuthService.VENDOR_LOGIN_OTP_SECONDS,
      }),
      `vendor login OTP for ${user.email}`,
    );

    return {
      requiresVendorOtp: true,
      challengeId: challenge.id,
      expiresInSeconds: AuthService.VENDOR_LOGIN_OTP_SECONDS,
      message: 'We sent a 6-digit login code to your email.',
    };
  }

  private async disableInactiveVendors() {
    await this.databaseService.query(
      `UPDATE vendors
       SET is_active = 0,
           is_verified = 0,
           admin_status = 'under_review',
           inactivity_disabled_at = COALESCE(inactivity_disabled_at, SYSDATETIME()),
           updated_at = SYSDATETIME()
       WHERE is_active = 1
         AND COALESCE(last_activity_at, last_login_at, updated_at, created_at) < DATEADD(MONTH, -${AuthService.VENDOR_INACTIVITY_DISABLE_MONTHS}, SYSDATETIME())`,
    );
  }

  private async sendVendorReactivationVerification(
    userId: string,
    email: string,
  ) {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE email_verifications
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [userId],
      );

      await client.query(
        `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, hashOpaqueToken(token), expiresAt],
      );
    });

    this.queueMailTask(
      () => this.mailService.sendVerificationEmail(email, token),
      `vendor reactivation verification email for ${email}`,
    );
  }

  private generateCustomerRegistrationOtp() {
    return this.generateOtp();
  }

  private generateOtp() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private composeFullName(
    firstName?: string | null,
    lastName?: string | null,
    fallbackFullName?: string | null,
  ) {
    const combined = [firstName, lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');

    return combined || fallbackFullName?.trim() || null;
  }

  private queueMailTask(taskFactory: () => Promise<unknown>, label: string) {
    setImmediate(() => {
      void taskFactory().catch((error: unknown) => {
        this.logger.warn(
          `${label} could not be sent immediately: ${
            error instanceof Error ? error.message : 'Unknown mail error'
          }`,
        );
      });
    });
  }

}
