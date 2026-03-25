import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get('stats')
  @ApiOperation({ summary: 'Aggregated KPIs for the overview dashboard (single request)' })
  async stats() {
    const [[orders], [customers], [approvals], [revenue], [overdueRow], [newCustRow], [lastMonthRev]] = await Promise.all([
      this.ds.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(status) = 'processing' THEN 1 ELSE 0 END) AS processing,
          SUM(CASE WHEN LOWER(status) = 'shipped'    THEN 1 ELSE 0 END) AS shipped,
          SUM(CASE WHEN LOWER(status) = 'delivered'  THEN 1 ELSE 0 END) AS delivered,
          SUM(CASE WHEN LOWER(status) = 'cancelled'  THEN 1 ELSE 0 END) AS cancelled
        FROM orders
      `),
      this.ds.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN status = 'at-risk'   THEN 1 ELSE 0 END) AS at_risk,
          SUM(CASE WHEN status = 'inactive'  THEN 1 ELSE 0 END) AS inactive
        FROM customers
      `),
      this.ds.query(`SELECT COUNT(*) AS pending FROM approvals WHERE status = 'pending'`),
      this.ds.query(`
        SELECT
          COALESCE(SUM(amount), 0) AS total_revenue,
          COALESCE(SUM(CASE WHEN date::date >= date_trunc('month', CURRENT_DATE)::date
                            THEN amount ELSE 0 END), 0) AS mtd_revenue,
          COALESCE(SUM(CASE WHEN date::date >= date_trunc('year', CURRENT_DATE)::date
                            THEN amount ELSE 0 END), 0) AS ytd_revenue
        FROM orders WHERE LOWER(status) != 'cancelled'
      `),
      // Overdue: Processing/Shipped orders older than 14 days
      this.ds.query(`
        SELECT COUNT(*) AS overdue
        FROM orders
        WHERE LOWER(status) IN ('processing','shipped')
          AND date::date < (CURRENT_DATE - INTERVAL '14 days')::date
      `),
      // New customers this month
      this.ds.query(`
        SELECT COUNT(*) AS new_this_month
        FROM customers
        WHERE "memberSince" >= date_trunc('month', CURRENT_DATE)::date::text
           OR "memberSince" >= to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')
      `),
      // Last month revenue for % change
      this.ds.query(`
        SELECT COALESCE(SUM(amount), 0) AS last_month_revenue
        FROM orders
        WHERE LOWER(status) != 'cancelled'
          AND date::date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date
          AND date::date <  date_trunc('month', CURRENT_DATE)::date
      `),
    ]);

    const mtd = +parseFloat(revenue.mtd_revenue).toFixed(2);
    const lastMonth = +parseFloat(lastMonthRev.last_month_revenue).toFixed(2);
    const revenueChangePercent = lastMonth > 0
      ? Math.round(((mtd - lastMonth) / lastMonth) * 100)
      : null;

    return {
      orders: {
        total: +orders.total,
        processing: +orders.processing,
        shipped: +orders.shipped,
        delivered: +orders.delivered,
        cancelled: +orders.cancelled,
        overdue: +overdueRow.overdue,
      },
      customers: {
        total: +customers.total,
        active: +customers.active,
        atRisk: +customers.at_risk,
        inactive: +customers.inactive,
        newThisMonth: +newCustRow.new_this_month,
      },
      approvals: {
        pending: +approvals.pending,
      },
      revenue: {
        total: +parseFloat(revenue.total_revenue).toFixed(2),
        mtd,
        ytd: +parseFloat(revenue.ytd_revenue).toFixed(2),
        lastMonth,
        changePercent: revenueChangePercent,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
