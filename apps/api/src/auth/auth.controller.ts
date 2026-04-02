import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  clearAuthCookie,
  setAuthCookie,
} from '../common/security/security.utils';
import { AuthenticatedUser } from '../common/types';
import {
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  ResendVerificationDto,
  RegisterCustomerDto,
  RegisterVendorDto,
  VerifyEmailDto,
} from './dto';
import { AuthService } from './auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 5, windowMs: 1000 * 60 * 15 })
  register(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Post('vendor/register')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 3, windowMs: 1000 * 60 * 15 })
  registerVendor(@Body() dto: RegisterVendorDto) {
    return this.authService.registerVendor(dto);
  }

  @Public()
  @Post('vendor/verify')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, windowMs: 1000 * 60 * 15 })
  verifyVendor(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyVendorEmail(dto);
  }

  @Public()
  @Post('verify')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, windowMs: 1000 * 60 * 15 })
  verify(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('verification/resend')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 5, windowMs: 1000 * 60 * 15 })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @Public()
  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    max: 10,
    windowMs: 1000 * 60 * 15,
    blockDurationMs: 1000 * 60 * 30,
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    setAuthCookie(response, result.accessToken, this.configService);
    return result;
  }

  @Public()
  @Post('password-reset/request')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 5, windowMs: 1000 * 60 * 15 })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password-reset/confirm')
  @UseGuards(RateLimitGuard)
  @RateLimit({ max: 10, windowMs: 1000 * 60 * 15 })
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Clear-Site-Data', '"storage"');
    clearAuthCookie(response, this.configService);
    return { message: 'Logged out.' };
  }

  @Get('me')
  getMe(@Req() req: { user: AuthenticatedUser }) {
    return this.authService.getProfile(req.user);
  }

  @Roles('admin')
  @Post('users/:id/password-reset')
  triggerUserReset(@Param('id') id: string) {
    return this.authService.issueAdminPasswordReset(id);
  }
}
