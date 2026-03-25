import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('products')
@Index(['category'])
@Index(['status'])
@Index(['sku'], { unique: true })
export class Product {
  @PrimaryColumn()
  id: string; // PROD-001

  @Column()
  name: string;

  @Column()
  category: string; // Electronics | Software | Hardware | Services | Consumables

  @Column({ unique: true })
  sku: string;

  @Column('decimal', { precision: 12, scale: 2 })
  price: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 'active' })
  status: string; // active | discontinued | out_of_stock

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  supplier: string;

  @Column({ default: 'pcs' })
  unit: string; // pcs | kg | box | license | hour

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  marginPercent: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
