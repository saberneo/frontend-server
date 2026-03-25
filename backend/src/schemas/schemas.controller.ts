import { Controller, Get, Post, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { SchemasService } from './schemas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('schemas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schemas')
export class SchemasController {
  constructor(private readonly service: SchemasService) {}

  @Get()
  @ApiOperation({ summary: 'List all schema snapshots' })
  findAll() {
    return this.service.findAll();
  }

  // ── CDM Knowledge Graph ──────────────────────────────────────────────────────
  // These routes MUST be declared before :id routes to avoid conflict

  @Get('cdm/domains')
  @ApiOperation({ summary: 'List CDM domains (logical groupings of CDM schemas)' })
  getCdmDomains() {
    return this.service.getCdmDomains();
  }

  @Get('cdm/schemas')
  @ApiOperation({ summary: 'List all CDM schemas (canonical entity definitions)' })
  getCdmSchemas() {
    return this.service.getCdmSchemas();
  }

  @Get('cdm/schemas/:id/fields')
  @ApiOperation({ summary: 'Get the field definitions for a given CDM schema' })
  getCdmSchemaFields(@Param('id') id: string) {
    return this.service.getCdmSchemaFields(id);
  }

  @Get('cdm/mappings')
  @ApiOperation({ summary: 'List pending CDM mapping reviews' })
  getCdmMappings() {
    return this.service.getCdmMappings();
  }

  @Get('cdm/graph-stats')
  @ApiOperation({ summary: 'Aggregate statistics for the CDM knowledge graph' })
  getCdmGraphStats() {
    return this.service.getCdmGraphStats();
  }

  // ── Source schema snapshots ──────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get schema detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/tables')
  @ApiOperation({ summary: 'Get table/column breakdown for schema viewer' })
  getDetail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Patch(':id/reprofile')
  @ApiOperation({ summary: 'Re-profile schema (resolve drift)' })
  reprofile(@Param('id') id: string) {
    return this.service.reprofile(id);
  }

  @Post('snapshot-all')
  @ApiOperation({ summary: 'Snapshot all schemas at once' })
  snapshotAll() {
    return this.service.snapshotAll();
  }
}
