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

const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?!.*(?:123|[Aa][Bb][Cc]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd])).{6,}$/;
const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 6 characters and include uppercase, lowercase, and a number. Avoid simple sequences like 123 or abc.';

export class UpdateAccountProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class VerifyPendingEmailChangeDto {
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}

export class UpdateEmailPreferencesDto {
  @IsOptional()
  @IsBoolean()
  orderUpdatesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmailsEnabled?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
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

export class CreateVendorTeamInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['shop_holder', 'manager', 'employee'])
  role!: 'shop_holder' | 'manager' | 'employee';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateVendorTeamMemberRoleDto {
  @IsString()
  @IsIn(['shop_holder', 'manager', 'employee'])
  role!: 'shop_holder' | 'manager' | 'employee';
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

export class CreateReturnRequestDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderItemId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateSupportTicketDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  message!: string;
}
