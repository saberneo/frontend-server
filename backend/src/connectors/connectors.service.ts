import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connector } from './connector.entity';
import { SyncJob } from './sync-job.entity';
import { CreateConnectorDto, UpdateConnectorDto } from './connector.dto';
import { NexusGateway } from '../events/nexus.gateway';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);

  constructor(
    @InjectRepository(Connector) private repo: Repository<Connector>,
    @InjectRepository(SyncJob) private syncJobRepo: Repository<SyncJob>,
    private readonly gateway: NexusGateway,
  ) {}

  findAll(): Promise<Connector[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Connector> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Connector ${id} not found`);
    return c;
  }

  async create(dto: CreateConnectorDto): Promise<Connector> {
    const connector = await this.repo.save(this.repo.create(dto));
    // La integración con M1 la gestiona el frontend a través del m1-proxy controller.
    // No hacemos la llamada doble aquí para evitar fallos sin Bearer token.
    return connector;
  }

  async triggerSync(id: string): Promise<Connector> {
    const c = await this.findOne(id);
    c.status = 'syncing';
    await this.repo.save(c);

    // Notify connected clients that sync has started
    this.gateway.syncStarted(c.name);

    // Register sync job in the pipeline history (nexus_system.sync_jobs)
    const job = this.syncJobRepo.create({
      connectorId: c.id,
      connectorName: c.name,
      tenantId: c.tenantId ?? null,
      status: 'running',
      triggerType: 'manual',
    });
    await this.syncJobRepo.save(job);

    // Simulate async extraction completing after 3 seconds
    setTimeout(async () => {
      const recordsDelta = Math.floor(Math.random() * 5000) + 500;
      const currentRecords = parseInt(String(c.records ?? '0'), 10) || 0;
      c.status = 'active';
      c.lastSync = new Date().toISOString();
      c.records = String(currentRecords + recordsDelta);
      await this.repo.save(c);

      job.status = 'completed';
      job.recordsExtracted = recordsDelta;
      job.completedAt = new Date();
      await this.syncJobRepo.save(job);

      // Notify connected clients that sync completed
      this.gateway.syncCompleted(c.name, recordsDelta);
    }, 3000);

    return c;
  }

  async update(id: string, dto: UpdateConnectorDto): Promise<Connector> {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string): Promise<void> {
    const c = await this.findOne(id);
    await this.repo.remove(c);
  }

  findSyncJobs(connectorId: string): Promise<SyncJob[]> {
    return this.syncJobRepo.find({ where: { connectorId }, order: { startedAt: 'DESC' } });
  }
}
