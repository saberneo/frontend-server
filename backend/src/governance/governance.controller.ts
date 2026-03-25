import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('governance')
export class GovernanceController {
  constructor(private readonly service: GovernanceService) {}

  // ── Proposals ──────────────────────────────────────────────────────────────

  @Get('proposals')
  @ApiOperation({ summary: 'List CDM governance proposals (default: pending)' })
  findProposals(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findProposals(tenantId, status);
  }

  @Post('proposals/:id/approve')
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Approve a CDM proposal → publishes nexus.cdm.version_published' })
  approveProposal(
    @Param('id') id: string,
    @Body() body: { reviewedBy?: string },
  ) {
    return this.service.approveProposal(id, body?.reviewedBy);
  }

  @Post('proposals/:id/reject')
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Reject a CDM proposal with reason' })
  rejectProposal(
    @Param('id') id: string,
    @Body() body: { reason?: string; reviewedBy?: string },
  ) {
    return this.service.rejectProposal(id, body?.reason ?? '', body?.reviewedBy);
  }

  // ── Mapping Reviews ────────────────────────────────────────────────────────

  @Get('mapping-reviews')
  @ApiOperation({ summary: 'List Tier-2/3 mapping review queue (default: pending)' })
  findMappingReviews(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findMappingReviews(tenantId, status);
  }

  @Post('mapping-reviews/:id/approve')
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Approve mapping → promotes to Tier 1 (silent auto-apply)' })
  approveMappingReview(
    @Param('id') id: string,
    @Body() body: { reviewedBy?: string },
  ) {
    return this.service.approveMappingReview(id, body?.reviewedBy);
  }

  @Post('mapping-reviews/:id/reject')
  @Roles('platform-admin', 'data-steward')
  @ApiOperation({ summary: 'Reject mapping → demotes to Tier 3 (source_extras)' })
  rejectMappingReview(
    @Param('id') id: string,
    @Body() body: { reviewedBy?: string },
  ) {
    return this.service.rejectMappingReview(id, body?.reviewedBy);
  }

  // ── Sync Jobs ──────────────────────────────────────────────────────────────

  @Get('sync-jobs')
  @ApiOperation({ summary: 'List connector sync job history' })
  findSyncJobs(
    @Query('connectorId') connectorId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.service.findSyncJobs(connectorId, limit);
  }
}
