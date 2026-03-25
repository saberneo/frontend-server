import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('orders')
@Index(['status'])
@Index(['customerId'])
@Index(['date'])
export class Order {
  @PrimaryColumn()
  id: string; // SO-48291

  @Column()
  date: string;

  @Column()
  customer: string;

  @Column()
  customerId: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'Processing' })
  status: string; // Processing | Shipped | Delivered | Cancelled

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ nullable: true })
  trackingNumber: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column('jsonb', { default: [] })
  items: { name: string; qty: number; price: string }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
