import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Mapping review item — fields that the CDM Mapper Worker could not auto-resolve.
 * Tier 2 = confidence 0.7–0.9 (needs human confirmation)
 * Tier 3 = confidence < 0.7 or no mapping found (needs full human review)
 *
 * Maps to build-plan table: nexus_system.mapping_review_queue
 */
@Entity('mapping_reviews')
export class MappingReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'acme-corp' })
  tenantId: string;

  @Column()
  sourceSystem: string;

  @Column()
  sourceTable: string;

  @Column()
  sourceField: string;

  /** CDM entity type — nullable if no match was found */
  @Column({ nullable: true })
  cdmEntity: string;

  /** Suggested CDM field — nullable if no suggestion */
  @Column({ nullable: true })
  suggestedCdmField: string;

  /** Confidence from 0.0 to 1.0 */
  @Column({ type: 'float', default: 0 })
  confidence: number;

  /** 1 (approved) | 2 (tier-2 review) | 3 (tier-3 low confidence) */
  @Column({ default: 2 })
  tier: number;

  /** 'pending' | 'approved' | 'rejected' */
  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date;
}
