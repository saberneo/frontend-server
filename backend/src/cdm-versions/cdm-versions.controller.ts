import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CdmVersionsService } from './cdm-versions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('cdm-versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cdm-versions')
export class CdmVersionsController {
  constructor(private readonly service: CdmVersionsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('active')
  findActive() {
    return this.service.findActive();
  }
}
