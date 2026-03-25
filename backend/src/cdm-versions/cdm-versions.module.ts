import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CdmVersion } from './cdm-version.entity';
import { CdmVersionsService } from './cdm-versions.service';
import { CdmVersionsController } from './cdm-versions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CdmVersion])],
  controllers: [CdmVersionsController],
  providers: [CdmVersionsService],
  exports: [CdmVersionsService],
})
export class CdmVersionsModule {}
