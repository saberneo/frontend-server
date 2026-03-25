import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tenants')
export class Tenant {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ default: 'sandbox' })
  plan: string; // 'sandbox' | 'professional' | 'enterprise'

  @Column({ default: 'active' })
  status: string; // 'active' | 'suspended' | 'provisioning'

  @Column({ default: 0 })
  connectors: number;

  @Column({ default: '1.0' })
  cdmVersion: string;

  @CreateDateColumn()
  activatedAt: Date;
}
