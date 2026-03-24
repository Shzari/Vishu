import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { DatabaseService, QueryRunner } from '../database/database.service';
import { MailService } from '../mail/mail.service';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import {
  CreateAdminUserDto,
  HomepageHeroSlideInputDto,
  UpdatePlatformSettingsDto,
  UpdateVendorSubscriptionDto,
} from './dto';

const VENDOR_SUBSCRIPTION_PRICES = {
  monthly: 29,
  yearly: 290,
} as const;

const DEFAULT_HOMEPAGE_HERO_INTERVAL_SECONDS = 6;

@Injectable()
export class AdminService {
  constructor(
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
        subscribed_vendors: number;
        subscriptions_expiring_soon: number;
        pending_vendor_approvals: number;
        unread_notifications: number;
      }>(
        `SELECT
           COUNT(*) AS total_users,
           SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) AS total_customers,
           SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins,
           (SELECT COUNT(*) FROM vendors) AS total_vendors,
           (SELECT COUNT(*) FROM vendors WHERE is_active = 1) AS active_vendors,
           (SELECT COUNT(*) FROM vendors v WHERE ${this.activeSubscriptionClause('v')}) AS subscribed_vendors,
           (SELECT COUNT(*) FROM vendors v WHERE ${this.activeSubscriptionClause('v')} AND ${this.effectiveEndsAtExpression('v')} < DATEADD(DAY, 14, SYSDATETIME())) AS subscriptions_expiring_soon,
           (SELECT COUNT(*) FROM vendors WHERE is_active = 0) AS pending_vendor_approvals,
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
        total_price: number | string;
        payment_method: string;
        payment_status: string;
        cod_status_note: string | null;
        cod_updated_at: Date | null;
        status: string;
        created_at: Date;
        customer_email: string;
      }>(
        `SELECT TOP 6 o.id, o.total_price, o.payment_method, o.payment_status, o.cod_status_note, o.cod_updated_at, o.status, o.created_at, u.email AS customer_email
         FROM orders o
         INNER JOIN users u ON u.id = o.customer_id
         ORDER BY o.created_at DESC`,
      ),
      this.databaseService.query<{
        id: string;
        shop_name: string;
        is_verified: boolean;
        approved_at: Date | null;
        created_at: Date;
        user_email: string;
      }>(
        `SELECT TOP 6 v.id, v.shop_name, v.is_verified, v.approved_at, v.created_at, u.email AS user_email
         FROM vendors v
         INNER JOIN users u ON u.id = v.user_id
         WHERE v.is_active = 0
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
        subscribedVendors: totals.subscribed_vendors,
        subscriptionsExpiringSoon: totals.subscriptions_expiring_soon,
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
        isVerified: row.is_verified,
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
    const result = await this.databaseService.withTransaction(async (client) => {
      const createdAdmin = await client.query<{
        id: string;
        email: string;
        role: string;
        full_name: string | null;
        phone_number: string | null;
        is_active: boolean;
        created_at: Date;
      }>(
        `INSERT INTO users (email, full_name, phone_number, password_hash, role, is_active)
         OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.full_name, INSERTED.phone_number, INSERTED.is_active, INSERTED.created_at
         VALUES ($1, $2, $3, $4, 'admin', 1)`,
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
    });

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
         homepage_hero_interval_seconds
       FROM platform_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    const heroSlides = await this.getHomepageHeroSlidesForAdmin();
    const activityLog = await this.getRecentAdminActivity(12);
    return {
      email: {
        smtpHost: row?.smtp_host ?? null,
        smtpPort: row?.smtp_port ?? null,
        smtpSecure: Boolean(row?.smtp_secure),
        smtpUser: row?.smtp_user ?? null,
        smtpPasswordConfigured: Boolean(row?.smtp_pass),
        mailFrom: row?.mail_from ?? null,
        appBaseUrl: row?.app_base_url ?? null,
        vendorVerificationEmailsEnabled: row ? Boolean(row.vendor_verification_emails_enabled) : true,
        adminVendorApprovalEmailsEnabled: row ? Boolean(row.admin_vendor_approval_emails_enabled) : true,
        passwordResetEmailsEnabled: row ? Boolean(row.password_reset_emails_enabled) : true,
      },
      homepageHero: {
        intervalSeconds:
          row?.homepage_hero_interval_seconds ?? DEFAULT_HOMEPAGE_HERO_INTERVAL_SECONDS,
        slides: heroSlides,
      },
      activityLog,
    };
  }

  async updatePlatformSettings(adminUserId: string, dto: UpdatePlatformSettingsDto) {
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
        pushUpdate('smtp_pass', normalizedPassword);
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
      pushUpdate('password_reset_emails_enabled', dto.passwordResetEmailsEnabled);
      changedAreas.push('password reset email switch');
    }

    if (dto.homepageHeroIntervalSeconds !== undefined) {
      pushUpdate(
        'homepage_hero_interval_seconds',
        dto.homepageHeroIntervalSeconds,
      );
      changedAreas.push('homepage carousel timer');
    }

    const shouldUpdateSlides = dto.homepageHeroSlides !== undefined;
    if (shouldUpdateSlides) {
      changedAreas.push('homepage carousel slides');
    }

    if (!updates.length && !shouldUpdateSlides) {
      return this.getPlatformSettings();
    }

    await this.databaseService.withTransaction(async (client) => {
      if (updates.length) {
        const statementValues = [...values, 1];
        await client.query(
          `UPDATE platform_settings
           SET ${updates.join(', ')},
               updated_at = SYSDATETIME()
           WHERE id = $${statementValues.length}`,
          statementValues,
        );
      }

      if (shouldUpdateSlides) {
        await this.replaceHomepageHeroSlides(client, dto.homepageHeroSlides ?? []);
      }

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'platform_settings_updated',
          entityType: 'platform_settings',
          entityLabel: 'Platform settings',
          description: `Updated platform settings: ${changedAreas.join(', ')}.`,
          metadata: {
            changedAreas,
            updatedSlides: shouldUpdateSlides ? (dto.homepageHeroSlides ?? []).length : undefined,
          },
        },
        client,
      );
    });

    return this.getPlatformSettings();
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
      product_id: string;
      headline: string | null;
      subheading: string | null;
      cta_label: string | null;
      is_active: boolean;
      sort_order: number;
      product_title: string;
      product_code: string | null;
      shop_name: string;
      image_url: string | null;
    }>(
      `SELECT
         hs.id,
         hs.product_id,
         hs.headline,
         hs.subheading,
         hs.cta_label,
         hs.is_active,
         hs.sort_order,
         p.title AS product_title,
         p.product_code,
         v.shop_name,
         image_preview.image_url
       FROM homepage_hero_slides hs
       INNER JOIN products p ON p.id = hs.product_id
       INNER JOIN vendors v ON v.id = p.vendor_id
       OUTER APPLY (
         SELECT TOP 1 pi.image_url
         FROM product_images pi
         WHERE pi.product_id = p.id
         ORDER BY pi.sort_order ASC
       ) image_preview
       ORDER BY hs.sort_order ASC, hs.created_at ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      productTitle: row.product_title,
      productCode: row.product_code,
      shopName: row.shop_name,
      imageUrl: row.image_url,
      headline: row.headline,
      subheading: row.subheading,
      ctaLabel: row.cta_label,
      isActive: row.is_active,
      sortOrder: row.sort_order,
    }));
  }

  private async replaceHomepageHeroSlides(
    client: QueryRunner,
    slides: HomepageHeroSlideInputDto[],
  ) {
    const uniqueProductIds = [...new Set(slides.map((slide) => slide.productId))];

    if (uniqueProductIds.length) {
      const literalClause = this.buildGuidLiteralClause(uniqueProductIds);
      const products = await client.query<{ id: string }>(
        `SELECT id
         FROM products
         WHERE id IN (${literalClause})`,
      );

      if (products.rows.length !== uniqueProductIds.length) {
        throw new BadRequestException('One or more selected homepage products do not exist');
      }
    }

    await client.query('DELETE FROM homepage_hero_slides');

    for (const slide of slides) {
      await client.query(
        `INSERT INTO homepage_hero_slides (
           product_id,
           headline,
           subheading,
           cta_label,
           is_active,
           sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          slide.productId,
          slide.headline?.trim() || null,
          slide.subheading?.trim() || null,
          slide.ctaLabel?.trim() || null,
          slide.isActive ?? true,
          slide.sortOrder,
        ],
      );
    }
  }

  async updateVendorSubscription(
    adminUserId: string,
    vendorId: string,
    dto: UpdateVendorSubscriptionDto,
  ) {
    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
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
    }>(
      `SELECT TOP 1
         id,
         shop_name,
         subscription_plan,
         subscription_status,
         subscription_started_at,
         subscription_ends_at,
         subscription_override_plan,
         subscription_override_status,
         subscription_override_started_at,
         subscription_override_ends_at,
         subscription_override_note,
         subscription_override_updated_at
       FROM vendors
       WHERE id = $1`,
      [vendorId],
    );

    const current = vendor.rows[0];
    if (!current) {
      throw new NotFoundException('Vendor not found');
    }

    const note = dto.note?.trim() || null;
    const now = new Date();
    const nowSql = this.formatSqlDateTime(now);

    await this.databaseService.withTransaction(async (client) => {
      if (dto.status === 'auto') {
        await client.query(
          `UPDATE vendors
           SET subscription_override_plan = NULL,
               subscription_override_status = NULL,
               subscription_override_started_at = NULL,
               subscription_override_ends_at = NULL,
               subscription_override_note = NULL,
               subscription_override_updated_at = SYSDATETIME(),
               updated_at = SYSDATETIME()
           WHERE id = $1`,
          [vendorId],
        );
        await this.recordAdminActivity(
          adminUserId,
          {
            actionType: 'vendor_subscription_override_updated',
            entityType: 'vendor',
            entityId: vendorId,
            entityLabel: current.shop_name,
            description: 'Returned vendor subscription control to automatic mode.',
            metadata: {
              status: dto.status,
              note,
            },
          },
          client,
        );
        return;
      }

      if (dto.status === 'active') {
        if (!dto.planType) {
          throw new BadRequestException('Plan type is required when enabling a subscription');
        }

        const currentEffective = this.resolveEffectiveSubscription(current);
        const activeUntil =
          currentEffective.status === 'active' &&
          currentEffective.endsAt &&
          currentEffective.endsAt > now
            ? currentEffective.endsAt
            : null;
        const chargeStartsAt = activeUntil ?? now;
        const nextEndsAt = new Date(chargeStartsAt.getTime());

        if (dto.planType === 'yearly') {
          nextEndsAt.setFullYear(nextEndsAt.getFullYear() + 1);
        } else {
          nextEndsAt.setMonth(nextEndsAt.getMonth() + 1);
        }

        const normalizedStartedAt = this.formatSqlDateTime(
          activeUntil ? currentEffective.startedAt ?? now : now,
        );
        const normalizedChargeStartsAt = this.formatSqlDateTime(chargeStartsAt);
        const normalizedEndsAt = this.formatSqlDateTime(nextEndsAt);

        await client.query(
          `UPDATE vendors
           SET subscription_override_plan = $1,
               subscription_override_status = 'active',
               subscription_override_started_at = $2,
               subscription_override_ends_at = $3,
               subscription_override_note = $4,
               subscription_override_updated_at = SYSDATETIME(),
               updated_at = SYSDATETIME()
           WHERE id = $5`,
          [dto.planType, normalizedStartedAt, normalizedEndsAt, note, vendorId],
        );

        await client.query(
          `INSERT INTO vendor_subscriptions (
             vendor_id,
             plan_type,
             status,
             amount,
             admin_user_id,
             admin_note,
             starts_at,
             ends_at
           )
           VALUES ($1, $2, 'active', 0, $3, $4, $5, $6)`,
          [
            vendorId,
            dto.planType,
            adminUserId,
            note,
            normalizedChargeStartsAt,
            normalizedEndsAt,
          ],
        );

        await this.recordAdminActivity(
          adminUserId,
          {
            actionType: 'vendor_subscription_override_updated',
            entityType: 'vendor',
            entityId: vendorId,
            entityLabel: current.shop_name,
            description: `Applied a manual ${dto.planType} subscription override for the vendor.`,
            metadata: {
              status: dto.status,
              planType: dto.planType,
              note,
            },
          },
          client,
        );

        return;
      }

      await client.query(
        `UPDATE vendors
         SET subscription_override_plan = $1,
             subscription_override_status = 'expired',
             subscription_override_started_at = COALESCE(subscription_override_started_at, $2),
             subscription_override_ends_at = $2,
             subscription_override_note = $3,
             subscription_override_updated_at = SYSDATETIME(),
             updated_at = SYSDATETIME()
         WHERE id = $4`,
        [
          current.subscription_override_plan ?? current.subscription_plan,
          nowSql,
          note,
          vendorId,
        ],
      );

      await client.query(
        `INSERT INTO vendor_subscriptions (
           vendor_id,
           plan_type,
           status,
           amount,
           admin_user_id,
           admin_note,
           starts_at,
           ends_at
         )
         VALUES ($1, $2, 'expired', 0, $3, $4, $5, $5)`,
        [
          vendorId,
          current.subscription_override_plan ?? current.subscription_plan ?? 'monthly',
          adminUserId,
          note,
          nowSql,
        ],
      );

      await this.recordAdminActivity(
        adminUserId,
        {
          actionType: 'vendor_subscription_override_updated',
          entityType: 'vendor',
          entityId: vendorId,
          entityLabel: current.shop_name,
          description: 'Marked the vendor subscription override as expired.',
          metadata: {
            status: dto.status,
            note,
          },
        },
        client,
      );
    });

    return this.getVendorById(vendorId);
  }

  async getVendorPayouts() {
    const result = await this.databaseService.query<{
      vendor_id: string;
      shop_name: string;
      vendor_email: string;
      bank_account_name: string | null;
      bank_name: string | null;
      bank_iban: string | null;
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
         v.bank_account_name,
         v.bank_name,
         v.bank_iban,
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
         u.email,
         v.bank_account_name,
         v.bank_name,
         v.bank_iban
       ORDER BY payable_now DESC, total_vendor_earnings DESC, v.shop_name ASC`,
    );

    return result.rows.map((row) => ({
      vendorId: row.vendor_id,
      shopName: row.shop_name,
      vendorEmail: row.vendor_email,
      bankAccountName: row.bank_account_name,
      bankName: row.bank_name,
      bankIban: row.bank_iban,
      grossSales: Number(row.gross_sales),
      totalCommission: Number(row.total_commission),
      payableNow: Number(row.payable_now),
      totalVendorEarnings: Number(row.total_vendor_earnings),
      shippedBalance: Number(row.shipped_balance),
      paidOut: Number(row.paid_out),
      outstandingShippedBalance: Math.max(0, Number(row.outstanding_shipped_balance)),
      orderCount: row.order_count,
      bankReady: Boolean(row.bank_account_name && row.bank_name && row.bank_iban),
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
      throw new BadRequestException('Payout amount exceeds delivered unpaid balance');
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

    const [customerOrders, recentOrders, cartItems, vendorStats] = await Promise.all([
      this.databaseService.query<{ order_count: number; total_spend: number | string }>(
        `SELECT COUNT(*) AS order_count, ISNULL(SUM(total_price), 0) AS total_spend
         FROM orders
         WHERE customer_id = $1`,
        [userId],
      ),
      this.databaseService.query<{
        id: string;
        total_price: number | string;
        status: string;
        special_request: string | null;
        created_at: Date;
      }>(
        `SELECT TOP 8 id, total_price, status, special_request, created_at
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

  async deleteUser(adminUserId: string, userId: string) {
    const user = await this.databaseService.query<{
      id: string;
      email: string;
      role: string;
      vendor_id: string | null;
    }>(
      `SELECT TOP 1
         u.id,
         u.email,
         u.role,
         v.id AS vendor_id
       FROM users u
       LEFT JOIN vendors v ON v.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );

    const record = user.rows[0];
    if (!record) {
      throw new NotFoundException('User not found');
    }

    if (record.role !== 'customer') {
      throw new BadRequestException('Only customer accounts can be deleted from this action');
    }

    if (record.vendor_id) {
      throw new BadRequestException('Vendor-linked users must be deleted from the vendor record');
    }

    await this.databaseService.query('DELETE FROM users WHERE id = $1', [userId]);

    await this.recordAdminActivity(adminUserId, {
      actionType: 'customer_deleted',
      entityType: 'user',
      entityId: userId,
      entityLabel: record.email,
      description: `Deleted customer account ${record.email}.`,
      metadata: {
        role: record.role,
      },
    });

    return { message: 'Customer deleted' };
  }

  async getVendorById(vendorId: string) {
    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
      is_active: boolean;
      is_verified: boolean;
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

    const [metrics, categoryRows, recentOrders, payoutHistory, subscriptionHistory] = await Promise.all([
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
        `SELECT TOP 8
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
      subscription: this.resolveEffectiveSubscription(record),
      automaticSubscription: this.resolveAutomaticSubscription(record),
      manualOverride: this.resolveManualOverride(record),
      metrics: {
        productCount: metrics.rows[0].product_count,
        inventoryUnits: metrics.rows[0].inventory_units,
        orderCount: metrics.rows[0].order_count,
        totalEarnings: Number(metrics.rows[0].total_earnings),
        totalCommission: Number(metrics.rows[0].total_commission),
        pendingItems: metrics.rows[0].pending_items,
        shippedItems: metrics.rows[0].shipped_items,
        paidOut: Number(metrics.rows[0].paid_out),
        outstandingShippedBalance: Math.max(0, Number(metrics.rows[0].outstanding_shipped_balance)),
      },
      categories: categoryRows.rows.map((row) => ({
        category: row.category,
        productCount: row.product_count,
      })),
      recentOrderItems: recentOrders.rows.map((row) => ({
        orderId: row.order_id,
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
      subscriptionHistory: subscriptionHistory.rows.map((row) => ({
        id: row.id,
        planType: row.plan_type,
        status: row.status === 'active' && row.ends_at < new Date() ? 'expired' : row.status,
        amount: Number(row.amount),
        adminNote: row.admin_note,
        adminEmail: row.admin_email,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        createdAt: row.created_at,
      })),
    };
  }

  async deleteVendor(adminUserId: string, vendorId: string) {
    const vendor = await this.databaseService.query<{
      id: string;
      shop_name: string;
      user_id: string;
      user_email: string;
      order_item_count: number;
    }>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.user_id,
         u.email AS user_email,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.vendor_id = v.id) AS order_item_count
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       WHERE v.id = $1`,
      [vendorId],
    );

    const record = vendor.rows[0];
    if (!record) {
      throw new NotFoundException('Vendor not found');
    }

    if (record.order_item_count > 0) {
      throw new BadRequestException(
        'This vendor cannot be deleted because they already have order history. Deactivate the vendor instead.',
      );
    }

    await this.databaseService.query('DELETE FROM users WHERE id = $1', [record.user_id]);

    await this.recordAdminActivity(adminUserId, {
      actionType: 'vendor_deleted',
      entityType: 'vendor',
      entityId: vendorId,
      entityLabel: record.shop_name,
      description: `Deleted vendor ${record.shop_name}.`,
      metadata: {
        vendorEmail: record.user_email,
      },
    });

    return { message: 'Vendor deleted' };
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
      throw new BadRequestException('Only cash on delivery orders can use COD status updates');
    }

    if (
      payload.paymentStatus === 'cod_collected' &&
      existing.rows[0].status !== 'delivered'
    ) {
      throw new BadRequestException('COD cash can only be collected after the order is delivered');
    }

    if (
      payload.paymentStatus === 'cod_refused' &&
      existing.rows[0].payment_status === 'cod_collected'
    ) {
      throw new BadRequestException('Collected COD orders cannot be marked as refused');
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
    }>(
      'SELECT TOP 1 id, title FROM products WHERE id = $1',
      [productId],
    );

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

  async resendVendorVerificationEmail(adminUserId: string, vendorId: string) {
    const vendorLookup = await this.databaseService.query<{
      id: string;
      shop_name: string;
      user_email: string;
      is_verified: boolean;
    }>(
      `SELECT TOP 1 v.id, v.shop_name, u.email AS user_email, v.is_verified
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

    const result = await this.authService.resendVerificationEmail({
      email: vendor.user_email,
    });

    await this.recordAdminActivity(adminUserId, {
      actionType: 'vendor_verification_resent',
      entityType: 'vendor',
      entityId: vendorId,
      entityLabel: vendor.shop_name,
      description: `Resent vendor verification email to ${vendor.shop_name}.`,
      metadata: {
        vendorEmail: vendor.user_email,
      },
    });

    return result;
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
        ['Shop name', 'Vendor email', 'Vendor active', 'Vendor verified', 'Login active', 'Created at'],
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
      customer_email: string;
      status: string;
      payment_method: string;
      payment_status: string;
      total_price: number | string;
      created_at: Date;
    }>(
      `SELECT
         o.id,
         u.email AS customer_email,
         o.status,
         o.payment_method,
         o.payment_status,
         o.total_price,
         o.created_at
       FROM orders o
       INNER JOIN users u ON u.id = o.customer_id
       ORDER BY o.created_at DESC, o.id DESC`,
    );

    const csv = this.toCsv([
      ['Order ID', 'Customer email', 'Status', 'Payment method', 'Payment status', 'Total price', 'Created at'],
      ...result.rows.map((row) => [
        row.id,
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

  private toCsv(rows: Array<Array<string | number | boolean | null | undefined>>) {
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

  private formatSqlDateTime(value: Date) {
    return value.toISOString().replace('T', ' ').replace('Z', '');
  }

  private activeSubscriptionClause(vendorAlias: string) {
    return `CASE
      WHEN ${vendorAlias}.subscription_override_status = 'expired' THEN 0
      WHEN ${vendorAlias}.subscription_override_status = 'active'
        AND ${vendorAlias}.subscription_override_ends_at IS NOT NULL
        AND ${vendorAlias}.subscription_override_ends_at >= SYSDATETIME()
        THEN 1
      WHEN ${vendorAlias}.subscription_status = 'active'
        AND ${vendorAlias}.subscription_ends_at IS NOT NULL
        AND ${vendorAlias}.subscription_ends_at >= SYSDATETIME()
        THEN 1
      ELSE 0
    END = 1`;
  }

  private effectiveEndsAtExpression(vendorAlias: string) {
    return `CASE
      WHEN ${vendorAlias}.subscription_override_status = 'active'
        AND ${vendorAlias}.subscription_override_ends_at IS NOT NULL
        AND ${vendorAlias}.subscription_override_ends_at >= SYSDATETIME()
        THEN ${vendorAlias}.subscription_override_ends_at
      ELSE ${vendorAlias}.subscription_ends_at
    END`;
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
    subscription_override_note: string | null;
    subscription_override_updated_at: Date | null;
  }) {
    const manualOverride = this.resolveManualOverride(vendor);
    if (
      manualOverride &&
      (vendor.subscription_override_status === 'expired' || manualOverride.status === 'active')
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

  private buildGuidLiteralClause(ids: string[]) {
    return ids.map((id) => `'${id}'`).join(', ');
  }
}
