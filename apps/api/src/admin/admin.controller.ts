import {
  Body,
  Controller,
  Delete,
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
import { AdminService } from './admin.service';
import { AdminCodStatusDto } from '../orders/dto';
import {
  CreateAdminUserDto,
  SendPlatformTestEmailDto,
  UpdatePlatformSettingsDto,
  UpdateVendorSubscriptionDto,
} from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('reporting')
  getReporting(@Query('rangeDays') rangeDays?: string) {
    return this.adminService.getReporting(rangeDays);
  }

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Get('exports/:resource')
  getExport(
    @Req() req: { user: AuthenticatedUser },
    @Param('resource') resource: 'vendors' | 'customers' | 'orders',
  ) {
    return this.adminService.getExport(req.user.sub, resource);
  }

  @Get('platform-settings')
  getPlatformSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Patch('platform-settings')
  updatePlatformSettings(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    return this.adminService.updatePlatformSettings(req.user.sub, dto);
  }

  @Post('platform-settings/test-email')
  sendPlatformTestEmail(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SendPlatformTestEmailDto,
  ) {
    return this.adminService.sendPlatformTestEmail(req.user.sub, dto.email);
  }

  @Post('admins')
  createAdmin(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateAdminUserDto,
  ) {
    return this.adminService.createAdminUser(req.user.sub, dto);
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Delete('users/:id')
  deleteUser(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteUser(req.user.sub, id);
  }

  @Patch('users/:id/contact')
  updateUserContact(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { email?: string; phoneNumber?: string | null },
  ) {
    return this.adminService.updateUserContact(req.user.sub, id, body);
  }

  @Get('orders')
  getOrders() {
    return this.adminService.getOrders();
  }

  @Get('payouts')
  getVendorPayouts() {
    return this.adminService.getVendorPayouts();
  }

  @Post('payouts')
  recordVendorPayout(
    @Req() req: { user: AuthenticatedUser },
    @Body()
    body: {
      vendorId: string;
      amount: number;
      reference?: string | null;
      note?: string | null;
    },
  ) {
    return this.adminService.recordVendorPayout(req.user.sub, body);
  }

  @Get('orders/:id')
  getOrderById(@Param('id') id: string) {
    return this.adminService.getOrderById(id);
  }

  @Patch('orders/:id/cod')
  updateCodStatus(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: AdminCodStatusDto,
  ) {
    return this.adminService.updateCodStatus(req.user.sub, id, dto);
  }

  @Get('vendors/:id')
  getVendorById(@Param('id') id: string) {
    return this.adminService.getVendorById(id);
  }

  @Delete('vendors/:id')
  deleteVendor(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteVendor(req.user.sub, id);
  }

  @Get('products')
  getProducts() {
    return this.adminService.getProducts();
  }

  @Delete('products/:id')
  deleteProduct(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteProduct(req.user.sub, id);
  }

  @Patch('vendors/:id/activation')
  setVendorActivation(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.adminService.updateVendorActivation(req.user.sub, id, body.isActive);
  }

  @Post('vendors/:id/verification-resend')
  resendVendorVerification(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.resendVendorVerificationEmail(req.user.sub, id);
  }

  @Patch('vendors/:id/subscription')
  updateVendorSubscription(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpdateVendorSubscriptionDto,
  ) {
    return this.adminService.updateVendorSubscription(req.user.sub, id, dto);
  }

  @Patch('users/:id/activation')
  setUserActivation(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.adminService.setUserActive(req.user.sub, id, body.isActive);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.markNotificationRead(req.user.sub, id);
  }

  @Post('users/:id/password-reset')
  triggerPasswordReset(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.triggerPasswordReset(req.user.sub, id);
  }
}
