import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Sophie Lambert' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'sophie@nexus.io' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'business-user' })
  @IsIn(['platform-admin', 'data-steward', 'business-user', 'read-only'])
  role: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsIn(['platform-admin', 'data-steward', 'business-user', 'read-only'])
  @IsOptional()
  role?: string;

  @ApiPropertyOptional()
  @IsIn(['active', 'inactive', 'invited'])
  @IsOptional()
  status?: string;
}
