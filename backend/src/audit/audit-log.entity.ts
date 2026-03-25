import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
@Index(['actor'])
@Index(['action'])
@Index(['timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  actor: string;

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ nullable: true })
  detail: string;

  @Column({ nullable: true })
  result: string;

  @Column({ default: 'info' })
  severity: string; // info | warning | critical

  @Column({ nullable: true, type: 'varchar' })
  ipAddress: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
