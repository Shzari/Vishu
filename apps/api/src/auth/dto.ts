import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

const PASSWORD_POLICY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?!.*(?:123|[Aa][Bb][Cc]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd])).{6,}$/;
const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 6 characters and include uppercase, lowercase, and a number. Avoid simple sequences like 123 or abc.';

export class RegisterCustomerDto {
  @IsEmail()
  email!: string;

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

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;
}

export class RegisterVendorDto {
  @IsEmail()
  email!: string;

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

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @Equals(true, {
    message:
      'Vendors must accept Vishu terms, marketplace policy, and refund policy.',
  })
  acceptedTerms!: boolean;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class VerifyCustomerRegistrationCodeDto {
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : value,
  )
  @Matches(/^[0-9]{6}$/)
  code!: string;
}

export class VerifyVendorLoginOtpDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}

export class ResendVendorLoginOtpDto {
  @IsUUID()
  challengeId!: string;
}

export class PasswordResetRequestDto {
  @IsEmail()
  email!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}
