import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class GovernanceActionDto {
  @ApiProperty({ enum: ['approve_mapping', 'reject_mapping', 'approve_proposal', 'reject_proposal'] })
  @IsIn(['approve_mapping', 'reject_mapping', 'approve_proposal', 'reject_proposal'])
  action: string;

  @ApiProperty()
  @IsString()
  sourceField: string;

  @ApiProperty()
  @IsString()
  cdmField: string;
}

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(@Query('limit') limit?: string, @Query('page') page?: string) {
    return this.auditService.findPaginated(limit ? +limit : 50, page ? +page : 1);
  }

  @Get('entity')
  @ApiQuery({ name: 'entity', required: true })
  @ApiQuery({ name: 'entityId', required: false })
  findByEntity(@Query('entity') entity: string, @Query('entityId') entityId?: string) {
    return this.auditService.findByEntity(entity, entityId);
  }

  @Post('governance-action')
  @ApiOperation({ summary: 'Log a field mapping or proposal governance action' })
  logGovernanceAction(@Body() dto: GovernanceActionDto) {
    return this.auditService.log({
      actor: 'platform-admin',
      action: dto.action,
      entity: `mapping:${dto.sourceField}`,
      entityId: dto.cdmField,
      detail: `${dto.action.replace('_', ' ')}: ${dto.sourceField} → ${dto.cdmField}`,
    });
  }
}
