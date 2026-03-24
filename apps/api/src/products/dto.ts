import {
  ArrayNotEmpty,
  IsBoolean,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ProductMutationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  department?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  color?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  size?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  replaceImages?: boolean;
}

export class ProductUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  department?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  color?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  size?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  replaceImages?: boolean;
}

export class ProductListingDto {
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isListed!: boolean;
}

export class ProductBulkStockDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  productIds!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;
}
