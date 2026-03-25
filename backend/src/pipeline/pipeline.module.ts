import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncJob } from '../connectors/sync-job.entity';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SyncJob])],
  controllers: [PipelineController],
})
export class PipelineModule {}
