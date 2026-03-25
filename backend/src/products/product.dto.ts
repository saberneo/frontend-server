import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FilterProductsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}

export class CreateProductDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsString() category: string;
  @IsString() sku: string;
  @IsNumber() price: number;
  @IsOptional() @IsNumber() stock?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() marginPercent?: number;
}

export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() stock?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() marginPercent?: number;
}
