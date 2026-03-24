import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  specialRequest?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cash_on_delivery', 'card'])
  paymentMethod?: 'cash_on_delivery' | 'card';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  addressId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentMethodId?: string;
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
