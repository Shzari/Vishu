import {
  ArrayNotEmpty,
  ArrayMinSize,
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

  @IsString()
  @IsNotEmpty()
  brandId!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  subcategoryId!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  genderGroupId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  sizeTypeId?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  colorIds!: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  sizeVariants?: Array<{ sizeId: string; stock: number }>;

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
  @IsString()
  @IsNotEmpty()
  brandId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  subcategoryId?: string;

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
  genderGroupId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  @IsNotEmpty()
  sizeTypeId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  colorIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  sizeVariants?: Array<{ sizeId: string; stock: number }>;

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

export class VendorCatalogRequestDto {
  @IsString()
  @IsNotEmpty()
  requestType!: string;

  @IsString()
  @IsNotEmpty()
  requestedValue!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  sizeTypeId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  )
  @IsString()
  note?: string;
}
