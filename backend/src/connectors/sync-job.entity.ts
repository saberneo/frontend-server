import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * History of connector sync executions.
 * Created by ConnectorsService.triggerSync(); updated on completion/failure.
 *
 * Maps to build-plan table: nexus_system.sync_jobs
 */
@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  connectorId: string;

  @Column()
  connectorName: string;

  @Column({ nullable: true })
  tenantId: string;

  /** 'running' | 'completed' | 'failed' */
  @Column({ default: 'running' })
  status: string;

  /** Number of records extracted in this run */
  @Column({ default: 0 })
  recordsExtracted: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  /** 'manual' | 'scheduled' */
  @Column({ default: 'manual' })
  triggerType: string;
}
