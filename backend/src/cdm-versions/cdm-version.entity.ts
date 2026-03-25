import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('cdm_versions')
export class CdmVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  version: string;

  @Column({ default: 'retired' })
  status: string; // 'active' | 'deprecated' | 'retired'

  @Column({ type: 'text', nullable: true })
  changes: string;

  @Column({ nullable: true })
  publishedBy: string;

  @CreateDateColumn()
  publishedAt: Date;
}
