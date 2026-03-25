import { IsIn, IsOptional, IsString, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConnectorDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ['PostgreSQL', 'MySQL', 'SQL Server', 'Salesforce', 'ServiceNow'] })
  @IsIn(['PostgreSQL', 'MySQL', 'SQL Server', 'Salesforce', 'ServiceNow'])
  type: string;

  @ApiProperty()
  @IsString()
  host: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  port?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dbName?: string;

  @ApiProperty()
  @IsString()
  secretPath: string;
}

export class UpdateConnectorDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  host?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  port?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dbName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  secretPath?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}
