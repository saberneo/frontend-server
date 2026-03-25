import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Connector } from './connector.entity';
import { SyncJob } from './sync-job.entity';
import { ConnectorsService } from './connectors.service';
import { ConnectorsController } from './connectors.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Connector, SyncJob]), EventsModule],
  providers: [ConnectorsService],
  controllers: [ConnectorsController],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
