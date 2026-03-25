import { Module } from '@nestjs/common';
import { DataHealthController } from './data-health.controller';

@Module({
  controllers: [DataHealthController],
})
export class DataHealthModule {}
