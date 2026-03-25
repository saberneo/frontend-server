import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CdmVersion } from './cdm-version.entity';

@Injectable()
export class CdmVersionsService {
  constructor(@InjectRepository(CdmVersion) private repo: Repository<CdmVersion>) {}

  findAll(): Promise<CdmVersion[]> {
    return this.repo.find({ order: { publishedAt: 'DESC' } });
  }

  findActive(): Promise<CdmVersion | null> {
    return this.repo.findOne({ where: { status: 'active' } });
  }
}
