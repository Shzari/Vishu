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
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types';
import {
  ProductBulkStockDto,
  ProductListingDto,
  ProductMutationDto,
  ProductUpdateDto,
  VendorCatalogRequestDto,
} from './dto';
import { ProductsService } from './products.service';

function productUploadInterceptor() {
  return FilesInterceptor('images', 6, {
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
          `${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`,
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
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  getProducts() {
    return this.productsService.listPublicProducts();
  }

  @Public()
  @Get('vendors')
  getPublicVendors() {
    return this.productsService.listPublicVendors();
  }

  @Public()
  @Get('vendors/:id')
  getPublicVendor(@Param('id') id: string) {
    return this.productsService.getPublicVendorById(id);
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
