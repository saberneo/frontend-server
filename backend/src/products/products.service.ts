import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { FilterProductsDto, CreateProductDto, UpdateProductDto } from './product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private repo: Repository<Product>,
  ) {}

  async findAll(filter: FilterProductsDto) {
    const limit = filter.limit ? +filter.limit : 50;
    const page  = filter.page  ? +filter.page  : 1;
    const skip  = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('p')
      .orderBy('p.name', 'ASC')
      .take(limit)
      .skip(skip);

    if (filter.search) {
      qb.andWhere('(LOWER(p.name) LIKE :s OR LOWER(p.sku) LIKE :s OR LOWER(p.description) LIKE :s)', {
        s: `%${filter.search.toLowerCase()}%`,
      });
    }
    if (filter.category) qb.andWhere('p.category = :cat', { cat: filter.category });
    if (filter.status)   qb.andWhere('p.status = :st', { st: filter.status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Product> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Product ${id} not found`);
    return p;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const p = this.repo.create(dto);
    return this.repo.save(p);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const p = await this.findOne(id);
    await this.repo.remove(p);
    return { deleted: true };
  }

  async getStats() {
    const total   = await this.repo.count();
    const active  = await this.repo.count({ where: { status: 'active' } });
    const outOfStock = await this.repo.count({ where: { status: 'out_of_stock' } });
    const discontinued = await this.repo.count({ where: { status: 'discontinued' } });

    const revenueResult = await this.repo
      .createQueryBuilder('p')
      .select('SUM(p.price * p.stock)', 'inventoryValue')
      .getRawOne();

    return {
      total,
      active,
      outOfStock,
      discontinued,
      inventoryValue: parseFloat(revenueResult?.inventoryValue ?? '0'),
    };
  }

  getCategories(): Promise<{ category: string; count: number }[]> {
    return this.repo
      .createQueryBuilder('p')
      .select('p.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.category')
      .orderBy('count', 'DESC')
      .getRawMany();
  }
}
