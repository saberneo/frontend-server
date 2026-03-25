import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schema } from './schema.entity';
import { SchemasService } from './schemas.service';
import { SchemasController } from './schemas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Schema])],
  providers: [SchemasService],
  controllers: [SchemasController],
})
export class SchemasModule {}
