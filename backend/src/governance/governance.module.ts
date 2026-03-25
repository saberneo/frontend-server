import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceProposal } from './governance-proposal.entity';
import { MappingReview } from './mapping-review.entity';
import { SyncJob } from '../connectors/sync-job.entity';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([GovernanceProposal, MappingReview, SyncJob]), EventsModule],
  providers: [GovernanceService],
  controllers: [GovernanceController],
  exports: [GovernanceService],
})
export class GovernanceModule {}
