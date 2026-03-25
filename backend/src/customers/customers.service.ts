import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import { FilterCustomersDto, UpdateCustomerStatusDto, CreateCustomerDto, UpdateCustomerDto } from './customer.dto';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private repo: Repository<Customer>,
    private ordersService: OrdersService,
  ) {}

  async findAll(filter: FilterCustomersDto): Promise<{ data: Customer[]; total: number; page: number; totalPages: number }> {
    const limit = filter.limit ? +filter.limit : 50;
    const page  = filter.page  ? +filter.page  : 1;
    const skip  = (page - 1) * limit;
    const qb = this.repo.createQueryBuilder('c').orderBy('c.revenueYtd', 'DESC').take(limit).skip(skip);
    if (filter.search) {
      qb.andWhere(
        '(LOWER(c.name) LIKE :s OR LOWER(c.country) LIKE :s OR LOWER(c.id) LIKE :s)',
        { s: `%${filter.search.toLowerCase()}%` },
      );
    }
    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    if (filter.segment) qb.andWhere('c.segment = :segment', { segment: filter.segment });
    if (filter.tenantId) qb.andWhere('c.tenantId = :tenantId', { tenantId: filter.tenantId });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Customer> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  async updateStatus(id: string, dto: UpdateCustomerStatusDto): Promise<Customer> {
    const customer = await this.findOne(id);
    customer.status = dto.status;
    if (dto.notes) customer.notes = dto.notes;
    return this.repo.save(customer);
  }

  async getRecentOrders(id: string) {
    return this.ordersService.findAll({ customer: id });
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const exists = await this.repo.findOne({ where: { id: dto.id } });
    if (exists) throw new ConflictException(`Customer ID '${dto.id}' is already taken`);
    const today = new Date().toISOString().slice(0, 10);
    const customer = this.repo.create({ ...dto, memberSince: today, status: 'Active', totalOrders: 0, revenueYtd: 0, openOrders: 0 });
    return this.repo.save(customer);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, dto);
    return this.repo.save(customer);
  }

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    const customer = await this.findOne(id);
    await this.repo.remove(customer);
    return { deleted: true, id };
  }
}
