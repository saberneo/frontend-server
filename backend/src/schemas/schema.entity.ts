import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('schemas')
export class Schema {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  connectorId: string;

  @Column()
  connectorName: string;

  @Column({ default: 0 })
  tables: number;

  @Column({ default: 0 })
  columns: number;

  @Column({ nullable: true })
  snapshot: string;

  @Column({ default: 'none' })
  drift: string; // none | minor | major

  @Column({ default: 'current' })
  status: string; // current | stale | needs-reprofiling

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
