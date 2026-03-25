import { IsIn, IsOptional, IsString, IsNumberString, IsNotEmpty, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FilterOrdersDto {
  @ApiPropertyOptional({ enum: ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] })
  @IsIn(['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customer?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsNumberString()
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsNumberString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Scope results to a specific tenant' })
  @IsString()
  @IsOptional()
  tenantId?: string;
}

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({ enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'] })
  @IsIn(['Processing', 'Shipped', 'Delivered', 'Cancelled'])
  status: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  trackingNumber?: string;
}

export class OrderItemDto {
  @ApiProperty({ example: 'NX-CDM-PRO' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ example: 'CDM Pro License' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  qty: number;

  @ApiProperty({ example: 800 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 1600 })
  @IsNumber()
  total: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  customer: string;

  @ApiProperty({ example: 12400.00 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: '123 Main St, New York NY 10001, US' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Net 30' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'Rush processing requested.' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsOptional()
  items?: OrderItemDto[];
}

