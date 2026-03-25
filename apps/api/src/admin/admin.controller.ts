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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types';
import { AdminService } from './admin.service';
import { AdminCodStatusDto } from '../orders/dto';
import {
  CreateAdminUserDto,
  PromotionMutationDto,
  PromotionUpdateDto,
  SendPlatformTestEmailDto,
  UpdatePromotionSettingsDto,
  UpdatePlatformSettingsDto,
  UpdateVendorSubscriptionDto,
} from './dto';

function promotionUploadInterceptor() {
  return FileFieldsInterceptor(
    [
      { name: 'desktopBannerImage', maxCount: 1 },
      { name: 'mobileBannerImage', maxCount: 1 },
    ],
    {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadDir = join(process.cwd(), 'uploads', 'tmp');
          if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
          }
          callback(null, uploadDir);
        },
        filename: (_req, file, callback) => {
          const extension = file.originalname.includes('.')
            ? file.originalname.slice(file.originalname.lastIndexOf('.'))
            : '.jpg';
          callback(
            null,
            `promotion-${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`,
          );
        },
      }),
      fileFilter: (_req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
          callback(new Error('Only image uploads are allowed'), false);
          return;
        }

        callback(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    },
  );
}

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

  @Get('promotions')
  getPromotions() {
    return this.adminService.getPromotionSettings();
  }

  @Patch('promotions/settings')
  updatePromotionSettings(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdatePromotionSettingsDto,
  ) {
    return this.adminService.updatePromotionSettings(req.user.sub, dto);
  }

  @Post('promotions')
  @UseInterceptors(promotionUploadInterceptor())
  createPromotion(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: PromotionMutationDto,
    @UploadedFiles()
    files?: {
      desktopBannerImage?: Express.Multer.File[];
      mobileBannerImage?: Express.Multer.File[];
    },
  ) {
    return this.adminService.createPromotion(
      req.user.sub,
      dto,
      files?.desktopBannerImage?.[0],
      files?.mobileBannerImage?.[0],
    );
  }

  @Patch('promotions/:id')
  @UseInterceptors(promotionUploadInterceptor())
  updatePromotion(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: PromotionUpdateDto,
    @UploadedFiles()
    files?: {
      desktopBannerImage?: Express.Multer.File[];
      mobileBannerImage?: Express.Multer.File[];
    },
  ) {
    return this.adminService.updatePromotion(
      req.user.sub,
      id,
      dto,
      files?.desktopBannerImage?.[0],
      files?.mobileBannerImage?.[0],
    );
  }

  @Delete('promotions/:id')
  deletePromotion(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deletePromotion(req.user.sub, id);
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
    return this.adminService.updateVendorActivation(
      req.user.sub,
      id,
      body.isActive,
    );
  }

  @Post('vendors/:id/verification-resend')
  resendVendorVerification(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.resendVendorVerification(req.user.sub, id);
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
