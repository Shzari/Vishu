import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
  @IsIn(['test', 'live'])
  paymentMode?: 'test' | 'live';

  @IsOptional()
  @IsBoolean()
  cashOnDeliveryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  cardPaymentsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  guestCheckoutEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripeTestPublishableKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  stripeLivePublishableKey?: string;
}

export class SendPlatformTestEmailDto {
  @IsEmail()
  email!: string;
}

export class UpdatePromotionSettingsDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  autoRotate?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(30)
  intervalSeconds?: number;
}

export class PromotionMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  internalName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  customUrl!: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  displayOrder!: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsDateString()
  endDate?: string;
}

export class PromotionUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  internalName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  customUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  displayOrder?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  clearMobileImage?: boolean;
}

export class ReviewCatalogRequestDto {
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class CategoryMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class SubcategoryMutationDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class BrandMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class ColorMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class SizeTypeMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class SizeMutationDto {
  @IsString()
  @IsNotEmpty()
  sizeTypeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class GenderGroupMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class CatalogMasterDataMutationDto {
  @IsIn(['category', 'subcategory', 'brand', 'size', 'color'])
  optionType!:
    | 'category'
    | 'subcategory'
    | 'brand'
    | 'size'
    | 'color';

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @MaxLength(80)
  department?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @MaxLength(120)
  parentValue?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  value!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}
