import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types';
import {
  CreateOrderDto,
  CustomerCancelRequestDto,
  SyncCartDto,
  VendorOrderStatusDto,
} from './dto';
import { OrdersService } from './orders.service';
import { Public } from '../common/decorators/public.decorator';
import {
  PaginationQueryDto,
  resolvePagination,
} from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private firstHeaderValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }

  private getClientIp(req: Request) {
    const forwardedFor = this.firstHeaderValue(req.headers['x-forwarded-for']);
    if (forwardedFor?.trim()) {
      return forwardedFor.split(',')[0]?.trim() || null;
    }

    return req.socket.remoteAddress || req.ip || null;
  }

  private buildOrderSource(
    req: Request,
    checkoutSource: 'authenticated_checkout' | 'guest_checkout',
  ) {
    return {
      checkoutSource,
      ipAddress: this.getClientIp(req),
      userAgent: this.firstHeaderValue(req.headers['user-agent']),
      origin: this.firstHeaderValue(req.headers.origin),
      referer: this.firstHeaderValue(req.headers.referer),
    };
  }

  @Public()
  @Get('checkout/payment-settings')
  getCheckoutPaymentSettings() {
    return this.ordersService.getCheckoutPaymentSettings();
  }

  @Roles('customer', 'vendor')
  @Post('orders')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 5, windowMs: 1000 * 60 * 15 })
  createOrder(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(
      req.user.sub,
      dto,
      this.buildOrderSource(req, 'authenticated_checkout'),
    );
  }

  @Roles('customer', 'vendor')
  @Post('orders/stripe-checkout')
  createStripeCheckoutSession(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createStripeCheckoutSession(req.user.sub, dto);
  }

  @Roles('customer', 'vendor')
  @Post('orders/stripe-checkout/:sessionId/complete')
  completeStripeCheckoutSession(
    @Req() req: { user: AuthenticatedUser },
    @Param('sessionId') sessionId: string,
  ) {
    return this.ordersService.completeStripeCheckoutSession(
      req.user.sub,
      sessionId,
    );
  }

  @Public()
  @Post('orders/guest')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 3, windowMs: 1000 * 60 * 15 })
  createGuestOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    return this.ordersService.createGuestOrder(
      dto,
      this.buildOrderSource(req, 'guest_checkout'),
    );
  }

  @Public()
  @Post('orders/guest/stripe-checkout')
  createGuestStripeCheckoutSession(@Body() dto: CreateOrderDto) {
    return this.ordersService.createStripeCheckoutSession(null, dto);
  }

  @Public()
  @Post('orders/guest/stripe-checkout/:sessionId/complete')
  completeGuestStripeCheckoutSession(@Param('sessionId') sessionId: string) {
    return this.ordersService.completeStripeCheckoutSession(null, sessionId);
  }

  @Roles('customer', 'vendor')
  @Get('cart/my')
  getMyCart(@Req() req: { user: AuthenticatedUser }) {
    return this.ordersService.getCustomerCart(req.user.sub);
  }

  @Roles('customer', 'vendor')
  @Post('cart/my')
  syncMyCart(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SyncCartDto,
  ) {
    return this.ordersService.syncCustomerCart(req.user.sub, dto);
  }

  @Roles('customer', 'vendor')
  @Get('orders/my')
  getMyOrders(
    @Req() req: { user: AuthenticatedUser },
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ordersService.getCustomerOrders(
      req.user.sub,
      resolvePagination(pagination),
    );
  }

  @Roles('customer', 'vendor')
  @Patch('orders/:id/cancel-request')
  requestCancel(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: CustomerCancelRequestDto,
  ) {
    return this.ordersService.requestCustomerCancel(req.user.sub, id, dto);
  }

  @Roles('customer', 'vendor')
  @Post('orders/:id/reorder')
  reorder(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.ordersService.reorderCustomerOrder(req.user.sub, id);
  }

  @Roles('vendor')
  @Get('vendor/orders')
  getVendorOrders(
    @Req() req: { user: AuthenticatedUser },
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ordersService.getVendorOrders(
      req.user.sub,
      resolvePagination(pagination),
    );
  }

  @Roles('vendor')
  @Get('vendor/notifications')
  getVendorNotifications(@Req() req: { user: AuthenticatedUser }) {
    return this.ordersService.getVendorNotifications(req.user.sub);
  }

  @Roles('vendor')
  @Patch('vendor/notifications/:id/read')
  markVendorNotificationRead(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.markVendorNotificationRead(req.user.sub, id);
  }

  @Roles('vendor')
  @Patch('vendor/orders/:id/status')
  updateVendorOrderStatus(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: VendorOrderStatusDto,
  ) {
    return this.ordersService.updateVendorOrderStatus(req.user.sub, id, dto);
  }

  @Roles('vendor')
  @Patch('vendor/orders/:id/cancel-request')
  cancelVendorOrderAfterCustomerRequest(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.ordersService.cancelVendorOrderAfterCustomerRequest(
      req.user.sub,
      id,
    );
  }

  @Roles('vendor')
  @Patch('vendor/orders/:id/cancel')
  cancelVendorOrder(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.ordersService.cancelVendorOrder(req.user.sub, id, body.reason);
  }
}
