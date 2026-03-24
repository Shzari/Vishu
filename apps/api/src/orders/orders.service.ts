import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  COMMISSION_RATE,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../common/types';
import { DatabaseService, QueryRunner } from '../database/database.service';
import {
  CreateOrderDto,
  CustomerCancelRequestDto,
  SyncCartDto,
  VendorOrderStatusDto,
} from './dto';
import { MailService } from '../mail/mail.service';

interface OrderProductRow {
  id: string;
  title: string;
  description: string;
  price: number | string;
  stock: number;
  vendor_id: string;
  category: string;
  color: string | null;
  size: string | null;
  product_code: string | null;
  low_stock_alert_sent_at: Date | null;
  low_stock_threshold: number;
  shop_name: string;
  vendor_email: string;
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

@Injectable()
export class OrdersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailService: MailService,
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

  async createOrder(customerId: string, dto: CreateOrderDto) {
    const lowStockAlerts: {
      email: string;
      shopName: string;
      productTitle: string;
      productCode: string | null;
      stock: number;
      threshold: number;
    }[] = [];

    const createdOrder = await this.databaseService.withTransaction(async (client) => {
      const paymentMethod: PaymentMethod = dto.paymentMethod ?? 'cash_on_delivery';
      const paymentStatus: PaymentStatus =
        paymentMethod === 'cash_on_delivery' ? 'cod_pending' : 'paid';
      const address = await this.loadCheckoutAddress(
        client,
        customerId,
        dto.addressId,
      );
      const savedPaymentMethod =
        paymentMethod === 'card'
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

      const items = dto.items.map((item) => {
        const product = this.productRowGuard(products.get(item.productId), item.productId);
        if (product.stock < item.quantity) {
          throw new BadRequestException(`Insufficient stock for ${product.title}`);
        }

        const unitPrice = Number(product.price);
        const gross = Number((unitPrice * item.quantity).toFixed(2));
        const commissionAmount = Number((gross * COMMISSION_RATE).toFixed(2));
        const vendorEarnings = Number((gross - commissionAmount).toFixed(2));

        return {
          product,
          quantity: item.quantity,
          unitPrice,
          commissionAmount,
          vendorEarnings,
          gross,
        };
      });

      const totalPrice = Number(items.reduce((sum, item) => sum + item.gross, 0).toFixed(2));
      const order = await client.query<{ id: string }>(
        `INSERT INTO orders (
           customer_id, total_price, special_request,
           shipping_address_id, shipping_label, shipping_full_name, shipping_phone_number,
           shipping_line1, shipping_line2, shipping_city, shipping_state_region,
           shipping_postal_code, shipping_country,
           payment_method_id, payment_card_nickname, payment_cardholder_name,
           payment_card_brand, payment_card_last4,
           payment_method, payment_status, status
         )
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pending')`,
        [
          customerId,
          totalPrice,
          dto.specialRequest?.trim() || null,
          address.id,
          address.label,
          address.full_name,
          address.phone_number,
          address.line1,
          address.line2,
          address.city,
          address.state_region,
          address.postal_code,
          address.country,
          savedPaymentMethod?.id ?? null,
          savedPaymentMethod?.nickname ?? null,
          savedPaymentMethod?.cardholder_name ?? null,
          savedPaymentMethod?.brand ?? null,
          savedPaymentMethod?.last4 ?? null,
          paymentMethod,
          paymentStatus,
        ],
      );

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, vendor_id, quantity, unit_price,
             commission_amount, vendor_earnings, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
          [
            order.rows[0].id,
            item.product.id,
            item.product.vendor_id,
            item.quantity,
            item.unitPrice,
            item.commissionAmount,
            item.vendorEarnings,
          ],
        );

        await client.query(
          'UPDATE products SET stock = stock - $1, updated_at = SYSDATETIME() WHERE id = $2',
          [item.quantity, item.product.id],
        );

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
            email: item.product.vendor_email,
            shopName: item.product.shop_name,
            productTitle: item.product.title,
            productCode: item.product.product_code,
            stock: nextStock,
            threshold: item.product.low_stock_threshold,
          });
        }
      }

      await client.query(
        `DELETE ci
         FROM cart_items ci
         INNER JOIN carts c ON c.id = ci.cart_id
         WHERE c.customer_id = $1`,
        [customerId],
      );

      return order.rows[0];
    });

    for (const alert of lowStockAlerts) {
      await this.mailService.sendVendorLowStockAlert(alert);
    }

    return this.getCustomerOrderById(createdOrder.id, customerId);
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

        for (const item of dto.items) {
          const product = this.productRowGuard(products.get(item.productId), item.productId);
          if (product.stock < item.quantity) {
            throw new BadRequestException(`Insufficient stock for ${product.title}`);
          }

          await client.query(
            `INSERT INTO cart_items (cart_id, product_id, quantity, updated_at)
             VALUES ($1, $2, $3, SYSDATETIME())`,
            [cartId, item.productId, item.quantity],
          );
        }
      }

      await client.query('UPDATE carts SET updated_at = SYSDATETIME() WHERE id = $1', [cartId]);
    });

    return this.loadCartSnapshot(customerId);
  }

  async getCustomerOrders(customerId: string) {
    const result = await this.databaseService.query<{ id: string }>(
      'SELECT id FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId],
    );

    return Promise.all(
      result.rows.map((order) => this.getCustomerOrderById(order.id, customerId)),
    );
  }

  async getVendorOrders(userId: string) {
    const vendor = await this.getVendorByUserId(userId);
    if (!vendor.is_active || !vendor.is_verified) {
      throw new ForbiddenException('Vendor account is not active');
    }

    const orders = await this.databaseService.query<{
      id: string;
      total_price: number | string;
      special_request: string | null;
      confirmed_at: Date | null;
      shipped_at: Date | null;
      delivered_at: Date | null;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      cod_status_note: string | null;
      cod_updated_at: Date | null;
      cancel_request_status: string;
      cancel_request_note: string | null;
      cancel_requested_at: Date | null;
      status: OrderStatus;
      created_at: Date;
      customer_email: string;
    }>(
      `SELECT DISTINCT
         o.id,
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
         u.email AS customer_email
       FROM orders o
       INNER JOIN users u ON u.id = o.customer_id
       INNER JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.vendor_id = $1
       ORDER BY o.created_at DESC`,
      [vendor.id],
    );

    return Promise.all(
      orders.rows.map(async (order) => {
        const items = await this.databaseService.query<{
          id: string;
          quantity: number;
          unit_price: number | string;
          commission_amount: number | string;
          vendor_earnings: number | string;
          status: OrderStatus;
          shipping_carrier: string | null;
          tracking_number: string | null;
          shipped_at: Date | null;
          product_id: string;
          title: string;
          category: string;
          color: string | null;
          size: string | null;
          product_code: string | null;
        }>(
          `SELECT
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
             p.product_code
           FROM order_items oi
           INNER JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = $1 AND oi.vendor_id = $2`,
          [order.id, vendor.id],
        );

        return {
          id: order.id,
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
          customerEmail: order.customer_email,
          items: items.rows.map((item) => ({
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
              size: item.size,
              productCode: item.product_code,
            },
          })),
        };
      }),
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

    const ownership = await this.databaseService.query<{ id: string; status: OrderStatus }>(
      'SELECT id, status FROM order_items WHERE order_id = $1 AND vendor_id = $2',
      [orderId, vendor.id],
    );
    if (!ownership.rows.length) {
      throw new NotFoundException('Order not found');
    }

    this.assertVendorStatusTransition(
      ownership.rows.map((item) => item.status),
      dto.status,
    );

    await this.databaseService.withTransaction(async (client) => {
      const shipmentFields = this.getShipmentFields(dto.status, dto);

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

    if (row.status !== 'pending') {
      throw new BadRequestException(
        'Cancel requests are only available before the order is confirmed',
      );
    }

    if (row.cancel_request_status === 'requested') {
      throw new BadRequestException('A cancel request has already been submitted');
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

    const result = await this.databaseService.withTransaction(async (client) => {
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
      const currentCartRows = await client.query<{ product_id: string; quantity: number }>(
        'SELECT product_id, quantity FROM cart_items WHERE cart_id = $1',
        [cartId],
      );
      const currentCartMap = new Map(
        currentCartRows.rows.map((item) => [item.product_id, item.quantity]),
      );

      let addedCount = 0;

      for (const item of orderItems.rows) {
        const product = this.productRowGuard(products.get(item.product_id), item.product_id);
        if (product.stock <= 0) {
          continue;
        }

        const existingQuantity = currentCartMap.get(item.product_id) ?? 0;
        const nextQuantity = Math.min(existingQuantity + item.quantity, product.stock);

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
        throw new BadRequestException('None of the order items are currently available to reorder');
      }

      await client.query('UPDATE carts SET updated_at = SYSDATETIME() WHERE id = $1', [cartId]);

      return {
        addedCount,
      };
    });

    return {
      message: 'Items added back to cart',
      addedCount: result.addedCount,
      cart: await this.loadCartSnapshot(customerId),
    };
  }

  async getAllOrders() {
    const orders = await this.databaseService.query<{
      id: string;
      total_price: number | string;
      special_request: string | null;
      confirmed_at: Date | null;
      shipped_at: Date | null;
      delivered_at: Date | null;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      cod_status_note: string | null;
      cod_updated_at: Date | null;
      cancel_request_status: string;
      cancel_request_note: string | null;
      cancel_requested_at: Date | null;
      status: OrderStatus;
      created_at: Date;
      customer_email: string;
    }>(
      `SELECT
         o.id,
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
         u.email AS customer_email
       FROM orders o
       INNER JOIN users u ON u.id = o.customer_id
       ORDER BY o.created_at DESC`,
    );

    return Promise.all(
      orders.rows.map(async (order) => {
        const items = await this.databaseService.query<{
          id: string;
          quantity: number;
          unit_price: number | string;
          commission_amount: number | string;
          vendor_earnings: number | string;
          status: OrderStatus;
          shipping_carrier: string | null;
          tracking_number: string | null;
          shipped_at: Date | null;
          product_id: string;
          title: string;
          category: string;
          color: string | null;
          size: string | null;
          product_code: string | null;
          vendor_id: string;
          shop_name: string;
        }>(
          `SELECT
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
             p.product_code,
             v.id AS vendor_id,
             v.shop_name
           FROM order_items oi
           INNER JOIN products p ON p.id = oi.product_id
           INNER JOIN vendors v ON v.id = oi.vendor_id
           WHERE oi.order_id = $1
           ORDER BY p.title ASC`,
          [order.id],
        );

        return {
          id: order.id,
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
          customerEmail: order.customer_email,
          items: items.rows.map((item) => ({
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
              size: item.size,
              productCode: item.product_code,
            },
            vendor: {
              id: item.vendor_id,
              shopName: item.shop_name,
            },
          })),
        };
      }),
    );
  }

  private async getCustomerOrderById(orderId: string, customerId: string) {
    const orderResult = await this.databaseService.query<{
      id: string;
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
    }>(
      `SELECT TOP 1
         id,
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

    const items = await this.databaseService.query<{
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
    }>(
      `SELECT
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
         p.size
       FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId],
    );

    const imageRows = await this.getImagesForProducts(items.rows.map((item) => item.product_id));
    const imageMap = new Map<string, string[]>();

    for (const image of imageRows) {
      const current = imageMap.get(image.product_id) ?? [];
      current.push(image.image_url);
      imageMap.set(image.product_id, current);
    }

    return {
      id: order.id,
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
      items: items.rows.map((item) => ({
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
          size: item.size,
          images: imageMap.get(item.product_id) ?? [],
        },
      })),
    };
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
      statuses.every((status) => status === 'shipped' || status === 'delivered')
    ) {
      orderStatus = 'shipped';
    } else if (
      statuses.length &&
      statuses.every(
        (status) => status === 'confirmed' || status === 'shipped' || status === 'delivered',
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
      throw new BadRequestException('Vendor orders cannot be moved back to pending');
    }

    if (
      nextStatus === 'confirmed' &&
      !currentStatuses.every((status) => status === 'pending')
    ) {
      throw new BadRequestException('Only pending vendor items can be confirmed');
    }

    if (
      nextStatus === 'shipped' &&
      !currentStatuses.every((status) => status === 'confirmed')
    ) {
      throw new BadRequestException('Only confirmed vendor items can be marked as shipped');
    }

    if (
      nextStatus === 'delivered' &&
      !currentStatuses.every((status) => status === 'shipped')
    ) {
      throw new BadRequestException('Only shipped vendor items can be marked as delivered');
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

    const trackingNumber = dto.trackingNumber?.trim();
    if (!trackingNumber) {
      throw new BadRequestException('Tracking number is required when marking an order as shipped');
    }

    return {
      shippingCarrier: dto.shippingCarrier?.trim() || null,
      trackingNumber,
      shippedAt: new Date(),
    };
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
         AND ${this.publicVisibilityClause('v')}`,
    );

    return new Map(result.rows.map((row) => [row.id, row]));
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
    const result = await this.databaseService.query<{
      id: string;
      is_active: boolean;
      is_verified: boolean;
    }>(
      `SELECT TOP 1 id, is_active, is_verified
       FROM vendors
       WHERE user_id = $1`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new ForbiddenException('Vendor profile not found');
    }

    return result.rows[0];
  }

  private publicVisibilityClause(vendorAlias: string) {
    return `${vendorAlias}.is_active = 1
      AND ${vendorAlias}.is_verified = 1
      AND ${this.activeSubscriptionClause(vendorAlias)}`;
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

  private async ensureCartExists(customerId: string) {
    const existing = await this.databaseService.query<{ id: string }>(
      'SELECT TOP 1 id FROM carts WHERE customer_id = $1',
      [customerId],
    );

    if (!existing.rows[0]) {
      await this.databaseService.query('INSERT INTO carts (customer_id) VALUES ($1)', [
        customerId,
      ]);
    }
  }

  private async loadCartSnapshot(customerId: string) {
    await this.ensureCartExists(customerId);

    const cart = await this.databaseService.query<{
      product_id: string | null;
      quantity: number | null;
      title: string | null;
      description: string | null;
      category: string | null;
      price: number | string | null;
      stock: number | null;
    }>(
      `SELECT
         ci.product_id,
         ci.quantity,
         p.title,
         p.description,
         p.category,
         p.price,
         p.stock
       FROM carts c
       LEFT JOIN cart_items ci ON ci.cart_id = c.id
       LEFT JOIN products p ON p.id = ci.product_id
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
        .filter((row) => row.product_id && row.quantity && row.title && row.category)
        .map((row) => ({
          productId: row.product_id as string,
          quantity: row.quantity as number,
          product: {
            id: row.product_id as string,
            title: row.title as string,
            description: row.description ?? '',
            category: row.category as string,
            price: Number(row.price ?? 0),
            stock: row.stock ?? 0,
            images: imageMap.get(row.product_id as string) ?? [],
          },
        })),
    };
  }

  private buildGuidLiteralClause(values: string[]) {
    return values.map((value) => `'${this.assertGuid(value)}'`).join(', ');
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
      throw new BadRequestException('Please save a delivery address before checkout');
    }

    return address;
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
      throw new BadRequestException('Please save a card before placing a prepaid order');
    }

    return paymentMethod;
  }
}
