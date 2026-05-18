import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../common/types';
import {
  generateOpaqueToken,
  hashOpaqueToken,
} from '../common/security/security.utils';
import {
  isStoredSecretProtected,
  protectStoredSecret,
  unprotectStoredSecret,
} from '../common/security/stored-secrets.utils';
import { DatabaseService, QueryRunner } from '../database/database.service';
import {
  CreateOrderDto,
  CustomerCancelRequestDto,
  SyncCartDto,
  VendorOrderStatusDto,
} from './dto';
import { MailService } from '../mail/mail.service';
import { VendorAccessService } from '../vendor-access/vendor-access.service';
import {
  type PaginationInput,
  toPaginatedResponse,
} from '../common/dto/pagination.dto';

interface OrderProductRow {
  id: string;
  title: string;
  description: string;
  price: number | string;
  stock: number;
  vendor_id: string;
  platform_fee: number | string;
  platform_fee_mode: 'dynamic' | 'fixed' | null;
  fee_free_until: Date | null;
  vendor_created_at: Date;
  category: string;
  color: string | null;
  size: string | null;
  product_code: string | null;
  low_stock_alert_sent_at: Date | null;
  low_stock_threshold: number;
  shop_name: string;
  vendor_email: string;
}

interface VendorOrderFeeItemRow {
  id: string;
  unit_price: number | string;
  quantity: number;
  platform_fee: number | string | null;
  platform_fee_mode: 'dynamic' | 'fixed' | null;
  fee_free_until: Date | null;
}

interface OrderProductSizeRow {
  product_id: string;
  size_id: string;
  size_label: string;
  stock: number;
}

interface ShipmentFields {
  shippingCarrier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
}

interface CheckoutAddressRow {
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
}

interface CheckoutPaymentMethodRow {
  id: string;
  nickname: string | null;
  cardholder_name: string;
  brand: string;
  last4: string;
}

interface CheckoutSnapshotInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  city: string;
  addressLine1: string;
  apartmentOrNote: string | null;
  specialRequest: string | null;
}

interface CustomerCheckoutProfile {
  email: string;
  full_name: string | null;
  phone_number: string | null;
}

interface GuestCustomerResolution {
  customerId: string | null;
  activationUserId: string | null;
  sendActivationEmail: boolean;
}

interface OrderRequestMetadata {
  checkoutSource: string;
  ipAddress: string | null;
  userAgent: string | null;
  origin: string | null;
  referer: string | null;
}

interface OrderListRow {
  id: string;
  order_number: string | null;
  total_price: number | string;
  special_request: string | null;
  confirmed_at: Date | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  cod_status_note: string | null;
  cod_updated_at: Date | null;
  shipping_label: string | null;
  shipping_full_name: string | null;
  shipping_phone_number: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state_region: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  cancel_request_status: string;
  cancel_request_note: string | null;
  cancel_requested_at: Date | null;
  status: OrderStatus;
  created_at: Date;
  customer_email: string | null;
  customer_name: string | null;
}

interface OrderDetailRow {
  id: string;
  order_number: string | null;
  total_price: number | string;
  special_request: string | null;
  confirmed_at: Date | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  shipping_label: string | null;
  shipping_full_name: string | null;
  shipping_phone_number: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_state_region: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  payment_card_nickname: string | null;
  payment_cardholder_name: string | null;
  payment_card_brand: string | null;
  payment_card_last4: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  cod_status_note: string | null;
  cod_updated_at: Date | null;
  cancel_request_status: string;
  cancel_request_note: string | null;
  cancel_requested_at: Date | null;
  status: OrderStatus;
  created_at: Date;
}

interface OrderCustomerItemRow {
  order_id: string;
  id: string;
  quantity: number;
  unit_price: number | string;
  status: OrderStatus;
  shipping_carrier: string | null;
  tracking_number: string | null;
  shipped_at: Date | null;
  product_id: string;
  title: string;
  category: string;
  color: string | null;
  size: string | null;
  selected_size_id: string | null;
  selected_size_label: string | null;
}

interface OrderAdminItemRow extends OrderCustomerItemRow {
  commission_amount: number | string;
  vendor_earnings: number | string;
  product_code: string | null;
  vendor_id: string | null;
  shop_name: string | null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: MailService,
    private readonly vendorAccessService: VendorAccessService,
    private readonly configService: ConfigService,
  ) {}

  private readonly productRowGuard = (
    product: OrderProductRow | undefined,
    productId: string,
  ) => {
    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    return product;
  };

  async createOrder(
    customerId: string,
    dto: CreateOrderDto,
    requestMetadata?: OrderRequestMetadata,
  ) {
    return this.createOrderFromCheckout(customerId, dto, { requestMetadata });
  }

  async createGuestOrder(
    dto: CreateOrderDto,
    requestMetadata?: OrderRequestMetadata,
  ) {
    return this.createOrderFromCheckout(null, dto, { requestMetadata });
  }

  async getCheckoutPaymentSettings() {
    const settings = await this.loadActiveStripeOrderPaymentContext(false);

    return {
      mode: settings.mode,
      cashOnDeliveryEnabled: settings.cashOnDeliveryEnabled,
      cardPaymentsEnabled: false,
      guestCheckoutEnabled: settings.guestCheckoutEnabled,
      activeStripePublishableKey: null,
    };
  }

  async createStripeCheckoutSession(
    customerId: string | null,
    dto: CreateOrderDto,
  ) {
    void customerId;
    void dto;
    throw new BadRequestException(
      'Card payments are paused. Please use cash on delivery.',
    );
  }

  async completeStripeCheckoutSession(
    customerId: string | null,
    sessionId: string,
  ) {
    const stored = await this.databaseService.query<{
      id: string;
      customer_id: string | null;
      order_id: string | null;
      checkout_payload_json: string;
      status: string;
    }>(
      `SELECT TOP 1 id, customer_id, order_id, checkout_payload_json, status
       FROM payment_checkout_sessions
       WHERE stripe_session_id = $1`,
      [sessionId],
    );
    const record = stored.rows[0];
    if (!record) {
      throw new NotFoundException('Stripe checkout session not found');
    }
    if (record.customer_id && customerId && record.customer_id !== customerId) {
      throw new ForbiddenException('This checkout session belongs to another account');
    }
    if (record.customer_id && !customerId) {
      throw new ForbiddenException('Sign in to complete this checkout session');
    }
    if (record.order_id) {
      return record.customer_id
        ? this.getCustomerOrderById(record.order_id, record.customer_id)
        : this.getOrderSnapshotById(record.order_id);
    }

    const settings = await this.loadActiveStripeOrderPaymentContext(true);
    const stripe = this.createStripeClient(settings.secretKey!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      throw new BadRequestException('Stripe payment is not complete yet');
    }

    const dto = JSON.parse(record.checkout_payload_json) as CreateOrderDto;
    const orderCustomerId = record.customer_id ?? customerId ?? null;
    const placedOrder = await this.createOrderFromCheckout(orderCustomerId, dto, {
      forceCardPayment: true,
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
    });

    await this.databaseService.query(
      `UPDATE payment_checkout_sessions
       SET order_id = $1,
           stripe_payment_intent_id = $2,
           status = 'completed',
           completed_at = SYSDATETIME(),
           updated_at = SYSDATETIME()
       WHERE id = $3`,
      [
        placedOrder.id,
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
        record.id,
      ],
    );

    return placedOrder;
  }

  private async createOrderFromCheckout(
    customerId: string | null,
    dto: CreateOrderDto,
    options?: {
      forceCardPayment?: boolean;
      stripeSessionId?: string | null;
      stripePaymentIntentId?: string | null;
      requestMetadata?: OrderRequestMetadata;
    },
  ) {
    const lowStockAlerts: {
      vendorId: string;
      productId: string;
      email: string;
      shopName: string;
      productTitle: string;
      productCode: string | null;
      stock: number;
      threshold: number;
    }[] = [];

    const createdOrder = await this.databaseService.withTransaction(
      async (client) => {
        const isGuestCheckout = !customerId;
        const customerProfile = customerId
          ? await this.loadCheckoutCustomerProfile(client, customerId)
          : null;
        const needsSavedAddress =
          Boolean(customerId) &&
          (dto.addressId !== undefined ||
            !dto.fullName?.trim() ||
            !dto.phoneNumber?.trim() ||
            !dto.city?.trim() ||
            !dto.addressLine1?.trim());
        const savedAddress =
          customerId && needsSavedAddress
            ? await this.loadCheckoutAddress(client, customerId, dto.addressId)
            : null;
        const checkout = this.normalizeCheckoutInput(dto, {
          customerProfile,
          savedAddress,
        });
        const guestCustomer = isGuestCheckout
          ? await this.resolveGuestCheckoutCustomer(client, checkout)
          : null;
        const linkedCustomerId =
          customerId ?? guestCustomer?.customerId ?? null;
        const paymentMethod: PaymentMethod =
          options?.forceCardPayment || (customerId && dto.paymentMethod === 'card')
            ? 'card'
            : 'cash_on_delivery';
        if (paymentMethod === 'card' && !options?.forceCardPayment) {
          throw new BadRequestException(
            'Card payments are paused. Please use cash on delivery.',
          );
        }

        const paymentStatus: PaymentStatus =
          paymentMethod === 'cash_on_delivery' ? 'cod_pending' : 'paid';
        const savedPaymentMethod =
          customerId && paymentMethod === 'card' && !options?.forceCardPayment
            ? await this.loadCheckoutPaymentMethod(
                client,
                customerId,
                dto.paymentMethodId,
              )
            : null;
        const products = await this.loadProductsForOrder(
          client,
          dto.items.map((item) => item.productId),
        );
        await this.assertBuyerCanPurchaseProducts(
          client,
          customerId,
          products,
        );
        const sizeSelections = await this.loadProductSizeSelections(
          client,
          dto.items
            .filter((item) => item.sizeId)
            .map((item) => ({
              productId: item.productId,
              sizeId: item.sizeId as string,
            })),
        );

        const items = dto.items.map((item) => {
          const product = this.productRowGuard(
            products.get(item.productId),
            item.productId,
          );
          const sizeSelection = item.sizeId
            ? sizeSelections.get(`${item.productId}:${item.sizeId}`)
            : null;
          if (item.sizeId && !sizeSelection) {
            throw new BadRequestException('Selected size is not available for this product');
          }
          const availableStock = sizeSelection?.stock ?? product.stock;
          if (availableStock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${product.title}`,
            );
          }

          const unitPrice = Number(product.price);
          const gross = Number((unitPrice * item.quantity).toFixed(2));
          const commissionAmount = 0;
          const vendorEarnings = gross;

          return {
            product,
            quantity: item.quantity,
            unitPrice,
            commissionAmount,
            vendorEarnings,
            gross,
            sizeSelection,
          };
        });

        const totalPrice = Number(
          items.reduce((sum, item) => sum + item.gross, 0).toFixed(2),
        );
        const order = await client.query<{ id: string; created_at: Date }>(
          `INSERT INTO orders (
           customer_id, guest_email, guest_phone_number, total_price, special_request,
           shipping_address_id, shipping_label, shipping_full_name, shipping_phone_number,
           shipping_line1, shipping_line2, shipping_city, shipping_state_region,
           shipping_postal_code, shipping_country,
           payment_method_id, payment_card_nickname, payment_cardholder_name,
           payment_card_brand, payment_card_last4,
           stripe_checkout_session_id, stripe_payment_intent_id,
           checkout_source, source_ip_address, source_user_agent, source_origin, source_referer,
           payment_method, payment_status, status
         )
         OUTPUT INSERTED.id, INSERTED.created_at
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, 'pending')`,
          [
            linkedCustomerId,
            isGuestCheckout ? checkout.email : null,
            isGuestCheckout ? checkout.phoneNumber : null,
            totalPrice,
            checkout.specialRequest,
            savedAddress?.id ?? null,
            savedAddress?.label ??
              (isGuestCheckout ? 'Guest checkout' : 'Checkout details'),
            checkout.fullName,
            checkout.phoneNumber,
            checkout.addressLine1,
            checkout.apartmentOrNote,
            checkout.city,
            savedAddress?.state_region ?? null,
            savedAddress?.postal_code ?? null,
            savedAddress?.country ?? null,
            savedPaymentMethod?.id ?? null,
            savedPaymentMethod?.nickname ?? null,
            savedPaymentMethod?.cardholder_name ?? null,
            savedPaymentMethod?.brand ?? null,
            savedPaymentMethod?.last4 ?? null,
            options?.stripeSessionId ?? null,
            options?.stripePaymentIntentId ?? null,
            options?.requestMetadata?.checkoutSource ??
              (isGuestCheckout ? 'guest_checkout' : 'authenticated_checkout'),
            this.truncateOrderSourceValue(
              options?.requestMetadata?.ipAddress,
              64,
            ),
            this.truncateOrderSourceValue(
              options?.requestMetadata?.userAgent,
              512,
            ),
            this.truncateOrderSourceValue(options?.requestMetadata?.origin, 255),
            this.truncateOrderSourceValue(
              options?.requestMetadata?.referer,
              1000,
            ),
            paymentMethod,
            paymentStatus,
          ],
        );
        const orderId = order.rows[0].id;
        await this.assignPublicOrderNumber(
          client,
          orderId,
          order.rows[0].created_at,
        );

        for (const item of items) {
          await client.query(
            `INSERT INTO order_items (
             order_id, product_id, vendor_id, quantity, unit_price,
             commission_amount, vendor_earnings, selected_size_id, selected_size_label, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
            [
              order.rows[0].id,
              item.product.id,
              item.product.vendor_id,
              item.quantity,
              item.unitPrice,
              item.commissionAmount,
              item.vendorEarnings,
              item.sizeSelection?.size_id ?? null,
              item.sizeSelection?.size_label ?? null,
            ],
          );

          await client.query(
            'UPDATE products SET stock = stock - $1, updated_at = SYSDATETIME() WHERE id = $2',
            [item.quantity, item.product.id],
          );
          if (item.sizeSelection) {
            await client.query(
              `UPDATE product_sizes
               SET stock = stock - $1,
                   updated_at = SYSDATETIME()
               WHERE product_id = $2
                 AND size_id = $3`,
              [item.quantity, item.product.id, item.sizeSelection.size_id],
            );
          }

          const nextStock = item.product.stock - item.quantity;
          if (
            item.product.low_stock_threshold > 0 &&
            nextStock <= item.product.low_stock_threshold &&
            !item.product.low_stock_alert_sent_at
          ) {
            await client.query(
              `UPDATE products
             SET low_stock_alert_sent_at = SYSDATETIME(),
                 updated_at = SYSDATETIME()
             WHERE id = $1`,
              [item.product.id],
            );

            lowStockAlerts.push({
              vendorId: item.product.vendor_id,
              productId: item.product.id,
              email: item.product.vendor_email,
              shopName: item.product.shop_name,
              productTitle: item.product.title,
              productCode: item.product.product_code,
              stock: nextStock,
              threshold: item.product.low_stock_threshold,
            });
            await this.createVendorLowStockNotification(client, {
              vendorId: item.product.vendor_id,
              productId: item.product.id,
              productTitle: item.product.title,
              productCode: item.product.product_code,
              stock: nextStock,
              threshold: item.product.low_stock_threshold,
            });
          }
        }

        if (customerId) {
          await client.query(
            `DELETE ci
           FROM cart_items ci
           INNER JOIN carts c ON c.id = ci.cart_id
           WHERE c.customer_id = $1`,
            [customerId],
          );
        }

        return {
          id: orderId,
          checkout,
          guestCustomer,
          isGuestCheckout,
        };
      },
    );

    for (const alert of lowStockAlerts) {
      await this.mailService.sendVendorLowStockAlert(alert);
    }

    const placedOrder = createdOrder.isGuestCheckout
      ? await this.getOrderSnapshotById(createdOrder.id)
      : await this.getCustomerOrderById(createdOrder.id, customerId as string);

    if (createdOrder.isGuestCheckout) {
      await this.mailService.sendGuestOrderConfirmationEmail({
        email: createdOrder.checkout.email,
        fullName: createdOrder.checkout.fullName,
        orderNumber: placedOrder.orderNumber,
        totalPrice: placedOrder.totalPrice,
        placedAt: placedOrder.createdAt,
        shippingAddress: placedOrder.shippingAddress,
        items: placedOrder.items.map((item) => ({
          title: item.product.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          color: item.product.color,
          size: item.product.size,
        })),
      });

      if (
        createdOrder.guestCustomer?.sendActivationEmail &&
        createdOrder.guestCustomer.activationUserId
      ) {
        const token = await this.issueCustomerActivationToken(
          createdOrder.guestCustomer.activationUserId,
        );
        await this.mailService.sendCustomerActivationEmail({
          email: createdOrder.checkout.email,
          fullName: createdOrder.checkout.fullName,
          token,
        });
      }
    }

    return placedOrder;
  }

  private truncateOrderSourceValue(value: string | null | undefined, max: number) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.slice(0, max);
  }

  async getCustomerCart(customerId: string) {
    return this.loadCartSnapshot(customerId);
  }

  async syncCustomerCart(customerId: string, dto: SyncCartDto) {
    await this.ensureCartExists(customerId);

    await this.databaseService.withTransaction(async (client) => {
      const cart = await client.query<{ id: string }>(
        'SELECT TOP 1 id FROM carts WHERE customer_id = $1',
        [customerId],
      );
      const cartId = cart.rows[0].id;

      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

      if (dto.items.length) {
        const products = await this.loadProductsForOrder(
          client,
          dto.items.map((item) => item.productId),
        );
        await this.assertBuyerCanPurchaseProducts(
          client,
          customerId,
          products,
        );
        const sizeSelections = await this.loadProductSizeSelections(
          client,
          dto.items
            .filter((item) => item.sizeId)
            .map((item) => ({
              productId: item.productId,
              sizeId: item.sizeId as string,
            })),
        );

        for (const item of dto.items) {
          const product = this.productRowGuard(
            products.get(item.productId),
            item.productId,
          );
          const sizeSelection = item.sizeId
            ? sizeSelections.get(`${item.productId}:${item.sizeId}`)
            : null;
          if (item.sizeId && !sizeSelection) {
            throw new BadRequestException(
              'Selected size is not available for this product',
            );
          }
          const availableStock = sizeSelection?.stock ?? product.stock;
          if (availableStock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${product.title}`,
            );
          }

          await client.query(
            `INSERT INTO cart_items (
               cart_id,
               product_id,
               selected_size_id,
               selected_size_label,
               quantity,
               updated_at
             )
             VALUES ($1, $2, $3, $4, $5, SYSDATETIME())`,
            [
              cartId,
              item.productId,
              sizeSelection?.size_id ?? null,
              sizeSelection?.size_label ?? null,
              item.quantity,
            ],
          );
        }
      }

      await client.query(
        'UPDATE carts SET updated_at = SYSDATETIME() WHERE id = $1',
        [cartId],
      );
    });

    return this.loadCartSnapshot(customerId);
  }

  async getCustomerOrders(
    customerId: string,
    pagination?: PaginationInput | null,
  ) {
    const pagingClause = pagination
      ? ` OFFSET ${pagination.offset} ROWS FETCH NEXT ${pagination.pageSize} ROWS ONLY`
      : '';
    const [orders, totalCount] = await Promise.all([
      this.databaseService.query<OrderDetailRow>(
        `SELECT
         id,
         order_number,
         total_price,
         special_request,
         confirmed_at,
         shipped_at,
         delivered_at,
         shipping_label,
         shipping_full_name,
         shipping_phone_number,
         shipping_line1,
         shipping_line2,
         shipping_city,
         shipping_state_region,
         shipping_postal_code,
         shipping_country,
         payment_card_nickname,
         payment_cardholder_name,
         payment_card_brand,
         payment_card_last4,
         payment_method,
         payment_status,
         cod_status_note,
         cod_updated_at,
         cancel_request_status,
         cancel_request_note,
         cancel_requested_at,
         status,
         created_at
       FROM orders
       WHERE customer_id = $1
       ORDER BY created_at DESC${pagingClause}`,
        [customerId],
      ),
      pagination
        ? this.databaseService.query<{ total: number }>(
            'SELECT COUNT(*) AS total FROM orders WHERE customer_id = $1',
            [customerId],
          )
        : Promise.resolve({ rows: [] as { total: number }[] }),
    ]);

    const snapshots = await this.buildCustomerOrderSnapshots(orders.rows);
    if (!pagination) {
      return snapshots;
    }

    return toPaginatedResponse(
      snapshots,
      totalCount.rows[0]?.total ?? 0,
      pagination,
    );
  }

  async getVendorOrders(
    userId: string,
    pagination?: PaginationInput | null,
  ) {
    const vendor = await this.getVendorByUserId(userId);
    if (!vendor.is_active || !vendor.is_verified) {
      throw new ForbiddenException('Vendor account is not active');
    }

    const pagingClause = pagination
      ? ` OFFSET ${pagination.offset} ROWS FETCH NEXT ${pagination.pageSize} ROWS ONLY`
      : '';
    const [orders, totalCount] = await Promise.all([
      this.databaseService.query<OrderListRow>(
        `SELECT DISTINCT
         o.id,
         o.order_number,
         o.total_price,
         o.special_request,
         o.confirmed_at,
         o.shipped_at,
         o.delivered_at,
         o.payment_method,
         o.payment_status,
         o.cod_status_note,
         o.cod_updated_at,
         o.shipping_label,
         o.shipping_full_name,
         o.shipping_phone_number,
         o.shipping_line1,
         o.shipping_line2,
         o.shipping_city,
         o.shipping_state_region,
         o.shipping_postal_code,
         o.shipping_country,
         o.cancel_request_status,
         o.cancel_request_note,
         o.cancel_requested_at,
         o.status,
         o.created_at,
         COALESCE(u.email, o.guest_email) AS customer_email,
         COALESCE(
           NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.first_name, ''), ' ', ISNULL(u.last_name, '')))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(u.full_name, ''))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(o.shipping_full_name, ''))), ''),
           'Guest checkout'
         ) AS customer_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_id
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.vendor_id = $1
       ORDER BY o.created_at DESC${pagingClause}`,
        [vendor.id],
      ),
      pagination
        ? this.databaseService.query<{ total: number }>(
            `SELECT COUNT(DISTINCT o.id) AS total
             FROM orders o
             INNER JOIN order_items oi ON oi.order_id = o.id
             WHERE oi.vendor_id = $1`,
            [vendor.id],
          )
        : Promise.resolve({ rows: [] as { total: number }[] }),
    ]);

    const snapshots = await this.buildVendorOrderSnapshots(orders.rows, vendor.id);
    if (!pagination) {
      return snapshots;
    }

    return toPaginatedResponse(
      snapshots,
      totalCount.rows[0]?.total ?? 0,
      pagination,
    );
  }

  async getVendorNotifications(userId: string) {
    const vendor = await this.getVendorByUserId(userId);
    const notifications = await this.databaseService.query<{
      id: string;
      notification_type: string;
      title: string;
      body: string;
      action_url: string | null;
      product_id: string | null;
      metadata_json: string | null;
      read_at: Date | null;
      created_at: Date;
    }>(
      `SELECT TOP 20
         id,
         notification_type,
         title,
         body,
         action_url,
         product_id,
         metadata_json,
         read_at,
         created_at
       FROM vendor_notifications
       WHERE vendor_id = $1
       ORDER BY CASE WHEN read_at IS NULL THEN 0 ELSE 1 END, created_at DESC`,
      [vendor.id],
    );

    return notifications.rows.map((row) => ({
      id: row.id,
      type: row.notification_type,
      title: row.title,
      body: row.body,
      actionUrl: row.action_url,
      productId: row.product_id,
      metadata: this.parseNotificationMetadata(row.metadata_json),
      readAt: row.read_at,
      createdAt: row.created_at,
    }));
  }

  async markVendorNotificationRead(userId: string, notificationId: string) {
    const vendor = await this.getVendorByUserId(userId);
    await this.databaseService.query(
      `UPDATE vendor_notifications
       SET read_at = COALESCE(read_at, SYSDATETIME()),
           updated_at = SYSDATETIME()
       WHERE id = $1
         AND vendor_id = $2`,
      [notificationId, vendor.id],
    );

    return { message: 'Notification marked as read.' };
  }

  async getAllOrders(pagination?: PaginationInput | null) {
    const pagingClause = pagination
      ? ` OFFSET ${pagination.offset} ROWS FETCH NEXT ${pagination.pageSize} ROWS ONLY`
      : '';
    const [orders, totalCount] = await Promise.all([
      this.databaseService.query<OrderListRow>(
        `SELECT
         o.id,
         o.order_number,
         o.total_price,
         o.special_request,
         o.confirmed_at,
         o.shipped_at,
         o.delivered_at,
         o.payment_method,
         o.payment_status,
         o.cod_status_note,
         o.cod_updated_at,
         o.cancel_request_status,
         o.cancel_request_note,
         o.cancel_requested_at,
         o.status,
         o.created_at,
         COALESCE(u.email, o.guest_email) AS customer_email,
         COALESCE(
           NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.first_name, ''), ' ', ISNULL(u.last_name, '')))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(u.full_name, ''))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(o.shipping_full_name, ''))), ''),
           'Guest checkout'
         ) AS customer_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_id
       ORDER BY o.created_at DESC${pagingClause}`,
      ),
      pagination
        ? this.databaseService.query<{ total: number }>(
            'SELECT COUNT(*) AS total FROM orders',
          )
        : Promise.resolve({ rows: [] as { total: number }[] }),
    ]);

    const snapshots = await this.buildAdminOrderSnapshots(orders.rows);
    if (!pagination) {
      return snapshots;
    }

    return toPaginatedResponse(
      snapshots,
      totalCount.rows[0]?.total ?? 0,
      pagination,
    );
  }

  async updateVendorOrderStatus(
    userId: string,
    orderId: string,
    dto: VendorOrderStatusDto,
  ) {
    const vendor = await this.getVendorByUserId(userId);
    if (!vendor.is_active || !vendor.is_verified) {
      throw new ForbiddenException('Vendor account is not active');
    }

    const ownership = await this.databaseService.query<{
      id: string;
      status: OrderStatus;
      cancel_request_status: string;
      unit_price: number | string;
      quantity: number;
      platform_fee: number | string | null;
      platform_fee_mode: 'dynamic' | 'fixed' | null;
      fee_free_until: Date | null;
      vendor_created_at: Date;
    }>(
      `SELECT
         oi.id,
         oi.status,
         oi.unit_price,
         oi.quantity,
         v.platform_fee,
         v.platform_fee_mode,
         v.fee_free_until,
         o.cancel_request_status,
         v.created_at AS vendor_created_at
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       INNER JOIN vendors v ON v.id = oi.vendor_id
       WHERE oi.order_id = $1 AND oi.vendor_id = $2`,
      [orderId, vendor.id],
    );
    if (!ownership.rows.length) {
      throw new NotFoundException('Order not found');
    }
    if (ownership.rows[0].cancel_request_status === 'requested') {
      throw new BadRequestException(
        'This order has a customer cancellation request. Cancel the order instead of updating its status.',
      );
    }

    this.assertVendorStatusTransition(
      ownership.rows.map((item) => item.status),
      dto.status,
    );

    await this.databaseService.withTransaction(async (client) => {
      const shipmentFields = this.getShipmentFields(dto.status, dto);

      if (dto.status === 'confirmed') {
        await this.applyVendorPlatformFeeOnConfirmation(
          client,
          ownership.rows,
          ownership.rows[0].vendor_created_at,
          ownership.rows[0].fee_free_until,
        );
      }

      await client.query(
        `UPDATE order_items
         SET status = $1,
             shipping_carrier = CASE
               WHEN $1 = 'shipped' THEN $2
               WHEN $1 = 'delivered' THEN shipping_carrier
               ELSE NULL
             END,
             tracking_number = CASE
               WHEN $1 = 'shipped' THEN $3
               WHEN $1 = 'delivered' THEN tracking_number
               ELSE NULL
             END,
             shipped_at = CASE
               WHEN $1 = 'shipped' THEN $4
               WHEN $1 = 'delivered' THEN shipped_at
               ELSE NULL
             END,
             updated_at = SYSDATETIME()
         WHERE order_id = $5 AND vendor_id = $6`,
        [
          dto.status,
          shipmentFields.shippingCarrier,
          shipmentFields.trackingNumber,
          shipmentFields.shippedAt,
          orderId,
          vendor.id,
        ],
      );
      await this.syncOrderStatus(client, orderId);
    });

    return { message: 'Order status updated' };
  }

  async cancelVendorOrderAfterCustomerRequest(
    userId: string,
    orderId: string,
  ) {
    const vendor = await this.getVendorByUserId(userId);
    if (!vendor.is_active || !vendor.is_verified) {
      throw new ForbiddenException('Vendor account is not active');
    }

    const orderLookup = await this.databaseService.query<{
      id: string;
      order_number: string | null;
      status: OrderStatus;
      payment_method: PaymentMethod;
      cancel_request_status: string;
      cancel_request_note: string | null;
      customer_email: string | null;
      customer_name: string | null;
    }>(
      `SELECT TOP 1
         o.id,
         o.order_number,
         o.status,
         o.payment_method,
         o.cancel_request_status,
         o.cancel_request_note,
         COALESCE(u.email, o.guest_email) AS customer_email,
         COALESCE(
           NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.first_name, ''), ' ', ISNULL(u.last_name, '')))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(u.full_name, ''))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(o.shipping_full_name, ''))), '')
         ) AS customer_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_id
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND oi.vendor_id = $2`,
      [orderId, vendor.id],
    );

    const order = orderLookup.rows[0];
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException(
        'Only pending orders can be cancelled by the vendor',
      );
    }

    if (order.cancel_request_status !== 'requested') {
      throw new BadRequestException(
        'The customer has not requested cancellation for this order',
      );
    }

    await this.databaseService.withTransaction(async (client) => {
      const items = await client.query<{
        product_id: string;
        selected_size_id: string | null;
        quantity: number;
      }>(
        `SELECT product_id, selected_size_id, quantity
         FROM order_items
         WHERE order_id = $1`,
        [orderId],
      );

      for (const item of items.rows) {
        await client.query(
          `UPDATE products
           SET stock = stock + $1,
               updated_at = SYSDATETIME()
           WHERE id = $2`,
          [item.quantity, item.product_id],
        );
        if (item.selected_size_id) {
          await client.query(
            `UPDATE product_sizes
             SET stock = stock + $1,
                 updated_at = SYSDATETIME()
             WHERE product_id = $2
               AND size_id = $3`,
            [item.quantity, item.product_id, item.selected_size_id],
          );
        }
      }

      await client.query(
        `UPDATE order_items
         SET status = 'cancelled',
             shipping_carrier = NULL,
             tracking_number = NULL,
             shipped_at = NULL,
             updated_at = SYSDATETIME()
         WHERE order_id = $1`,
        [orderId],
      );

      await client.query(
        `UPDATE orders
         SET status = 'cancelled',
             payment_status = CASE
               WHEN payment_method = 'cash_on_delivery' THEN 'cod_refused'
               ELSE payment_status
             END,
             cancel_request_status = 'approved',
             updated_at = SYSDATETIME()
         WHERE id = $1`,
        [orderId],
      );
    });

    if (order.customer_email) {
      try {
        await this.mailService.sendOrderCancelledEmail({
          email: order.customer_email,
          fullName: order.customer_name,
          orderNumber: order.order_number ?? order.id,
          cancelNote: order.cancel_request_note,
        });
      } catch (emailError) {
        this.logger.warn(
          `Order ${order.order_number ?? order.id} was cancelled, but customer cancellation email failed: ${
            emailError instanceof Error ? emailError.message : String(emailError)
          }`,
        );
      }
    }

    return { message: 'Order cancelled and customer notified.' };
  }

  async cancelVendorOrder(userId: string, orderId: string, reason?: string) {
    const vendor = await this.getVendorByUserId(userId);
    if (!vendor.is_active || !vendor.is_verified) {
      throw new ForbiddenException('Vendor account is not active');
    }

    const orderLookup = await this.databaseService.query<{
      id: string;
      order_number: string | null;
      status: OrderStatus;
      payment_method: PaymentMethod;
      customer_email: string | null;
      customer_name: string | null;
    }>(
      `SELECT TOP 1
         o.id,
         o.order_number,
         o.status,
         o.payment_method,
         COALESCE(u.email, o.guest_email) AS customer_email,
         COALESCE(
           NULLIF(LTRIM(RTRIM(CONCAT(ISNULL(u.first_name, ''), ' ', ISNULL(u.last_name, '')))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(u.full_name, ''))), ''),
           NULLIF(LTRIM(RTRIM(ISNULL(o.shipping_full_name, ''))), '')
         ) AS customer_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.customer_id
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND oi.vendor_id = $2`,
      [orderId, vendor.id],
    );

    const order = orderLookup.rows[0];
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const vendorItems = await this.databaseService.query<{
      id: string;
      status: OrderStatus;
      product_id: string;
      selected_size_id: string | null;
      quantity: number;
    }>(
      `SELECT id, status, product_id, selected_size_id, quantity
       FROM order_items
       WHERE order_id = $1 AND vendor_id = $2`,
      [orderId, vendor.id],
    );

    if (!vendorItems.rows.length) {
      throw new NotFoundException('Order not found');
    }

    if (!vendorItems.rows.every((item) => item.status === 'pending')) {
      throw new BadRequestException(
        'Only pending vendor order items can be cancelled',
      );
    }

    let orderFullyCancelled = false;

    await this.databaseService.withTransaction(async (client) => {
      for (const item of vendorItems.rows) {
        await client.query(
          `UPDATE products
           SET stock = stock + $1,
               updated_at = SYSDATETIME()
           WHERE id = $2`,
          [item.quantity, item.product_id],
        );
        if (item.selected_size_id) {
          await client.query(
            `UPDATE product_sizes
             SET stock = stock + $1,
                 updated_at = SYSDATETIME()
             WHERE product_id = $2
               AND size_id = $3`,
            [item.quantity, item.product_id, item.selected_size_id],
          );
        }
      }

      await client.query(
        `UPDATE order_items
         SET status = 'cancelled',
             shipping_carrier = NULL,
             tracking_number = NULL,
             shipped_at = NULL,
             updated_at = SYSDATETIME()
         WHERE order_id = $1 AND vendor_id = $2`,
        [orderId, vendor.id],
      );

      await this.syncOrderStatus(client, orderId);

      const nextOrder = await client.query<{ status: OrderStatus }>(
        'SELECT TOP 1 status FROM orders WHERE id = $1',
        [orderId],
      );
      orderFullyCancelled = nextOrder.rows[0]?.status === 'cancelled';

      if (orderFullyCancelled && order.payment_method === 'cash_on_delivery') {
        await client.query(
          `UPDATE orders
           SET payment_status = 'cod_refused',
               cancel_request_status = CASE
                 WHEN cancel_request_status = 'requested' THEN 'approved'
                 ELSE cancel_request_status
               END,
               cancel_request_note = COALESCE($1, cancel_request_note),
               updated_at = SYSDATETIME()
           WHERE id = $2`,
          [reason?.trim() || null, orderId],
        );
      } else if (orderFullyCancelled) {
        await client.query(
          `UPDATE orders
           SET cancel_request_status = CASE
                 WHEN cancel_request_status = 'requested' THEN 'approved'
                 ELSE cancel_request_status
               END,
               cancel_request_note = COALESCE($1, cancel_request_note),
               updated_at = SYSDATETIME()
           WHERE id = $2`,
          [reason?.trim() || null, orderId],
        );
      }
    });

    if (orderFullyCancelled && order.customer_email) {
      try {
        await this.mailService.sendOrderCancelledEmail({
          email: order.customer_email,
          fullName: order.customer_name,
          orderNumber: order.order_number ?? order.id,
          cancelNote: reason?.trim() || 'Cancelled by the vendor.',
        });
      } catch (emailError) {
        this.logger.warn(
          `Order ${order.order_number ?? order.id} was cancelled by vendor, but customer email failed: ${
            emailError instanceof Error ? emailError.message : String(emailError)
          }`,
        );
      }
    }

    return {
      message: orderFullyCancelled
        ? 'Order cancelled and inventory restocked.'
        : 'Vendor items cancelled and inventory restocked.',
    };
  }

  async requestCustomerCancel(
    customerId: string,
    orderId: string,
    dto: CustomerCancelRequestDto,
  ) {
    const order = await this.databaseService.query<{
      id: string;
      status: OrderStatus;
      cancel_request_status: string;
    }>(
      `SELECT TOP 1 id, status, cancel_request_status
       FROM orders
       WHERE id = $1 AND customer_id = $2`,
      [orderId, customerId],
    );

    const row = order.rows[0];
    if (!row) {
      throw new NotFoundException('Order not found');
    }

    if (
      row.status === 'delivered' ||
      row.status === 'cancelled' ||
      row.status === 'returned'
    ) {
      throw new BadRequestException(
        'Cancel requests are only available before the order is delivered',
      );
    }

    if (row.cancel_request_status === 'requested') {
      throw new BadRequestException(
        'A cancel request has already been submitted',
      );
    }

    await this.databaseService.query(
      `UPDATE orders
       SET cancel_request_status = 'requested',
           cancel_request_note = $1,
           cancel_requested_at = SYSDATETIME(),
           updated_at = SYSDATETIME()
       WHERE id = $2 AND customer_id = $3`,
      [dto.note?.trim() || null, orderId, customerId],
    );

    return this.getCustomerOrderById(orderId, customerId);
  }

  async reorderCustomerOrder(customerId: string, orderId: string) {
    await this.ensureCartExists(customerId);

    const result = await this.databaseService.withTransaction(
      async (client) => {
        const orderItems = await client.query<{
          product_id: string;
          quantity: number;
        }>(
          `SELECT oi.product_id, oi.quantity
         FROM orders o
         INNER JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1 AND o.customer_id = $2`,
          [orderId, customerId],
        );

        if (!orderItems.rows.length) {
          throw new NotFoundException('Order not found');
        }

        const cart = await client.query<{ id: string }>(
          'SELECT TOP 1 id FROM carts WHERE customer_id = $1',
          [customerId],
        );
        const cartId = cart.rows[0].id;

        const products = await this.loadProductsForOrder(
          client,
          orderItems.rows.map((item) => item.product_id),
        );
        await this.assertBuyerCanPurchaseProducts(
          client,
          customerId,
          products,
        );
        const currentCartRows = await client.query<{
          product_id: string;
          quantity: number;
        }>('SELECT product_id, quantity FROM cart_items WHERE cart_id = $1', [
          cartId,
        ]);
        const currentCartMap = new Map(
          currentCartRows.rows.map((item) => [item.product_id, item.quantity]),
        );

        let addedCount = 0;

        for (const item of orderItems.rows) {
          const product = this.productRowGuard(
            products.get(item.product_id),
            item.product_id,
          );
          if (product.stock <= 0) {
            continue;
          }

          const existingQuantity = currentCartMap.get(item.product_id) ?? 0;
          const nextQuantity = Math.min(
            existingQuantity + item.quantity,
            product.stock,
          );

          if (nextQuantity <= 0 || nextQuantity === existingQuantity) {
            continue;
          }

          if (existingQuantity > 0) {
            await client.query(
              `UPDATE cart_items
             SET quantity = $1,
                 updated_at = SYSDATETIME()
             WHERE cart_id = $2 AND product_id = $3`,
              [nextQuantity, cartId, item.product_id],
            );
          } else {
            await client.query(
              `INSERT INTO cart_items (cart_id, product_id, quantity, updated_at)
             VALUES ($1, $2, $3, SYSDATETIME())`,
              [cartId, item.product_id, nextQuantity],
            );
          }

          currentCartMap.set(item.product_id, nextQuantity);
          addedCount += nextQuantity - existingQuantity;
        }

        if (addedCount === 0) {
          throw new BadRequestException(
            'None of the order items are currently available to reorder',
          );
        }

        await client.query(
          'UPDATE carts SET updated_at = SYSDATETIME() WHERE id = $1',
          [cartId],
        );

        return {
          addedCount,
        };
      },
    );

    return {
      message: 'Items added back to cart',
      addedCount: result.addedCount,
      cart: await this.loadCartSnapshot(customerId),
    };
  }


  private async getCustomerOrderById(orderId: string, customerId: string) {
    const orderResult = await this.databaseService.query<OrderDetailRow>(
      `SELECT TOP 1
         id,
         order_number,
         total_price,
         special_request,
         confirmed_at,
         shipped_at,
         delivered_at,
         shipping_label,
         shipping_full_name,
         shipping_phone_number,
         shipping_line1,
         shipping_line2,
         shipping_city,
         shipping_state_region,
         shipping_postal_code,
         shipping_country,
         payment_card_nickname,
         payment_cardholder_name,
         payment_card_brand,
         payment_card_last4,
         payment_method,
         payment_status,
         cod_status_note,
         cod_updated_at,
         cancel_request_status,
         cancel_request_note,
         cancel_requested_at,
         status,
         created_at
       FROM orders
       WHERE id = $1 AND customer_id = $2`,
      [orderId, customerId],
    );

    const order = orderResult.rows[0];
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return (await this.buildCustomerOrderSnapshots([order]))[0];
  }

  async getOrderSnapshotById(orderId: string) {
    const orderResult = await this.databaseService.query<OrderDetailRow>(
      `SELECT TOP 1
         id,
         order_number,
         total_price,
         special_request,
         confirmed_at,
         shipped_at,
         delivered_at,
         shipping_label,
         shipping_full_name,
         shipping_phone_number,
         shipping_line1,
         shipping_line2,
         shipping_city,
         shipping_state_region,
         shipping_postal_code,
         shipping_country,
         payment_card_nickname,
         payment_cardholder_name,
         payment_card_brand,
         payment_card_last4,
         payment_method,
         payment_status,
         cod_status_note,
         cod_updated_at,
         cancel_request_status,
         cancel_request_note,
         cancel_requested_at,
         status,
         created_at
       FROM orders
       WHERE id = $1`,
      [orderId],
    );

    const order = orderResult.rows[0];
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return (await this.buildCustomerOrderSnapshots([order]))[0];
  }

  private async buildCustomerOrderSnapshots(orders: OrderDetailRow[]) {
    if (!orders.length) {
      return [];
    }

    const orderIds = orders.map((order) => order.id);
    const items = await this.loadCustomerOrderItems(orderIds);
    const itemsByOrderId = this.groupRowsByOrderId(items);
    const imageMap = await this.buildProductImageMap(
      items.map((item) => item.product_id),
    );

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number ?? order.id,
      totalPrice: Number(order.total_price),
      specialRequest: order.special_request,
      fulfillment: {
        placedAt: order.created_at,
        confirmedAt: order.confirmed_at,
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
      },
      shippingAddress: order.shipping_line1
        ? {
            label: order.shipping_label,
            fullName: order.shipping_full_name,
            phoneNumber: order.shipping_phone_number,
            line1: order.shipping_line1,
            line2: order.shipping_line2,
            city: order.shipping_city,
            stateRegion: order.shipping_state_region,
            postalCode: order.shipping_postal_code,
            country: order.shipping_country,
          }
        : null,
      paymentCard:
        order.payment_method === 'card' && order.payment_card_last4
          ? {
              nickname: order.payment_card_nickname,
              cardholderName: order.payment_cardholder_name,
              brand: order.payment_card_brand,
              last4: order.payment_card_last4,
            }
          : null,
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      codStatusNote: order.cod_status_note,
      codUpdatedAt: order.cod_updated_at,
      cancelRequest: {
        status: order.cancel_request_status,
        note: order.cancel_request_note,
        requestedAt: order.cancel_requested_at,
      },
      status: order.status,
      createdAt: order.created_at,
      items: (itemsByOrderId.get(order.id) ?? []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        status: item.status,
        shipment: {
          shippingCarrier: item.shipping_carrier,
          trackingNumber: item.tracking_number,
          shippedAt: item.shipped_at,
        },
        product: {
          id: item.product_id,
          title: item.title,
          category: item.category,
          color: item.color,
          size: item.selected_size_label ?? item.size,
          images: imageMap.get(item.product_id) ?? [],
        },
      })),
    }));
  }

  private async buildVendorOrderSnapshots(
    orders: OrderListRow[],
    vendorId: string,
  ) {
    if (!orders.length) {
      return [];
    }

    const items = await this.loadAdminOrderItems(orders.map((order) => order.id), {
      vendorId,
      includeVendor: false,
    });
    const itemsByOrderId = this.groupRowsByOrderId(items);

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number ?? order.id,
      totalPrice: Number(order.total_price),
      specialRequest: order.special_request,
      fulfillment: {
        placedAt: order.created_at,
        confirmedAt: order.confirmed_at,
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
      },
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      codStatusNote: order.cod_status_note,
      codUpdatedAt: order.cod_updated_at,
      shippingAddress: order.shipping_line1
        ? {
            label: order.shipping_label,
            fullName: order.shipping_full_name,
            phoneNumber: order.shipping_phone_number,
            line1: order.shipping_line1,
            line2: order.shipping_line2,
            city: order.shipping_city,
            stateRegion: order.shipping_state_region,
            postalCode: order.shipping_postal_code,
            country: order.shipping_country,
          }
        : null,
      cancelRequest: {
        status: order.cancel_request_status,
        note: order.cancel_request_note,
        requestedAt: order.cancel_requested_at,
      },
      status: order.status,
      createdAt: order.created_at,
      customerEmail: order.customer_email,
      customerName: order.customer_name ?? 'Guest checkout',
      items: (itemsByOrderId.get(order.id) ?? []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        commission: Number(item.commission_amount),
        vendorEarnings: Number(item.vendor_earnings),
        status: item.status,
        shipment: {
          shippingCarrier: item.shipping_carrier,
          trackingNumber: item.tracking_number,
          shippedAt: item.shipped_at,
        },
        product: {
          id: item.product_id,
          title: item.title,
          category: item.category,
          color: item.color,
          size: item.selected_size_label ?? item.size,
          productCode: item.product_code,
        },
      })),
    }));
  }

  private async buildAdminOrderSnapshots(orders: OrderListRow[]) {
    if (!orders.length) {
      return [];
    }

    const items = await this.loadAdminOrderItems(orders.map((order) => order.id));
    const itemsByOrderId = this.groupRowsByOrderId(items);

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.order_number ?? order.id,
      totalPrice: Number(order.total_price),
      specialRequest: order.special_request,
      fulfillment: {
        placedAt: order.created_at,
        confirmedAt: order.confirmed_at,
        shippedAt: order.shipped_at,
        deliveredAt: order.delivered_at,
      },
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      codStatusNote: order.cod_status_note,
      codUpdatedAt: order.cod_updated_at,
      cancelRequest: {
        status: order.cancel_request_status,
        note: order.cancel_request_note,
        requestedAt: order.cancel_requested_at,
      },
      status: order.status,
      createdAt: order.created_at,
      customerEmail: order.customer_email ?? 'Guest checkout',
      customerName: order.customer_name ?? 'Guest checkout',
      items: (itemsByOrderId.get(order.id) ?? []).map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        commission: Number(item.commission_amount),
        vendorEarnings: Number(item.vendor_earnings),
        status: item.status,
        shipment: {
          shippingCarrier: item.shipping_carrier,
          trackingNumber: item.tracking_number,
          shippedAt: item.shipped_at,
        },
        product: {
          id: item.product_id,
          title: item.title,
          category: item.category,
          color: item.color,
          size: item.selected_size_label ?? item.size,
          productCode: item.product_code,
        },
        vendor: {
          id: item.vendor_id,
          shopName: item.shop_name,
        },
      })),
    }));
  }

  private async loadCustomerOrderItems(orderIds: string[]) {
    if (!orderIds.length) {
      return [];
    }

    const clause = this.buildGuidLiteralClause(orderIds);
    const result = await this.databaseService.query<OrderCustomerItemRow>(
      `SELECT
         oi.order_id,
         oi.id,
         oi.quantity,
         oi.unit_price,
         oi.status,
         oi.shipping_carrier,
         oi.tracking_number,
         oi.shipped_at,
         p.id AS product_id,
         p.title,
         p.category,
         p.color,
         p.size,
         oi.selected_size_id,
         oi.selected_size_label
       FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (${clause})
       ORDER BY oi.order_id ASC, p.title ASC`,
    );

    return result.rows;
  }

  private async loadAdminOrderItems(
    orderIds: string[],
    options: { vendorId?: string; includeVendor?: boolean } = {},
  ) {
    if (!orderIds.length) {
      return [];
    }

    const clause = this.buildGuidLiteralClause(orderIds);
    const filters = [`oi.order_id IN (${clause})`];
    const values: string[] = [];

    if (options.vendorId) {
      values.push(options.vendorId);
      filters.push(`oi.vendor_id = $${values.length}`);
    }

    const vendorJoin =
      options.includeVendor === false
        ? ''
        : '\n       INNER JOIN vendors v ON v.id = oi.vendor_id';
    const vendorSelect =
      options.includeVendor === false
        ? `CAST(NULL AS UNIQUEIDENTIFIER) AS vendor_id,
         CAST(NULL AS NVARCHAR(255)) AS shop_name`
        : `v.id AS vendor_id,
         v.shop_name`;

    const result = await this.databaseService.query<OrderAdminItemRow>(
      `SELECT
         oi.order_id,
         oi.id,
         oi.quantity,
         oi.unit_price,
         oi.commission_amount,
         oi.vendor_earnings,
         oi.status,
         oi.shipping_carrier,
         oi.tracking_number,
         oi.shipped_at,
         p.id AS product_id,
         p.title,
         p.category,
         p.color,
         p.size,
         oi.selected_size_id,
         oi.selected_size_label,
         p.product_code,
         ${vendorSelect}
       FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id${vendorJoin}
       WHERE ${filters.join(' AND ')}
       ORDER BY oi.order_id ASC, p.title ASC`,
      values,
    );

    return result.rows;
  }

  private async buildProductImageMap(productIds: string[]) {
    const imageRows = await this.getImagesForProducts(productIds);
    const imageMap = new Map<string, string[]>();

    for (const image of imageRows) {
      const current = imageMap.get(image.product_id) ?? [];
      current.push(image.image_url);
      imageMap.set(image.product_id, current);
    }

    return imageMap;
  }

  private groupRowsByOrderId<T extends { order_id: string }>(rows: T[]) {
    const grouped = new Map<string, T[]>();

    for (const row of rows) {
      const current = grouped.get(row.order_id) ?? [];
      current.push(row);
      grouped.set(row.order_id, current);
    }

    return grouped;
  }

  private async assignPublicOrderNumber(
    client: QueryRunner,
    orderId: string,
    createdAt: Date,
  ) {
    const dateKey = this.formatOrderNumberDateKey(createdAt);
    const counter = await client.query<{ last_value: number }>(
      `MERGE dbo.order_number_counters WITH (HOLDLOCK) AS target
       USING (SELECT $1 AS order_date_key) AS source
       ON target.order_date_key = source.order_date_key
       WHEN MATCHED THEN
         UPDATE
         SET last_value = target.last_value + 1,
             updated_at = SYSDATETIME()
       WHEN NOT MATCHED THEN
         INSERT (order_date_key, last_value, created_at, updated_at)
         VALUES (source.order_date_key, 1, SYSDATETIME(), SYSDATETIME())
       OUTPUT INSERTED.last_value;`,
      [dateKey],
    );

    const sequenceNumber = Number(counter.rows[0]?.last_value ?? 0);
    if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
      throw new BadRequestException('Unable to generate a public order number');
    }

    const orderNumber = `VSH-${dateKey}-${String(sequenceNumber).padStart(4, '0')}`;

    await client.query(
      `UPDATE orders
       SET order_number = $1,
           updated_at = SYSDATETIME()
       WHERE id = $2`,
      [orderNumber, orderId],
    );

    return orderNumber;
  }

  private async createVendorLowStockNotification(
    client: QueryRunner,
    payload: {
      vendorId: string;
      productId: string;
      productTitle: string;
      productCode: string | null;
      stock: number;
      threshold: number;
    },
  ) {
    await client.query(
      `INSERT INTO vendor_notifications (
         vendor_id,
         product_id,
         notification_type,
         title,
         body,
         action_url,
         metadata_json
       )
       VALUES ($1, $2, 'low_stock', $3, $4, $5, $6)`,
      [
        payload.vendorId,
        payload.productId,
        `Low stock: ${payload.productTitle}`,
        `${payload.productTitle} is at ${payload.stock} units, at or below your threshold of ${payload.threshold}.`,
        '/vendor/products',
        JSON.stringify({
          productCode: payload.productCode,
          stock: payload.stock,
          threshold: payload.threshold,
        }),
      ],
    );
  }

  private parseNotificationMetadata(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private normalizeCheckoutInput(
    dto: CreateOrderDto,
    context: {
      customerProfile?: CustomerCheckoutProfile | null;
      savedAddress?: CheckoutAddressRow | null;
    } = {},
  ): CheckoutSnapshotInput {
    const fullName = this.firstNonEmpty(
      dto.fullName,
      context.savedAddress?.full_name,
      context.customerProfile?.full_name,
    );
    const email = this.firstNonEmpty(dto.email, context.customerProfile?.email);
    const phoneNumber = this.firstNonEmpty(
      dto.phoneNumber,
      context.savedAddress?.phone_number,
      context.customerProfile?.phone_number,
    );
    const city = this.firstNonEmpty(dto.city, context.savedAddress?.city);
    const addressLine1 = this.firstNonEmpty(
      dto.addressLine1,
      context.savedAddress?.line1,
    );
    const apartmentOrNote =
      dto.apartmentOrNote?.trim() || context.savedAddress?.line2 || null;

    if (!fullName) {
      throw new BadRequestException(
        'Please add the customer name before placing the order',
      );
    }

    if (!email) {
      throw new BadRequestException(
        'Please add the customer email before placing the order',
      );
    }

    if (!phoneNumber) {
      throw new BadRequestException(
        'Please add the customer phone number before placing the order',
      );
    }

    if (!city) {
      throw new BadRequestException(
        'Please add the delivery city before placing the order',
      );
    }

    if (!addressLine1) {
      throw new BadRequestException(
        'Please add the delivery address before placing the order',
      );
    }

    return {
      fullName,
      email: email.toLowerCase(),
      phoneNumber,
      city,
      addressLine1,
      apartmentOrNote,
      specialRequest: dto.specialRequest?.trim() || null,
    };
  }

  private firstNonEmpty(...values: Array<string | null | undefined>) {
    for (const value of values) {
      const normalized = value?.trim();
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private async resolveGuestCheckoutCustomer(
    client: QueryRunner,
    checkout: CheckoutSnapshotInput,
  ): Promise<GuestCustomerResolution> {
    const existing = await client.query<{
      id: string;
      role: 'admin' | 'vendor' | 'customer';
      email_verified_at: Date | null;
      full_name: string | null;
      phone_number: string | null;
    }>(
      `SELECT TOP 1
         id,
         role,
         email_verified_at,
         full_name,
         phone_number
       FROM users
       WHERE email = $1`,
      [checkout.email],
    );

    const existingUser = existing.rows[0];
    if (!existingUser) {
      const passwordHash = await bcrypt.hash(randomUUID(), 10);
      const created = await client.query<{ id: string }>(
        `INSERT INTO users (
           email,
           full_name,
           phone_number,
           password_hash,
           role,
           email_verified_at,
           is_active
         )
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, 'customer', NULL, 1)`,
        [checkout.email, checkout.fullName, checkout.phoneNumber, passwordHash],
      );

      await this.upsertGuestCustomerAddress(
        client,
        created.rows[0].id,
        checkout,
        false,
      );

      return {
        customerId: created.rows[0].id,
        activationUserId: created.rows[0].id,
        sendActivationEmail: true,
      };
    }

    if (existingUser.role !== 'customer') {
      return {
        customerId: null,
        activationUserId: null,
        sendActivationEmail: false,
      };
    }

    await client.query(
      `UPDATE users
       SET full_name = CASE
             WHEN NULLIF(LTRIM(RTRIM(ISNULL(full_name, ''))), '') IS NULL THEN $1
             ELSE full_name
           END,
           phone_number = CASE
             WHEN NULLIF(LTRIM(RTRIM(ISNULL(phone_number, ''))), '') IS NULL THEN $2
             ELSE phone_number
           END,
           updated_at = SYSDATETIME()
       WHERE id = $3`,
      [checkout.fullName, checkout.phoneNumber, existingUser.id],
    );

    if (!existingUser.email_verified_at) {
      await this.upsertGuestCustomerAddress(
        client,
        existingUser.id,
        checkout,
        true,
      );
    }

    return {
      customerId: existingUser.id,
      activationUserId: existingUser.email_verified_at ? null : existingUser.id,
      sendActivationEmail: !existingUser.email_verified_at,
    };
  }

  private async upsertGuestCustomerAddress(
    client: QueryRunner,
    customerId: string,
    checkout: CheckoutSnapshotInput,
    overwriteExisting: boolean,
  ) {
    const existing = await client.query<{ id: string }>(
      `SELECT TOP 1 id
       FROM customer_addresses
       WHERE customer_id = $1
       ORDER BY is_default DESC, created_at ASC`,
      [customerId],
    );

    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO customer_addresses (
           customer_id,
           label,
           full_name,
           phone_number,
           line1,
           line2,
           city,
           state_region,
           postal_code,
           country,
           is_default
         )
         VALUES ($1, 'Default delivery', $2, $3, $4, $5, $6, NULL, '-', 'Local marketplace', 1)`,
        [
          customerId,
          checkout.fullName,
          checkout.phoneNumber,
          checkout.addressLine1,
          checkout.apartmentOrNote,
          checkout.city,
        ],
      );
      return;
    }

    if (!overwriteExisting) {
      return;
    }

    await client.query(
      `UPDATE customer_addresses
       SET label = 'Default delivery',
           full_name = $1,
           phone_number = $2,
           line1 = $3,
           line2 = $4,
           city = $5,
           state_region = NULL,
           postal_code = '-',
           country = 'Local marketplace',
           is_default = 1,
           updated_at = SYSDATETIME()
       WHERE id = $6`,
      [
        checkout.fullName,
        checkout.phoneNumber,
        checkout.addressLine1,
        checkout.apartmentOrNote,
        checkout.city,
        existing.rows[0].id,
      ],
    );
  }

  private async issueCustomerActivationToken(userId: string) {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE password_resets
         SET used_at = COALESCE(used_at, SYSDATETIME())
         WHERE user_id = $1
           AND used_at IS NULL`,
        [userId],
      );

      await client.query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, hashOpaqueToken(token), expiresAt],
      );
    });

    return token;
  }

  private async syncOrderStatus(client: QueryRunner, orderId: string) {
    const rows = await client.query<{ status: OrderStatus }>(
      'SELECT status FROM order_items WHERE order_id = $1',
      [orderId],
    );

    const statuses = rows.rows.map((row) => row.status);
    let orderStatus: OrderStatus = 'pending';

    if (statuses.length && statuses.every((status) => status === 'delivered')) {
      orderStatus = 'delivered';
    } else if (
      statuses.length &&
      statuses.every((status) => status === 'cancelled')
    ) {
      orderStatus = 'cancelled';
    } else if (
      statuses.length &&
      statuses.every((status) => status === 'returned')
    ) {
      orderStatus = 'returned';
    } else if (
      statuses.length &&
      statuses.every((status) => status === 'shipped' || status === 'delivered')
    ) {
      orderStatus = 'shipped';
    } else if (
      statuses.length &&
      statuses.every(
        (status) =>
          status === 'confirmed' ||
          status === 'shipped' ||
          status === 'delivered',
      )
    ) {
      orderStatus = 'confirmed';
    }

    await client.query(
      `UPDATE orders
       SET status = $1,
           confirmed_at = CASE
             WHEN $1 IN ('confirmed', 'shipped', 'delivered') AND confirmed_at IS NULL THEN SYSDATETIME()
             ELSE confirmed_at
           END,
           shipped_at = CASE
             WHEN $1 IN ('shipped', 'delivered') AND shipped_at IS NULL THEN SYSDATETIME()
             ELSE shipped_at
           END,
           delivered_at = CASE
             WHEN $1 = 'delivered' AND delivered_at IS NULL THEN SYSDATETIME()
             ELSE delivered_at
           END,
           updated_at = SYSDATETIME()
       WHERE id = $2`,
      [orderStatus, orderId],
    );
  }

  private assertVendorStatusTransition(
    currentStatuses: OrderStatus[],
    nextStatus: OrderStatus,
  ) {
    if (nextStatus === 'pending') {
      throw new BadRequestException(
        'Vendor orders cannot be moved back to pending',
      );
    }

    if (
      nextStatus === 'confirmed' &&
      !currentStatuses.every((status) => status === 'pending')
    ) {
      throw new BadRequestException(
        'Only pending vendor items can be confirmed',
      );
    }

    if (
      nextStatus === 'shipped' &&
      !currentStatuses.every((status) => status === 'confirmed')
    ) {
      throw new BadRequestException(
        'Only confirmed vendor items can be marked as shipped',
      );
    }

    if (
      nextStatus === 'delivered' &&
      !currentStatuses.every((status) => status === 'shipped')
    ) {
      throw new BadRequestException(
        'Only shipped vendor items can be marked as delivered',
      );
    }
  }

  private getShipmentFields(
    nextStatus: OrderStatus,
    dto: { shippingCarrier?: string; trackingNumber?: string },
  ): ShipmentFields {
    if (nextStatus === 'delivered') {
      return {
        shippingCarrier: null,
        trackingNumber: null,
        shippedAt: null,
      };
    }

    if (nextStatus !== 'shipped') {
      return {
        shippingCarrier: null,
        trackingNumber: null,
        shippedAt: null,
      };
    }

    return {
      shippingCarrier: dto.shippingCarrier?.trim() || null,
      trackingNumber: dto.trackingNumber?.trim() || null,
      shippedAt: new Date(),
    };
  }

  private formatOrderNumberDateKey(value: Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = String(value.getFullYear()).slice(-2);
    return `${day}${month}${year}`;
  }

  private async loadProductsForOrder(client: QueryRunner, ids: string[]) {
    const clause = this.buildGuidLiteralClause(ids);
    const result = await client.query<OrderProductRow>(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.price,
         p.stock,
         p.vendor_id,
         v.platform_fee,
         v.platform_fee_mode,
         v.fee_free_until,
         v.created_at AS vendor_created_at,
         p.category,
         p.color,
         p.size,
         p.product_code,
         p.low_stock_alert_sent_at,
         v.low_stock_threshold,
         v.shop_name,
         u.email AS vendor_email
       FROM products p
       INNER JOIN vendors v ON v.id = p.vendor_id
       INNER JOIN users u ON u.id = v.user_id
       WHERE p.id IN (${clause})
         AND p.is_listed = 1
         AND ${this.publicVisibilityClause('v')}`,
    );

    return new Map(result.rows.map((row) => [row.id, row]));
  }

  private async loadProductSizeSelections(
    client: QueryRunner,
    selections: Array<{ productId: string; sizeId: string }>,
  ) {
    if (!selections.length) {
      return new Map<string, OrderProductSizeRow>();
    }

    const productClause = this.buildGuidLiteralClause(
      selections.map((selection) => selection.productId),
    );
    const sizeClause = this.buildGuidLiteralClause(
      selections.map((selection) => selection.sizeId),
    );
    const result = await client.query<OrderProductSizeRow>(
      `SELECT
         ps.product_id,
         ps.size_id,
         s.label AS size_label,
         ps.stock
       FROM product_sizes ps
       INNER JOIN sizes s ON s.id = ps.size_id
       WHERE ps.product_id IN (${productClause})
         AND ps.size_id IN (${sizeClause})
         AND s.is_active = 1`,
    );

    return new Map(
      result.rows.map((row) => [`${row.product_id}:${row.size_id}`, row]),
    );
  }

  private async getImagesForProducts(productIds: string[]) {
    if (!productIds.length) {
      return [];
    }

    const clause = this.buildGuidLiteralClause(productIds);
    const result = await this.databaseService.query<{
      product_id: string;
      image_url: string;
    }>(
      `SELECT product_id, image_url
       FROM product_images
       WHERE product_id IN (${clause})
       ORDER BY product_id ASC, sort_order ASC`,
    );

    return result.rows;
  }

  private async getVendorByUserId(userId: string) {
    const access = await this.vendorAccessService.requireVendorAccess(userId);
    const result = await this.databaseService.query<{
      id: string;
      is_active: boolean;
      is_verified: boolean;
    }>(
      `SELECT TOP 1 id, is_active, is_verified
       FROM vendors
       WHERE id = $1`,
      [access.id],
    );

    return result.rows[0];
  }

  private publicVisibilityClause(vendorAlias: string) {
    return `${vendorAlias}.is_active = 1
      AND ${vendorAlias}.is_verified = 1`;
  }

  private resolveEffectiveVendorPlatformFee(
    configuredFee: number | string | null | undefined,
    vendorCreatedAt: Date | string,
    feeFreeUntil?: Date | string | null,
  ) {
    const fee = Number(configuredFee ?? 0);
    if (!Number.isFinite(fee) || fee <= 0) {
      return 0;
    }

    if (feeFreeUntil) {
      const freeUntil = new Date(feeFreeUntil);
      if (!Number.isNaN(freeUntil.getTime()) && new Date() < freeUntil) {
        return 0;
      }
    }

    const createdAt = new Date(vendorCreatedAt);
    if (Number.isNaN(createdAt.getTime())) {
      return fee;
    }

    const graceEndsAt = new Date(createdAt);
    graceEndsAt.setMonth(graceEndsAt.getMonth() + 2);

    if (new Date() < graceEndsAt) {
      return 0;
    }

    return fee;
  }

  private calculateDynamicVendorPlatformFee(vendorSubtotal: number) {
    if (!Number.isFinite(vendorSubtotal) || vendorSubtotal <= 0) {
      return 0;
    }

    let fee: number;
    if (vendorSubtotal <= 7) {
      fee = 0.5;
    } else if (vendorSubtotal <= 50) {
      fee = 0.5 + ((vendorSubtotal - 7) / 43) * 1.5;
    } else {
      fee = 2 + vendorSubtotal * 0.02;
    }

    return Number(Math.min(fee, vendorSubtotal).toFixed(2));
  }

  private allocateFeeAcrossVendorItems(
    items: VendorOrderFeeItemRow[],
    fee: number,
  ) {
    const itemGrossCents = items.map((item) =>
      Math.round(Number(item.unit_price) * item.quantity * 100),
    );
    const totalGrossCents = itemGrossCents.reduce((sum, gross) => sum + gross, 0);
    const totalFeeCents = Math.min(
      Math.round(fee * 100),
      totalGrossCents,
    );
    const allocations = new Map<string, number>();

    if (totalGrossCents <= 0 || totalFeeCents <= 0) {
      items.forEach((item) => allocations.set(item.id, 0));
      return allocations;
    }

    let allocatedCents = 0;
    items.forEach((item, index) => {
      const grossCents = itemGrossCents[index];
      const isLast = index === items.length - 1;
      const feeCents = isLast
        ? totalFeeCents - allocatedCents
        : Math.min(
            grossCents,
            Math.round((totalFeeCents * grossCents) / totalGrossCents),
          );

      allocations.set(item.id, Number((feeCents / 100).toFixed(2)));
      allocatedCents += feeCents;
    });

    return allocations;
  }

  private async applyVendorPlatformFeeOnConfirmation(
    client: QueryRunner,
    items: VendorOrderFeeItemRow[],
    vendorCreatedAt: Date | string,
    feeFreeUntil?: Date | string | null,
  ) {
    const subtotal = Number(
      items
        .reduce(
          (sum, item) => sum + Number(item.unit_price) * item.quantity,
          0,
        )
        .toFixed(2),
    );
    const mode = items[0]?.platform_fee_mode ?? 'dynamic';
    const fixedFee = Number(items[0]?.platform_fee ?? 0);
    const dynamicFee =
      mode === 'fixed' && Number.isFinite(fixedFee)
        ? Math.min(Math.max(0, fixedFee), subtotal)
        : this.calculateDynamicVendorPlatformFee(subtotal);
    const effectiveFee = this.resolveEffectiveVendorPlatformFee(
      dynamicFee,
      vendorCreatedAt,
      feeFreeUntil,
    );
    const feeByItem = this.allocateFeeAcrossVendorItems(items, effectiveFee);

    for (const item of items) {
      const gross = Number((Number(item.unit_price) * item.quantity).toFixed(2));
      const itemFee = feeByItem.get(item.id) ?? 0;
      await client.query(
        `UPDATE order_items
         SET commission_amount = $1,
             vendor_earnings = $2,
             updated_at = SYSDATETIME()
         WHERE id = $3`,
        [itemFee, Number((gross - itemFee).toFixed(2)), item.id],
      );
    }
  }

  private async ensureCartExists(customerId: string) {
    const existing = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM carts WHERE customer_id = $1',
      [customerId],
    );

    if (!existing.rows[0]) {
      await this.databaseService.query(
        'INSERT INTO carts (customer_id) VALUES ($1)',
        [customerId],
      );
    }
  }

  private async loadCartSnapshot(customerId: string) {
    await this.ensureCartExists(customerId);

    const cart = await this.databaseService.query<{
      product_id: string | null;
      selected_size_id: string | null;
      selected_size_label: string | null;
      quantity: number | null;
      title: string | null;
      description: string | null;
      category: string | null;
      price: number | string | null;
      stock: number | null;
      vendor_id: string | null;
    }>(
      `SELECT
         ci.product_id,
         ci.selected_size_id,
         ci.selected_size_label,
         ci.quantity,
         p.title,
         p.description,
         p.category,
         p.price,
         p.vendor_id,
         COALESCE(ps.stock, p.stock) AS stock
       FROM carts c
       LEFT JOIN cart_items ci ON ci.cart_id = c.id
       LEFT JOIN products p ON p.id = ci.product_id
       LEFT JOIN product_sizes ps
         ON ps.product_id = ci.product_id
        AND ps.size_id = ci.selected_size_id
       WHERE c.customer_id = $1
       ORDER BY ci.created_at ASC`,
      [customerId],
    );

    const productIds = cart.rows
      .filter((row) => row.product_id)
      .map((row) => row.product_id as string);
    const imageRows = await this.getImagesForProducts(productIds);
    const imageMap = new Map<string, string[]>();

    for (const image of imageRows) {
      const current = imageMap.get(image.product_id) ?? [];
      current.push(image.image_url);
      imageMap.set(image.product_id, current);
    }

    return {
      items: cart.rows
        .filter(
          (row) => row.product_id && row.quantity && row.title && row.category,
        )
        .map((row) => ({
          productId: row.product_id as string,
          vendorId: row.vendor_id,
          sizeId: row.selected_size_id,
          size: row.selected_size_label,
          quantity: row.quantity as number,
          product: {
            id: row.product_id as string,
            title: row.title as string,
            description: row.description ?? '',
            category: row.category as string,
            price: Number(row.price ?? 0),
            stock: row.stock ?? 0,
            selectedSizeId: row.selected_size_id,
            selectedSizeLabel: row.selected_size_label,
            images: imageMap.get(row.product_id as string) ?? [],
          },
        })),
    };
  }

  private buildGuidLiteralClause(values: string[]) {
    return values.map((value) => `'${this.assertGuid(value)}'`).join(', ');
  }

  private async assertBuyerCanPurchaseProducts(
    client: QueryRunner,
    customerId: string | null,
    products: Map<string, OrderProductRow>,
  ) {
    if (!customerId || products.size === 0) {
      return;
    }

    const vendor = await client.query<{ id: string }>(
      'SELECT TOP 1 id FROM vendors WHERE user_id = $1',
      [customerId],
    );
    const buyerVendorId = vendor.rows[0]?.id;
    if (!buyerVendorId) {
      return;
    }

    const ownProduct = Array.from(products.values()).find(
      (product) => product.vendor_id === buyerVendorId,
    );
    if (ownProduct) {
      throw new ForbiddenException(
        'You cannot add your own shop products to cart or checkout.',
      );
    }
  }

  private assertGuid(value: string) {
    if (!/^[0-9a-fA-F-]{36}$/.test(value)) {
      throw new BadRequestException('Invalid identifier');
    }

    return value;
  }

  private async loadCheckoutAddress(
    client: QueryRunner,
    customerId: string,
    addressId?: string,
  ) {
    const result = await client.query<CheckoutAddressRow>(
      `SELECT TOP 1
         id,
         label,
         full_name,
         phone_number,
         line1,
         line2,
         city,
         state_region,
         postal_code,
         country
       FROM customer_addresses
       WHERE customer_id = $1
         AND ($2 IS NULL OR id = $2)
       ORDER BY CASE WHEN $2 IS NOT NULL AND id = $2 THEN 0 ELSE 1 END, is_default DESC, created_at DESC`,
      [customerId, addressId ?? null],
    );

    const address = result.rows[0];
    if (!address) {
      throw new BadRequestException(
        'Please save a delivery address before checkout',
      );
    }

    return address;
  }

  private async loadCheckoutCustomerProfile(
    client: QueryRunner,
    customerId: string,
  ) {
    const result = await client.query<CustomerCheckoutProfile>(
      `SELECT TOP 1 email, full_name, phone_number
       FROM users
       WHERE id = $1`,
      [customerId],
    );

    const profile = result.rows[0];
    if (!profile) {
      throw new NotFoundException('Customer account not found');
    }

    return profile;
  }

  private async loadCheckoutPaymentMethod(
    client: QueryRunner,
    customerId: string,
    paymentMethodId?: string,
  ) {
    const result = await client.query<CheckoutPaymentMethodRow>(
      `SELECT TOP 1
         id,
         nickname,
         cardholder_name,
         brand,
         last4
       FROM customer_payment_methods
       WHERE customer_id = $1
         AND ($2 IS NULL OR id = $2)
       ORDER BY CASE WHEN $2 IS NOT NULL AND id = $2 THEN 0 ELSE 1 END, is_default DESC, created_at DESC`,
      [customerId, paymentMethodId ?? null],
    );

    const paymentMethod = result.rows[0];
    if (!paymentMethod) {
      throw new BadRequestException(
        'Please save a card before placing a prepaid order',
      );
    }

    return paymentMethod;
  }

  private async loadActiveStripeOrderPaymentContext(requireSecret: boolean) {
    const result = await this.databaseService.query<{
      payment_mode: 'test' | 'live';
      cash_on_delivery_enabled: boolean;
      card_payments_enabled: boolean;
      guest_checkout_enabled: boolean;
      stripe_test_publishable_key: string | null;
      stripe_test_secret_key: string | null;
      stripe_live_publishable_key: string | null;
      stripe_live_secret_key: string | null;
      app_base_url: string | null;
    }>(
      `SELECT TOP 1
         payment_mode,
         cash_on_delivery_enabled,
         card_payments_enabled,
         guest_checkout_enabled,
         stripe_test_publishable_key,
         stripe_test_secret_key,
         stripe_live_publishable_key,
         stripe_live_secret_key,
         app_base_url
       FROM platform_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    const mode: 'test' | 'live' =
      row?.payment_mode === 'live' ? 'live' : 'test';
    const secretColumn =
      mode === 'live' ? 'stripe_live_secret_key' : 'stripe_test_secret_key';
    let storedSecret =
      mode === 'live'
        ? row?.stripe_live_secret_key
        : row?.stripe_test_secret_key;

    if (storedSecret && !isStoredSecretProtected(storedSecret)) {
      const protectedSecret = protectStoredSecret(
        storedSecret,
        this.configService,
      );
      await this.databaseService.query(
        `UPDATE platform_settings
         SET ${secretColumn} = $1,
             updated_at = SYSDATETIME()
         WHERE id = 1`,
        [protectedSecret],
      );
      storedSecret = protectedSecret;
    }

    const envSecretKey =
      mode === 'live'
        ? this.configService.get<string>('STRIPE_LIVE_SECRET_KEY')?.trim() ||
          null
        : this.configService.get<string>('STRIPE_TEST_SECRET_KEY')?.trim() ||
          null;
    const secretKey =
      envSecretKey ?? unprotectStoredSecret(storedSecret, this.configService);

    if (requireSecret && !secretKey) {
      throw new BadRequestException(
        'Stripe is not configured for the active payment mode.',
      );
    }

    return {
      mode,
      secretKey,
      cashOnDeliveryEnabled: row ? Boolean(row.cash_on_delivery_enabled) : true,
      cardPaymentsEnabled: row ? Boolean(row.card_payments_enabled) : false,
      guestCheckoutEnabled: row ? Boolean(row.guest_checkout_enabled) : true,
      publishableKey:
        mode === 'live'
          ? row?.stripe_live_publishable_key?.trim() || null
          : row?.stripe_test_publishable_key?.trim() || null,
      appBaseUrl:
        row?.app_base_url?.trim() ||
        this.configService.get<string>('APP_BASE_URL')?.trim() ||
        'http://localhost:3001',
    };
  }

  private createStripeClient(secretKey: string) {
    return new Stripe(secretKey);
  }
}
