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
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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

  @Public()
  @Get('checkout/payment-settings')
  getCheckoutPaymentSettings() {
    return this.ordersService.getCheckoutPaymentSettings();
  }

  @Roles('customer', 'vendor')
  @Post('orders')
  createOrder(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(req.user.sub, dto);
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
  createGuestOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createGuestOrder(dto);
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
}
