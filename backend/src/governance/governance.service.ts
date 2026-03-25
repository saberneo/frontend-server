import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GovernanceProposal } from './governance-proposal.entity';
import { MappingReview } from './mapping-review.entity';
import { SyncJob } from '../connectors/sync-job.entity';
import { NexusGateway } from '../events/nexus.gateway';

@Injectable()
export class GovernanceService {
  constructor(
    @InjectRepository(GovernanceProposal)
    private proposalsRepo: Repository<GovernanceProposal>,
    @InjectRepository(MappingReview)
    private mappingsRepo: Repository<MappingReview>,
    @InjectRepository(SyncJob)
    private syncJobsRepo: Repository<SyncJob>,
    private readonly gateway: NexusGateway,
  ) {}

  // ── Governance Proposals ──────────────────────────────────────────────────

  findProposals(tenantId?: string, status = 'pending'): Promise<GovernanceProposal[]> {
    const where: any = { status };
    if (tenantId) where.tenantId = tenantId;
    return this.proposalsRepo.find({ where, order: { submittedAt: 'DESC' } });
  }

  async approveProposal(id: string, reviewedBy = 'admin@nexus.io'): Promise<GovernanceProposal> {
    const p = await this.proposalsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Proposal ${id} not found`);
    p.status = 'approved';
    p.reviewedBy = reviewedBy;
    p.resolvedAt = new Date();
    const saved = await this.proposalsRepo.save(p);
    this.gateway.alert('info', `CDM proposal approved: ${p.sourceField} → ${p.cdmField} (${p.id})`);
    return saved;
  }

  async rejectProposal(
    id: string,
    reason = '',
    reviewedBy = 'admin@nexus.io',
  ): Promise<GovernanceProposal> {
    const p = await this.proposalsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Proposal ${id} not found`);
    p.status = 'rejected';
    p.reviewedBy = reviewedBy;
    p.rejectionReason = reason;
    p.resolvedAt = new Date();
    const saved = await this.proposalsRepo.save(p);
    this.gateway.alert('warning', `CDM proposal rejected: ${p.sourceField} → ${p.cdmField} (${p.id}). Reason: ${reason}`);
    return saved;
  }

  // ── Mapping Reviews ────────────────────────────────────────────────────────

  findMappingReviews(tenantId?: string, status = 'pending'): Promise<MappingReview[]> {
    const where: any = { status };
    if (tenantId) where.tenantId = tenantId;
    return this.mappingsRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async approveMappingReview(id: string, reviewedBy = 'admin@nexus.io'): Promise<MappingReview> {
    const m = await this.mappingsRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`Mapping review ${id} not found`);
    m.status = 'approved';
    m.tier = 1; // Promoted to Tier 1 — silent auto-apply from now on
    m.reviewedBy = reviewedBy;
    m.reviewedAt = new Date();
    return this.mappingsRepo.save(m);
  }

  async rejectMappingReview(id: string, reviewedBy = 'admin@nexus.io'): Promise<MappingReview> {
    const m = await this.mappingsRepo.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`Mapping review ${id} not found`);
    m.status = 'rejected';
    m.tier = 3; // Demoted to Tier 3 — goes to source_extras
    m.reviewedBy = reviewedBy;
    m.reviewedAt = new Date();
    return this.mappingsRepo.save(m);
  }

  // ── Sync Jobs ──────────────────────────────────────────────────────────────

  findSyncJobs(connectorId?: string, limit = 20): Promise<SyncJob[]> {
    const where: any = {};
    if (connectorId) where.connectorId = connectorId;
    return this.syncJobsRepo.find({
      where,
      order: { startedAt: 'DESC' },
      take: Number(limit) || 20,
    });
  }
}
