import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ default: 'business-user' })
  role: string;

  @Column({ default: 'active' })
  status: string;

  /** 'okta' = provisioned via Okta SSO login; 'local' = seed/manual/legacy */
  @Column({ default: 'local' })
  source: string;

  @Column({ nullable: true })
  tenantId: string;

  @Column({ nullable: true })
  lastLogin: string;

  // ── 2FA / TOTP ──────────────────────────────────────────────────────────────
  @Column({ nullable: true, select: false })
  totpSecret: string;

  @Column({ default: false })
  totpEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
