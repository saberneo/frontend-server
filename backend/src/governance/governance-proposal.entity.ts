import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Governance proposal — created by M2 Structural Agent when CDM mapping changes are needed.
 * Humans approve or reject via the UI; approval publishes nexus.cdm.version_published.
 *
 * Maps to the build-plan table: nexus_system.governance_queue
 */
@Entity('governance_proposals')
export class GovernanceProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'acme-corp' })
  tenantId: string;

  /** 'mapping_confidence_review' | 'cdm_interpretation' */
  @Column({ default: 'mapping_confidence_review' })
  proposalType: string;

  /** Source system name, e.g. 'postgresql', 'salesforce', 'servicenow' */
  @Column()
  sourceSystem: string;

  @Column()
  sourceTable: string;

  @Column()
  sourceField: string;

  /** CDM entity type: 'party' | 'transaction' | 'product' | 'employee' | 'incident' */
  @Column()
  cdmEntity: string;

  /** CDM field name, e.g. 'party_id', 'transaction_amount' */
  @Column()
  cdmField: string;

  /** Confidence score from 0.0 to 1.0 */
  @Column({ type: 'float', default: 0.8 })
  confidence: number;

  /** 'pending' | 'approved' | 'rejected' */
  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  /** LLM-generated justification for the proposed mapping */
  @Column({ type: 'text', nullable: true })
  justification: string;

  @CreateDateColumn()
  submittedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;
}
