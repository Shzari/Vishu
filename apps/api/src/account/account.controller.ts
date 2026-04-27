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
import { AccountService } from './account.service';
import {
  ChangePasswordDto,
  CreateVendorTeamInviteDto,
  CreatePaymentMethodDto,
  RequestGuestOrderClaimDto,
  UpdateAccountProfileDto,
  UpdateEmailPreferencesDto,
  UpdatePaymentMethodDto,
  VerifyPendingEmailChangeDto,
  UpdateVendorTeamMemberRoleDto,
  UpdateVendorBankDetailsDto,
  UpdateVendorProfileDto,
  UpsertAddressDto,
  VerifyGuestOrderClaimDto,
} from './dto';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

function vendorLogoUploadInterceptor() {
  return FileInterceptor('logoImage', {
    storage: diskStorage({
      destination: (_req, _file, callback) => {
        callback(null, ensureTemporaryUploadDir());
      },
      filename: (_req, file, callback) => {
        callback(
          null,
          buildSafeUploadedImageName('vendor-logo', file.mimetype),
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

  @Post('guest-orders/claim-request')
  @Roles('customer')
  requestGuestOrderClaim(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: RequestGuestOrderClaimDto,
  ) {
    return this.accountService.requestGuestOrderClaim(
      req.user.sub,
      dto.phoneNumber,
    );
  }

  @Public()
  @Post('guest-orders/claim-verify')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, windowMs: 1000 * 60 * 15 })
  verifyGuestOrderClaim(@Body() dto: VerifyGuestOrderClaimDto) {
    return this.accountService.verifyGuestOrderClaim(dto.token);
  }

  @Patch('profile')
  @Roles('admin', 'vendor', 'customer')
  updateProfile(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdateAccountProfileDto,
  ) {
    return this.accountService.updateSettingsProfile(req.user.sub, dto);
  }

  @Post('email-change/verify')
  @Roles('customer')
  verifyPendingEmailChange(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: VerifyPendingEmailChangeDto,
  ) {
    return this.accountService.verifyPendingEmailChange(req.user.sub, dto.code);
  }

  @Post('email-change/resend')
  @Roles('customer')
  resendPendingEmailChange(@Req() req: { user: AuthenticatedUser }) {
    return this.accountService.resendPendingEmailChange(req.user.sub);
  }

  @Patch('email-preferences')
  @Roles('customer')
  updateEmailPreferences(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: UpdateEmailPreferencesDto,
  ) {
    return this.accountService.updateEmailPreferences(req.user.sub, dto);
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
    return this.accountService.updateVendorProfile(
      req.user.sub,
      dto,
      logoImage,
    );
  }

  @Get('vendor-team')
  @Roles('vendor')
  getVendorTeam(@Req() req: { user: AuthenticatedUser }) {
    return this.accountService.getVendorTeamAccess(req.user.sub);
  }

  @Post('vendor-team/invitations')
  @Roles('vendor')
  createVendorTeamInvite(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateVendorTeamInviteDto,
  ) {
    return this.accountService.createVendorTeamInvite(req.user.sub, dto);
  }

  @Post('vendor-team/invitations/:id/resend')
  @Roles('vendor')
  resendVendorTeamInvite(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.accountService.resendVendorTeamInvite(req.user.sub, id);
  }

  @Patch('vendor-team/members/:id/role')
  @Roles('vendor')
  updateVendorTeamMemberRole(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpdateVendorTeamMemberRoleDto,
  ) {
    return this.accountService.updateVendorTeamMemberRole(
      req.user.sub,
      id,
      dto,
    );
  }

  @Delete('vendor-team/members/:id')
  @Roles('vendor')
  removeVendorTeamMember(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.accountService.removeVendorTeamMember(req.user.sub, id);
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
  deleteAddress(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
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

  @Post('payment-methods/setup-session')
  @Roles('customer')
  createPaymentMethodSetupSession(@Req() req: { user: AuthenticatedUser }) {
    return this.accountService.createPaymentMethodSetupSession(req.user.sub);
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
  deletePaymentMethod(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    return this.accountService.deletePaymentMethod(req.user.sub, id);
  }
}
