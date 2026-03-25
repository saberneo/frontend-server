import { Controller, Get, Patch, Post, Param, Body, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { ResolveApprovalDto } from './approval.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending approvals' })
  pending() {
    return this.service.findPending();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Approval stats (pending, approved today, high priority)' })
  stats() {
    return this.service.getStats();
  }

  @Get()
  @ApiOperation({ summary: 'Get all approvals (history)' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single approval detail' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Approve or reject an item' })
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveApprovalDto,
    @Request() req: any,
  ) {
    return this.service.resolve(id, dto, req.user.email);
  }

  @Post('resolve-all')
  @ApiOperation({ summary: 'Approve all pending items at once' })
  resolveAll(@Request() req: any) {
    return this.service.resolveAll('approved', req.user.email);
  }
}
