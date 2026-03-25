import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles('customer')
  @Post('orders')
  createOrder(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(req.user.sub, dto);
  }

  @Roles('customer')
  @Get('cart/my')
  getMyCart(@Req() req: { user: AuthenticatedUser }) {
    return this.ordersService.getCustomerCart(req.user.sub);
  }

  @Roles('customer')
  @Post('cart/my')
  syncMyCart(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SyncCartDto,
  ) {
    return this.ordersService.syncCustomerCart(req.user.sub, dto);
  }

  @Roles('customer')
  @Get('orders/my')
  getMyOrders(@Req() req: { user: AuthenticatedUser }) {
    return this.ordersService.getCustomerOrders(req.user.sub);
  }

  @Roles('customer')
  @Patch('orders/:id/cancel-request')
  requestCancel(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: CustomerCancelRequestDto,
  ) {
    return this.ordersService.requestCustomerCancel(req.user.sub, id, dto);
  }

  @Roles('customer')
  @Post('orders/:id/reorder')
  reorder(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.ordersService.reorderCustomerOrder(req.user.sub, id);
  }

  @Roles('vendor')
  @Get('vendor/orders')
  getVendorOrders(@Req() req: { user: AuthenticatedUser }) {
    return this.ordersService.getVendorOrders(req.user.sub);
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
}
