import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { VendorAccessService } from '../vendor-access/vendor-access.service';
import {
  ChangePasswordDto,
  CreateVendorTeamInviteDto,
  CreatePaymentMethodDto,
  UpdateAccountProfileDto,
  UpdatePaymentMethodDto,
  UpdateVendorTeamMemberRoleDto,
  UpdateVendorBankDetailsDto,
  UpdateVendorProfileDto,
  UpsertAddressDto,
} from './dto';

const VENDOR_SUBSCRIPTION_PRICES = {
  monthly: 29,
  yearly: 290,
} as const;

@Injectable()
export class AccountService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: MailService,
    private readonly vendorAccessService: VendorAccessService,
  ) {}

  async getSettings(userId: string) {
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      full_name: string | null;
      phone_number: string | null;
      role: string;
      email_verified_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT TOP 1 id, email, full_name, phone_number, role, email_verified_at, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const vendorAccess =
      user.role === 'vendor'
        ? await this.vendorAccessService.getVendorAccessForUser(userId)
        : null;

    const [vendorDetails, vendorSubscriptionHistory] = vendorAccess
      ? await Promise.all([
          this.databaseService.query<{
            id: string;
            shop_name: string;
            is_active: boolean;
            is_verified: boolean;
            support_email: string | null;
            support_phone: string | null;
            shop_description: string | null;
            logo_url: string | null;
            banner_url: string | null;
            business_address: string | null;
            return_policy: string | null;
            business_hours: string | null;
            shipping_notes: string | null;
            low_stock_threshold: number;
            subscription_plan: 'monthly' | 'yearly' | null;
            subscription_status: 'inactive' | 'active' | 'expired';
            subscription_started_at: Date | null;
            subscription_ends_at: Date | null;
            subscription_override_plan: 'monthly' | 'yearly' | null;
            subscription_override_status: 'active' | 'expired' | null;
            subscription_override_started_at: Date | null;
            subscription_override_ends_at: Date | null;
            subscription_override_note: string | null;
            subscription_override_updated_at: Date | null;
            bank_account_name: string | null;
            bank_name: string | null;
            bank_iban: string | null;
            pending_balance: number | string;
            shipped_balance: number | string;
            total_earnings: number | string;
            paid_out: number | string;
            outstanding_shipped_balance: number | string;
          }>(
            `SELECT TOP 1
             v.id,
             v.shop_name,
             v.is_active,
             v.is_verified,
             v.support_email,
             v.support_phone,
             v.shop_description,
             v.logo_url,
             v.banner_url,
             v.business_address,
             v.return_policy,
             v.business_hours,
             v.shipping_notes,
             v.low_stock_threshold,
             v.subscription_plan,
             v.subscription_status,
             v.subscription_started_at,
             v.subscription_ends_at,
             v.subscription_override_plan,
             v.subscription_override_status,
             v.subscription_override_started_at,
             v.subscription_override_ends_at,
             v.subscription_override_note,
             v.subscription_override_updated_at,
             v.bank_account_name,
             v.bank_name,
             v.bank_iban,
             ISNULL((SELECT SUM(vendor_earnings) FROM order_items WHERE vendor_id = v.id AND status IN ('pending', 'confirmed')), 0) AS pending_balance,
             ISNULL((
               SELECT SUM(oi.vendor_earnings)
               FROM order_items oi
               INNER JOIN orders o ON o.id = oi.order_id
               WHERE oi.vendor_id = v.id
                 AND oi.status = 'delivered'
                 AND (o.payment_method = 'card' OR o.payment_status = 'cod_collected')
             ), 0) AS shipped_balance,
             ISNULL((SELECT SUM(vendor_earnings) FROM order_items WHERE vendor_id = v.id), 0) AS total_earnings,
             ISNULL((SELECT SUM(amount) FROM vendor_payouts WHERE vendor_id = v.id), 0) AS paid_out,
             ISNULL((
               SELECT SUM(oi.vendor_earnings)
               FROM order_items oi
               INNER JOIN orders o ON o.id = oi.order_id
               WHERE oi.vendor_id = v.id
                 AND oi.status = 'delivered'
                 AND (o.payment_method = 'card' OR o.payment_status = 'cod_collected')
             ), 0)
               - ISNULL((SELECT SUM(amount) FROM vendor_payouts WHERE vendor_id = v.id), 0) AS outstanding_shipped_balance
           FROM vendors v
           WHERE v.id = $1`,
            [vendorAccess.id],
          ),
          this.databaseService.query<{
            id: string;
            plan_type: 'monthly' | 'yearly';
            status: 'active' | 'expired';
            amount: number | string;
            admin_note: string | null;
            admin_email: string | null;
            starts_at: Date;
            ends_at: Date;
            created_at: Date;
          }>(
            `SELECT TOP 6
             s.id,
             s.plan_type,
             s.status,
             s.amount,
             s.admin_note,
             u.email AS admin_email,
             s.starts_at,
             s.ends_at,
             s.created_at
           FROM vendor_subscriptions s
           LEFT JOIN users u ON u.id = s.admin_user_id
           WHERE s.vendor_id = $1
           ORDER BY s.created_at DESC`,
            [vendorAccess.id],
          ),
        ])
      : [{ rows: [] }, { rows: [] }];

    const canViewFinance = vendorAccess?.access_role === 'shop_holder';
    const canManageSettings = vendorAccess?.access_role === 'shop_holder';

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      emailVerifiedAt: user.email_verified_at,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      vendor:
        user.role === 'vendor' && vendorDetails.rows[0] && vendorAccess
          ? {
              id: vendorDetails.rows[0].id,
              shopName: vendorDetails.rows[0].shop_name,
              isActive: vendorDetails.rows[0].is_active,
              isVerified: vendorDetails.rows[0].is_verified,
              accessRole: vendorAccess.access_role,
              isPrimaryOwner: vendorAccess.is_primary_owner,
              canManageSettings,
              canManageTeam: vendorAccess.access_role === 'shop_holder',
              canViewFinance,
              supportEmail: vendorDetails.rows[0].support_email,
              supportPhone: vendorDetails.rows[0].support_phone,
              shopDescription: vendorDetails.rows[0].shop_description,
              logoUrl: vendorDetails.rows[0].logo_url,
              bannerUrl: vendorDetails.rows[0].banner_url,
              businessAddress: vendorDetails.rows[0].business_address,
              returnPolicy: vendorDetails.rows[0].return_policy,
              businessHours: vendorDetails.rows[0].business_hours,
              shippingNotes: vendorDetails.rows[0].shipping_notes,
              lowStockThreshold: vendorDetails.rows[0].low_stock_threshold,
              subscription: {
                ...this.resolveEffectiveSubscription(vendorDetails.rows[0]),
                monthlyPrice: VENDOR_SUBSCRIPTION_PRICES.monthly,
                yearlyPrice: VENDOR_SUBSCRIPTION_PRICES.yearly,
              },
              automaticSubscription: this.resolveAutomaticSubscription(
                vendorDetails.rows[0],
              ),
              manualOverride: this.resolveManualOverride(vendorDetails.rows[0]),
              subscriptionHistory: vendorSubscriptionHistory.rows.map(
                (entry) => ({
                  id: entry.id,
                  planType: entry.plan_type,
                  status:
                    entry.status === 'active' && entry.ends_at < new Date()
                      ? 'expired'
                      : entry.status,
                  amount: Number(entry.amount),
                  adminNote: entry.admin_note,
                  adminEmail: entry.admin_email,
                  startsAt: entry.starts_at,
                  endsAt: entry.ends_at,
                  createdAt: entry.created_at,
                }),
              ),
              bankAccountName: canViewFinance
                ? vendorDetails.rows[0].bank_account_name
                : null,
              bankName: canViewFinance ? vendorDetails.rows[0].bank_name : null,
              bankIban: canViewFinance ? vendorDetails.rows[0].bank_iban : null,
              payoutSummary: canViewFinance
                ? {
                    pendingBalance: Number(vendorDetails.rows[0].pending_balance),
                    shippedBalance: Number(vendorDetails.rows[0].shipped_balance),
                    totalEarnings: Number(vendorDetails.rows[0].total_earnings),
                    paidOut: Number(vendorDetails.rows[0].paid_out),
                    outstandingShippedBalance: Math.max(
                      0,
                      Number(vendorDetails.rows[0].outstanding_shipped_balance),
                    ),
                  }
                : {
                    pendingBalance: 0,
                    shippedBalance: 0,
                    totalEarnings: 0,
                    paidOut: 0,
                    outstandingShippedBalance: 0,
                  },
            }
          : null,
    };
  }

  async getAccount(userId: string) {
    const [profile, addresses, paymentMethods, recentOrders, cartItems, claimableGuestOrders] =
      await Promise.all([
        this.databaseService.query<{
          id: string;
          email: string;
          full_name: string | null;
          phone_number: string | null;
          email_verified_at: Date | null;
          created_at: Date;
          updated_at: Date;
        }>(
          `SELECT TOP 1 id, email, full_name, phone_number, email_verified_at, created_at, updated_at
         FROM users
         WHERE id = $1`,
          [userId],
        ),
        this.databaseService.query<{
          id: string;
          label: string;
          full_name: string;
          phone_number: string | null;
          line1: string;
          line2: string | null;
          city: string;
          state_region: string | null;
          postal_code: string;
          country: string;
          is_default: boolean;
        }>(
          `SELECT id, label, full_name, phone_number, line1, line2, city, state_region, postal_code, country, is_default
         FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
          [userId],
        ),
        this.databaseService.query<{
          id: string;
          nickname: string | null;
          cardholder_name: string;
          brand: string;
          last4: string;
          exp_month: number;
          exp_year: number;
          is_default: boolean;
        }>(
          `SELECT id, nickname, cardholder_name, brand, last4, exp_month, exp_year, is_default
         FROM customer_payment_methods
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
          [userId],
        ),
        this.databaseService.query<{
          id: string;
          total_price: number;
          special_request: string | null;
          status: string;
          created_at: Date;
        }>(
          `SELECT TOP 5 id, total_price, special_request, status, created_at
         FROM orders
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
          [userId],
        ),
        this.databaseService.query<{
          product_id: string;
          quantity: number;
          updated_at: Date;
          title: string;
          price: number;
          category: string;
          image_url: string | null;
        }>(
          `SELECT ci.product_id, ci.quantity, ci.updated_at, p.title, p.price, p.category, pi.image_url
         FROM carts c
         INNER JOIN cart_items ci ON ci.cart_id = c.id
         INNER JOIN products p ON p.id = ci.product_id
         OUTER APPLY (
           SELECT TOP 1 image_url
           FROM product_images
           WHERE product_id = p.id
           ORDER BY sort_order ASC, id ASC
         ) pi
         WHERE c.customer_id = $1
          ORDER BY ci.updated_at DESC`,
          [userId],
        ),
        this.databaseService.query<{ claimable_count: number }>(
          `SELECT COUNT(*) AS claimable_count
           FROM users u
           INNER JOIN orders o
             ON o.guest_email = u.email
            AND o.customer_id IS NULL
           WHERE u.id = $1`,
          [userId],
        ),
      ]);

    const user = profile.rows[0];
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    return {
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phoneNumber: user.phone_number,
        emailVerifiedAt: user.email_verified_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      addresses: addresses.rows.map((row) => ({
        id: row.id,
        label: row.label,
        fullName: row.full_name,
        phoneNumber: row.phone_number,
        line1: row.line1,
        line2: row.line2,
        city: row.city,
        stateRegion: row.state_region,
        postalCode: row.postal_code,
        country: row.country,
        isDefault: row.is_default,
      })),
      paymentMethods: paymentMethods.rows.map((row) => ({
        id: row.id,
        nickname: row.nickname,
        cardholderName: row.cardholder_name,
        brand: row.brand,
        last4: row.last4,
        expMonth: row.exp_month,
        expYear: row.exp_year,
        isDefault: row.is_default,
      })),
      cart: {
        itemCount: cartItems.rows.reduce((sum, row) => sum + row.quantity, 0),
        items: cartItems.rows.map((row) => ({
          productId: row.product_id,
          title: row.title,
          category: row.category,
          quantity: row.quantity,
          price: Number(row.price),
          image: row.image_url,
          updatedAt: row.updated_at,
        })),
      },
      recentOrders: recentOrders.rows.map((row) => ({
        id: row.id,
        totalPrice: Number(row.total_price),
        specialRequest: row.special_request,
        status: row.status,
        createdAt: row.created_at,
      })),
      guestOrderRecovery: {
        claimableCount: claimableGuestOrders.rows[0]?.claimable_count ?? 0,
      },
    };
  }

  async requestGuestOrderClaim(userId: string, phoneNumber?: string) {
    const userResult = await this.databaseService.query<{
      email: string;
      phone_number: string | null;
    }>(
      `SELECT TOP 1 email, phone_number
       FROM users
       WHERE id = $1`,
      [userId],
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const normalizedPhone = phoneNumber?.trim() || user.phone_number?.trim() || null;
    const claimableOrders = await this.databaseService.query<{ id: string }>(
      `SELECT id
       FROM orders
       WHERE customer_id IS NULL
         AND guest_email = $1
         AND ($2 IS NULL OR guest_phone_number = $2)`,
      [normalizedEmail, normalizedPhone],
    );

    if (!claimableOrders.rows.length) {
      return {
        message:
          'No unlinked guest orders were found for this account email right now.',
      };
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE guest_order_claim_tokens
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [userId],
      );

      await client.query(
        `INSERT INTO guest_order_claim_tokens (user_id, email, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, normalizedEmail, token, expiresAt],
      );
    });

    await this.mailService.sendGuestOrderClaimEmail(normalizedEmail, token);

    return {
      message:
        'Verification email sent. Open the link in that email to securely connect your past guest orders.',
    };
  }

  async verifyGuestOrderClaim(token: string) {
    const result = await this.databaseService.withTransaction(async (client) => {
      const tokenResult = await client.query<{
        id: string;
        user_id: string;
        email: string;
        expires_at: Date;
        used_at: Date | null;
      }>(
        `SELECT TOP 1 id, user_id, email, expires_at, used_at
         FROM guest_order_claim_tokens
         WHERE token = $1`,
        [token],
      );

      const record = tokenResult.rows[0];
      if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
        throw new BadRequestException(
          'Invalid or expired guest order claim token',
        );
      }

      const linked = await client.query<{ id: string }>(
        `UPDATE orders
         SET customer_id = $1,
             guest_claimed_at = SYSDATETIME(),
             guest_claimed_by_user_id = $1,
             updated_at = SYSDATETIME()
         OUTPUT INSERTED.id
         WHERE customer_id IS NULL
           AND guest_email = $2`,
        [record.user_id, record.email],
      );

      await client.query(
        `UPDATE guest_order_claim_tokens
         SET used_at = SYSDATETIME()
         WHERE id = $1`,
        [record.id],
      );

      return linked.rows.length;
    });

    return {
      message:
        result > 0
          ? `Connected ${result} guest order${result === 1 ? '' : 's'} to your account.`
          : 'No pending guest orders were left to connect.',
      linkedCount: result,
    };
  }

  async updateProfile(userId: string, dto: UpdateAccountProfileDto) {
    await this.applySharedProfileUpdate(userId, dto);
    return this.getAccount(userId);
  }

  async updateSettingsProfile(userId: string, dto: UpdateAccountProfileDto) {
    await this.applySharedProfileUpdate(userId, dto);
    return this.getSettings(userId);
  }

  private async applySharedProfileUpdate(
    userId: string,
    dto: UpdateAccountProfileDto,
  ) {
    const currentResult = await this.databaseService.query<{
      email: string;
      role: 'admin' | 'vendor' | 'customer';
    }>(
      `SELECT TOP 1 email, role
       FROM users
       WHERE id = $1`,
      [userId],
    );

    const currentUser = currentResult.rows[0];
    if (!currentUser) {
      throw new NotFoundException('Account not found');
    }

    const vendorAccess =
      currentUser.role === 'vendor'
        ? await this.vendorAccessService.getVendorAccessForUser(userId)
        : null;

    const updates: string[] = [];
    const values: unknown[] = [];
    const normalizedEmail =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;
    const emailChanged =
      normalizedEmail !== undefined &&
      normalizedEmail !== currentUser.email.trim().toLowerCase();

    if (normalizedEmail !== undefined) {
      values.push(normalizedEmail);
      updates.push(`email = $${values.length}`);
    }
    if (dto.fullName !== undefined) {
      values.push(dto.fullName.trim() || null);
      updates.push(`full_name = $${values.length}`);
    }
    if (dto.phoneNumber !== undefined) {
      values.push(dto.phoneNumber.trim() || null);
      updates.push(`phone_number = $${values.length}`);
    }

    if (!updates.length) {
      return;
    }

    if (normalizedEmail !== undefined) {
      const existing = await this.databaseService.query<{ id: string }>(
        'SELECT TOP 1 id FROM users WHERE email = $1 AND id <> $2',
        [normalizedEmail, userId],
      );
      if (existing.rows[0]) {
        throw new BadRequestException('Email is already in use');
      }
    }

    let verificationEmail: {
      email: string;
      token: string;
      role: 'vendor' | 'customer';
    } | null = null;

    await this.databaseService.withTransaction(async (client) => {
      const transactionUpdates = [...updates];
      const transactionValues = [...values];

      if (emailChanged && vendorAccess?.is_primary_owner) {
        transactionUpdates.push('email_verified_at = NULL');
      }

      transactionValues.push(userId);
      await client.query(
        `UPDATE users
         SET ${transactionUpdates.join(', ')}, updated_at = SYSDATETIME()
         WHERE id = $${transactionValues.length}`,
        transactionValues,
      );

      if (
        !emailChanged ||
        currentUser.role !== 'vendor' ||
        !normalizedEmail ||
        !vendorAccess?.is_primary_owner
      ) {
        return;
      }

      await client.query(
        `UPDATE vendors
         SET is_verified = 0,
             updated_at = SYSDATETIME()
         WHERE user_id = $1`,
        [userId],
      );

      await client.query(
        'DELETE FROM email_verifications WHERE user_id = $1 AND used_at IS NULL',
        [userId],
      );

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
      await client.query(
        `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, token, expiresAt],
      );

      verificationEmail = {
        email: normalizedEmail,
        token,
        role: currentUser.role,
      };
    });

    if (verificationEmail !== null) {
      const pendingVerification = verificationEmail as {
        email: string;
        token: string;
        role: 'vendor' | 'customer';
      };
      await this.mailService.sendVerificationEmail(
        pendingVerification.email,
        pendingVerification.token,
        pendingVerification.role,
      );
    }
  }

  async activateVendorSubscription(
    userId: string,
    dto: { planType: 'monthly' | 'yearly' },
  ) {
    const access = await this.vendorAccessService.requireShopHolderAccess(userId);
    const vendor = await this.databaseService.query<{
      id: string;
      is_active: boolean;
      is_verified: boolean;
      subscription_plan: 'monthly' | 'yearly' | null;
      subscription_started_at: Date | null;
      subscription_ends_at: Date | null;
      subscription_status: 'inactive' | 'active' | 'expired';
      subscription_override_plan: 'monthly' | 'yearly' | null;
      subscription_override_status: 'active' | 'expired' | null;
      subscription_override_started_at: Date | null;
      subscription_override_ends_at: Date | null;
    }>(
      `SELECT TOP 1
         id,
         is_active,
         is_verified,
         subscription_plan,
         subscription_started_at,
         subscription_ends_at,
         subscription_status,
         subscription_override_plan,
         subscription_override_status,
         subscription_override_started_at,
         subscription_override_ends_at
       FROM vendors
       WHERE id = $1`,
      [access.id],
    );

    const current = vendor.rows[0];
    if (!current) {
      throw new NotFoundException('Vendor account not found');
    }

    if (!current.is_verified) {
      throw new BadRequestException(
        'Verify the vendor account before starting a subscription',
      );
    }

    if (!current.is_active) {
      throw new BadRequestException(
        'Admin approval is required before starting a subscription',
      );
    }

    const effectiveSubscription = this.resolveEffectiveSubscription(current);
    if (
      effectiveSubscription.status === 'active' &&
      effectiveSubscription.endsAt &&
      effectiveSubscription.endsAt > new Date()
    ) {
      const until = effectiveSubscription.endsAt.toLocaleDateString('en-GB');
      throw new BadRequestException(
        `Your subscription is already active until ${until}. You can renew after it ends.`,
      );
    }

    const now = new Date();
    const nextEndsAt = new Date(now.getTime());
    if (dto.planType === 'yearly') {
      nextEndsAt.setFullYear(nextEndsAt.getFullYear() + 1);
    } else {
      nextEndsAt.setMonth(nextEndsAt.getMonth() + 1);
    }

    const normalizedStartedAt = this.formatSqlDateTime(now);
    const normalizedChargeStartsAt = this.formatSqlDateTime(now);
    const normalizedEndsAt = this.formatSqlDateTime(nextEndsAt);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE vendor_subscriptions
         SET status = 'expired'
         WHERE vendor_id = $1
           AND status = 'active'
           AND ends_at < SYSDATETIME()`,
        [current.id],
      );

      await client.query(
        `UPDATE vendors
         SET subscription_plan = $1,
             subscription_status = 'active',
             subscription_started_at = $2,
             subscription_ends_at = $3,
             updated_at = SYSDATETIME()
         WHERE id = $4`,
        [dto.planType, normalizedStartedAt, normalizedEndsAt, current.id],
      );

      await client.query(
        `INSERT INTO vendor_subscriptions (vendor_id, plan_type, status, amount, starts_at, ends_at)
         VALUES ($1, $2, 'active', $3, $4, $5)`,
        [
          current.id,
          dto.planType,
          VENDOR_SUBSCRIPTION_PRICES[dto.planType],
          normalizedChargeStartsAt,
          normalizedEndsAt,
        ],
      );
    });

    return this.getSettings(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const result = await this.databaseService.query<{ password_hash: string }>(
      'SELECT TOP 1 password_hash FROM users WHERE id = $1',
      [userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password_hash,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Current password is incorrect');
    }

    const nextHash = await bcrypt.hash(dto.newPassword, 10);
    await this.databaseService.query(
      'UPDATE users SET password_hash = $1, updated_at = SYSDATETIME() WHERE id = $2',
      [nextHash, userId],
    );

    return { message: 'Password updated successfully.' };
  }

  async updateVendorBankDetails(
    userId: string,
    dto: UpdateVendorBankDetailsDto,
  ) {
    const vendor = await this.vendorAccessService.requireShopHolderAccess(userId);

    await this.databaseService.query(
      `UPDATE vendors
       SET bank_account_name = $1,
           bank_name = $2,
           bank_iban = $3,
           updated_at = SYSDATETIME()
       WHERE id = $4`,
      [
        dto.bankAccountName?.trim() || null,
        dto.bankName?.trim() || null,
        dto.bankIban?.trim().toUpperCase() || null,
        vendor.id,
      ],
    );

    return this.getSettings(userId);
  }

  async updateVendorProfile(
    userId: string,
    dto: UpdateVendorProfileDto,
    logoImage?: Express.Multer.File,
  ) {
    const vendorAccess = await this.vendorAccessService.requireShopHolderAccess(
      userId,
    );

    const vendor = await this.databaseService.query<{
      id: string;
      logo_url: string | null;
    }>('SELECT TOP 1 id, logo_url FROM vendors WHERE id = $1', [vendorAccess.id]);

    if (!vendor.rows[0]) {
      this.cleanupTemporaryFile(logoImage);
      throw new NotFoundException('Vendor account not found');
    }

    if (dto.supportEmail !== undefined) {
      const normalizedEmail = dto.supportEmail.trim().toLowerCase();
      const existing = await this.databaseService.query<{ id: string }>(
        'SELECT TOP 1 id FROM users WHERE email = $1 AND id <> $2',
        [normalizedEmail, userId],
      );
      if (existing.rows[0]) {
        this.cleanupTemporaryFile(logoImage);
        throw new BadRequestException(
          'Support email is already in use by another account',
        );
      }
    }

    let storedLogoUrl: string | null = null;
    const currentLogoUrl = vendor.rows[0].logo_url;

    try {
      storedLogoUrl = logoImage
        ? this.storeVendorLogo(vendor.rows[0].id, logoImage)
        : null;

      await this.databaseService.query(
        `UPDATE vendors
         SET shop_name = COALESCE($1, shop_name),
             support_email = $2,
             support_phone = $3,
             shop_description = $4,
             logo_url = $5,
             banner_url = $6,
             business_address = $7,
             return_policy = $8,
             business_hours = $9,
             shipping_notes = $10,
             low_stock_threshold = COALESCE($11, low_stock_threshold),
             updated_at = SYSDATETIME()
         WHERE id = $12`,
        [
          dto.shopName?.trim() || null,
          dto.supportEmail?.trim().toLowerCase() || null,
          dto.supportPhone?.trim() || null,
          dto.shopDescription?.trim() || null,
          storedLogoUrl ?? dto.logoUrl?.trim() ?? null,
          dto.bannerUrl?.trim() || null,
          dto.businessAddress?.trim() || null,
          dto.returnPolicy?.trim() || null,
          dto.businessHours?.trim() || null,
          dto.shippingNotes?.trim() || null,
          dto.lowStockThreshold,
          vendorAccess.id,
        ],
      );
    } catch (error) {
      if (storedLogoUrl) {
        this.deleteStoredMedia(storedLogoUrl);
      } else {
        this.cleanupTemporaryFile(logoImage);
      }
      throw error;
    }

    if (storedLogoUrl && currentLogoUrl && currentLogoUrl !== storedLogoUrl) {
      this.deleteStoredMedia(currentLogoUrl);
    }

    return this.getSettings(userId);
  }

  async getVendorTeamAccess(userId: string) {
    const access = await this.vendorAccessService.requireShopHolderAccess(userId);

    const [members, invites] = await Promise.all([
      this.databaseService.query<{
        id: string;
        user_id: string;
        full_name: string | null;
        email: string;
        role: 'shop_holder' | 'employee';
        status: 'pending' | 'active' | 'removed';
        joined_at: Date | null;
        updated_at: Date;
        is_primary_owner: boolean;
      }>(
        `SELECT
           tm.id,
           tm.user_id,
           u.full_name,
           u.email,
           tm.role,
           tm.status,
           tm.joined_at,
           tm.updated_at,
           CASE
             WHEN v.user_id = tm.user_id THEN CAST(1 AS BIT)
             ELSE CAST(0 AS BIT)
           END AS is_primary_owner
         FROM vendor_team_members tm
         INNER JOIN users u ON u.id = tm.user_id
         INNER JOIN vendors v ON v.id = tm.vendor_id
         WHERE tm.vendor_id = $1
           AND tm.status <> 'removed'
         ORDER BY
           CASE WHEN v.user_id = tm.user_id THEN 0 ELSE 1 END,
           CASE WHEN tm.role = 'shop_holder' THEN 0 ELSE 1 END,
           u.email ASC`,
        [access.id],
      ),
      this.databaseService.query<{
        id: string;
        user_id: string | null;
        email: string;
        role: 'shop_holder' | 'employee';
        note: string | null;
        status: 'pending' | 'accepted' | 'revoked' | 'expired';
        invited_at: Date;
        last_sent_at: Date;
        expires_at: Date;
        invited_by_name: string | null;
      }>(
        `SELECT
           i.id,
           i.user_id,
           i.email,
           i.role,
           i.note,
           i.status,
           i.invited_at,
           i.last_sent_at,
           i.expires_at,
           inviter.full_name AS invited_by_name
         FROM vendor_team_invites i
         LEFT JOIN users inviter ON inviter.id = i.invited_by_user_id
         WHERE i.vendor_id = $1
           AND i.status = 'pending'
         ORDER BY i.last_sent_at DESC, i.invited_at DESC`,
        [access.id],
      ),
    ]);

    return {
      vendorId: access.id,
      currentUserRole: access.access_role,
      canManageTeam: true,
      members: members.rows.map((member) => ({
        id: member.id,
        userId: member.user_id,
        name: member.full_name,
        email: member.email,
        role: member.role,
        status: member.status,
        joinedAt: member.joined_at,
        updatedAt: member.updated_at,
        isPrimaryOwner: member.is_primary_owner,
      })),
      invites: invites.rows.map((invite) => ({
        id: invite.id,
        userId: invite.user_id,
        email: invite.email,
        role: invite.role,
        note: invite.note,
        status: invite.status,
        invitedAt: invite.invited_at,
        lastSentAt: invite.last_sent_at,
        expiresAt: invite.expires_at,
        invitedByName: invite.invited_by_name,
      })),
    };
  }

  async createVendorTeamInvite(
    userId: string,
    dto: CreateVendorTeamInviteDto,
  ) {
    const access = await this.vendorAccessService.requireShopHolderAccess(userId);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const delivery = await this.databaseService.withTransaction(async (client) => {
      if (normalizedEmail === normalizedEmail.trim().toLowerCase() && normalizedEmail.length === 0) {
        throw new BadRequestException('Invite email is required');
      }

      const existingMember = await client.query<{ id: string }>(
        `SELECT TOP 1 tm.id
         FROM vendor_team_members tm
         INNER JOIN users u ON u.id = tm.user_id
         WHERE tm.vendor_id = $1
           AND u.email = $2
           AND tm.status IN ('pending', 'active')`,
        [access.id, normalizedEmail],
      );

      if (existingMember.rows[0]) {
        throw new BadRequestException(
          'This email already has access or a pending invite for this shop',
        );
      }

      const existingInvite = await client.query<{ id: string }>(
        `SELECT TOP 1 id
         FROM vendor_team_invites
         WHERE vendor_id = $1
           AND email = $2
           AND status = 'pending'`,
        [access.id, normalizedEmail],
      );

      if (existingInvite.rows[0]) {
        throw new BadRequestException(
          'This email already has access or a pending invite for this shop',
        );
      }

      const existingUser = await client.query<{
        id: string;
        role: 'admin' | 'vendor' | 'customer';
      }>(
        `SELECT TOP 1 id, role
         FROM users
         WHERE email = $1`,
        [normalizedEmail],
      );

      let inviteeUserId = existingUser.rows[0]?.id ?? null;
      let needsPasswordSetup = false;

      if (inviteeUserId === userId) {
        throw new BadRequestException(
          'Your own shop account already has access to this workspace',
        );
      }

      if (existingUser.rows[0]) {
        if (existingUser.rows[0].role !== 'vendor') {
          throw new BadRequestException(
            'This email is already being used by a non-vendor account',
          );
        }

        const otherOwner = await client.query<{ id: string }>(
          `SELECT TOP 1 id
           FROM vendors
           WHERE user_id = $1
             AND id <> $2`,
          [inviteeUserId, access.id],
        );

        const otherMembership = await client.query<{ id: string }>(
          `SELECT TOP 1 id
           FROM vendor_team_members
           WHERE user_id = $1
             AND vendor_id <> $2
             AND status IN ('pending', 'active')`,
          [inviteeUserId, access.id],
        );

        if (otherOwner.rows[0] || otherMembership.rows[0]) {
          throw new BadRequestException(
            'This user is already linked to another vendor shop',
          );
        }
      } else {
        const passwordHash = await bcrypt.hash(randomUUID(), 10);
        const createdUser = await client.query<{ id: string }>(
          `INSERT INTO users (email, password_hash, role, email_verified_at)
           OUTPUT INSERTED.id
           VALUES ($1, $2, 'vendor', SYSDATETIME())`,
          [normalizedEmail, passwordHash],
        );
        inviteeUserId = createdUser.rows[0].id;
        needsPasswordSetup = true;
      }

      await client.query(
        `INSERT INTO vendor_team_members (
           vendor_id,
           user_id,
           role,
           status,
           invited_by_user_id,
           joined_at
         )
         VALUES ($1, $2, $3, 'pending', $4, NULL)`,
        [access.id, inviteeUserId, dto.role, userId],
      );

      let passwordResetToken: string | null = null;
      if (needsPasswordSetup) {
        passwordResetToken = randomUUID();
        const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
        await client.query(
          `INSERT INTO password_resets (user_id, token, expires_at)
           VALUES ($1, $2, $3)`,
          [inviteeUserId, passwordResetToken, resetExpiresAt],
        );
      }

      const inviteToken = randomUUID();
      await client.query(
        `INSERT INTO vendor_team_invites (
           vendor_id,
           user_id,
           email,
           role,
           note,
           token,
           status,
           invited_by_user_id,
           invited_at,
           last_sent_at,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, SYSDATETIME(), SYSDATETIME(), $8)`,
        [
          access.id,
          inviteeUserId,
          normalizedEmail,
          dto.role,
          dto.note?.trim() || null,
          inviteToken,
          userId,
          expiresAt,
        ],
      );

      const inviter = await client.query<{ full_name: string | null; email: string }>(
        'SELECT TOP 1 full_name, email FROM users WHERE id = $1',
        [userId],
      );

      return {
        email: normalizedEmail,
        shopName: access.shop_name,
        role: dto.role,
        inviterName:
          inviter.rows[0]?.full_name?.trim() ||
          inviter.rows[0]?.email ||
          'Shop holder',
        resetToken: passwordResetToken,
      };
    });

    await this.sendVendorTeamInviteEmail(delivery);

    return {
      message: 'Team invitation sent.',
      ...(await this.getVendorTeamAccess(userId)),
    };
  }

  async resendVendorTeamInvite(userId: string, inviteId: string) {
    const access = await this.vendorAccessService.requireShopHolderAccess(userId);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const delivery = await this.databaseService.withTransaction(async (client) => {
      const invite = await client.query<{
        id: string;
        vendor_id: string;
        user_id: string | null;
        email: string;
        role: 'shop_holder' | 'employee';
      }>(
        `SELECT TOP 1 id, vendor_id, user_id, email, role
         FROM vendor_team_invites
         WHERE id = $1
           AND vendor_id = $2
           AND status = 'pending'`,
        [inviteId, access.id],
      );

      const current = invite.rows[0];
      if (!current) {
        throw new NotFoundException('Pending invite not found');
      }

      let resetToken: string | null = null;
      if (current.user_id) {
        const userRow = await client.query<{ full_name: string | null }>(
          'SELECT TOP 1 full_name FROM users WHERE id = $1',
          [current.user_id],
        );

        const member = await client.query<{ id: string; status: string }>(
          `SELECT TOP 1 id, status
           FROM vendor_team_members
           WHERE vendor_id = $1
             AND user_id = $2`,
          [access.id, current.user_id],
        );

        if (!member.rows[0] || member.rows[0].status === 'removed') {
          throw new NotFoundException('Team member not found for this invite');
        }

        if (!userRow.rows[0]?.full_name) {
          resetToken = randomUUID();
          const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
          await client.query(
            `INSERT INTO password_resets (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [current.user_id, resetToken, resetExpiresAt],
          );
        }
      }

      const nextToken = randomUUID();
      await client.query(
        `UPDATE vendor_team_invites
         SET token = $1,
             expires_at = $2,
             last_sent_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE id = $3`,
        [nextToken, expiresAt, inviteId],
      );

      const inviter = await client.query<{ full_name: string | null; email: string }>(
        'SELECT TOP 1 full_name, email FROM users WHERE id = $1',
        [userId],
      );

      return {
        email: current.email,
        shopName: access.shop_name,
        role: current.role,
        inviterName:
          inviter.rows[0]?.full_name?.trim() ||
          inviter.rows[0]?.email ||
          'Shop holder',
        resetToken,
      };
    });

    await this.sendVendorTeamInviteEmail(delivery);

    return {
      message: 'Invitation resent.',
      ...(await this.getVendorTeamAccess(userId)),
    };
  }

  async updateVendorTeamMemberRole(
    userId: string,
    memberId: string,
    dto: UpdateVendorTeamMemberRoleDto,
  ) {
    const access = await this.vendorAccessService.requireShopHolderAccess(userId);

    await this.databaseService.withTransaction(async (client) => {
      const member = await client.query<{
        id: string;
        user_id: string;
        role: 'shop_holder' | 'employee';
        status: 'pending' | 'active' | 'removed';
        is_primary_owner: boolean;
      }>(
        `SELECT TOP 1
           tm.id,
           tm.user_id,
           tm.role,
           tm.status,
           CASE
             WHEN v.user_id = tm.user_id THEN CAST(1 AS BIT)
             ELSE CAST(0 AS BIT)
           END AS is_primary_owner
         FROM vendor_team_members tm
         INNER JOIN vendors v ON v.id = tm.vendor_id
         WHERE tm.id = $1
           AND tm.vendor_id = $2`,
        [memberId, access.id],
      );

      const current = member.rows[0];
      if (!current || current.status === 'removed') {
        throw new NotFoundException('Team member not found');
      }

      if (current.is_primary_owner) {
        throw new BadRequestException(
          'The primary shop holder role cannot be changed',
        );
      }

      if (current.role === 'shop_holder' && dto.role !== 'shop_holder') {
        const activeHolderCount = await this.countActiveShopHolders(
          access.id,
          client,
        );
        if (activeHolderCount <= 1) {
          throw new BadRequestException(
            'The last remaining shop holder cannot be demoted',
          );
        }
      }

      await client.query(
        `UPDATE vendor_team_members
         SET role = $1,
             updated_at = SYSDATETIME()
         WHERE id = $2`,
        [dto.role, memberId],
      );

      await client.query(
        `UPDATE vendor_team_invites
         SET role = $1,
             updated_at = SYSDATETIME()
         WHERE vendor_id = $2
           AND user_id = $3
           AND status = 'pending'`,
        [dto.role, access.id, current.user_id],
      );
    });

    return {
      message: 'Team role updated.',
      ...(await this.getVendorTeamAccess(userId)),
    };
  }

  async removeVendorTeamMember(userId: string, memberId: string) {
    const access = await this.vendorAccessService.requireShopHolderAccess(userId);

    await this.databaseService.withTransaction(async (client) => {
      const member = await client.query<{
        id: string;
        user_id: string;
        role: 'shop_holder' | 'employee';
        status: 'pending' | 'active' | 'removed';
        is_primary_owner: boolean;
      }>(
        `SELECT TOP 1
           tm.id,
           tm.user_id,
           tm.role,
           tm.status,
           CASE
             WHEN v.user_id = tm.user_id THEN CAST(1 AS BIT)
             ELSE CAST(0 AS BIT)
           END AS is_primary_owner
         FROM vendor_team_members tm
         INNER JOIN vendors v ON v.id = tm.vendor_id
         WHERE tm.id = $1
           AND tm.vendor_id = $2`,
        [memberId, access.id],
      );

      const current = member.rows[0];
      if (!current || current.status === 'removed') {
        throw new NotFoundException('Team member not found');
      }

      if (current.is_primary_owner) {
        throw new BadRequestException(
          'The primary shop holder cannot be removed',
        );
      }

      if (current.role === 'shop_holder') {
        const activeHolderCount = await this.countActiveShopHolders(
          access.id,
          client,
        );
        if (activeHolderCount <= 1) {
          throw new BadRequestException(
            'The last remaining shop holder cannot be removed',
          );
        }
      }

      await client.query(
        `UPDATE vendor_team_members
         SET status = 'removed',
             updated_at = SYSDATETIME()
         WHERE id = $1`,
        [memberId],
      );

      await client.query(
        `UPDATE vendor_team_invites
         SET status = 'revoked',
             responded_at = COALESCE(responded_at, SYSDATETIME()),
             updated_at = SYSDATETIME()
         WHERE vendor_id = $1
           AND user_id = $2
           AND status = 'pending'`,
        [access.id, current.user_id],
      );
    });

    return {
      message: 'Team access removed.',
      ...(await this.getVendorTeamAccess(userId)),
    };
  }

  async createAddress(userId: string, dto: UpsertAddressDto) {
    await this.databaseService.withTransaction(async (client) => {
      if (dto.isDefault) {
        await client.query(
          'UPDATE customer_addresses SET is_default = 0, updated_at = SYSDATETIME() WHERE customer_id = $1',
          [userId],
        );
      }

      await client.query(
        `INSERT INTO customer_addresses (
           customer_id, label, full_name, phone_number, line1, line2, city,
           state_region, postal_code, country, is_default
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          dto.label.trim(),
          dto.fullName.trim(),
          dto.phoneNumber?.trim() || null,
          dto.line1.trim(),
          dto.line2?.trim() || null,
          dto.city.trim(),
          dto.stateRegion?.trim() || null,
          dto.postalCode.trim(),
          dto.country.trim(),
          dto.isDefault === true,
        ],
      );
    });

    return this.getAccount(userId);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpsertAddressDto,
  ) {
    await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        'SELECT TOP 1 id FROM customer_addresses WHERE id = $1 AND customer_id = $2',
        [addressId, userId],
      );
      if (!existing.rows[0]) {
        throw new NotFoundException('Address not found');
      }

      if (dto.isDefault) {
        await client.query(
          'UPDATE customer_addresses SET is_default = 0, updated_at = SYSDATETIME() WHERE customer_id = $1',
          [userId],
        );
      }

      await client.query(
        `UPDATE customer_addresses
         SET label = $1,
             full_name = $2,
             phone_number = $3,
             line1 = $4,
             line2 = $5,
             city = $6,
             state_region = $7,
             postal_code = $8,
             country = $9,
             is_default = $10,
             updated_at = SYSDATETIME()
         WHERE id = $11 AND customer_id = $12`,
        [
          dto.label.trim(),
          dto.fullName.trim(),
          dto.phoneNumber?.trim() || null,
          dto.line1.trim(),
          dto.line2?.trim() || null,
          dto.city.trim(),
          dto.stateRegion?.trim() || null,
          dto.postalCode.trim(),
          dto.country.trim(),
          dto.isDefault === true,
          addressId,
          userId,
        ],
      );
    });

    return this.getAccount(userId);
  }

  async deleteAddress(userId: string, addressId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'DELETE FROM customer_addresses OUTPUT DELETED.id WHERE id = $1 AND customer_id = $2',
      [addressId, userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Address not found');
    }

    return this.getAccount(userId);
  }

  async createPaymentMethod(userId: string, dto: CreatePaymentMethodDto) {
    const normalizedNumber = dto.cardNumber.replace(/\s+/g, '');
    const last4 = normalizedNumber.slice(-4);
    const brand = this.detectCardBrand(normalizedNumber);

    await this.databaseService.withTransaction(async (client) => {
      if (dto.isDefault) {
        await client.query(
          'UPDATE customer_payment_methods SET is_default = 0, updated_at = SYSDATETIME() WHERE customer_id = $1',
          [userId],
        );
      }

      await client.query(
        `INSERT INTO customer_payment_methods (
           customer_id, nickname, cardholder_name, brand, last4, exp_month, exp_year, is_default
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          dto.nickname?.trim() || null,
          dto.cardholderName.trim(),
          brand,
          last4,
          dto.expMonth,
          dto.expYear,
          dto.isDefault === true,
        ],
      );
    });

    return this.getAccount(userId);
  }

  async updatePaymentMethod(
    userId: string,
    paymentMethodId: string,
    dto: UpdatePaymentMethodDto,
  ) {
    await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        'SELECT TOP 1 id FROM customer_payment_methods WHERE id = $1 AND customer_id = $2',
        [paymentMethodId, userId],
      );
      if (!existing.rows[0]) {
        throw new NotFoundException('Payment method not found');
      }

      if (dto.isDefault) {
        await client.query(
          'UPDATE customer_payment_methods SET is_default = 0, updated_at = SYSDATETIME() WHERE customer_id = $1',
          [userId],
        );
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      if (dto.nickname !== undefined) {
        values.push(dto.nickname.trim() || null);
        updates.push(`nickname = $${values.length}`);
      }
      if (dto.cardholderName !== undefined) {
        values.push(dto.cardholderName.trim());
        updates.push(`cardholder_name = $${values.length}`);
      }
      if (dto.isDefault !== undefined) {
        values.push(dto.isDefault);
        updates.push(`is_default = $${values.length}`);
      }

      if (updates.length) {
        values.push(paymentMethodId);
        values.push(userId);
        await client.query(
          `UPDATE customer_payment_methods
           SET ${updates.join(', ')}, updated_at = SYSDATETIME()
           WHERE id = $${values.length - 1} AND customer_id = $${values.length}`,
          values,
        );
      }
    });

    return this.getAccount(userId);
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'DELETE FROM customer_payment_methods OUTPUT DELETED.id WHERE id = $1 AND customer_id = $2',
      [paymentMethodId, userId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Payment method not found');
    }

    return this.getAccount(userId);
  }

  private detectCardBrand(cardNumber: string) {
    if (/^4/.test(cardNumber)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return 'Mastercard';
    if (/^3[47]/.test(cardNumber)) return 'Amex';
    if (/^6(?:011|5)/.test(cardNumber)) return 'Discover';
    return 'Card';
  }

  private storeVendorLogo(vendorId: string, file: Express.Multer.File) {
    const targetDir = join(
      process.cwd(),
      'uploads',
      'vendors',
      `vendor-${vendorId}`,
      'branding',
    );

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const extension = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.'))
      : '.jpg';
    const fileName = `logo-${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`;
    const targetPath = join(targetDir, fileName);

    if (!existsSync(file.path)) {
      throw new BadRequestException('Uploaded logo could not be processed');
    }

    renameSync(file.path, targetPath);
    return `/media/vendors/vendor-${vendorId}/branding/${fileName}`;
  }

  private deleteStoredMedia(mediaUrl: string) {
    if (!mediaUrl.startsWith('/media/')) {
      return;
    }

    const relative = mediaUrl.replace(/^\/media\//, '');
    const fullPath = join(process.cwd(), 'uploads', relative);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  private cleanupTemporaryFile(file?: Express.Multer.File) {
    if (file?.path && existsSync(file.path)) {
      unlinkSync(file.path);
    }
  }

  private async countActiveShopHolders(
    vendorId: string,
    client: {
      query<T = Record<string, unknown>>(
        text: string,
        params?: unknown[],
      ): Promise<{ rows: T[] }>;
    } = this.databaseService,
  ) {
    const result = await client.query<{ holder_count: number }>(
      `SELECT COUNT(*) AS holder_count
       FROM vendor_team_members
       WHERE vendor_id = $1
         AND role = 'shop_holder'
         AND status = 'active'`,
      [vendorId],
    );

    return Number(result.rows[0]?.holder_count ?? 0);
  }

  private async sendVendorTeamInviteEmail(payload: {
    email: string;
    shopName: string;
    role: 'shop_holder' | 'employee';
    inviterName: string;
    resetToken: string | null;
  }) {
    await this.mailService.sendVendorTeamInviteEmail({
      email: payload.email,
      shopName: payload.shopName,
      role: payload.role,
      inviterName: payload.inviterName,
      actionUrl: payload.resetToken
        ? `/reset-password?token=${encodeURIComponent(payload.resetToken)}`
        : '/login',
      actionLabel: payload.resetToken ? 'Set up account' : 'Sign in',
    });
  }

  private formatSqlDateTime(value: Date) {
    return value.toISOString().replace('T', ' ').replace('Z', '');
  }

  private resolveAutomaticSubscription(vendor: {
    subscription_plan: 'monthly' | 'yearly' | null;
    subscription_status: 'inactive' | 'active' | 'expired';
    subscription_started_at: Date | null;
    subscription_ends_at: Date | null;
  }) {
    return {
      planType: vendor.subscription_plan,
      status:
        vendor.subscription_status === 'active' &&
        vendor.subscription_ends_at &&
        vendor.subscription_ends_at >= new Date()
          ? 'active'
          : vendor.subscription_plan
            ? 'expired'
            : 'inactive',
      startedAt: vendor.subscription_started_at,
      endsAt: vendor.subscription_ends_at,
    } as const;
  }

  private resolveManualOverride(vendor: {
    subscription_override_plan: 'monthly' | 'yearly' | null;
    subscription_override_status: 'active' | 'expired' | null;
    subscription_override_started_at: Date | null;
    subscription_override_ends_at: Date | null;
    subscription_override_note?: string | null;
    subscription_override_updated_at?: Date | null;
  }) {
    if (!vendor.subscription_override_status) {
      return null;
    }

    return {
      planType: vendor.subscription_override_plan,
      status:
        vendor.subscription_override_status === 'active' &&
        vendor.subscription_override_ends_at &&
        vendor.subscription_override_ends_at >= new Date()
          ? 'active'
          : 'expired',
      startedAt: vendor.subscription_override_started_at,
      endsAt: vendor.subscription_override_ends_at,
      note: vendor.subscription_override_note,
      updatedAt: vendor.subscription_override_updated_at,
    } as const;
  }

  private resolveEffectiveSubscription(vendor: {
    subscription_plan: 'monthly' | 'yearly' | null;
    subscription_status: 'inactive' | 'active' | 'expired';
    subscription_started_at: Date | null;
    subscription_ends_at: Date | null;
    subscription_override_plan: 'monthly' | 'yearly' | null;
    subscription_override_status: 'active' | 'expired' | null;
    subscription_override_started_at: Date | null;
    subscription_override_ends_at: Date | null;
  }) {
    const manualOverride = this.resolveManualOverride(vendor);
    if (
      manualOverride &&
      (vendor.subscription_override_status === 'expired' ||
        manualOverride.status === 'active')
    ) {
      return {
        planType: manualOverride.planType ?? vendor.subscription_plan,
        status: manualOverride.status,
        startedAt: manualOverride.startedAt,
        endsAt: manualOverride.endsAt,
        source: 'manual_override' as const,
      };
    }

    const automatic = this.resolveAutomaticSubscription(vendor);
    return {
      ...automatic,
      source: 'automatic' as const,
    };
  }
}
