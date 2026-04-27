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
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Public } from '../common/decorators/public.decorator';
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
import {
  ProductBulkStockDto,
  ProductListingDto,
  ProductMutationDto,
  ReviewSubmissionDto,
  ProductUpdateDto,
  VendorCatalogRequestDto,
} from './dto';
import { ProductsService } from './products.service';

function productUploadInterceptor() {
  return FilesInterceptor('images', 6, {
    storage: diskStorage({
      destination: (_req, _file, callback) => {
        callback(null, ensureTemporaryUploadDir());
      },
      filename: (_req, file, callback) => {
        callback(
          null,
          buildSafeUploadedImageName('product-image', file.mimetype),
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
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  getProducts(@Query() pagination: PaginationQueryDto) {
    return this.productsService.listPublicProducts(resolvePagination(pagination));
  }

  @Public()
  @Get('vendors')
  getPublicVendors(@Query() pagination: PaginationQueryDto) {
    return this.productsService.listPublicVendors(resolvePagination(pagination));
  }

  @Public()
  @Get('vendors/:id')
  getPublicVendor(@Param('id') id: string) {
    return this.productsService.getPublicVendorById(id);
  }

  @Roles('customer')
  @Get('vendors/:id/review-status')
  getCustomerVendorReviewStatus(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.productsService.getCustomerVendorReviewStatus(req.user.sub, id);
  }

  @Roles('customer')
  @Post('vendors/:id/reviews')
  submitVendorReview(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.productsService.upsertVendorReview(req.user.sub, id, dto);
  }

  @Public()
  @Get('search')
  searchProducts(
    @Query('query') query?: string,
    @Query('category') category?: string,
    @Query('department') department?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    return this.productsService.searchPublicProducts({
      query: query ?? '',
      category,
      department,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Roles('vendor')
  @Get('vendor/me')
  getVendorProducts(@Req() req: { user: AuthenticatedUser }) {
    return this.productsService.getVendorProducts(req.user);
  }

  @Roles('vendor')
  @Get('vendor/catalog-options')
  getVendorCatalogOptions(@Req() req: { user: AuthenticatedUser }) {
    return this.productsService.getVendorCatalogOptions(req.user);
  }

  @Roles('vendor')
  @Get('vendor/catalog-requests')
  getVendorCatalogRequests(@Req() req: { user: AuthenticatedUser }) {
    return this.productsService.getVendorCatalogRequests(req.user);
  }

  @Roles('vendor')
  @Post('vendor/catalog-requests')
  createVendorCatalogRequest(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: VendorCatalogRequestDto,
  ) {
    return this.productsService.createVendorCatalogRequest(req.user, dto);
  }

  @Public()
  @Get(':id')
  getProduct(@Param('id') id: string) {
    return this.productsService.getPublicProductById(id);
  }

  @Roles('customer')
  @Get(':id/review-status')
  getCustomerProductReviewStatus(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.productsService.getCustomerProductReviewStatus(
      req.user.sub,
      id,
    );
  }

  @Roles('customer')
  @Post(':id/reviews')
  submitProductReview(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.productsService.upsertProductReview(req.user.sub, id, dto);
  }

  @Roles('vendor')
  @Post()
  @UseInterceptors(productUploadInterceptor())
  createProduct(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: ProductMutationDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.createProduct(req.user, dto, files ?? []);
  }

  @Roles('vendor')
  @Patch('bulk-stock')
  bulkUpdateStock(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: ProductBulkStockDto,
  ) {
    return this.productsService.bulkUpdateStock(req.user, dto);
  }

  @Roles('vendor')
  @Patch(':id')
  @UseInterceptors(productUploadInterceptor())
  updateProduct(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ProductUpdateDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.updateProduct(req.user, id, dto, files ?? []);
  }

  @Roles('vendor')
  @Post(':id/duplicate')
  duplicateProduct(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.productsService.duplicateProduct(req.user, id);
  }

  @Roles('vendor')
  @Patch(':id/listing')
  setProductListing(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ProductListingDto,
  ) {
    return this.productsService.setProductListing(req.user, id, dto.isListed);
  }

  @Roles('vendor')
  @Delete(':id')
  deleteProduct(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.productsService.deleteProduct(req.user, id);
  }
}
