import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('connectors')
export class Connector {
  @PrimaryColumn()
  id: string; // connector-001

  @Column()
  name: string;

  @Column()
  type: string; // PostgreSQL | Salesforce | ServiceNow

  @Column()
  host: string;

  @Column({ nullable: true })
  port: number;

  @Column({ nullable: true })
  dbName: string;

  @Column()
  secretPath: string;

  @Column({ default: 'active' })
  status: string; // active | syncing | error | disabled

  @Column({ nullable: true })
  lastSync: string;

  @Column({ nullable: true })
  records: string;

  @Column({ nullable: true })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
