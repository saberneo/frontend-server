import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  log(data: Partial<AuditLog>): Promise<AuditLog> {
    const entry = this.repo.create(data);
    return this.repo.save(entry);
  }

  async findPaginated(limit = 50, page = 1): Promise<{ data: AuditLog[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.repo.findAndCount({
      order: { timestamp: 'DESC' },
      take: limit,
      skip,
    });
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  findByEntity(entity: string, entityId?: string): Promise<AuditLog[]> {
    const where: any = { entity };
    if (entityId) where.entityId = entityId;
    return this.repo.find({ where, order: { timestamp: 'DESC' } });
  }
}
