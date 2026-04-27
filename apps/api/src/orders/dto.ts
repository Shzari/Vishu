import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  addressId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  apartmentOrNote?: string;

  @IsOptional()
  @IsString()
  specialRequest?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cash_on_delivery', 'card'])
  paymentMethod?: 'cash_on_delivery' | 'card';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentMethodId?: string;
}

export class GuestOrderClaimRequestDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{6,40}$/)
  phoneNumber?: string;
}

export class GuestOrderClaimVerifyDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class VendorOrderStatusDto {
  @IsString()
  @IsIn(['pending', 'confirmed', 'shipped', 'delivered'])
  status!: 'pending' | 'confirmed' | 'shipped' | 'delivered';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  shippingCarrier?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_/ ]{4,120}$/)
  trackingNumber?: string;
}

export class CartItemSyncDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class SyncCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemSyncDto)
  items!: CartItemSyncDto[];
}

export class AdminCodStatusDto {
  @IsString()
  @IsIn(['cod_pending', 'cod_collected', 'cod_refused'])
  paymentStatus!: 'cod_pending' | 'cod_collected' | 'cod_refused';

  @IsOptional()
  @IsString()
  note?: string;
}

export class CustomerCancelRequestDto {
  @IsOptional()
  @IsString()
  @Matches(/^.{0,500}$/)
  note?: string;
}
