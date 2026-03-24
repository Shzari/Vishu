import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class UpdateVendorSubscriptionDto {
  @IsIn(['auto', 'active', 'expired'])
  status!: 'auto' | 'active' | 'expired';

  @ValidateIf((dto: UpdateVendorSubscriptionDto) => dto.status === 'active')
  @IsIn(['monthly', 'yearly'])
  planType?: 'monthly' | 'yearly';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpPassword?: string;

  @IsOptional()
  @IsBoolean()
  clearSmtpPassword?: boolean;

  @IsOptional()
  @IsEmail()
  mailFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appBaseUrl?: string;

  @IsOptional()
  @IsBoolean()
  vendorVerificationEmailsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  adminVendorApprovalEmailsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  passwordResetEmailsEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(30)
  homepageHeroIntervalSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HomepageHeroSlideInputDto)
  homepageHeroSlides?: HomepageHeroSlideInputDto[];
}

export class SendPlatformTestEmailDto {
  @IsEmail()
  email!: string;
}

export class HomepageHeroSlideInputDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subheading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  sortOrder!: number;
}
