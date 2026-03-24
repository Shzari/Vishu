import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types';
import { AccountService } from './account.service';
import {
  ActivateVendorSubscriptionDto,
  ChangePasswordDto,
  CreatePaymentMethodDto,
  UpdateAccountProfileDto,
  UpdatePaymentMethodDto,
  UpdateVendorBankDetailsDto,
  UpdateVendorProfileDto,
  UpsertAddressDto,
} from './dto';

function vendorLogoUploadInterceptor() {
  return FileInterceptor('logoImage', {
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
          `vendor-logo-${Date.now()}-${Math.round(Math.random() * 1_000_000)}${extension}`,
        );
      },
    }),
    fileFilter: (_req, file, callback) => {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('settings')
  @Roles('admin', 'vendor', 'customer')
  getSettings(@Req() req: { user: AuthenticatedUser }) {
    return this.accountService.getSettings(req.user.sub);
  }

  @Get('me')
  @Roles('customer')
  getAccount(@Req() req: { user: AuthenticatedUser }) {
    return this.accountService.getAccount(req.user.sub);
  }

  @Patch('profile')
  @Roles('admin', 'vendor', 'customer')
  updateProfile(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdateAccountProfileDto,
  ) {
    return this.accountService.updateSettingsProfile(req.user.sub, dto);
  }

  @Patch('password')
  @Roles('admin', 'vendor', 'customer')
  changePassword(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.accountService.changePassword(req.user.sub, dto);
  }

  @Patch('vendor-bank')
  @Roles('vendor')
  updateVendorBank(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdateVendorBankDetailsDto,
  ) {
    return this.accountService.updateVendorBankDetails(req.user.sub, dto);
  }

  @Patch('vendor-profile')
  @Roles('vendor')
  @UseInterceptors(vendorLogoUploadInterceptor())
  updateVendorProfile(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdateVendorProfileDto,
    @UploadedFile() logoImage?: Express.Multer.File,
  ) {
    return this.accountService.updateVendorProfile(req.user.sub, dto, logoImage);
  }

  @Post('vendor-subscription')
  @Roles('vendor')
  activateVendorSubscription(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: ActivateVendorSubscriptionDto,
  ) {
    return this.accountService.activateVendorSubscription(req.user.sub, dto);
  }

  @Post('addresses')
  @Roles('customer')
  createAddress(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpsertAddressDto,
  ) {
    return this.accountService.createAddress(req.user.sub, dto);
  }

  @Patch('addresses/:id')
  @Roles('customer')
  updateAddress(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpsertAddressDto,
  ) {
    return this.accountService.updateAddress(req.user.sub, id, dto);
  }

  @Delete('addresses/:id')
  @Roles('customer')
  deleteAddress(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.accountService.deleteAddress(req.user.sub, id);
  }

  @Post('payment-methods')
  @Roles('customer')
  createPaymentMethod(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.accountService.createPaymentMethod(req.user.sub, dto);
  }

  @Patch('payment-methods/:id')
  @Roles('customer')
  updatePaymentMethod(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.accountService.updatePaymentMethod(req.user.sub, id, dto);
  }

  @Delete('payment-methods/:id')
  @Roles('customer')
  deletePaymentMethod(@Req() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.accountService.deletePaymentMethod(req.user.sub, id);
  }
}
