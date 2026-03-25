import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: string; // leave | expense | return

  @Column()
  icon: string;

  @Column()
  title: string;

  @Column()
  category: string; // HR | Finance | Sales

  @Column()
  details: string;

  @Column('text')
  description: string;

  @Column({ default: false })
  isHighPriority: boolean;

  @Column({ default: true })
  canReject: boolean;

  @Column({ default: 'pending' })
  status: string; // pending | approved | rejected

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ nullable: true })
  resolvedAt: string;

  @CreateDateColumn()
  submittedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
