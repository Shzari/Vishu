import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAccountProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^.{6,}$/)
  newPassword!: string;
}

export class UpdateVendorBankDetailsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bankName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9 ]{10,40}$/)
  bankIban?: string;
}

export class UpdateVendorProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  shopName?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  shopDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shippingNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  lowStockThreshold?: number;
}

export class ActivateVendorSubscriptionDto {
  @IsString()
  @IsIn(['monthly', 'yearly'])
  planType!: 'monthly' | 'yearly';
}

export class CreateVendorTeamInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['shop_holder', 'employee'])
  role!: 'shop_holder' | 'employee';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateVendorTeamMemberRoleDto {
  @IsString()
  @IsIn(['shop_holder', 'employee'])
  role!: 'shop_holder' | 'employee';
}

export class UpsertAddressDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;

  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsOptional()
  @IsString()
  stateRegion?: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreatePaymentMethodDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsString()
  @IsNotEmpty()
  cardholderName!: string;

  @IsString()
  @Matches(/^[0-9]{12,19}$/)
  cardNumber!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  expMonth!: number;

  @IsInt()
  @Min(new Date().getFullYear())
  @Max(new Date().getFullYear() + 25)
  expYear!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cardholderName?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class RequestGuestOrderClaimDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;
}

export class VerifyGuestOrderClaimDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
