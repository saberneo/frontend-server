import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(@InjectRepository(Tenant) private repo: Repository<Tenant>) {}

  findAll(): Promise<Tenant[]> {
    return this.repo.find({ order: { activatedAt: 'ASC' } });
  }

  findOne(id: string): Promise<Tenant | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<Tenant>): Promise<Tenant> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    Object.assign(tenant, data);
    return this.repo.save(tenant);
  }
}
