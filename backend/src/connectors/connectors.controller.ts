import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConnectorsService } from './connectors.service';
import { CreateConnectorDto, UpdateConnectorDto } from './connector.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('connectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly service: ConnectorsService) {}

  @Get()
  @ApiOperation({ summary: 'List all connectors' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get connector detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Register a new connector' })
  create(@Body() dto: CreateConnectorDto) {
    return this.service.create(dto);
  }

  @Post(':id/sync')
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Trigger a sync for the connector' })
  sync(@Param('id') id: string) {
    return this.service.triggerSync(id);
  }

  @Patch(':id')
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Update a connector' })
  update(@Param('id') id: string, @Body() dto: UpdateConnectorDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('platform-admin')
  @ApiOperation({ summary: 'Remove a connector' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/sync-jobs')
  @ApiOperation({ summary: 'Get sync job history for a connector (last 50)' })
  syncJobs(@Param('id') id: string) {
    return this.service.findSyncJobs(id);
  }
}
