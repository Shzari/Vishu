import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export interface PaginationInput {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export function resolvePagination(
  query?: PaginationQueryDto,
): PaginationInput | null {
  if (query?.page === undefined && query?.pageSize === undefined) {
    return null;
  }

  const rawPage = Number(query?.page ?? 1);
  const rawPageSize = Number(query?.pageSize ?? 24);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, 100)
      : 24;

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function toPaginatedResponse<T>(
  items: T[],
  total: number,
  pagination: PaginationInput,
): PaginatedResponse<T> {
  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
