import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval } from './approval.entity';
import { ResolveApprovalDto } from './approval.dto';
import { NexusGateway } from '../events/nexus.gateway';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval) private repo: Repository<Approval>,
    private readonly gateway: NexusGateway,
  ) {}

  async findPending(): Promise<Approval[]> {
    return this.repo.find({ where: { status: 'pending' }, order: { isHighPriority: 'DESC', submittedAt: 'ASC' } });
  }

  async findAll(): Promise<Approval[]> {
    return this.repo.find({ order: { submittedAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Approval> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Approval #${id} not found`);
    return item;
  }

  async resolve(id: number, dto: ResolveApprovalDto, resolverEmail: string): Promise<Approval> {
    const item = await this.findOne(id);
    item.status = dto.action === 'approved' ? 'approved' : 'rejected';
    item.resolvedBy = resolverEmail;
    item.resolvedAt = new Date().toISOString();
    const saved = await this.repo.save(item);
    const label = dto.action === 'approved' ? 'Approved' : 'Rejected';
    this.gateway.newApproval(`${label}: ${item.title}`);
    return saved;
  }

  async resolveAll(action: 'approved' | 'rejected', resolverEmail: string): Promise<{ count: number }> {
    const pending = await this.findPending();
    for (const item of pending) {
      item.status = action;
      item.resolvedBy = resolverEmail;
      item.resolvedAt = new Date().toISOString();
    }
    await this.repo.save(pending);
    return { count: pending.length };
  }

  async getStats() {
    const pending = await this.repo.count({ where: { status: 'pending' } });
    const approvedToday = await this.repo
      .createQueryBuilder('a')
      .where('a.status = :s', { s: 'approved' })
      .andWhere('DATE(a."resolvedAt") = CURRENT_DATE')
      .getCount();
    const highPriority = await this.repo.count({ where: { status: 'pending', isHighPriority: true } });
    return { pending, approvedToday, highPriority };
  }
}
