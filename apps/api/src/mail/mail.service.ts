import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  isStoredSecretProtected,
  protectStoredSecret,
  unprotectStoredSecret,
} from '../common/security/stored-secrets.utils';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  private getDefaultAppBaseUrl() {
    return this.configService.get<string>('NODE_ENV', 'development') ===
      'production'
      ? 'https://vishu.shop'
      : 'http://localhost:3001';
  }

  private getDefaultMailFrom() {
    return this.configService.get<string>('NODE_ENV', 'development') ===
      'production'
      ? 'noreply@vishu.shop'
      : 'noreply@vishu.local';
  }

  private async getMailerSettings() {
    const stored = await this.databaseService.query<{
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
         password_reset_emails_enabled
       FROM platform_settings
       WHERE id = 1`,
    );

    const row = stored.rows[0];
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

    return {
      host:
        row?.smtp_host || this.configService.get<string>('SMTP_HOST') || null,
      port: row?.smtp_port ?? this.configService.get<number>('SMTP_PORT', 587),
      secure:
        row?.smtp_host !== null && row?.smtp_host !== undefined
          ? Boolean(row.smtp_secure)
          : this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      user:
        row?.smtp_user || this.configService.get<string>('SMTP_USER') || null,
      pass:
        this.configService.get<string>('SMTP_PASS') ||
        unprotectStoredSecret(row?.smtp_pass, this.configService) ||
        null,
      mailFrom:
        row?.mail_from ||
        this.configService.get<string>('MAIL_FROM', this.getDefaultMailFrom()),
      appBaseUrl:
        row?.app_base_url ||
        this.configService.get<string>(
          'APP_BASE_URL',
          this.getDefaultAppBaseUrl(),
        ),
      vendorVerificationEmailsEnabled:
        row?.vendor_verification_emails_enabled !== undefined
          ? Boolean(row.vendor_verification_emails_enabled)
          : true,
      adminVendorApprovalEmailsEnabled:
        row?.admin_vendor_approval_emails_enabled !== undefined
          ? Boolean(row.admin_vendor_approval_emails_enabled)
          : true,
      passwordResetEmailsEnabled:
        row?.password_reset_emails_enabled !== undefined
          ? Boolean(row.password_reset_emails_enabled)
          : true,
    };
  }

  private async getTransporter(
    settings: Awaited<ReturnType<MailService['getMailerSettings']>>,
  ) {
    const host = settings.host;

    if (!host) {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    return nodemailer.createTransport({
      host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user ?? undefined,
        pass: settings.pass ?? undefined,
      },
    });
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    accountType: 'vendor' | 'customer' = 'vendor',
  ) {
    const settings = await this.getMailerSettings();
    if (!settings.vendorVerificationEmailsEnabled) {
      this.logger.warn(
        'Verification email skipped because it is disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const baseUrl = settings.appBaseUrl;
    const verifyUrl =
      accountType === 'vendor'
        ? `${baseUrl}/vendor/verify?token=${encodeURIComponent(token)}`
        : `${baseUrl}/verify?token=${encodeURIComponent(token)}`;
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: email,
      subject:
        accountType === 'vendor'
          ? 'Verify your vendor account'
          : 'Verify your customer account',
      html:
        accountType === 'vendor'
          ? `<p>Please verify your vendor account.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
          : `<p>Please verify your customer account.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
    this.logger.log(
      `Verification email queued for ${email}: ${info.messageId}`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const settings = await this.getMailerSettings();
    if (!settings.passwordResetEmailsEnabled) {
      this.logger.warn(
        'Password reset email skipped because it is disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const baseUrl = settings.appBaseUrl;
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: email,
      subject: 'Reset your password',
      html: `<p>Use the link below to reset your password.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
    this.logger.log(
      `Password reset email queued for ${email}: ${info.messageId}`,
    );
  }

  async sendCustomerActivationEmail(payload: {
    email: string;
    fullName?: string | null;
    token: string;
  }) {
    const settings = await this.getMailerSettings();
    if (!settings.passwordResetEmailsEnabled) {
      this.logger.warn(
        'Customer activation email skipped because password reset emails are disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const activationUrl = `${settings.appBaseUrl}/reset-password?token=${encodeURIComponent(payload.token)}`;
    const greeting = payload.fullName?.trim()
      ? `Hi ${payload.fullName.trim()},`
      : 'Hi,';
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: payload.email,
      subject: 'Activate your Vishu.shop account',
      html: `<p>${greeting}</p>
<p>We created a Vishu.shop customer account for this email after your recent purchase.</p>
<p>Activate it to track orders, view your order history, and manage future purchases.</p>
<p><a href="${activationUrl}">${activationUrl}</a></p>`,
    });
    this.logger.log(
      `Customer activation email queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendGuestOrderConfirmationEmail(payload: {
    email: string;
    fullName?: string | null;
    orderNumber: string;
    totalPrice: number;
    placedAt: Date;
    shippingAddress: {
      fullName: string | null;
      phoneNumber: string | null;
      line1: string | null;
      line2: string | null;
      city: string | null;
    } | null;
    items: Array<{
      title: string;
      quantity: number;
      unitPrice: number;
      color?: string | null;
      size?: string | null;
    }>;
  }) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const greeting = payload.fullName?.trim()
      ? `Hi ${payload.fullName.trim()},`
      : 'Hi,';
    const itemsHtml = payload.items
      .map((item) => {
        const variant = [item.color, item.size].filter(Boolean).join(' · ');
        return `<li><strong>${item.title}</strong> x ${item.quantity}${
          variant ? ` (${variant})` : ''
        } - ${item.unitPrice.toFixed(2)} EUR each</li>`;
      })
      .join('');
    const address = payload.shippingAddress
      ? `<p><strong>Delivery:</strong> ${[
          payload.shippingAddress.fullName,
          payload.shippingAddress.phoneNumber,
          payload.shippingAddress.line1,
          payload.shippingAddress.line2,
          payload.shippingAddress.city,
        ]
          .filter(Boolean)
          .join(', ')}</p>`
      : '';
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: payload.email,
      subject: `Order confirmation ${payload.orderNumber}`,
      html: `<p>${greeting}</p>
<p>Thank you for your order.</p>
<p><strong>Order number:</strong> ${payload.orderNumber}</p>
<p><strong>Placed:</strong> ${new Date(payload.placedAt).toLocaleString('en-GB')}</p>
<ul>${itemsHtml}</ul>
<p><strong>Total:</strong> ${payload.totalPrice.toFixed(2)} EUR</p>
${address}
<p>We will contact you with delivery updates if needed.</p>`,
    });
    this.logger.log(
      `Guest order confirmation email queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendAdminVendorApprovalAlert(
    emails: string[],
    payload: { shopName: string; vendorEmail: string; reviewUrl: string },
  ) {
    const uniqueEmails = [
      ...new Set(
        emails.map((entry) => entry.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (!uniqueEmails.length) {
      return;
    }

    const settings = await this.getMailerSettings();
    if (!settings.adminVendorApprovalEmailsEnabled) {
      this.logger.warn(
        'Admin vendor approval email skipped because it is disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const subject = `Vendor waiting for approval: ${payload.shopName}`;
    const html = `<p>A vendor is now verified and waiting for admin approval.</p><p><strong>Shop:</strong> ${payload.shopName}</p><p><strong>Email:</strong> ${payload.vendorEmail}</p><p><a href="${payload.reviewUrl}">${payload.reviewUrl}</a></p>`;

    for (const email of uniqueEmails) {
      const info = await transporter.sendMail({
        from: settings.mailFrom,
        to: email,
        subject,
        html,
      });
      this.logger.log(
        `Admin approval notification queued for ${email}: ${info.messageId}`,
      );
    }
  }

  async sendVendorApprovedEmail(email: string, payload: { shopName: string }) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const loginUrl = `${settings.appBaseUrl}/login`;
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: email,
      subject: `Your shop ${payload.shopName} is now approved`,
      html: `<p>Your vendor account for <strong>${payload.shopName}</strong> has been approved.</p><p>You can now sign in and manage your shop.</p><p><a href="${loginUrl}">${loginUrl}</a></p>`,
    });
    this.logger.log(
      `Vendor approval email queued for ${email}: ${info.messageId}`,
    );
  }

  async sendVendorTeamInviteEmail(payload: {
    email: string;
    shopName: string;
    role: 'shop_holder' | 'employee';
    inviterName: string;
    actionUrl: string;
    actionLabel: string;
  }) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const absoluteActionUrl = payload.actionUrl.startsWith('http')
      ? payload.actionUrl
      : `${settings.appBaseUrl}${payload.actionUrl}`;
    const roleLabel =
      payload.role === 'shop_holder' ? 'Shop Holder' : 'Employee';
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: payload.email,
      subject: `You have been invited to ${payload.shopName}`,
      html: `<p>${payload.inviterName} invited you to join <strong>${payload.shopName}</strong> on Vishu.shop.</p>
<p><strong>Role:</strong> ${roleLabel}</p>
<p>Use the link below to ${payload.actionLabel.toLowerCase()} and activate your access.</p>
<p><a href="${absoluteActionUrl}">${absoluteActionUrl}</a></p>`,
    });
    this.logger.log(
      `Vendor team invite email queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendPlatformTestEmail(email: string) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: email,
      subject: 'Vishu platform email test',
      html: `<p>This is a test email from Vishu platform settings.</p><p>SMTP host: ${settings.host ?? 'json transport'}</p><p>App URL: ${settings.appBaseUrl}</p>`,
    });
    this.logger.log(
      `Platform test email queued for ${email}: ${info.messageId}`,
    );
  }

  async sendVendorLowStockAlert(payload: {
    email: string;
    shopName: string;
    productTitle: string;
    productCode?: string | null;
    stock: number;
    threshold: number;
  }) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const dashboardUrl = `${settings.appBaseUrl}/vendor/dashboard`;
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: payload.email,
      subject: `Low stock alert: ${payload.productTitle}`,
      html: `<p>Your shop <strong>${payload.shopName}</strong> has a product at or below the low-stock threshold.</p>
<p><strong>Product:</strong> ${payload.productTitle}</p>
<p><strong>Product code:</strong> ${payload.productCode ?? 'Not assigned'}</p>
<p><strong>Current stock:</strong> ${payload.stock}</p>
<p><strong>Alert threshold:</strong> ${payload.threshold}</p>
<p><a href="${dashboardUrl}">${dashboardUrl}</a></p>`,
    });
    this.logger.log(
      `Vendor low stock alert queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendGuestOrderClaimEmail(email: string, token: string) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const claimUrl = `${settings.appBaseUrl}/claim-orders?token=${encodeURIComponent(token)}`;
    const info = await transporter.sendMail({
      from: settings.mailFrom,
      to: email,
      subject: 'Confirm access to your past guest orders',
      html: `<p>Use the link below to securely connect your previous guest orders to your Vishu.shop account.</p>
<p>This verification step is required before any old guest orders can appear in your account history.</p>
<p><a href="${claimUrl}">${claimUrl}</a></p>`,
    });
    this.logger.log(
      `Guest order claim email queued for ${email}: ${info.messageId}`,
    );
  }
}
