import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  private readonly deliverableEmailPattern =
    /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

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

  private getDeliverableMailAddress(mailFrom: string) {
    const configuredFrom = mailFrom.trim();
    const bracketAddress = configuredFrom.match(/<([^>]+)>/)?.[1]?.trim();
    const address = bracketAddress || configuredFrom;

    if (this.deliverableEmailPattern.test(address)) {
      return address;
    }

    const fallback = this.getDefaultMailFrom();
    this.logger.warn(
      `Ignoring invalid mail sender "${configuredFrom}". Falling back to ${fallback}.`,
    );
    return fallback;
  }

  private getSender(settings: Awaited<ReturnType<MailService['getMailerSettings']>>) {
    return {
      name: 'Vishu',
      address: this.getDeliverableMailAddress(settings.mailFrom),
    };
  }

  private getEmailLogoUrl(
    settings: Awaited<ReturnType<MailService['getMailerSettings']>>,
  ) {
    const configuredLogo = this.configService
      .get<string>('EMAIL_LOGO_URL', '')
      .trim();

    if (configuredLogo) {
      return configuredLogo;
    }

    return `${settings.appBaseUrl.replace(/\/$/, '')}/vishu-tab-logo.png`;
  }

  private renderEmailHtml(
    settings: Awaited<ReturnType<MailService['getMailerSettings']>>,
    title: string,
    bodyHtml: string,
  ) {
    const logoUrl = this.getEmailLogoUrl(settings);

    return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, Helvetica, sans-serif; color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background:#f4f4f4; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border:1px solid #e5e5e5;">
            <tr>
              <td style="padding:24px 24px 10px; text-align:center;">
                <img src="${logoUrl}" width="72" alt="Vishu.shop" style="display:inline-block; max-width:72px; height:auto; border:0;" />
                <div style="margin-top:10px; font-size:18px; font-weight:700; letter-spacing:0; color:#111111;">Vishu.shop</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 4px;">
                <h1 style="margin:0; font-size:22px; line-height:1.25; font-weight:700; color:#111111;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 26px; font-size:15px; line-height:1.6; color:#2b2b2b;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777; text-align:center;">
                Vishu.shop marketplace email
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
      requireTLS: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      dnsTimeout: 10_000,
      family: 4,
      auth: {
        user: settings.user ?? undefined,
        pass: settings.pass ?? undefined,
      },
      tls: {
        minVersion: 'TLSv1.2',
        servername: host,
      },
    });
  }

  async ensureVerificationDeliveryConfigured() {
    const settings = await this.getMailerSettings();

    if (!settings.host) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured yet. Add SMTP settings in admin before sending email.',
      );
    }

    return settings;
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
    const vendorBaseUrl =
      this.configService.get<string>('MERCHANT_BASE_URL')?.trim() ||
      settings.appBaseUrl;
    const baseUrl = accountType === 'vendor' ? vendorBaseUrl : settings.appBaseUrl;
    const verifyUrl =
      accountType === 'vendor'
        ? `${baseUrl}/vendor/verify?token=${encodeURIComponent(token)}`
        : `${baseUrl}/verify?token=${encodeURIComponent(token)}`;
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: email,
      subject:
        accountType === 'vendor'
          ? 'Verify your vendor account'
          : 'Verify your customer account',
      text:
        accountType === 'vendor'
          ? `Please verify your Vishu.shop vendor account: ${verifyUrl}`
          : `Please verify your Vishu.shop customer account: ${verifyUrl}`,
      html:
        accountType === 'vendor'
          ? this.renderEmailHtml(
              settings,
              'Verify your vendor account',
              `<p>Please verify your vendor account.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
            )
          : this.renderEmailHtml(
              settings,
              'Verify your customer account',
              `<p>Please verify your customer account.</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
            ),
    });
    this.logger.log(
      `Verification email queued for ${email}: ${info.messageId}`,
    );
  }

  async sendCustomerEmailChangeOtp(payload: {
    email: string;
    fullName?: string | null;
    code: string;
    expiresInMinutes: number;
  }) {
    const settings = await this.ensureVerificationDeliveryConfigured();
    if (!settings.vendorVerificationEmailsEnabled) {
      this.logger.warn(
        'Customer email change verification email skipped because verification emails are disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const greeting = payload.fullName?.trim()
      ? `Hi ${payload.fullName.trim()},`
      : 'Hi,';
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: payload.email,
      subject: 'Verify your new email address',
      text: `${greeting}

Use this one-time code to confirm your new email address on Vishu.shop:

${payload.code}

This code expires in ${payload.expiresInMinutes} minutes.`,
      html: this.renderEmailHtml(
        settings,
        'Verify your new email address',
        `<p>${greeting}</p>
<p>Use this one-time code to confirm your new email address on Vishu.shop:</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${payload.code}</p>
<p>This code expires in ${payload.expiresInMinutes} minutes.</p>`,
      ),
    });
    this.logger.log(
      `Customer email change OTP queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendCustomerRegistrationOtp(payload: {
    email: string;
    fullName?: string | null;
    code: string;
    expiresInMinutes: number;
  }) {
    const settings = await this.getMailerSettings();
    if (!settings.passwordResetEmailsEnabled) {
      this.logger.warn(
        'Customer registration OTP skipped because password reset emails are disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const greeting = payload.fullName?.trim()
      ? `Hi ${payload.fullName.trim()},`
      : 'Hi,';
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: payload.email,
      subject: 'Your Vishu.shop verification code',
      text: `${greeting}

Use this 6-digit code to verify your new Vishu.shop customer account:

${payload.code}

This code expires in ${payload.expiresInMinutes} minutes.`,
      html: this.renderEmailHtml(
        settings,
        'Your Vishu.shop verification code',
        `<p>${greeting}</p>
<p>Use this 6-digit code to verify your new Vishu.shop customer account:</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${payload.code}</p>
<p>This code expires in ${payload.expiresInMinutes} minutes.</p>`,
      ),
    });
    this.logger.log(
      `Customer registration OTP queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendVendorLoginOtp(payload: {
    email: string;
    fullName?: string | null;
    code: string;
    expiresInSeconds: number;
  }) {
    const settings = await this.getMailerSettings();
    if (!settings.passwordResetEmailsEnabled) {
      this.logger.warn(
        'Vendor login OTP skipped because password reset emails are disabled in platform settings',
      );
      return;
    }

    const transporter = await this.getTransporter(settings);
    const greeting = payload.fullName?.trim()
      ? `Hi ${payload.fullName.trim()},`
      : 'Hi,';
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: payload.email,
      subject: 'Your Vishu.shop vendor login code',
      text: `${greeting}

Use this 6-digit code to finish signing in to your Vishu.shop vendor account:

${payload.code}

This code expires in ${payload.expiresInSeconds} seconds. If it expires, keep the login prompt open and request a new code.`,
      html: this.renderEmailHtml(
        settings,
        'Your Vishu.shop vendor login code',
        `<p>${greeting}</p>
<p>Use this 6-digit code to finish signing in to your Vishu.shop vendor account:</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${payload.code}</p>
<p>This code expires in ${payload.expiresInSeconds} seconds. If it expires, keep the login prompt open and request a new code.</p>`,
      ),
    });
    this.logger.log(
      `Vendor login OTP queued for ${payload.email}: ${info.messageId}`,
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
      from: this.getSender(settings),
      to: email,
      subject: 'Reset your password',
      text: `Use this link to reset your Vishu password:

${resetUrl}

This link expires in 20 minutes and works once.`,
      html: this.renderEmailHtml(
        settings,
        'Reset your password',
        `<p>Use the link below to reset your Vishu password.</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 20 minutes and works once.</p>`,
      ),
    });
    this.logger.log(
      `Password reset email queued for ${email}: ${info.messageId}; accepted=${info.accepted?.join(',') || 'none'}; rejected=${info.rejected?.join(',') || 'none'}; response=${info.response || 'n/a'}`,
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
      from: this.getSender(settings),
      to: payload.email,
      subject: 'Activate your Vishu.shop account',
      html: this.renderEmailHtml(
        settings,
        'Activate your Vishu.shop account',
        `<p>${greeting}</p>
<p>We created a Vishu.shop customer account for this email after your recent purchase.</p>
<p>Activate it to track orders, view your order history, and manage future purchases.</p>
<p><a href="${activationUrl}">Activate account</a></p>`,
      ),
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
      from: this.getSender(settings),
      to: payload.email,
      subject: `Order confirmation ${payload.orderNumber}`,
      html: this.renderEmailHtml(
        settings,
        `Order confirmation ${payload.orderNumber}`,
        `<p>${greeting}</p>
<p>Thank you for your order.</p>
<p><strong>Order number:</strong> ${payload.orderNumber}</p>
<p><strong>Placed:</strong> ${new Date(payload.placedAt).toLocaleString('en-GB')}</p>
<ul>${itemsHtml}</ul>
<p><strong>Total:</strong> ${payload.totalPrice.toFixed(2)} EUR</p>
${address}
<p>We will contact you with delivery updates if needed.</p>`,
      ),
    });
    this.logger.log(
      `Guest order confirmation email queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendOrderCancelledEmail(payload: {
    email: string;
    fullName?: string | null;
    orderNumber: string;
    cancelNote?: string | null;
  }) {
    const settings = await this.getMailerSettings();
    const transporter = await this.getTransporter(settings);
    const greeting = payload.fullName?.trim()
      ? `Hi ${payload.fullName.trim()},`
      : 'Hi,';
    const note = payload.cancelNote?.trim();
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: payload.email,
      subject: `Order cancelled ${payload.orderNumber}`,
      text: `${greeting}

Your Vishu.shop order ${payload.orderNumber} has been cancelled.
${note ? `\nCancel request note: ${note}\n` : ''}
You do not need to take any further action for this order.`,
      html: this.renderEmailHtml(
        settings,
        `Order cancelled ${payload.orderNumber}`,
        `<p>${greeting}</p>
<p>Your Vishu.shop order <strong>${payload.orderNumber}</strong> has been cancelled.</p>
${note ? `<p><strong>Cancel request note:</strong> ${note}</p>` : ''}
<p>You do not need to take any further action for this order.</p>`,
      ),
    });
    this.logger.log(
      `Order cancellation email queued for ${payload.email}: ${info.messageId}`,
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
    const html = this.renderEmailHtml(
      settings,
      `Vendor waiting for approval: ${payload.shopName}`,
      `<p>A vendor is now verified and waiting for admin approval.</p><p><strong>Shop:</strong> ${payload.shopName}</p><p><strong>Email:</strong> ${payload.vendorEmail}</p><p><a href="${payload.reviewUrl}">${payload.reviewUrl}</a></p>`,
    );

    for (const email of uniqueEmails) {
      const info = await transporter.sendMail({
        from: this.getSender(settings),
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
      from: this.getSender(settings),
      to: email,
      subject: `Your shop ${payload.shopName} is now approved`,
      html: this.renderEmailHtml(
        settings,
        `Your shop ${payload.shopName} is now approved`,
        `<p>Your vendor account for <strong>${payload.shopName}</strong> has been approved.</p><p>You can now sign in and manage your shop.</p><p><a href="${loginUrl}">${loginUrl}</a></p>`,
      ),
    });
    this.logger.log(
      `Vendor approval email queued for ${email}: ${info.messageId}`,
    );
  }

  async sendVendorTeamInviteEmail(payload: {
    email: string;
    shopName: string;
    role: 'shop_holder' | 'manager' | 'employee';
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
      payload.role === 'shop_holder'
        ? 'Shop Holder'
        : payload.role === 'manager'
          ? 'Manager'
          : 'Employee';
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: payload.email,
      subject: `You have been invited to ${payload.shopName}`,
      html: this.renderEmailHtml(
        settings,
        `You have been invited to ${payload.shopName}`,
        `<p>${payload.inviterName} invited you to join <strong>${payload.shopName}</strong> on Vishu.shop.</p>
<p><strong>Role:</strong> ${roleLabel}</p>
<p>Use the link below to ${payload.actionLabel.toLowerCase()} and activate your access.</p>
<p><a href="${absoluteActionUrl}">${absoluteActionUrl}</a></p>`,
      ),
    });
    this.logger.log(
      `Vendor team invite email queued for ${payload.email}: ${info.messageId}`,
    );
  }

  async sendPlatformTestEmail(email: string) {
    const settings = await this.ensureVerificationDeliveryConfigured();
    const transporter = await this.getTransporter(settings);
    const info = await transporter.sendMail({
      from: this.getSender(settings),
      to: email,
      subject: 'Vishu platform email test',
      html: this.renderEmailHtml(
        settings,
        'Vishu platform email test',
        `<p>This is a test email from Vishu platform settings.</p><p>SMTP host: ${settings.host ?? 'json transport'}</p><p>App URL: ${settings.appBaseUrl}</p>`,
      ),
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
      from: this.getSender(settings),
      to: payload.email,
      subject: `Low stock alert: ${payload.productTitle}`,
      html: this.renderEmailHtml(
        settings,
        `Low stock alert: ${payload.productTitle}`,
        `<p>Your shop <strong>${payload.shopName}</strong> has a product at or below the low-stock threshold.</p>
<p><strong>Product:</strong> ${payload.productTitle}</p>
<p><strong>Product code:</strong> ${payload.productCode ?? 'Not assigned'}</p>
<p><strong>Current stock:</strong> ${payload.stock}</p>
<p><strong>Alert threshold:</strong> ${payload.threshold}</p>
<p><a href="${dashboardUrl}">${dashboardUrl}</a></p>`,
      ),
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
      from: this.getSender(settings),
      to: email,
      subject: 'Confirm access to your past guest orders',
      html: this.renderEmailHtml(
        settings,
        'Confirm access to your past guest orders',
        `<p>Use the link below to securely connect your previous guest orders to your Vishu.shop account.</p>
<p>This verification step is required before any old guest orders can appear in your account history.</p>
<p><a href="${claimUrl}">${claimUrl}</a></p>`,
      ),
    });
    this.logger.log(
      `Guest order claim email queued for ${email}: ${info.messageId}`,
    );
  }
}
