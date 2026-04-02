import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuthService } from '../auth/auth.service';
import {
  assertStoredImageFileMatchesMimeType,
  generateOpaqueToken,
  getSafeImageExtensionForMimeType,
  hashOpaqueToken,
} from '../common/security/security.utils';
import {
  isStoredSecretProtected,
  protectStoredSecret,
} from '../common/security/stored-secrets.utils';
import { DatabaseService, QueryRunner } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import {
  BrandMutationDto,
  CatalogMasterDataMutationDto,
  CategoryMutationDto,
  ColorMutationDto,
  CreateAdminUserDto,
  GenderGroupMutationDto,
  ReviewCatalogRequestDto,
  SizeMutationDto,
  SizeTypeMutationDto,
  SubcategoryMutationDto,
  UpdatePlatformSettingsDto,
} from './dto';

const DEFAULT_HOMEPAGE_HERO_INTERVAL_SECONDS = 6;
type UploadedFile = Express.Multer.File;

@Injectable()
export class AdminService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  async getOverview() {
    const [
      counts,
      revenue,
      orderMix,
      reportingSummary,
      topShop,
      topCategory,
      recentUsers,
      recentOrders,
      pendingVendors,
      recentNotifications,
      recentActivity,
    ] = await Promise.all([
      this.databaseService.query<{
        total_users: number;
        total_customers: number;
        total_admins: number;
        total_vendors: number;
        active_vendors: number;
        pending_vendor_approvals: number;
        unread_notifications: number;
      }>(
        `SELECT
           COUNT(*) AS total_users,
           SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) AS total_customers,
           SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins,
           (SELECT COUNT(*) FROM vendors) AS total_vendors,
           (SELECT COUNT(*) FROM vendors WHERE is_active = 1) AS active_vendors,
           (SELECT COUNT(*) FROM vendors WHERE is_verified = 1 AND is_active = 0) AS pending_vendor_approvals,
           (SELECT COUNT(*) FROM admin_notifications WHERE read_at IS NULL) AS unread_notifications
         FROM users`,
      ),
      this.databaseService.query<{
        gross_revenue: number | string;
        total_commission: number | string;
        total_vendor_earnings: number | string;
        orders_today: number;
        orders_this_week: number;
        orders_this_month: number;
        cod_orders: number;
        cod_pending_orders: number;
        cod_collected_orders: number;
        cod_refused_orders: number;
        cod_value: number | string;
        cod_collected_value: number | string;
      }>(
        `SELECT
           ISNULL((SELECT SUM(total_price) FROM orders), 0) AS gross_revenue,
           ISNULL((SELECT SUM(commission_amount) FROM order_items), 0) AS total_commission,
           ISNULL((SELECT SUM(vendor_earnings) FROM order_items), 0) AS total_vendor_earnings,
           ISNULL((SELECT COUNT(*) FROM orders WHERE CAST(created_at AS DATE) = CAST(SYSDATETIME() AS DATE)), 0) AS orders_today,
           ISNULL((SELECT COUNT(*) FROM orders WHERE created_at >= DATEADD(DAY, -7, SYSDATETIME())), 0) AS orders_this_week,
           ISNULL((SELECT COUNT(*) FROM orders WHERE created_at >= DATEADD(DAY, -30, SYSDATETIME())), 0) AS orders_this_month,
           ISNULL((SELECT COUNT(*) FROM orders WHERE payment_method = 'cash_on_delivery'), 0) AS cod_orders,
           ISNULL((SELECT COUNT(*) FROM orders WHERE payment_status = 'cod_pending'), 0) AS cod_pending_orders,
           ISNULL((SELECT COUNT(*) FROM orders WHERE payment_status = 'cod_collected'), 0) AS cod_collected_orders,
           ISNULL((SELECT COUNT(*) FROM orders WHERE payment_status = 'cod_refused'), 0) AS cod_refused_orders,
           ISNULL((SELECT SUM(total_price) FROM orders WHERE payment_method = 'cash_on_delivery'), 0) AS cod_value,
           ISNULL((SELECT SUM(total_price) FROM orders WHERE payment_status = 'cod_collected'), 0) AS cod_collected_value`,
      ),
      this.databaseService.query<{
        pending_orders: number;
        confirmed_orders: number;
        shipped_orders: number;
        delivered_orders: number;
      }>(
        `SELECT
           ISNULL(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_orders,
           ISNULL(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed_orders,
           ISNULL(SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END), 0) AS shipped_orders,
           ISNULL(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_orders
         FROM orders`,
      ),
      this.databaseService.query<{
        average_order_value: number | string;
        revenue_last_7_days: number | string;
        revenue_last_30_days: number | string;
        new_users_last_7_days: number;
        new_customers_last_7_days: number;
        new_vendors_last_7_days: number;
      }>(
        `SELECT
           ISNULL((SELECT AVG(CAST(total_price AS DECIMAL(18, 2))) FROM orders), 0) AS average_order_value,
           ISNULL((SELECT SUM(total_price) FROM orders WHERE created_at >= DATEADD(DAY, -7, SYSDATETIME())), 0) AS revenue_last_7_days,
           ISNULL((SELECT SUM(total_price) FROM orders WHERE created_at >= DATEADD(DAY, -30, SYSDATETIME())), 0) AS revenue_last_30_days,
           ISNULL((SELECT COUNT(*) FROM users WHERE created_at >= DATEADD(DAY, -7, SYSDATETIME())), 0) AS new_users_last_7_days,
           ISNULL((SELECT COUNT(*) FROM users WHERE role = 'customer' AND created_at >= DATEADD(DAY, -7, SYSDATETIME())), 0) AS new_customers_last_7_days,
           ISNULL((SELECT COUNT(*) FROM vendors WHERE created_at >= DATEADD(DAY, -7, SYSDATETIME())), 0) AS new_vendors_last_7_days`,
      ),
      this.databaseService.query<{
        vendor_id: string;
        shop_name: string;
        gross_revenue: number | string;
        order_count: number;
      }>(
        `SELECT TOP 1
           v.id AS vendor_id,
           v.shop_name,
           ISNULL(SUM(oi.unit_price * oi.quantity), 0) AS gross_revenue,
           COUNT(DISTINCT oi.order_id) AS order_count
         FROM vendors v
         LEFT JOIN order_items oi ON oi.vendor_id = v.id
         GROUP BY v.id, v.shop_name
         ORDER BY gross_revenue DESC, order_count DESC, v.shop_name ASC`,
      ),
      this.databaseService.query<{
        category: string;
        units_sold: number;
        gross_revenue: number | string;
      }>(
        `SELECT TOP 1
           p.category,
           ISNULL(SUM(oi.quantity), 0) AS units_sold,
           ISNULL(SUM(oi.unit_price * oi.quantity), 0) AS gross_revenue
         FROM order_items oi
         INNER JOIN products p ON p.id = oi.product_id
         GROUP BY p.category
         ORDER BY units_sold DESC, gross_revenue DESC, p.category ASC`,
      ),
      this.databaseService.query<{
        id: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: Date;
      }>(
        `SELECT TOP 6 id, email, role, is_active, created_at
         FROM users
         ORDER BY created_at DESC`,
      ),
      this.databaseService.query<{
        id: string;
        order_number: string | null;
        total_price: number | string;
        payment_method: string;
        payment_status: string;
        cod_status_note: string | null;
        cod_updated_at: Date | null;
        status: string;
        created_at: Date;
        customer_email: string;
      }>(
        `SELECT TOP 6 o.id, o.order_number, o.total_price, o.payment_method, o.payment_status, o.cod_status_note, o.cod_updated_at, o.status, o.created_at, COALESCE(u.email, o.guest_email) AS customer_email
         FROM orders o
         LEFT JOIN users u ON u.id = o.customer_id
         ORDER BY o.created_at DESC`,
      ),
      this.databaseService.query<{
        id: string;
        shop_name: string;
        approved_at: Date | null;
        created_at: Date;
        user_email: string;
      }>(
        `SELECT TOP 6 v.id, v.shop_name, v.approved_at, v.created_at, u.email AS user_email
         FROM vendors v
         INNER JOIN users u ON u.id = v.user_id
         WHERE v.is_verified = 1 AND v.is_active = 0
         ORDER BY v.created_at DESC`,
      ),
      this.databaseService.query<{
        id: string;
        notification_type: string;
        title: string;
        body: string;
        action_url: string | null;
        created_at: Date;
        read_at: Date | null;
      }>(
        `SELECT TOP 6
           id,
           notification_type,
           title,
           body,
           action_url,
           created_at,
           read_at
         FROM admin_notifications
         ORDER BY CASE WHEN read_at IS NULL THEN 0 ELSE 1 END, created_at DESC`,
      ),
      this.getRecentAdminActivity(6),
    ]);

    const totals = counts.rows[0];
    const money = revenue.rows[0];
    const orderStatusCounts = orderMix.rows[0];
    const summary = reportingSummary.rows[0];
    const bestShop = topShop.rows[0];
    const bestCategory = topCategory.rows[0];

    return {
      totals: {
        totalUsers: totals.total_users,
        totalCustomers: totals.total_customers,
        totalAdmins: totals.total_admins,
        totalVendors: totals.total_vendors,
        activeVendors: totals.active_vendors,
        pendingVendorApprovals: totals.pending_vendor_approvals,
        unreadNotifications: totals.unread_notifications,
        totalOrders:
          orderStatusCounts.pending_orders +
          orderStatusCounts.confirmed_orders +
          orderStatusCounts.shipped_orders +
          orderStatusCounts.delivered_orders,
      },
      commerce: {
        grossRevenue: Number(money.gross_revenue),
        totalCommission: Number(money.total_commission),
        totalVendorEarnings: Number(money.total_vendor_earnings),
        ordersToday: money.orders_today,
        ordersThisWeek: money.orders_this_week,
        ordersThisMonth: money.orders_this_month,
        pendingOrders: orderStatusCounts.pending_orders,
        confirmedOrders: orderStatusCounts.confirmed_orders,
        shippedOrders: orderStatusCounts.shipped_orders,
        deliveredOrders: orderStatusCounts.delivered_orders,
        cashOnDeliveryOrders: money.cod_orders,
        cashOnDeliveryPending: money.cod_pending_orders,
        cashOnDeliveryCollected: money.cod_collected_orders,
        cashOnDeliveryRefused: money.cod_refused_orders,
        cashOnDeliveryValue: Number(money.cod_value),
        cashOnDeliveryCollectedValue: Number(money.cod_collected_value),
      },
      reporting: {
        averageOrderValue: Number(summary.average_order_value),
        revenueLast7Days: Number(summary.revenue_last_7_days),
        revenueLast30Days: Number(summary.revenue_last_30_days),
        newUsersLast7Days: summary.new_users_last_7_days,
        newCustomersLast7Days: summary.new_customers_last_7_days,
        newVendorsLast7Days: summary.new_vendors_last_7_days,
        topShop: bestShop
          ? {
              vendorId: bestShop.vendor_id,
              shopName: bestShop.shop_name,
              grossRevenue: Number(bestShop.gross_revenue),
              orderCount: bestShop.order_count,
            }
          : null,
        topCategory: bestCategory
          ? {
              category: bestCategory.category,
              unitsSold: bestCategory.units_sold,
              grossRevenue: Number(bestCategory.gross_revenue),
            }
          : null,
      },
      recentUsers: recentUsers.rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at,
      })),
      recentOrders: recentOrders.rows.map((row) => ({
        id: row.id,
        orderNumber: row.order_number ?? row.id,
        totalPrice: Number(row.total_price),
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        codStatusNote: row.cod_status_note,
        codUpdatedAt: row.cod_updated_at,
        status: row.status,
        createdAt: row.created_at,
        customerEmail: row.customer_email,
      })),
      pendingVendors: pendingVendors.rows.map((row) => ({
        id: row.id,
        shopName: row.shop_name,
        email: row.user_email,
        approvedAt: row.approved_at,
        createdAt: row.created_at,
      })),
      notifications: recentNotifications.rows.map((row) => ({
        id: row.id,
        type: row.notification_type,
        title: row.title,
        body: row.body,
        actionUrl: row.action_url,
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
      activities: recentActivity,
    };
  }

  async getReporting(rangeDaysInput?: string) {
    const rangeDays = this.normalizeReportingRange(rangeDaysInput);
    const summary = await this.databaseService.query<{
      order_count: number;
      average_order_value: number | string;
      revenue: number | string;
      new_users: number;
      new_customers: number;
      new_vendors: number;
    }>(
      `SELECT
         ISNULL((SELECT COUNT(*) FROM orders WHERE created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())), 0) AS order_count,
         ISNULL((SELECT AVG(CAST(total_price AS DECIMAL(18, 2))) FROM orders WHERE created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())), 0) AS average_order_value,
         ISNULL((SELECT SUM(total_price) FROM orders WHERE created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())), 0) AS revenue,
         ISNULL((SELECT COUNT(*) FROM users WHERE created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())), 0) AS new_users,
         ISNULL((SELECT COUNT(*) FROM users WHERE role = 'customer' AND created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())), 0) AS new_customers,
         ISNULL((SELECT COUNT(*) FROM vendors WHERE created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())), 0) AS new_vendors`,
    );

    const topShop = await this.databaseService.query<{
      vendor_id: string;
      shop_name: string;
      gross_revenue: number | string;
      order_count: number;
    }>(
      `SELECT TOP 1
         v.id AS vendor_id,
         v.shop_name,
         ISNULL(SUM(oi.unit_price * oi.quantity), 0) AS gross_revenue,
         COUNT(DISTINCT oi.order_id) AS order_count
       FROM vendors v
       INNER JOIN order_items oi ON oi.vendor_id = v.id
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())
       GROUP BY v.id, v.shop_name
       ORDER BY gross_revenue DESC, order_count DESC, v.shop_name ASC`,
    );

    const topCategory = await this.databaseService.query<{
      category: string;
      units_sold: number;
      gross_revenue: number | string;
    }>(
      `SELECT TOP 1
         p.category,
         ISNULL(SUM(oi.quantity), 0) AS units_sold,
         ISNULL(SUM(oi.unit_price * oi.quantity), 0) AS gross_revenue
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       INNER JOIN products p ON p.id = oi.product_id
       WHERE o.created_at >= DATEADD(DAY, -${rangeDays}, SYSDATETIME())
       GROUP BY p.category
       ORDER BY units_sold DESC, gross_revenue DESC, p.category ASC`,
    );

    const summaryRow = summary.rows[0];
    const topShopRow = topShop.rows[0];
    const topCategoryRow = topCategory.rows[0];

    return {
      rangeDays,
      orderCount: summaryRow.order_count,
      averageOrderValue: Number(summaryRow.average_order_value),
      revenue: Number(summaryRow.revenue),
      newUsers: summaryRow.new_users,
      newCustomers: summaryRow.new_customers,
      newVendors: summaryRow.new_vendors,
      topShop: topShopRow
        ? {
            vendorId: topShopRow.vendor_id,
            shopName: topShopRow.shop_name,
            grossRevenue: Number(topShopRow.gross_revenue),
            orderCount: topShopRow.order_count,
          }
        : null,
      topCategory: topCategoryRow
        ? {
            category: topCategoryRow.category,
            unitsSold: topCategoryRow.units_sold,
            grossRevenue: Number(topCategoryRow.gross_revenue),
          }
        : null,
    };
  }

  async createAdminUser(adminUserId: string, dto: CreateAdminUserDto) {
    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName?.trim() || null;
    const phoneNumber = dto.phoneNumber?.trim() || null;

    const existing = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM users WHERE email = $1',
      [email],
    );

    if (existing.rows[0]) {
      throw new BadRequestException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const result = await this.databaseService.withTransaction(
      async (client) => {
        const createdAdmin = await client.query<{
          id: string;
          email: string;
          role: string;
          full_name: string | null;
          phone_number: string | null;
          is_active: boolean;
          created_at: Date;
        }>(
          `INSERT INTO users (email, full_name, phone_number, password_hash, role, is_active, email_verified_at)
         OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.full_name, INSERTED.phone_number, INSERTED.is_active, INSERTED.created_at
         VALUES ($1, $2, $3, $4, 'admin', 1, SYSDATETIME())`,
          [email, fullName, phoneNumber, passwordHash],
        );

        await this.recordAdminActivity(
          adminUserId,
          {
            actionType: 'admin_created',
            entityType: 'admin_user',
            entityId: createdAdmin.rows[0].id,
            entityLabel: createdAdmin.rows[0].email,
            description: `Created admin account for ${createdAdmin.rows[0].email}.`,
          },
          client,
        );

        return createdAdmin;
      },
    );

    return {
      message: 'Admin account created',
      admin: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
        fullName: result.rows[0].full_name,
        phoneNumber: result.rows[0].phone_number,
        isActive: result.rows[0].is_active,
        createdAt: result.rows[0].created_at,
      },
    };
  }

  async getPlatformSettings() {
    const result = await this.databaseService.query<{
      smtp_host: string | null;
      smtp_port: number | null;
      smtp_secure: boolean;
      smtp_user: string | null;
      smtp_pass: string | null;
      mail_from: string | null;
      app_base_url: string | null;
      vendor_verification_emails_enabled: boolean;
      admin_vendor_approval_emails_enabled: boolean;
      password_reset_emails_enabled: boolean;
      payment_mode: 'test' | 'live';
      cash_on_delivery_enabled: boolean;
      card_payments_enabled: boolean;
      guest_checkout_enabled: boolean;
      stripe_test_publishable_key: string | null;
      stripe_test_secret_key: string | null;
      stripe_test_webhook_signing_secret: string | null;
      stripe_live_publishable_key: string | null;
      stripe_live_secret_key: string | null;
      stripe_live_webhook_signing_secret: string | null;
      homepage_hero_autoplay_enabled: boolean;
      homepage_hero_interval_seconds: number | null;
    }>(
      `SELECT TOP 1
         smtp_host,
         smtp_port,
         smtp_secure,
         smtp_user,
         smtp_pass,
         mail_from,
         app_base_url,
         vendor_verification_emails_enabled,
         admin_vendor_approval_emails_enabled,
         password_reset_emails_enabled,
         payment_mode,
         cash_on_delivery_enabled,
         card_payments_enabled,
         guest_checkout_enabled,
         stripe_test_publishable_key,
         stripe_test_secret_key,
         stripe_test_webhook_signing_secret,
         stripe_live_publishable_key,
         stripe_live_secret_key,
         stripe_live_webhook_signing_secret,
         homepage_hero_autoplay_enabled,
         homepage_hero_interval_seconds
       FROM platform_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    const paymentMode: 'test' | 'live' =
      row?.payment_mode === 'live' ? 'live' : 'test';
    const smtpPasswordManagedByEnv = Boolean(
      this.configService.get<string>('SMTP_PASS')?.trim(),
    );
    const stripeTestPublishableKey =
      this.configService.get<string>('STRIPE_TEST_PUBLISHABLE_KEY')?.trim() ||
      row?.stripe_test_publishable_key?.trim() ||
      null;
    const stripeLivePublishableKey =
      this.configService.get<string>('STRIPE_LIVE_PUBLISHABLE_KEY')?.trim() ||
      row?.stripe_live_publishable_key?.trim() ||
      null;
    const stripeTestSecretConfigured = Boolean(
      this.configService.get<string>('STRIPE_TEST_SECRET_KEY')?.trim() ||
        row?.stripe_test_secret_key,
    );
    const stripeLiveSecretConfigured = Boolean(
      this.configService.get<string>('STRIPE_LIVE_SECRET_KEY')?.trim() ||
        row?.stripe_live_secret_key,
    );
    const stripeTestWebhookConfigured = Boolean(
      this.configService
        .get<string>('STRIPE_TEST_WEBHOOK_SIGNING_SECRET')
        ?.trim() || row?.stripe_test_webhook_signing_secret,
    );
    const stripeLiveWebhookConfigured = Boolean(
      this.configService
        .get<string>('STRIPE_LIVE_WEBHOOK_SIGNING_SECRET')
        ?.trim() || row?.stripe_live_webhook_signing_secret,
    );
    if (row?.smtp_pass && !isStoredSecretProtected(row.smtp_pass)) {
      const protectedSecret = protectStoredSecret(
        row.smtp_pass,
        this.configService,
      );
      await this.databaseService.query(
        `UPDATE platform_settings
         SET smtp_pass = $1,
             updated_at = SYSDATETIME()
         WHERE id = 1`,
        [protectedSecret],
      );
      row.smtp_pass = protectedSecret;
    }
    const heroSlides = await this.getHomepageHeroSlidesForAdmin();
    const activityLog = await this.getRecentAdminActivity(12);
    return {
      email: {
        smtpHost: row?.smtp_host ?? null,
        smtpPort: row?.smtp_port ?? null,
        smtpSecure: Boolean(row?.smtp_secure),
        smtpUser: row?.smtp_user ?? null,
        smtpPasswordConfigured:
          smtpPasswordManagedByEnv || Boolean(row?.smtp_pass),
        smtpPasswordManagedByEnv,
        mailFrom: row?.mail_from ?? null,
        appBaseUrl: row?.app_base_url ?? null,
        vendorVerificationEmailsEnabled: row
          ? Boolean(row.vendor_verification_emails_enabled)
          : true,
        adminVendorApprovalEmailsEnabled: row
          ? Boolean(row.admin_vendor_approval_emails_enabled)
          : true,
        passwordResetEmailsEnabled: row
          ? Boolean(row.password_reset_emails_enabled)
          : true,
      },
      payment: {
        mode: paymentMode,
        cashOnDeliveryEnabled: row
          ? Boolean(row.cash_on_delivery_enabled)
          : true,
        cardPaymentsEnabled: row ? Boolean(row.card_payments_enabled) : false,
        guestCheckoutEnabled: row ? Boolean(row.guest_checkout_enabled) : true,
        stripe: {
          test: {
            publishableKey: stripeTestPublishableKey,
            secretKeyConfigured: stripeTestSecretConfigured,
            webhookSigningSecretConfigured: stripeTestWebhookConfigured,
          },
          live: {
            publishableKey: stripeLivePublishableKey,
            secretKeyConfigured: stripeLiveSecretConfigured,
            webhookSigningSecretConfigured: stripeLiveWebhookConfigured,
          },
        },
        status: {
          activeMode: paymentMode,
          activePublishableKey:
            paymentMode === 'live'
              ? stripeLivePublishableKey
              : stripeTestPublishableKey,
          activeConfigurationComplete:
            paymentMode === 'live'
              ? Boolean(stripeLivePublishableKey && stripeLiveSecretConfigured)
              : Boolean(stripeTestPublishableKey && stripeTestSecretConfigured),
          activeWebhookConfigured:
            paymentMode === 'live'
              ? stripeLiveWebhookConfigured
              : stripeTestWebhookConfigured,
          lastEvent: null,
        },
        logs: [],
      },
      homepageHero: {
        autoRotate: row ? Boolean(row.homepage_hero_autoplay_enabled) : true,
        intervalSeconds:
          row?.homepage_hero_interval_seconds ??
          DEFAULT_HOMEPAGE_HERO_INTERVAL_SECONDS,
        slides: heroSlides,
      },
      activityLog,
    };
  }

  async updatePlatformSettings(
    adminUserId: string,
    dto: UpdatePlatformSettingsDto,
  ) {
    const updates: string[] = [];
    const values: unknown[] = [];
    const changedAreas: string[] = [];

    const pushUpdate = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (dto.smtpHost !== undefined) {
      pushUpdate('smtp_host', dto.smtpHost.trim() || null);
      changedAreas.push('SMTP host');
    }

    if (dto.smtpPort !== undefined) {
      pushUpdate('smtp_port', dto.smtpPort);
      changedAreas.push('SMTP port');
    }

    if (dto.smtpSecure !== undefined) {
      pushUpdate('smtp_secure', dto.smtpSecure);
      changedAreas.push('SMTP security');
    }

    if (dto.smtpUser !== undefined) {
      pushUpdate('smtp_user', dto.smtpUser.trim() || null);
      changedAreas.push('SMTP username');
    }

    if (dto.clearSmtpPassword) {
      pushUpdate('smtp_pass', null);
      changedAreas.push('SMTP password cleared');
    } else if (dto.smtpPassword !== undefined) {
      const normalizedPassword = dto.smtpPassword.trim();
      if (normalizedPassword) {
        pushUpdate(
          'smtp_pass',
          protectStoredSecret(normalizedPassword, this.configService),
        );
        changedAreas.push('SMTP password');
      }
    }

    if (dto.mailFrom !== undefined) {
      pushUpdate('mail_from', dto.mailFrom.trim().toLowerCase() || null);
      changedAreas.push('mail sender');
    }

    if (dto.appBaseUrl !== undefined) {
      pushUpdate('app_base_url', dto.appBaseUrl.trim() || null);
      changedAreas.push('app base URL');
    }

    if (dto.vendorVerificationEmailsEnabled !== undefined) {
      pushUpdate(
        'vendor_verification_emails_enabled',
        dto.vendorVerificationEmailsEnabled,
      );
      changedAreas.push('vendor verification email switch');
    }

    if (dto.adminVendorApprovalEmailsEnabled !== undefined) {
      pushUpdate(
        'admin_vendor_approval_emails_enabled',
        dto.adminVendorApprovalEmailsEnabled,
      );
      changedAreas.push('admin vendor approval email switch');
    }

    if (dto.passwordResetEmailsEnabled !== undefined) {
      pushUpdate(
        'password_reset_emails_enabled',
        dto.passwordResetEmailsEnabled,
      );
      changedAreas.push('password reset email switch');
    }

    if (dto.paymentMode !== undefined) {
      pushUpdate('payment_mode', dto.paymentMode);
      changedAreas.push('payment mode');
    }

    if (dto.cashOnDeliveryEnabled !== undefined) {
      pushUpdate('cash_on_delivery_enabled', dto.cashOnDeliveryEnabled);
      changedAreas.push('cash on delivery switch');
    }

    if (dto.cardPaymentsEnabled !== undefined) {
      pushUpdate('card_payments_enabled', dto.cardPaymentsEnabled);
      changedAreas.push('card payments switch');
    }

    if (dto.guestCheckoutEnabled !== undefined) {
      pushUpdate('guest_checkout_enabled', dto.guestCheckoutEnabled);
      changedAreas.push('guest checkout switch');
    }

    if (dto.stripeTestPublishableKey !== undefined) {
      pushUpdate(
        'stripe_test_publishable_key',
        dto.stripeTestPublishableKey.trim() || null,
      );
      changedAreas.push('Stripe test publishable key');
    }

    if (dto.stripeLivePublishableKey !== undefined) {
      pushUpdate(
        'stripe_live_publishable_key',
        dto.stripeLivePublishableKey.trim() || null,
      );
      changedAreas.push('Stripe live publishable key');
    }

    if (!updates.length) {
      return this.getPlatformSettings();
    }

    await this.databaseService.withTransaction(async (client) => {
      const statementValues = [...values, 1];
      await client.query(
        `UPDATE platform_settings
         SET ${updates.join(', ')},
             updated_at = SYSDATETIME()
         WHERE id = $${statementValues.length}`,
        statementValues,
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'platform_settings_updated',
          entityType: 'platform_settings',
          entityLabel: 'Platform settings',
          description: `Updated platform settings: ${changedAreas.join(', ')}.`,
          metadata: { changedAreas },
        },
        client,
      );
    });

    return this.getPlatformSettings();
  }

  async getCatalogRequests(typeInput?: string, statusInput?: string) {
    const type = this.normalizeCatalogOptionTypeFilter(typeInput);
    const status = this.normalizeCatalogRequestStatusFilter(statusInput);
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (type) {
      values.push(type);
      conditions.push(`r.request_type = $${values.length}`);
    }

    if (status) {
      values.push(status);
      conditions.push(`r.status = $${values.length}`);
    }

    const result = await this.databaseService.query<{
      id: string;
      vendor_id: string;
      shop_name: string;
      vendor_email: string;
      request_type: string;
      requested_value: string;
      note: string | null;
      status: string;
      admin_note: string | null;
      reviewed_at: Date | null;
      created_at: Date;
      category_id: string | null;
      category_name: string | null;
      subcategory_id: string | null;
      subcategory_name: string | null;
      size_type_id: string | null;
      size_type_name: string | null;
    }>(
      `SELECT
         r.id,
         r.vendor_id,
         v.shop_name,
         u.email AS vendor_email,
         r.request_type,
         r.requested_value,
         r.note,
         r.status,
         r.admin_note,
         r.reviewed_at,
         r.created_at,
         r.category_id,
         c.name AS category_name,
         r.subcategory_id,
         sc.name AS subcategory_name,
         r.size_type_id,
         st.name AS size_type_name
       FROM vendor_requests r
       INNER JOIN vendors v ON v.id = r.vendor_id
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN subcategories sc ON sc.id = r.subcategory_id
       LEFT JOIN size_types st ON st.id = r.size_type_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY
         CASE r.status
           WHEN 'pending' THEN 0
           WHEN 'approved' THEN 1
           ELSE 2
         END,
         r.created_at DESC`,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      requestType: row.request_type,
      categoryId: row.category_id,
      categoryName: row.category_name,
      subcategoryId: row.subcategory_id,
      subcategoryName: row.subcategory_name,
      sizeTypeId: row.size_type_id,
      sizeTypeName: row.size_type_name,
      requestedValue: row.requested_value,
      note: row.note,
      status: row.status,
      adminNote: row.admin_note,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      vendor: {
        id: row.vendor_id,
        shopName: row.shop_name,
        email: row.vendor_email,
      },
    }));
  }

  async reviewCatalogRequest(
    adminUserId: string,
    requestId: string,
    dto: ReviewCatalogRequestDto,
  ) {
    const current = await this.databaseService.query<{
      id: string;
      request_type: string;
      requested_value: string;
      status: string;
      admin_note: string | null;
      vendor_id: string;
      shop_name: string;
    }>(
      `SELECT TOP 1
         r.id,
         r.request_type,
         r.requested_value,
         r.status,
         r.admin_note,
         r.vendor_id,
         v.shop_name
       FROM vendor_requests r
       INNER JOIN vendors v ON v.id = r.vendor_id
       WHERE r.id = $1`,
      [requestId],
    );

    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('Catalog request not found');
    }

    const nextStatus = this.normalizeCatalogRequestStatus(dto.status);
    const adminNote = this.normalizeOptionalCatalogText(dto.adminNote, 500);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE vendor_requests
         SET status = $1,
             admin_note = $2,
             reviewed_by_admin_id = $3,
             reviewed_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE id = $4`,
        [nextStatus, adminNote, adminUserId, requestId],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'catalog_request_reviewed',
          entityType: 'catalog_request',
          entityId: requestId,
          entityLabel: row.requested_value,
          description: `${nextStatus === 'approved' ? 'Approved' : 'Rejected'} ${row.request_type} request "${row.requested_value}" from ${row.shop_name}.`,
          metadata: {
            vendorId: row.vendor_id,
            vendorName: row.shop_name,
            requestType: row.request_type,
            previousStatus: row.status,
            nextStatus,
            adminNote,
          },
        },
        client,
      );
    });

    return this.getCatalogRequests();
  }

  async getCatalogStructure() {
    const [
      categories,
      subcategories,
      brands,
      colors,
      sizeTypes,
      sizes,
      genderGroups,
    ] = await Promise.all([
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT id, name, is_active, sort_order
         FROM categories
         ORDER BY sort_order ASC, name ASC`,
      ),
      this.databaseService.query<{
        id: string;
        category_id: string;
        category_name: string;
        name: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT sc.id, sc.category_id, c.name AS category_name, sc.name, sc.is_active, sc.sort_order
         FROM subcategories sc
         INNER JOIN categories c ON c.id = sc.category_id
         ORDER BY c.sort_order ASC, c.name ASC, sc.sort_order ASC, sc.name ASC`,
      ),
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT id, name, is_active, sort_order
         FROM brands
         ORDER BY sort_order ASC, name ASC`,
      ),
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT id, name, is_active, sort_order
         FROM colors
         ORDER BY sort_order ASC, name ASC`,
      ),
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT id, name, is_active, sort_order
         FROM size_types
         ORDER BY sort_order ASC, name ASC`,
      ),
      this.databaseService.query<{
        id: string;
        size_type_id: string;
        size_type_name: string;
        label: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT s.id, s.size_type_id, st.name AS size_type_name, s.label, s.is_active, s.sort_order
         FROM sizes s
         INNER JOIN size_types st ON st.id = s.size_type_id
         ORDER BY st.sort_order ASC, st.name ASC, s.sort_order ASC, s.label ASC`,
      ),
      this.databaseService.query<{
        id: string;
        name: string;
        is_active: boolean;
        sort_order: number;
      }>(
        `SELECT id, name, is_active, sort_order
         FROM gender_groups
         ORDER BY sort_order ASC, name ASC`,
      ),
    ]);

    return {
      categories: categories.rows.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      subcategories: subcategories.rows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        categoryName: row.category_name,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      brands: brands.rows.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      colors: colors.rows.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      sizeTypes: sizeTypes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      sizes: sizes.rows.map((row) => ({
        id: row.id,
        sizeTypeId: row.size_type_id,
        sizeTypeName: row.size_type_name,
        label: row.label,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      genderGroups: genderGroups.rows.map((row) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
    };
  }

  async createCategory(adminUserId: string, dto: CategoryMutationDto) {
    await this.createNamedCatalogEntity(adminUserId, {
      table: 'categories',
      labelField: 'name',
      entityType: 'category',
      value: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.getCatalogStructure();
  }

  async updateCategory(adminUserId: string, id: string, dto: CategoryMutationDto) {
    await this.updateNamedCatalogEntity(adminUserId, id, {
      table: 'categories',
      labelField: 'name',
      entityType: 'category',
      value: dto.name,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    return this.getCatalogStructure();
  }

  async deleteCategory(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'categories',
      labelField: 'name',
      entityType: 'category',
      inUseQuery: `SELECT
        (SELECT COUNT(*) FROM subcategories WHERE category_id = $1) +
        (SELECT COUNT(*) FROM products WHERE category_id = $1) +
        (SELECT COUNT(*) FROM vendor_requests WHERE category_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async createSubcategory(adminUserId: string, dto: SubcategoryMutationDto) {
    await this.assertCategoryExists(dto.categoryId);
    const normalized = this.normalizeNamedCatalogValue(dto.name, 120);
    await this.databaseService.withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO subcategories (category_id, name, is_active, sort_order, updated_at)
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, SYSDATETIME())`,
        [dto.categoryId, normalized, dto.isActive ?? true, Math.max(0, Math.min(dto.sortOrder ?? 0, 999))],
      );
      await this.recordAdminActivity(adminUserId, {
        actionType: 'subcategory_created',
        entityType: 'subcategory',
        entityId: created.rows[0]?.id ?? null,
        entityLabel: normalized,
        description: `Created subcategory "${normalized}".`,
        metadata: { categoryId: dto.categoryId },
      }, client);
    });
    return this.getCatalogStructure();
  }

  async updateSubcategory(adminUserId: string, id: string, dto: SubcategoryMutationDto) {
    await this.assertCategoryExists(dto.categoryId);
    const current = await this.databaseService.query<{ id: string; name: string }>(
      `SELECT TOP 1 id, name FROM subcategories WHERE id = $1`,
      [id],
    );
    if (!current.rows[0]) {
      throw new NotFoundException('Subcategory not found');
    }
    const normalized = this.normalizeNamedCatalogValue(dto.name, 120);
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE subcategories
         SET category_id = $1,
             name = $2,
             is_active = $3,
             sort_order = $4,
             updated_at = SYSDATETIME()
         WHERE id = $5`,
        [dto.categoryId, normalized, dto.isActive ?? true, Math.max(0, Math.min(dto.sortOrder ?? 0, 999)), id],
      );
      await this.recordAdminActivity(adminUserId, {
        actionType: 'subcategory_updated',
        entityType: 'subcategory',
        entityId: id,
        entityLabel: normalized,
        description: `Updated subcategory "${normalized}".`,
        metadata: { categoryId: dto.categoryId },
      }, client);
    });
    return this.getCatalogStructure();
  }

  async deleteSubcategory(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'subcategories',
      labelField: 'name',
      entityType: 'subcategory',
      inUseQuery: `SELECT
        (SELECT COUNT(*) FROM products WHERE subcategory_id = $1) +
        (SELECT COUNT(*) FROM vendor_requests WHERE subcategory_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async createBrand(adminUserId: string, dto: BrandMutationDto) {
    await this.createNamedCatalogEntity(adminUserId, {
      table: 'brands',
      labelField: 'name',
      entityType: 'brand',
      value: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.getCatalogStructure();
  }

  async updateBrand(adminUserId: string, id: string, dto: BrandMutationDto) {
    await this.updateNamedCatalogEntity(adminUserId, id, {
      table: 'brands',
      labelField: 'name',
      entityType: 'brand',
      value: dto.name,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    return this.getCatalogStructure();
  }

  async deleteBrand(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'brands',
      labelField: 'name',
      entityType: 'brand',
      inUseQuery: `SELECT (SELECT COUNT(*) FROM products WHERE brand_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async createColor(adminUserId: string, dto: ColorMutationDto) {
    await this.createNamedCatalogEntity(adminUserId, {
      table: 'colors',
      labelField: 'name',
      entityType: 'color',
      value: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.getCatalogStructure();
  }

  async updateColor(adminUserId: string, id: string, dto: ColorMutationDto) {
    await this.updateNamedCatalogEntity(adminUserId, id, {
      table: 'colors',
      labelField: 'name',
      entityType: 'color',
      value: dto.name,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    return this.getCatalogStructure();
  }

  async deleteColor(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'colors',
      labelField: 'name',
      entityType: 'color',
      inUseQuery: `SELECT (SELECT COUNT(*) FROM product_colors WHERE color_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async createSizeType(adminUserId: string, dto: SizeTypeMutationDto) {
    await this.createNamedCatalogEntity(adminUserId, {
      table: 'size_types',
      labelField: 'name',
      entityType: 'size_type',
      value: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.getCatalogStructure();
  }

  async updateSizeType(adminUserId: string, id: string, dto: SizeTypeMutationDto) {
    await this.updateNamedCatalogEntity(adminUserId, id, {
      table: 'size_types',
      labelField: 'name',
      entityType: 'size_type',
      value: dto.name,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    return this.getCatalogStructure();
  }

  async deleteSizeType(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'size_types',
      labelField: 'name',
      entityType: 'size_type',
      inUseQuery: `SELECT
        (SELECT COUNT(*) FROM sizes WHERE size_type_id = $1) +
        (SELECT COUNT(*) FROM vendor_requests WHERE size_type_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async createSize(adminUserId: string, dto: SizeMutationDto) {
    await this.assertSizeTypeExists(dto.sizeTypeId);
    const normalized = this.normalizeNamedCatalogValue(dto.label, 120);
    await this.databaseService.withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO sizes (size_type_id, label, is_active, sort_order, updated_at)
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, SYSDATETIME())`,
        [dto.sizeTypeId, normalized, dto.isActive ?? true, Math.max(0, Math.min(dto.sortOrder ?? 0, 999))],
      );
      await this.recordAdminActivity(adminUserId, {
        actionType: 'size_created',
        entityType: 'size',
        entityId: created.rows[0]?.id ?? null,
        entityLabel: normalized,
        description: `Created size "${normalized}".`,
        metadata: { sizeTypeId: dto.sizeTypeId },
      }, client);
    });
    return this.getCatalogStructure();
  }

  async updateSize(adminUserId: string, id: string, dto: SizeMutationDto) {
    await this.assertSizeTypeExists(dto.sizeTypeId);
    const current = await this.databaseService.query<{ id: string }>(
      `SELECT TOP 1 id FROM sizes WHERE id = $1`,
      [id],
    );
    if (!current.rows[0]) {
      throw new NotFoundException('Size not found');
    }
    const normalized = this.normalizeNamedCatalogValue(dto.label, 120);
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE sizes
         SET size_type_id = $1,
             label = $2,
             is_active = $3,
             sort_order = $4,
             updated_at = SYSDATETIME()
         WHERE id = $5`,
        [dto.sizeTypeId, normalized, dto.isActive ?? true, Math.max(0, Math.min(dto.sortOrder ?? 0, 999)), id],
      );
      await this.recordAdminActivity(adminUserId, {
        actionType: 'size_updated',
        entityType: 'size',
        entityId: id,
        entityLabel: normalized,
        description: `Updated size "${normalized}".`,
        metadata: { sizeTypeId: dto.sizeTypeId },
      }, client);
    });
    return this.getCatalogStructure();
  }

  async deleteSize(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'sizes',
      labelField: 'label',
      entityType: 'size',
      inUseQuery: `SELECT (SELECT COUNT(*) FROM product_sizes WHERE size_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async createGenderGroup(adminUserId: string, dto: GenderGroupMutationDto) {
    await this.createNamedCatalogEntity(adminUserId, {
      table: 'gender_groups',
      labelField: 'name',
      entityType: 'gender_group',
      value: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.getCatalogStructure();
  }

  async updateGenderGroup(adminUserId: string, id: string, dto: GenderGroupMutationDto) {
    await this.updateNamedCatalogEntity(adminUserId, id, {
      table: 'gender_groups',
      labelField: 'name',
      entityType: 'gender_group',
      value: dto.name,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    return this.getCatalogStructure();
  }

  async deleteGenderGroup(adminUserId: string, id: string) {
    await this.deleteCatalogEntity(adminUserId, {
      id,
      table: 'gender_groups',
      labelField: 'name',
      entityType: 'gender_group',
      inUseQuery: `SELECT (SELECT COUNT(*) FROM products WHERE gender_group_id = $1) AS usage_count`,
    });
    return this.getCatalogStructure();
  }

  async getCatalogMasterData() {
    const result = await this.databaseService.query<{
      id: string;
      option_type: string;
      department: string | null;
      parent_value: string | null;
      value: string;
      is_active: boolean;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT
         id,
         option_type,
         department,
         parent_value,
         value,
         is_active,
         sort_order,
         created_at,
         updated_at
       FROM catalog_master_values
       ORDER BY
         option_type ASC,
         CASE WHEN department IS NULL OR LTRIM(RTRIM(department)) = '' THEN 1 ELSE 0 END,
         department ASC,
         sort_order ASC,
         value ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      optionType: row.option_type,
      department: row.department,
      parentValue: row.parent_value,
      value: row.value,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createCatalogMasterData(
    adminUserId: string,
    dto: CatalogMasterDataMutationDto,
  ) {
    const normalized = this.normalizeCatalogMasterDataPayload(dto);

    await this.databaseService.withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO catalog_master_values (
           option_type,
           department,
           parent_value,
           value,
           is_active,
           sort_order,
           updated_at
         )
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, $5, $6, SYSDATETIME())`,
        [
          normalized.optionType,
          normalized.department,
          normalized.parentValue,
          normalized.value,
          normalized.isActive,
          normalized.sortOrder,
        ],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'catalog_master_data_created',
          entityType: 'catalog_master_value',
          entityId: created.rows[0]?.id ?? null,
          entityLabel: normalized.value,
          description: `Created ${normalized.optionType} value "${normalized.value}".`,
          metadata: normalized,
        },
        client,
      );
    });

    return this.getCatalogMasterData();
  }

  async updateCatalogMasterData(
    adminUserId: string,
    masterDataId: string,
    dto: CatalogMasterDataMutationDto,
  ) {
    const current = await this.databaseService.query<{
      id: string;
      option_type: string;
      department: string | null;
      parent_value: string | null;
      value: string;
      is_active: boolean;
      sort_order: number;
    }>(
      `SELECT TOP 1
         id,
         option_type,
         department,
         parent_value,
         value,
         is_active,
         sort_order
       FROM catalog_master_values
       WHERE id = $1`,
      [masterDataId],
    );

    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('Catalog value not found');
    }

    const normalized = this.normalizeCatalogMasterDataPayload({
      optionType: dto.optionType ?? row.option_type,
      department: dto.department ?? row.department ?? undefined,
      parentValue: dto.parentValue ?? row.parent_value ?? undefined,
      value: dto.value ?? row.value,
      isActive: dto.isActive ?? row.is_active,
      sortOrder: dto.sortOrder ?? row.sort_order,
    });

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE catalog_master_values
         SET option_type = $1,
             department = $2,
             parent_value = $3,
             value = $4,
             is_active = $5,
             sort_order = $6,
             updated_at = SYSDATETIME()
         WHERE id = $7`,
        [
          normalized.optionType,
          normalized.department,
          normalized.parentValue,
          normalized.value,
          normalized.isActive,
          normalized.sortOrder,
          masterDataId,
        ],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'catalog_master_data_updated',
          entityType: 'catalog_master_value',
          entityId: masterDataId,
          entityLabel: normalized.value,
          description: `Updated ${normalized.optionType} value "${normalized.value}".`,
          metadata: normalized,
        },
        client,
      );
    });

    return this.getCatalogMasterData();
  }

  async deleteCatalogMasterData(adminUserId: string, masterDataId: string) {
    const current = await this.databaseService.query<{
      id: string;
      option_type: string;
      value: string;
    }>(
      `SELECT TOP 1 id, option_type, value
       FROM catalog_master_values
       WHERE id = $1`,
      [masterDataId],
    );

    const row = current.rows[0];
    if (!row) {
      throw new NotFoundException('Catalog value not found');
    }

    await this.databaseService.withTransaction(async (client) => {
      await client.query('DELETE FROM catalog_master_values WHERE id = $1', [
        masterDataId,
      ]);

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'catalog_master_data_deleted',
          entityType: 'catalog_master_value',
          entityId: masterDataId,
          entityLabel: row.value,
          description: `Deleted ${row.option_type} value "${row.value}".`,
        },
        client,
      );
    });

    return this.getCatalogMasterData();
  }

  async getPromotionSettings() {
    const settings = await this.databaseService.query<{
      homepage_hero_autoplay_enabled: boolean;
      homepage_hero_interval_seconds: number | null;
    }>(
      `SELECT TOP 1
         homepage_hero_autoplay_enabled,
         homepage_hero_interval_seconds
       FROM platform_settings
       WHERE id = 1`,
    );

    return {
      autoRotate: settings.rows[0]
        ? Boolean(settings.rows[0].homepage_hero_autoplay_enabled)
        : true,
      intervalSeconds:
        settings.rows[0]?.homepage_hero_interval_seconds ??
        DEFAULT_HOMEPAGE_HERO_INTERVAL_SECONDS,
      promotions: await this.getHomepageHeroSlidesForAdmin(),
    };
  }

  async updatePromotionSettings(
    adminUserId: string,
    dto: { autoRotate?: boolean; intervalSeconds?: number },
  ) {
    const updates: string[] = [];
    const values: unknown[] = [];
    const changedAreas: string[] = [];

    const pushUpdate = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (dto.autoRotate !== undefined) {
      pushUpdate('homepage_hero_autoplay_enabled', dto.autoRotate);
      changedAreas.push('homepage autoplay');
    }

    if (dto.intervalSeconds !== undefined) {
      pushUpdate('homepage_hero_interval_seconds', dto.intervalSeconds);
      changedAreas.push('homepage rotation interval');
    }

    if (!updates.length) {
      return this.getPromotionSettings();
    }

    await this.databaseService.withTransaction(async (client) => {
      const statementValues = [...values, 1];
      await client.query(
        `UPDATE platform_settings
         SET ${updates.join(', ')},
             updated_at = SYSDATETIME()
         WHERE id = $${statementValues.length}`,
        statementValues,
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'platform_settings_updated',
          entityType: 'promotion_settings',
          entityLabel: 'Homepage promotions',
          description: `Updated promotion settings: ${changedAreas.join(', ')}.`,
          metadata: {
            changedAreas,
          },
        },
        client,
      );
    });

    return this.getPromotionSettings();
  }

  async createPromotion(
    adminUserId: string,
    dto: {
      internalName: string;
      customUrl: string;
      isActive: boolean;
      displayOrder: number;
      startDate?: string;
      endDate?: string;
    },
    desktopImage?: UploadedFile,
    mobileImage?: UploadedFile,
  ) {
    if (!desktopImage) {
      this.cleanupTemporaryFile(mobileImage);
      throw new BadRequestException('Desktop banner image is required');
    }

    const normalized = this.normalizePromotionPayload(dto);
    let storedDesktopImageUrl: string | null = null;
    let storedMobileImageUrl: string | null = null;

    try {
      storedDesktopImageUrl = this.storeHomepagePromotionImage(
        desktopImage,
        'desktop',
      );
      storedMobileImageUrl = mobileImage
        ? this.storeHomepagePromotionImage(mobileImage, 'mobile')
        : null;
    } catch (error) {
      this.cleanupTemporaryFile(desktopImage);
      this.cleanupTemporaryFile(mobileImage);
      throw error;
    }

    try {
      await this.databaseService.withTransaction(async (client) => {
        const created = await client.query<{ id: string }>(
          `INSERT INTO homepage_hero_slides (
             internal_name,
             desktop_image_url,
             mobile_image_url,
             target_url,
             is_active,
             sort_order,
             starts_at,
             ends_at,
             updated_at
           )
           OUTPUT INSERTED.id
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, SYSDATETIME())`,
          [
            normalized.internalName,
            storedDesktopImageUrl,
            storedMobileImageUrl,
            normalized.customUrl,
            normalized.isActive,
            normalized.displayOrder,
            normalized.startsAt,
            normalized.endsAt,
          ],
        );

        await this.reorderPromotionSortOrders(
          client,
          created.rows[0].id,
          normalized.displayOrder,
        );

        await this.recordAdminActivity(
          adminUserId,
          {
            actionType: 'platform_settings_updated',
            entityType: 'promotion',
            entityId: created.rows[0]?.id ?? null,
            entityLabel: normalized.internalName,
            description: `Created promotion banner ${normalized.internalName}.`,
            metadata: {
              customUrl: normalized.customUrl,
              isActive: normalized.isActive,
              displayOrder: normalized.displayOrder,
            },
          },
          client,
        );
      });
    } catch (error) {
      this.deleteStoredMedia(storedDesktopImageUrl);
      this.deleteStoredMedia(storedMobileImageUrl);
      throw error;
    }

    return this.getPromotionSettings();
  }

  async updatePromotion(
    adminUserId: string,
    promotionId: string,
    dto: {
      internalName?: string;
      customUrl?: string;
      isActive?: boolean;
      displayOrder?: number;
      startDate?: string;
      endDate?: string;
      clearMobileImage?: boolean;
    },
    desktopImage?: UploadedFile,
    mobileImage?: UploadedFile,
  ) {
    const current = await this.getPromotionRow(promotionId);

    const normalized = this.normalizePromotionPayload({
      internalName: dto.internalName ?? current.internal_name,
      customUrl: dto.customUrl ?? current.target_url ?? '',
      isActive: dto.isActive ?? current.is_active,
      displayOrder: dto.displayOrder ?? current.sort_order,
      startDate:
        dto.startDate !== undefined
          ? dto.startDate
          : current.starts_at
            ? current.starts_at.toISOString()
            : undefined,
      endDate:
        dto.endDate !== undefined
          ? dto.endDate
          : current.ends_at
            ? current.ends_at.toISOString()
            : undefined,
    });

    let storedDesktopImageUrl: string | null = null;
    let storedMobileImageUrl: string | null = null;

    try {
      storedDesktopImageUrl = desktopImage
        ? this.storeHomepagePromotionImage(desktopImage, 'desktop')
        : null;
      storedMobileImageUrl = mobileImage
        ? this.storeHomepagePromotionImage(mobileImage, 'mobile')
        : null;
    } catch (error) {
      this.cleanupTemporaryFile(desktopImage);
      this.cleanupTemporaryFile(mobileImage);
      throw error;
    }

    const nextDesktopImageUrl =
      storedDesktopImageUrl ?? current.desktop_image_url ?? null;
    const nextMobileImageUrl = storedMobileImageUrl
      ? storedMobileImageUrl
      : dto.clearMobileImage
        ? null
        : current.mobile_image_url;

    if (!nextDesktopImageUrl) {
      throw new BadRequestException('Desktop banner image is required');
    }

    try {
      await this.databaseService.withTransaction(async (client) => {
        await client.query(
          `UPDATE homepage_hero_slides
           SET internal_name = $1,
               desktop_image_url = $2,
               mobile_image_url = $3,
               target_url = $4,
               is_active = $5,
               sort_order = $6,
               starts_at = $7,
               ends_at = $8,
               updated_at = SYSDATETIME()
           WHERE id = $9`,
          [
            normalized.internalName,
            nextDesktopImageUrl,
            nextMobileImageUrl,
            normalized.customUrl,
            normalized.isActive,
            normalized.displayOrder,
            normalized.startsAt,
            normalized.endsAt,
            promotionId,
          ],
        );

        await this.reorderPromotionSortOrders(
          client,
          promotionId,
          normalized.displayOrder,
        );

        await this.recordAdminActivity(
          adminUserId,
          {
            actionType: 'platform_settings_updated',
            entityType: 'promotion',
            entityId: promotionId,
            entityLabel: normalized.internalName,
            description: `Updated promotion banner ${normalized.internalName}.`,
            metadata: {
              customUrl: normalized.customUrl,
              isActive: normalized.isActive,
              displayOrder: normalized.displayOrder,
            },
          },
          client,
        );
      });
    } catch (error) {
      this.deleteStoredMedia(storedDesktopImageUrl);
      this.deleteStoredMedia(storedMobileImageUrl);
      throw error;
    }

    if (
      storedDesktopImageUrl &&
      current.desktop_image_url &&
      current.desktop_image_url !== storedDesktopImageUrl
    ) {
      this.deleteStoredMedia(current.desktop_image_url);
    }

    if (
      storedMobileImageUrl &&
      current.mobile_image_url &&
      current.mobile_image_url !== storedMobileImageUrl
    ) {
      this.deleteStoredMedia(current.mobile_image_url);
    }

    if (dto.clearMobileImage && current.mobile_image_url && !storedMobileImageUrl) {
      this.deleteStoredMedia(current.mobile_image_url);
    }

    return this.getPromotionSettings();
  }

  async deletePromotion(adminUserId: string, promotionId: string) {
    const current = await this.getPromotionRow(promotionId);

    await this.databaseService.withTransaction(async (client) => {
      await client.query('DELETE FROM homepage_hero_slides WHERE id = $1', [
        promotionId,
      ]);

      await this.normalizePromotionSortOrders(client);

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'platform_settings_updated',
          entityType: 'promotion',
          entityId: promotionId,
          entityLabel: current.internal_name,
          description: `Deleted promotion banner ${current.internal_name}.`,
        },
        client,
      );
    });

    this.deleteStoredMedia(current.desktop_image_url);
    this.deleteStoredMedia(current.mobile_image_url);

    return this.getPromotionSettings();
  }

  async sendPlatformTestEmail(adminUserId: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.mailService.sendPlatformTestEmail(normalizedEmail);
    await this.recordAdminActivity(adminUserId, {
      actionType: 'platform_test_email_sent',
      entityType: 'platform_settings',
      entityLabel: normalizedEmail,
      description: `Sent a platform test email to ${normalizedEmail}.`,
      metadata: {
        recipient: normalizedEmail,
      },
    });
    return { message: `Test email sent to ${normalizedEmail}` };
  }

  private async getHomepageHeroSlidesForAdmin() {
    const result = await this.databaseService.query<{
      id: string;
      internal_name: string | null;
      desktop_image_url: string | null;
      mobile_image_url: string | null;
      target_url: string | null;
      is_active: boolean;
      sort_order: number;
      starts_at: Date | null;
      ends_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT
         hs.id,
         hs.internal_name,
         hs.desktop_image_url,
         hs.mobile_image_url,
         hs.target_url,
         hs.is_active,
         hs.sort_order,
         hs.starts_at,
         hs.ends_at,
         hs.updated_at
       FROM homepage_hero_slides hs
       ORDER BY hs.sort_order ASC, hs.created_at ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      internalName: row.internal_name,
      desktopImageUrl: row.desktop_image_url,
      mobileImageUrl: row.mobile_image_url,
      customUrl: row.target_url,
      isActive: row.is_active,
      displayOrder: row.sort_order,
      startDate: row.starts_at,
      endDate: row.ends_at,
      updatedAt: row.updated_at,
      isScheduledNow: this.isPromotionInSchedule(row.starts_at, row.ends_at),
    }));
  }

  async getVendorPayouts() {
    const result = await this.databaseService.query<{
      vendor_id: string;
      shop_name: string;
      vendor_email: string;
      gross_sales: number | string;
      total_commission: number | string;
      payable_now: number | string;
      total_vendor_earnings: number | string;
      shipped_balance: number | string;
      paid_out: number | string;
      outstanding_shipped_balance: number | string;
      order_count: number;
    }>(
      `SELECT
         v.id AS vendor_id,
         v.shop_name,
         u.email AS vendor_email,
         ISNULL(SUM(oi.unit_price * oi.quantity), 0) AS gross_sales,
         ISNULL(SUM(oi.commission_amount), 0) AS total_commission,
         ISNULL(SUM(CASE WHEN oi.status IN ('pending', 'confirmed') THEN oi.vendor_earnings ELSE 0 END), 0) AS payable_now,
         ISNULL(SUM(oi.vendor_earnings), 0) AS total_vendor_earnings,
         ISNULL(SUM(CASE
           WHEN oi.status = 'delivered' AND (o.payment_method = 'card' OR o.payment_status = 'cod_collected')
             THEN oi.vendor_earnings
           ELSE 0
         END), 0) AS shipped_balance,
         ISNULL((SELECT SUM(vp.amount) FROM vendor_payouts vp WHERE vp.vendor_id = v.id), 0) AS paid_out,
         ISNULL(SUM(CASE
           WHEN oi.status = 'delivered' AND (o.payment_method = 'card' OR o.payment_status = 'cod_collected')
             THEN oi.vendor_earnings
           ELSE 0
         END), 0)
           - ISNULL((SELECT SUM(vp.amount) FROM vendor_payouts vp WHERE vp.vendor_id = v.id), 0) AS outstanding_shipped_balance,
         COUNT(DISTINCT oi.order_id) AS order_count
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN order_items oi ON oi.vendor_id = v.id
       LEFT JOIN orders o ON o.id = oi.order_id
       GROUP BY
         v.id,
         v.shop_name,
         u.email
       ORDER BY payable_now DESC, total_vendor_earnings DESC, v.shop_name ASC`,
    );

    return result.rows.map((row) => ({
      vendorId: row.vendor_id,
      shopName: row.shop_name,
      vendorEmail: row.vendor_email,
      grossSales: Number(row.gross_sales),
      totalCommission: Number(row.total_commission),
      payableNow: Number(row.payable_now),
      totalVendorEarnings: Number(row.total_vendor_earnings),
      shippedBalance: Number(row.shipped_balance),
      paidOut: Number(row.paid_out),
      outstandingShippedBalance: Math.max(
        0,
        Number(row.outstanding_shipped_balance),
      ),
      orderCount: row.order_count,
    }));
  }

  async recordVendorPayout(
    adminUserId: string,
    payload: {
      vendorId: string;
      amount: number;
      reference?: string | null;
      note?: string | null;
    },
  ) {
    const vendor = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM vendors WHERE id = $1',
      [payload.vendorId],
    );

    if (!vendor.rows[0]) {
      throw new NotFoundException('Vendor not found');
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }

    const payoutRows = await this.getVendorPayouts();
    const row = payoutRows.find((entry) => entry.vendorId === payload.vendorId);
    const outstanding = row?.outstandingShippedBalance ?? 0;

    if (amount > outstanding) {
      throw new BadRequestException(
        'Payout amount exceeds delivered unpaid balance',
      );
    }

    await this.databaseService.query(
      `INSERT INTO vendor_payouts (vendor_id, admin_user_id, amount, reference, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        payload.vendorId,
        adminUserId,
        Number(amount.toFixed(2)),
        payload.reference?.trim() || null,
        payload.note?.trim() || null,
      ],
    );

    return {
      message: 'Vendor payout recorded',
      payouts: await this.getVendorPayouts(),
    };
  }

  async getUsers() {
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      role: string;
      is_active: boolean;
      created_at: Date;
      vendor_id: string | null;
      shop_name: string | null;
      vendor_active: boolean | null;
      vendor_verified: boolean | null;
    }>(
      `SELECT
         u.id,
         u.email,
         u.role,
         u.is_active,
         u.created_at,
         v.id AS vendor_id,
         v.shop_name,
         v.is_active AS vendor_active,
         v.is_verified AS vendor_verified
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       ORDER BY u.created_at DESC`,
    );

    return result.rows;
  }

  async getUserById(userId: string) {
    const user = await this.databaseService.query<{
      id: string;
      email: string;
      phone_number: string | null;
      role: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
      vendor_id: string | null;
      shop_name: string | null;
      vendor_active: boolean | null;
      vendor_verified: boolean | null;
      approved_at: Date | null;
    }>(
      `SELECT TOP 1
         u.id,
         u.email,
         u.phone_number,
         u.role,
         u.is_active,
         u.created_at,
         u.updated_at,
         v.id AS vendor_id,
         v.shop_name,
         v.is_active AS vendor_active,
         v.is_verified AS vendor_verified,
         v.approved_at
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    const record = user.rows[0];
    if (!record) {
      throw new NotFoundException('User not found');
    }

    const [customerOrders, recentOrders, cartItems, vendorStats] =
      await Promise.all([
        this.databaseService.query<{
          order_count: number;
          total_spend: number | string;
        }>(
          `SELECT COUNT(*) AS order_count, ISNULL(SUM(total_price), 0) AS total_spend
         FROM orders
         WHERE customer_id = $1`,
          [userId],
        ),
        this.databaseService.query<{
          id: string;
          order_number: string | null;
          total_price: number | string;
          status: string;
          special_request: string | null;
          created_at: Date;
        }>(
          `SELECT TOP 8 id, order_number, total_price, status, special_request, created_at
         FROM orders
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
          [userId],
        ),
        this.databaseService.query<{
          product_id: string;
          quantity: number;
          title: string;
          price: number | string;
          category: string;
          updated_at: Date;
        }>(
          `SELECT
           ci.product_id,
           ci.quantity,
           p.title,
           p.price,
           p.category,
           ci.updated_at
         FROM carts c
         INNER JOIN cart_items ci ON ci.cart_id = c.id
         INNER JOIN products p ON p.id = ci.product_id
         WHERE c.customer_id = $1
         ORDER BY ci.updated_at DESC`,
          [userId],
        ),
        record.vendor_id
          ? this.databaseService.query<{
              product_count: number;
              item_count: number;
              vendor_order_count: number;
              total_earnings: number | string;
              total_commission: number | string;
            }>(
              `SELECT
               (SELECT COUNT(*) FROM products WHERE vendor_id = $1) AS product_count,
               (SELECT ISNULL(SUM(stock), 0) FROM products WHERE vendor_id = $1) AS item_count,
               (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE vendor_id = $1) AS vendor_order_count,
               (SELECT ISNULL(SUM(vendor_earnings), 0) FROM order_items WHERE vendor_id = $1) AS total_earnings,
               (SELECT ISNULL(SUM(commission_amount), 0) FROM order_items WHERE vendor_id = $1) AS total_commission`,
              [record.vendor_id],
            )
          : Promise.resolve({
              rows: [] as {
                product_count: number;
                item_count: number;
                vendor_order_count: number;
                total_earnings: number | string;
                total_commission: number | string;
              }[],
            }),
      ]);

    return {
      id: record.id,
      email: record.email,
      phoneNumber: record.phone_number,
      role: record.role,
      isActive: record.is_active,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      customer: {
        orderCount: customerOrders.rows[0].order_count,
        totalSpend: Number(customerOrders.rows[0].total_spend),
        recentOrders: recentOrders.rows.map((row) => ({
          id: row.id,
          orderNumber: row.order_number ?? row.id,
          totalPrice: Number(row.total_price),
          status: row.status,
          specialRequest: row.special_request,
          createdAt: row.created_at,
        })),
        cart: {
          itemCount: cartItems.rows.length,
          items: cartItems.rows.map((row) => ({
            productId: row.product_id,
            title: row.title,
            category: row.category,
            quantity: row.quantity,
            price: Number(row.price),
            updatedAt: row.updated_at,
          })),
        },
      },
      vendor: record.vendor_id
        ? {
            id: record.vendor_id,
            shopName: record.shop_name,
            isActive: record.vendor_active,
            isVerified: record.vendor_verified,
            approvedAt: record.approved_at,
            productCount: vendorStats.rows[0]?.product_count ?? 0,
            inventoryUnits: vendorStats.rows[0]?.item_count ?? 0,
            orderCount: vendorStats.rows[0]?.vendor_order_count ?? 0,
            totalEarnings: Number(vendorStats.rows[0]?.total_earnings ?? 0),
            totalCommission: Number(vendorStats.rows[0]?.total_commission ?? 0),
          }
        : null,
    };
  }

  async getVendorById(vendorId: string) {
    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
      is_active: boolean;
      is_verified: boolean;
      approved_at: Date | null;
      created_at: Date;
      updated_at: Date;
      user_id: string;
      user_email: string;
      user_active: boolean;
    }>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.is_active,
         v.is_verified,
         v.approved_at,
         v.created_at,
         v.updated_at,
         u.id AS user_id,
         u.email AS user_email,
         u.is_active AS user_active
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [vendorId],
    );

    const record = vendor.rows[0];
    if (!record) {
      throw new NotFoundException('Vendor not found');
    }

    const [
      metrics,
      categoryRows,
      recentOrders,
      payoutHistory,
    ] = await Promise.all([
      this.databaseService.query<{
        product_count: number;
        inventory_units: number;
        order_count: number;
        total_earnings: number | string;
        total_commission: number | string;
        pending_items: number;
        shipped_items: number;
        paid_out: number | string;
        outstanding_shipped_balance: number | string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM products WHERE vendor_id = $1) AS product_count,
           (SELECT ISNULL(SUM(stock), 0) FROM products WHERE vendor_id = $1) AS inventory_units,
           (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE vendor_id = $1) AS order_count,
           (SELECT ISNULL(SUM(vendor_earnings), 0) FROM order_items WHERE vendor_id = $1) AS total_earnings,
           (SELECT ISNULL(SUM(commission_amount), 0) FROM order_items WHERE vendor_id = $1) AS total_commission,
           (SELECT COUNT(*) FROM order_items WHERE vendor_id = $1 AND status = 'pending') AS pending_items,
           (SELECT COUNT(*) FROM order_items WHERE vendor_id = $1 AND status = 'shipped') AS shipped_items,
           (SELECT ISNULL(SUM(amount), 0) FROM vendor_payouts WHERE vendor_id = $1) AS paid_out,
           (SELECT ISNULL(SUM(oi.vendor_earnings), 0)
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE oi.vendor_id = $1
              AND oi.status = 'delivered'
              AND (o.payment_method = 'card' OR o.payment_status = 'cod_collected'))
             - (SELECT ISNULL(SUM(amount), 0) FROM vendor_payouts WHERE vendor_id = $1) AS outstanding_shipped_balance`,
        [vendorId],
      ),
      this.databaseService.query<{
        category: string;
        product_count: number;
      }>(
        `SELECT category, COUNT(*) AS product_count
         FROM products
         WHERE vendor_id = $1
         GROUP BY category
         ORDER BY product_count DESC, category ASC`,
        [vendorId],
      ),
      this.databaseService.query<{
        order_id: string;
        order_number: string | null;
        quantity: number;
        vendor_earnings: number | string;
        status: string;
        product_title: string;
        product_code: string | null;
        shipping_carrier: string | null;
        tracking_number: string | null;
        shipped_at: Date | null;
        created_at: Date;
      }>(
        `SELECT TOP 6
          oi.order_id,
          o.order_number,
          oi.quantity,
          oi.vendor_earnings,
          oi.status,
          p.title AS product_title,
          p.product_code,
          oi.shipping_carrier,
          oi.tracking_number,
          oi.shipped_at,
          oi.created_at
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN products p ON p.id = oi.product_id
         WHERE oi.vendor_id = $1
         ORDER BY oi.created_at DESC`,
        [vendorId],
      ),
      this.databaseService.query<{
        id: string;
        amount: number | string;
        reference: string | null;
        note: string | null;
        paid_at: Date;
      }>(
        `SELECT TOP 8 id, amount, reference, note, paid_at
         FROM vendor_payouts
         WHERE vendor_id = $1
         ORDER BY paid_at DESC`,
        [vendorId],
      ),
    ]);

    return {
      id: record.id,
      shopName: record.shop_name,
      isActive: record.is_active,
      isVerified: record.is_verified,
      approvedAt: record.approved_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      user: {
        id: record.user_id,
        email: record.user_email,
        isActive: record.user_active,
      },
      metrics: {
        productCount: metrics.rows[0].product_count,
        inventoryUnits: metrics.rows[0].inventory_units,
        orderCount: metrics.rows[0].order_count,
        totalEarnings: Number(metrics.rows[0].total_earnings),
        totalCommission: Number(metrics.rows[0].total_commission),
        pendingItems: metrics.rows[0].pending_items,
        shippedItems: metrics.rows[0].shipped_items,
        paidOut: Number(metrics.rows[0].paid_out),
        outstandingShippedBalance: Math.max(
          0,
          Number(metrics.rows[0].outstanding_shipped_balance),
        ),
      },
      categories: categoryRows.rows.map((row) => ({
        category: row.category,
        productCount: row.product_count,
      })),
      recentOrderItems: recentOrders.rows.map((row) => ({
        orderId: row.order_id,
        orderNumber: row.order_number ?? row.order_id,
        productTitle: row.product_title,
        productCode: row.product_code,
        quantity: row.quantity,
        vendorEarnings: Number(row.vendor_earnings),
        status: row.status,
        shipment: {
          shippingCarrier: row.shipping_carrier,
          trackingNumber: row.tracking_number,
          shippedAt: row.shipped_at,
        },
        createdAt: row.created_at,
      })),
      payoutHistory: payoutHistory.rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        reference: row.reference,
        note: row.note,
        paidAt: row.paid_at,
      })),
    };
  }

  async getVendorOrders(vendorId: string, status?: string) {
    const vendor = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM vendors WHERE id = $1',
      [vendorId],
    );

    if (!vendor.rows[0]) {
      throw new NotFoundException('Vendor not found');
    }

    const normalizedStatus = status?.trim().toLowerCase() || 'all';
    const filters: string[] = ['oi.vendor_id = $1'];
    const values: Array<string> = [vendorId];

    if (normalizedStatus !== 'all') {
      filters.push(`oi.status = $${values.length + 1}`);
      values.push(normalizedStatus);
    }

    const orders = await this.databaseService.query<{
      order_id: string;
      order_number: string | null;
      customer_email: string | null;
      quantity: number;
      vendor_earnings: number | string;
      status: string;
      product_title: string;
      product_code: string | null;
      shipping_carrier: string | null;
      tracking_number: string | null;
      shipped_at: Date | null;
      created_at: Date;
    }>(
      `SELECT
         oi.order_id,
         o.order_number,
         COALESCE(u.email, o.guest_email) AS customer_email,
         oi.quantity,
         oi.vendor_earnings,
         oi.status,
         p.title AS product_title,
         p.product_code,
         oi.shipping_carrier,
         oi.tracking_number,
         oi.shipped_at,
         oi.created_at
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       INNER JOIN products p ON p.id = oi.product_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE ${filters.join(' AND ')}
       ORDER BY oi.created_at DESC`,
      values,
    );

    return orders.rows.map((row) => ({
      orderId: row.order_id,
      orderNumber: row.order_number ?? row.order_id,
      customerEmail: row.customer_email ?? 'Guest checkout',
      productTitle: row.product_title,
      productCode: row.product_code,
      quantity: row.quantity,
      vendorEarnings: Number(row.vendor_earnings),
      status: row.status,
      shipment: {
        shippingCarrier: row.shipping_carrier,
        trackingNumber: row.tracking_number,
        shippedAt: row.shipped_at,
      },
      createdAt: row.created_at,
    }));
  }

  async getOrderById(orderId: string) {
    const orders = await this.ordersService.getAllOrders();
    const order = orders.find((entry) => entry.id === orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateCodStatus(
    adminUserId: string,
    orderId: string,
    payload: {
      paymentStatus: 'cod_pending' | 'cod_collected' | 'cod_refused';
      note?: string;
    },
  ) {
    const existing = await this.databaseService.query<{
      id: string;
      payment_method: string;
      status: string;
      payment_status: string;
    }>(
      'SELECT TOP 1 id, payment_method, status, payment_status FROM orders WHERE id = $1',
      [orderId],
    );

    if (!existing.rows[0]) {
      throw new NotFoundException('Order not found');
    }

    if (existing.rows[0].payment_method !== 'cash_on_delivery') {
      throw new BadRequestException(
        'Only cash on delivery orders can use COD status updates',
      );
    }

    if (
      payload.paymentStatus === 'cod_collected' &&
      existing.rows[0].status !== 'delivered'
    ) {
      throw new BadRequestException(
        'COD cash can only be collected after the order is delivered',
      );
    }

    if (
      payload.paymentStatus === 'cod_refused' &&
      existing.rows[0].payment_status === 'cod_collected'
    ) {
      throw new BadRequestException(
        'Collected COD orders cannot be marked as refused',
      );
    }

    await this.databaseService.query(
      `UPDATE orders
       SET payment_status = $1,
           cod_status_note = $2,
           cod_updated_at = SYSDATETIME(),
           updated_at = SYSDATETIME()
       WHERE id = $3`,
      [payload.paymentStatus, payload.note?.trim() || null, orderId],
    );

    await this.recordAdminActivity(adminUserId, {
      actionType: 'order_cod_status_updated',
      entityType: 'order',
      entityId: orderId,
      entityLabel: orderId,
      description: `Updated order COD status to ${payload.paymentStatus}.`,
      metadata: {
        paymentStatus: payload.paymentStatus,
        note: payload.note?.trim() || null,
      },
    });

    return this.getOrderById(orderId);
  }

  async getCodOrders() {
    const orders = await this.ordersService.getAllOrders();
    return orders.filter((order) => order.paymentMethod === 'cash_on_delivery');
  }

  async updateUserContact(
    adminUserId: string,
    userId: string,
    payload: { email?: string; phoneNumber?: string | null },
  ) {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (payload.email !== undefined) {
      values.push(payload.email.trim().toLowerCase());
      updates.push(`email = $${values.length}`);
    }

    if (payload.phoneNumber !== undefined) {
      values.push(payload.phoneNumber?.trim() || null);
      updates.push(`phone_number = $${values.length}`);
    }

    if (!updates.length) {
      return this.getUserById(userId);
    }

    await this.databaseService.withTransaction(async (client) => {
      const statementValues = [...values, userId];
      const result = await client.query<{ id: string }>(
        `UPDATE users
         SET ${updates.join(', ')}, updated_at = SYSDATETIME()
         OUTPUT INSERTED.id
         WHERE id = $${statementValues.length}`,
        statementValues,
      );

      if (!result.rows[0]) {
        throw new NotFoundException('User not found');
      }

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'user_contact_updated',
          entityType: 'user',
          entityId: userId,
          entityLabel: payload.email?.trim().toLowerCase() || userId,
          description: 'Updated user contact details.',
          metadata: {
            email: payload.email?.trim().toLowerCase() || undefined,
            phoneNumber: payload.phoneNumber?.trim() || null,
          },
        },
        client,
      );
    });

    return this.getUserById(userId);
  }

  getOrders() {
    return this.ordersService.getAllOrders();
  }

  getProducts() {
    return this.productsService.adminListProducts();
  }

  async deleteProduct(adminUserId: string, productId: string) {
    const product = await this.databaseService.query<{
      id: string;
      title: string;
    }>('SELECT TOP 1 id, title FROM products WHERE id = $1', [productId]);

    const deleted = await this.productsService.adminDeleteProduct(productId);

    await this.recordAdminActivity(adminUserId, {
      actionType: 'product_deleted',
      entityType: 'product',
      entityId: productId,
      entityLabel: product.rows[0]?.title ?? productId,
      description: `Deleted product ${product.rows[0]?.title ?? productId}.`,
    });

    return deleted;
  }

  async updateVendorActivation(
    adminUserId: string,
    vendorId: string,
    isActive: boolean,
  ) {
    const vendorLookup = await this.databaseService.query<{
      id: string;
      shop_name: string;
      user_email: string;
    }>(
      `SELECT TOP 1 v.id, v.shop_name, u.email AS user_email
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [vendorId],
    );

    const vendor = vendorLookup.rows[0];
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const result = await this.databaseService.query<{ id: string }>(
      `UPDATE vendors
       SET is_active = $1, approved_at = CASE WHEN $1 = 1 THEN SYSDATETIME() ELSE approved_at END, updated_at = SYSDATETIME()
       OUTPUT INSERTED.id
       WHERE id = $2`,
      [isActive, vendorId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Vendor not found');
    }

    if (isActive) {
      await this.databaseService.query(
        `UPDATE admin_notifications
         SET read_at = COALESCE(read_at, SYSDATETIME())
         WHERE vendor_id = $1
           AND notification_type = 'vendor_pending_approval'
           AND read_at IS NULL`,
        [vendorId],
      );
    }

    if (isActive) {
      await this.mailService.sendVendorApprovedEmail(vendor.user_email, {
        shopName: vendor.shop_name,
      });
    }

    await this.recordAdminActivity(adminUserId, {
      actionType: 'vendor_activation_updated',
      entityType: 'vendor',
      entityId: vendorId,
      entityLabel: vendor.shop_name,
      description: `${isActive ? 'Activated' : 'Deactivated'} vendor ${vendor.shop_name}.`,
      metadata: {
        isActive,
        vendorEmail: vendor.user_email,
      },
    });

    return { message: 'Vendor status updated' };
  }

  async resendVendorVerification(adminUserId: string, vendorId: string) {
    const vendorLookup = await this.databaseService.query<{
      id: string;
      shop_name: string;
      is_verified: boolean;
      user_id: string;
      user_email: string;
    }>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.is_verified,
         u.id AS user_id,
         u.email AS user_email
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [vendorId],
    );

    const vendor = vendorLookup.rows[0];
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.is_verified) {
      throw new BadRequestException('Vendor is already verified');
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE email_verifications
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [vendor.user_id],
      );

      await client.query(
        `INSERT INTO email_verifications (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [vendor.user_id, hashOpaqueToken(token), expiresAt],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'vendor_verification_resent',
          entityType: 'vendor',
          entityId: vendor.id,
          entityLabel: vendor.shop_name,
          description: `Resent vendor verification email to ${vendor.shop_name}.`,
          metadata: {
            vendorEmail: vendor.user_email,
          },
        },
        client,
      );
    });

    await this.mailService.sendVerificationEmail(
      vendor.user_email,
      token,
      'vendor',
    );

    return { message: 'Verification email sent.' };
  }

  async setUserActive(adminUserId: string, userId: string, isActive: boolean) {
    const user = await this.databaseService.query<{ email: string }>(
      'SELECT TOP 1 email FROM users WHERE id = $1',
      [userId],
    );
    const result = await this.databaseService.query<{ id: string }>(
      `UPDATE users
       SET is_active = $1, updated_at = SYSDATETIME()
       OUTPUT INSERTED.id
       WHERE id = $2`,
      [isActive, userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('User not found');
    }

    await this.recordAdminActivity(adminUserId, {
      actionType: 'user_activation_updated',
      entityType: 'user',
      entityId: userId,
      entityLabel: user.rows[0]?.email ?? userId,
      description: `${isActive ? 'Enabled' : 'Disabled'} login access for ${user.rows[0]?.email ?? 'a user'}.`,
      metadata: {
        isActive,
      },
    });

    return { message: 'User status updated' };
  }

  async triggerPasswordReset(adminUserId: string, userId: string) {
    const result = await this.authService.issueAdminPasswordReset(userId);
    await this.recordAdminActivity(adminUserId, {
      actionType: 'password_reset_triggered',
      entityType: 'user',
      entityId: userId,
      entityLabel: userId,
      description: 'Triggered an admin password reset email.',
    });
    return result;
  }

  async markNotificationRead(adminUserId: string, notificationId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      `UPDATE admin_notifications
       SET read_at = COALESCE(read_at, SYSDATETIME())
       OUTPUT INSERTED.id
       WHERE id = $1
         AND admin_user_id = $2`,
      [notificationId, adminUserId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Notification not found');
    }

    await this.recordAdminActivity(adminUserId, {
      actionType: 'notification_marked_read',
      entityType: 'admin_notification',
      entityId: notificationId,
      entityLabel: notificationId,
      description: 'Marked an admin notification as read.',
    });

    return { message: 'Notification marked as read' };
  }

  private async getRecentAdminActivity(limit: number) {
    const result = await this.databaseService.query<{
      id: string;
      action_type: string;
      entity_type: string;
      entity_id: string | null;
      entity_label: string | null;
      description: string;
      metadata_json: string | null;
      created_at: Date;
      admin_user_id: string;
      admin_email: string;
    }>(
      `SELECT TOP ${limit}
         l.id,
         l.action_type,
         l.entity_type,
         l.entity_id,
         l.entity_label,
         l.description,
         l.metadata_json,
         l.created_at,
         l.admin_user_id,
         u.email AS admin_email
       FROM admin_activity_logs l
       INNER JOIN users u ON u.id = l.admin_user_id
       ORDER BY l.created_at DESC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      actionType: row.action_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      description: row.description,
      metadata: this.parseActivityMetadata(row.metadata_json),
      createdAt: row.created_at,
      adminUserId: row.admin_user_id,
      adminEmail: row.admin_email,
    }));
  }

  async getExport(
    adminUserId: string,
    resource: 'vendors' | 'customers' | 'orders',
  ) {
    if (resource === 'vendors') {
      const result = await this.databaseService.query<{
        shop_name: string;
        vendor_email: string;
        vendor_active: boolean;
        vendor_verified: boolean;
        user_active: boolean;
        created_at: Date;
      }>(
        `SELECT
           v.shop_name,
           u.email AS vendor_email,
           v.is_active AS vendor_active,
           v.is_verified AS vendor_verified,
           u.is_active AS user_active,
           v.created_at
         FROM vendors v
         INNER JOIN users u ON u.id = v.user_id
         ORDER BY v.created_at DESC, v.shop_name ASC`,
      );

      const csv = this.toCsv([
        [
          'Shop name',
          'Vendor email',
          'Vendor active',
          'Vendor verified',
          'Login active',
          'Created at',
        ],
        ...result.rows.map((row) => [
          row.shop_name,
          row.vendor_email,
          row.vendor_active ? 'yes' : 'no',
          row.vendor_verified ? 'yes' : 'no',
          row.user_active ? 'yes' : 'no',
          row.created_at.toISOString(),
        ]),
      ]);

      await this.recordAdminActivity(adminUserId, {
        actionType: 'export_generated',
        entityType: 'admin_export',
        entityLabel: 'vendors.csv',
        description: 'Generated the vendor export.',
        metadata: { resource: 'vendors', rowCount: result.rows.length },
      });

      return {
        filename: 'vendors-export.csv',
        csv,
      };
    }

    if (resource === 'customers') {
      const result = await this.databaseService.query<{
        email: string;
        is_active: boolean;
        created_at: Date;
      }>(
        `SELECT
           email,
           is_active,
           created_at
         FROM users
         WHERE role = 'customer'
         ORDER BY created_at DESC, email ASC`,
      );

      const csv = this.toCsv([
        ['Email', 'Login active', 'Created at'],
        ...result.rows.map((row) => [
          row.email,
          row.is_active ? 'yes' : 'no',
          row.created_at.toISOString(),
        ]),
      ]);

      await this.recordAdminActivity(adminUserId, {
        actionType: 'export_generated',
        entityType: 'admin_export',
        entityLabel: 'customers.csv',
        description: 'Generated the customer export.',
        metadata: { resource: 'customers', rowCount: result.rows.length },
      });

      return {
        filename: 'customers-export.csv',
        csv,
      };
    }

      const result = await this.databaseService.query<{
        id: string;
        order_number: string | null;
        customer_email: string;
        status: string;
      payment_method: string;
      payment_status: string;
      total_price: number | string;
      created_at: Date;
    }>(
      `SELECT
         o.id,
         o.order_number,
         COALESCE(u.email, o.guest_email) AS customer_email,
         o.status,
         o.payment_method,
         o.payment_status,
         o.total_price,
         o.created_at
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_id
       ORDER BY o.created_at DESC, o.id DESC`,
    );

    const csv = this.toCsv([
      [
        'Order number',
        'Customer email',
        'Status',
        'Payment method',
        'Payment status',
        'Total price',
        'Created at',
      ],
      ...result.rows.map((row) => [
        row.order_number ?? row.id,
        row.customer_email,
        row.status,
        row.payment_method,
        row.payment_status,
        Number(row.total_price).toFixed(2),
        row.created_at.toISOString(),
      ]),
    ]);

    await this.recordAdminActivity(adminUserId, {
      actionType: 'export_generated',
      entityType: 'admin_export',
      entityLabel: 'orders.csv',
      description: 'Generated the orders export.',
      metadata: { resource: 'orders', rowCount: result.rows.length },
    });

    return {
      filename: 'orders-export.csv',
      csv,
    };
  }

  private async recordAdminActivity(
    adminUserId: string,
    entry: {
      actionType: string;
      entityType: string;
      entityId?: string | null;
      entityLabel?: string | null;
      description: string;
      metadata?: Record<string, unknown> | null;
    },
    runner: QueryRunner = this.databaseService,
  ) {
    await runner.query(
      `INSERT INTO admin_activity_logs (
         admin_user_id,
         action_type,
         entity_type,
         entity_id,
         entity_label,
         description,
         metadata_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminUserId,
        entry.actionType,
        entry.entityType,
        entry.entityId ?? null,
        entry.entityLabel ?? null,
        entry.description,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    );
  }

  private parseActivityMetadata(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeReportingRange(value?: string) {
    const numeric = Number(value);
    if (numeric === 7 || numeric === 30 || numeric === 90) {
      return numeric;
    }
    return 30;
  }

  private toCsv(
    rows: Array<Array<string | number | boolean | null | undefined>>,
  ) {
    return rows
      .map((row) =>
        row
          .map((value) => {
            const text = value == null ? '' : String(value);
            if (/[",\n]/.test(text)) {
              return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
          })
          .join(','),
      )
      .join('\n');
  }

  private storeHomepagePromotionImage(
    file: UploadedFile,
    variant: 'desktop' | 'mobile',
  ) {
    const targetDir = join(process.cwd(), 'uploads', 'homepage-promotions');

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const extension = getSafeImageExtensionForMimeType(file.mimetype);
    const fileName = `promotion-${variant}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`;
    const targetPath = join(targetDir, fileName);

    if (!existsSync(file.path)) {
      throw new BadRequestException('Uploaded promotion image could not be processed');
    }

    assertStoredImageFileMatchesMimeType(file.path, file.mimetype);
    renameSync(file.path, targetPath);
    return `/media/homepage-promotions/${fileName}`;
  }

  private deleteStoredMedia(mediaUrl?: string | null) {
    if (!mediaUrl || !mediaUrl.startsWith('/media/')) {
      return;
    }

    const relative = mediaUrl.replace(/^\/media\//, '');
    const fullPath = join(process.cwd(), 'uploads', relative);

    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  private normalizePromotionPayload(input: {
    internalName: string;
    customUrl: string;
    isActive: boolean;
    displayOrder: number;
    startDate?: string;
    endDate?: string;
  }) {
    const internalName = input.internalName.trim();
    const customUrl = input.customUrl.trim();

    if (!internalName) {
      throw new BadRequestException('Internal name is required');
    }

    if (!customUrl) {
      throw new BadRequestException('Custom URL is required');
    }

    const startsAt = input.startDate ? new Date(input.startDate) : null;
    const endsAt = input.endDate ? new Date(input.endDate) : null;

    if (startsAt && Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException('Start date is invalid');
    }

    if (endsAt && Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('End date is invalid');
    }

    if (startsAt && endsAt && endsAt < startsAt) {
      throw new BadRequestException('End date cannot be before start date');
    }

    return {
      internalName,
      customUrl: this.normalizePromotionTargetUrl(customUrl),
      isActive: input.isActive,
      displayOrder: input.displayOrder,
      startsAt: startsAt ? this.formatSqlDateTime(startsAt) : null,
      endsAt: endsAt ? this.formatSqlDateTime(endsAt) : null,
    };
  }

  private normalizePromotionTargetUrl(value: string) {
    const normalized = value.trim();
    let parsed: URL;

    try {
      parsed = new URL(normalized, 'https://vishu.shop');
    } catch {
      throw new BadRequestException('Promotion URL is invalid');
    }

    if (parsed.origin !== 'https://vishu.shop') {
      throw new BadRequestException(
        'Promotion URLs must stay within this marketplace',
      );
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  private async getPromotionRow(promotionId: string) {
    const result = await this.databaseService.query<{
      id: string;
      internal_name: string;
      desktop_image_url: string | null;
      mobile_image_url: string | null;
      target_url: string | null;
      is_active: boolean;
      sort_order: number;
      starts_at: Date | null;
      ends_at: Date | null;
    }>(
      `SELECT TOP 1
         id,
         internal_name,
         desktop_image_url,
         mobile_image_url,
         target_url,
         is_active,
         sort_order,
         starts_at,
         ends_at
       FROM homepage_hero_slides
       WHERE id = $1`,
      [promotionId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Promotion not found');
    }

    return row;
  }

  private async reorderPromotionSortOrders(
    client: QueryRunner,
    promotionId: string,
    nextIndex: number,
  ) {
    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM homepage_hero_slides
       WHERE id <> $1
       ORDER BY sort_order ASC, created_at ASC`,
      [promotionId],
    );

    const orderedIds = existing.rows.map((row) => row.id);
    const boundedIndex = Math.max(0, Math.min(nextIndex, orderedIds.length));
    orderedIds.splice(boundedIndex, 0, promotionId);

    for (const [index, id] of orderedIds.entries()) {
      await client.query(
        `UPDATE homepage_hero_slides
         SET sort_order = $1,
             updated_at = SYSDATETIME()
         WHERE id = $2`,
        [index, id],
      );
    }
  }

  private async normalizePromotionSortOrders(client: QueryRunner) {
    const result = await client.query<{ id: string }>(
      `SELECT id
       FROM homepage_hero_slides
       ORDER BY sort_order ASC, created_at ASC`,
    );

    for (const [index, row] of result.rows.entries()) {
      await client.query(
        `UPDATE homepage_hero_slides
         SET sort_order = $1,
             updated_at = SYSDATETIME()
         WHERE id = $2`,
        [index, row.id],
      );
    }
  }

  private isPromotionInSchedule(
    startsAt: Date | null,
    endsAt: Date | null,
    now = new Date(),
  ) {
    if (startsAt && startsAt > now) {
      return false;
    }

    if (endsAt && endsAt < now) {
      return false;
    }

    return true;
  }

  private normalizeCatalogOptionType(
    value: string,
  ): 'category' | 'subcategory' | 'brand' | 'size' | 'color' {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'category' ||
      normalized === 'subcategory' ||
      normalized === 'brand' ||
      normalized === 'size' ||
      normalized === 'color'
    ) {
      return normalized;
    }

    throw new BadRequestException('Unsupported catalog option type');
  }

  private normalizeCatalogOptionTypeFilter(value?: string | null) {
    if (!value || value.trim().length === 0 || value === 'all') {
      return null;
    }

    return this.normalizeCatalogOptionType(value);
  }

  private normalizeCatalogRequestStatus(
    value: string,
  ): 'pending' | 'approved' | 'rejected' {
    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'pending' ||
      normalized === 'approved' ||
      normalized === 'rejected'
    ) {
      return normalized;
    }

    throw new BadRequestException('Unsupported catalog request status');
  }

  private normalizeCatalogRequestStatusFilter(value?: string | null) {
    if (!value || value.trim().length === 0 || value === 'all') {
      return null;
    }

    return this.normalizeCatalogRequestStatus(value);
  }

  private normalizeOptionalCatalogText(
    value: string | null | undefined,
    maxLength: number,
  ) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    return normalized.slice(0, maxLength);
  }

  private normalizeCatalogMasterDataPayload(dto: {
    optionType: string;
    department?: string;
    parentValue?: string;
    value: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const value = dto.value.trim();
    if (!value) {
      throw new BadRequestException('Catalog value is required');
    }

    return {
      optionType: this.normalizeCatalogOptionType(dto.optionType),
      department: this.normalizeOptionalCatalogText(dto.department, 80),
      parentValue: this.normalizeOptionalCatalogText(dto.parentValue, 120),
      value: value.slice(0, 120),
      isActive: dto.isActive ?? true,
      sortOrder: Math.max(0, Math.min(dto.sortOrder ?? 0, 999)),
    };
  }

  private normalizeNamedCatalogValue(value: string, maxLength: number) {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException('A value is required');
    }

    return normalized.slice(0, maxLength);
  }

  private async assertCategoryExists(categoryId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      `SELECT TOP 1 id FROM categories WHERE id = $1`,
      [categoryId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertSizeTypeExists(sizeTypeId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      `SELECT TOP 1 id FROM size_types WHERE id = $1`,
      [sizeTypeId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Size type not found');
    }
  }

  private async createNamedCatalogEntity(
    adminUserId: string,
    input: {
      table: string;
      labelField: string;
      entityType: string;
      value: string;
      isActive: boolean;
      sortOrder: number;
    },
  ) {
    const normalized = this.normalizeNamedCatalogValue(input.value, 120);
    await this.databaseService.withTransaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `INSERT INTO ${input.table} (${input.labelField}, is_active, sort_order, updated_at)
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, SYSDATETIME())`,
        [normalized, input.isActive, Math.max(0, Math.min(input.sortOrder, 999))],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: `${input.entityType}_created`,
          entityType: input.entityType,
          entityId: created.rows[0]?.id ?? null,
          entityLabel: normalized,
          description: `Created ${input.entityType.replace(/_/g, ' ')} "${normalized}".`,
        },
        client,
      );
    });
  }

  private async updateNamedCatalogEntity(
    adminUserId: string,
    id: string,
    input: {
      table: string;
      labelField: string;
      entityType: string;
      value: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const current = await this.databaseService.query<{ id: string; label: string; is_active: boolean; sort_order: number }>(
      `SELECT TOP 1 id, ${input.labelField} AS label, is_active, sort_order
       FROM ${input.table}
       WHERE id = $1`,
      [id],
    );

    if (!current.rows[0]) {
      throw new NotFoundException(`${input.entityType.replace(/_/g, ' ')} not found`);
    }

    const normalized = this.normalizeNamedCatalogValue(input.value, 120);
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE ${input.table}
         SET ${input.labelField} = $1,
             is_active = $2,
             sort_order = $3,
             updated_at = SYSDATETIME()
         WHERE id = $4`,
        [
          normalized,
          input.isActive ?? current.rows[0].is_active,
          Math.max(0, Math.min(input.sortOrder ?? current.rows[0].sort_order, 999)),
          id,
        ],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: `${input.entityType}_updated`,
          entityType: input.entityType,
          entityId: id,
          entityLabel: normalized,
          description: `Updated ${input.entityType.replace(/_/g, ' ')} "${normalized}".`,
        },
        client,
      );
    });
  }

  private async deleteCatalogEntity(
    adminUserId: string,
    input: {
      id: string;
      table: string;
      labelField: string;
      entityType: string;
      inUseQuery: string;
    },
  ) {
    const current = await this.databaseService.query<{ id: string; label: string; is_active: boolean }>(
      `SELECT TOP 1 id, ${input.labelField} AS label, is_active
       FROM ${input.table}
       WHERE id = $1`,
      [input.id],
    );

    if (!current.rows[0]) {
      throw new NotFoundException(`${input.entityType.replace(/_/g, ' ')} not found`);
    }

    const usage = await this.databaseService.query<{ usage_count: number | string }>(
      input.inUseQuery,
      [input.id],
    );
    const usageCount = Number(usage.rows[0]?.usage_count ?? 0);

    await this.databaseService.withTransaction(async (client) => {
      if (usageCount > 0) {
        await client.query(
          `UPDATE ${input.table}
           SET is_active = 0,
               updated_at = SYSDATETIME()
           WHERE id = $1`,
          [input.id],
        );
      } else {
        await client.query(`DELETE FROM ${input.table} WHERE id = $1`, [input.id]);
      }

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: usageCount > 0 ? `${input.entityType}_deactivated` : `${input.entityType}_deleted`,
          entityType: input.entityType,
          entityId: input.id,
          entityLabel: current.rows[0].label,
          description:
            usageCount > 0
              ? `Deactivated ${input.entityType.replace(/_/g, ' ')} "${current.rows[0].label}" because it is in use.`
              : `Deleted ${input.entityType.replace(/_/g, ' ')} "${current.rows[0].label}".`,
          metadata: { usageCount },
        },
        client,
      );
    });
  }

  private cleanupTemporaryFile(file?: UploadedFile) {
    if (file?.path && existsSync(file.path)) {
      unlinkSync(file.path);
    }
  }

  private formatSqlDateTime(value: Date) {
    return value.toISOString().replace('T', ' ').replace('Z', '');
  }

  private buildGuidLiteralClause(ids: string[]) {
    return ids.map((id) => `'${id}'`).join(', ');
  }
}
