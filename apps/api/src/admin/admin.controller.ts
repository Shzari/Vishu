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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  buildSafeUploadedImageName,
  ensureTemporaryUploadDir,
  isAllowedImageMimeType,
} from '../common/security/security.utils';
import { AuthenticatedUser } from '../common/types';
import {
  PaginationQueryDto,
  resolvePagination,
} from '../common/dto/pagination.dto';
import { AdminService } from './admin.service';
import { AdminCodStatusDto } from '../orders/dto';
import {
  BrandMutationDto,
  CatalogMasterDataMutationDto,
  CategoryMutationDto,
  ColorMutationDto,
  CreateAdminUserDto,
  GenderGroupMutationDto,
  PromotionMutationDto,
  PromotionUpdateDto,
  ReviewCatalogRequestDto,
  SendPlatformTestEmailDto,
  SizeMutationDto,
  SizeTypeMutationDto,
  SubcategoryMutationDto,
  UpdateVendorPlatformFeeDto,
  UpdatePromotionSettingsDto,
  UpdatePlatformSettingsDto,
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
          callback(null, ensureTemporaryUploadDir());
        },
        filename: (_req, file, callback) => {
          callback(
            null,
            buildSafeUploadedImageName('promotion', file.mimetype),
          );
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
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
  getUsers(@Query() pagination: PaginationQueryDto) {
    return this.adminService.getUsers(resolvePagination(pagination));
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

  @Get('catalog-requests')
  getCatalogRequests(
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getCatalogRequests(type, status);
  }

  @Get('catalog-structure')
  getCatalogStructure() {
    return this.adminService.getCatalogStructure();
  }

  @Post('catalog/categories')
  createCategory(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CategoryMutationDto,
  ) {
    return this.adminService.createCategory(req.user.sub, dto);
  }

  @Patch('catalog/categories/:id')
  updateCategory(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: CategoryMutationDto,
  ) {
    return this.adminService.updateCategory(req.user.sub, id, dto);
  }

  @Delete('catalog/categories/:id')
  deleteCategory(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteCategory(req.user.sub, id);
  }

  @Post('catalog/subcategories')
  createSubcategory(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SubcategoryMutationDto,
  ) {
    return this.adminService.createSubcategory(req.user.sub, dto);
  }

  @Patch('catalog/subcategories/:id')
  updateSubcategory(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: SubcategoryMutationDto,
  ) {
    return this.adminService.updateSubcategory(req.user.sub, id, dto);
  }

  @Delete('catalog/subcategories/:id')
  deleteSubcategory(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteSubcategory(req.user.sub, id);
  }

  @Post('catalog/brands')
  createBrand(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: BrandMutationDto,
  ) {
    return this.adminService.createBrand(req.user.sub, dto);
  }

  @Patch('catalog/brands/:id')
  updateBrand(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: BrandMutationDto,
  ) {
    return this.adminService.updateBrand(req.user.sub, id, dto);
  }

  @Delete('catalog/brands/:id')
  deleteBrand(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteBrand(req.user.sub, id);
  }

  @Post('catalog/colors')
  createColor(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: ColorMutationDto,
  ) {
    return this.adminService.createColor(req.user.sub, dto);
  }

  @Patch('catalog/colors/:id')
  updateColor(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ColorMutationDto,
  ) {
    return this.adminService.updateColor(req.user.sub, id, dto);
  }

  @Delete('catalog/colors/:id')
  deleteColor(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteColor(req.user.sub, id);
  }

  @Post('catalog/size-types')
  createSizeType(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SizeTypeMutationDto,
  ) {
    return this.adminService.createSizeType(req.user.sub, dto);
  }

  @Patch('catalog/size-types/:id')
  updateSizeType(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: SizeTypeMutationDto,
  ) {
    return this.adminService.updateSizeType(req.user.sub, id, dto);
  }

  @Delete('catalog/size-types/:id')
  deleteSizeType(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteSizeType(req.user.sub, id);
  }

  @Post('catalog/sizes')
  createSize(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SizeMutationDto,
  ) {
    return this.adminService.createSize(req.user.sub, dto);
  }

  @Patch('catalog/sizes/:id')
  updateSize(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: SizeMutationDto,
  ) {
    return this.adminService.updateSize(req.user.sub, id, dto);
  }

  @Delete('catalog/sizes/:id')
  deleteSize(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.adminService.deleteSize(req.user.sub, id);
  }

  @Post('catalog/gender-groups')
  createGenderGroup(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: GenderGroupMutationDto,
  ) {
    return this.adminService.createGenderGroup(req.user.sub, dto);
  }

  @Patch('catalog/gender-groups/:id')
  updateGenderGroup(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: GenderGroupMutationDto,
  ) {
    return this.adminService.updateGenderGroup(req.user.sub, id, dto);
  }

  @Delete('catalog/gender-groups/:id')
  deleteGenderGroup(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteGenderGroup(req.user.sub, id);
  }

  @Patch('catalog-requests/:id/review')
  reviewCatalogRequest(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ReviewCatalogRequestDto,
  ) {
    return this.adminService.reviewCatalogRequest(req.user.sub, id, dto);
  }

  @Get('master-data')
  getCatalogMasterData() {
    return this.adminService.getCatalogMasterData();
  }

  @Post('master-data')
  createCatalogMasterData(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CatalogMasterDataMutationDto,
  ) {
    return this.adminService.createCatalogMasterData(req.user.sub, dto);
  }

  @Patch('master-data/:id')
  updateCatalogMasterData(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: CatalogMasterDataMutationDto,
  ) {
    return this.adminService.updateCatalogMasterData(req.user.sub, id, dto);
  }

  @Delete('master-data/:id')
  deleteCatalogMasterData(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteCatalogMasterData(req.user.sub, id);
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
  getOrders(@Query() pagination: PaginationQueryDto) {
    return this.adminService.getOrders(resolvePagination(pagination));
  }

  @Get('payouts')
  getVendorPayouts() {
    return this.adminService.getVendorPayouts();
  }

  @Get('vendor-fees')
  getVendorFeeSummary() {
    return this.adminService.getVendorFeeSummary();
  }

  @Get('vendor-fees/:id/history')
  getVendorFeeHistory(@Param('id') id: string) {
    return this.adminService.getVendorFeeHistory(id);
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

  @Patch('vendors/:id/platform-fee')
  updateVendorPlatformFee(
    @Param('id') id: string,
    @Body() dto: UpdateVendorPlatformFeeDto,
  ) {
    return this.adminService.updateVendorPlatformFee(id, dto.platformFee);
  }

  @Get('vendors/:id/orders')
  getVendorOrders(
    @Param('id') id: string,
    @Query('status') status: string | undefined,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getVendorOrders(
      id,
      status,
      resolvePagination({ page, pageSize }),
    );
  }

  @Get('products')
  getProducts(@Query() pagination: PaginationQueryDto) {
    return this.adminService.getProducts(resolvePagination(pagination));
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
