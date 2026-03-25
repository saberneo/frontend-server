import { IsIn, IsOptional, IsString, IsNumberString, IsNotEmpty, IsEmail, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FilterCustomersDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['Active', 'At Risk', 'Inactive'] })
  @IsIn(['Active', 'At Risk', 'Inactive'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ enum: ['Enterprise', 'SMB', 'Mid-Market'] })
  @IsIn(['Enterprise', 'SMB', 'Mid-Market'])
  @IsOptional()
  segment?: string;

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

export class UpdateCustomerStatusDto {
  @ApiPropertyOptional({ enum: ['Active', 'At Risk', 'Inactive'] })
  @IsIn(['Active', 'At Risk', 'Inactive'])
  status: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateCustomerDto {
  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({ example: 'United States' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiPropertyOptional({ enum: ['Enterprise', 'SMB', 'Mid-Market'], default: 'SMB' })
  @IsIn(['Enterprise', 'SMB', 'Mid-Market'])
  @IsOptional()
  segment?: string;

  @ApiPropertyOptional({ example: 'alice@nexus.io' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+1 (555) 000-0000' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Alice Martin' })
  @IsString()
  @IsOptional()
  accountManager?: string;

  @ApiPropertyOptional({ example: 'New customer from LATAM expansion.' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ enum: ['Enterprise', 'SMB', 'Mid-Market'] })
  @IsIn(['Enterprise', 'SMB', 'Mid-Market'])
  @IsOptional()
  segment?: string;

  @ApiPropertyOptional({ enum: ['Active', 'At Risk', 'Inactive'] })
  @IsIn(['Active', 'At Risk', 'Inactive'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountManager?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  revenueYtd?: number;
}

