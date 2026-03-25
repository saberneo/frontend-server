import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('customers')
@Index(['status'])
@Index(['segment'])
export class Customer {
  @PrimaryColumn()
  id: string; // contoso-benelux

  @Column()
  name: string;

  @Column({ length: 2 })
  countryCode: string;

  @Column()
  country: string;

  @Column({ default: 'SMB' })
  segment: string; // Enterprise | SMB

  @Column({ default: 0 })
  openOrders: number;

  @Column({ default: 'Active' })
  status: string; // Active | At Risk | Inactive

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  accountManager: string;

  @Column({ nullable: true })
  memberSince: string;

  @Column({ default: 0 })
  totalOrders: number;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  revenueYtd: number;

  @Column({ nullable: true })
  lastActivity: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
