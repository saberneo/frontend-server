import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { FilterOrdersDto, UpdateOrderStatusDto, CreateOrderDto } from './order.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private repo: Repository<Order>,
  ) {}

  async findAll(filter: FilterOrdersDto): Promise<{ data: Order[]; total: number; page: number; totalPages: number }> {
    const limit = filter.limit ? +filter.limit : 50;
    const page  = filter.page  ? +filter.page  : 1;
    const skip  = (page - 1) * limit;
    const qb = this.repo.createQueryBuilder('o').orderBy('o.date', 'DESC').take(limit).skip(skip);
    if (filter.status && filter.status !== 'All') {
      qb.andWhere('LOWER(o.status) = LOWER(:status)', { status: filter.status });
    }
    if (filter.customer) {
      qb.andWhere('LOWER(o.customer) LIKE :customer', {
        customer: `%${filter.customer.toLowerCase()}%`,
      });
    }
    if (filter.tenantId) {
      qb.andWhere('o.tenantId = :tenantId', { tenantId: filter.tenantId });
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(id);
    order.status = dto.status;
    if (dto.trackingNumber) order.trackingNumber = dto.trackingNumber;
    return this.repo.save(order);
  }

  async getStats() {
    const total = await this.repo.count();
    const processing = await this.repo.count({ where: { status: 'processing' } });
    const shipped = await this.repo.count({ where: { status: 'shipped' } });
    const delivered = await this.repo.count({ where: { status: 'delivered' } });
    const cancelled = await this.repo.count({ where: { status: 'cancelled' } });
    return { total, processing, shipped, delivered, cancelled };
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    const today = new Date().toISOString().slice(0, 10);
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const id = `SO-${suffix}`;
    const order = this.repo.create({
      id,
      date: today,
      customer: dto.customer,
      customerId: dto.customerId,
      amount: dto.amount,
      status: 'processing',
      address: dto.address,
      paymentMethod: dto.paymentMethod,
      notes: dto.notes,
      tenantId: dto.tenantId,
      items: dto.items ?? [],
    });
    return this.repo.save(order);
  }

  async getAnalytics(): Promise<{
    byDay: { day: string; revenue: number; orders: number }[];
    byStatus: Record<string, number>;
    topCustomers: { customerId: string; customer: string; totalRevenue: number; orderCount: number }[];
    totalOrders: number;
    avgOrderValue: number;
    fulfillmentRate: number;
    revenueYtd: number;
  }> {
    const [byDay, byStatus, topCustomers] = await Promise.all([
      this.repo.manager.query(`
        SELECT date, COALESCE(SUM(amount), 0)::float AS revenue, COUNT(*)::int AS orders
        FROM orders
        WHERE date::date >= (CURRENT_DATE - INTERVAL '30 days')
          AND LOWER(status) != 'cancelled'
        GROUP BY date ORDER BY date ASC
      `),
      this.repo.manager.query(`
        SELECT status, COUNT(*)::int AS count
        FROM orders GROUP BY status
      `),
      this.repo.manager.query(`
        SELECT customer, COALESCE(SUM(amount), 0)::float AS revenue
        FROM orders
        WHERE LOWER(status) != 'cancelled'
        GROUP BY customer ORDER BY revenue DESC
        LIMIT 5
      `),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[row.status] = +row.count;

    // Extra aggregate KPIs
    const [[kpis]] = await Promise.all([
      this.repo.manager.query(`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(AVG(amount), 0)::float AS avg_order_value,
          COALESCE(SUM(CASE WHEN LOWER(status) = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_count,
          COALESCE(SUM(CASE WHEN LOWER(status) != 'cancelled' THEN 1 ELSE 0 END), 0) AS non_cancelled_count,
          COALESCE(SUM(CASE WHEN date::date >= date_trunc('year', CURRENT_DATE)::date THEN amount ELSE 0 END), 0)::float AS revenue_ytd
        FROM orders
      `),
    ]);

    const totalOrders = +kpis.total_orders;
    const nonCancelled = +kpis.non_cancelled_count;
    const fulfillmentRate = nonCancelled > 0
      ? Math.round((+kpis.delivered_count / nonCancelled) * 1000) / 10
      : 0;

    return {
      byDay: byDay.map((r: any) => ({ day: r.date, revenue: +r.revenue, orders: +r.orders })),
      byStatus: statusMap,
      topCustomers: topCustomers.map((r: any) => ({
        customerId: r.customer?.toLowerCase().replace(/\s+/g, '-'),
        customer: r.customer,
        totalRevenue: +r.revenue,
        orderCount: byStatus['delivered'] ?? 0,
      })),
      totalOrders,
      avgOrderValue: Math.round(+kpis.avg_order_value * 100) / 100,
      fulfillmentRate,
      revenueYtd: Math.round(+kpis.revenue_ytd * 100) / 100,
    };
  }
}
