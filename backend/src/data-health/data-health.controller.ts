import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('data-health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('data-health')
export class DataHealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Full data health report: scores, source statuses and quality issues' })
  async getDataHealth() {
    const [
      connectors,
      [custTotal],
      [custNoEmail],
      [custNoPhone],
      [orderNoAddr],
      [orderNoTracking],
      [prodNoDesc],
      [prodNoSupplier],
    ] = await Promise.all([
      this.ds.query(`
        SELECT id, name, type, status, "lastSync", records
        FROM connectors
        ORDER BY "createdAt" ASC
      `),
      this.ds.query(`SELECT COUNT(*)::int AS total FROM customers`),
      this.ds.query(`SELECT COUNT(*)::int AS cnt FROM customers WHERE email IS NULL OR email = ''`),
      this.ds.query(`SELECT COUNT(*)::int AS cnt FROM customers WHERE phone IS NULL OR phone = ''`),
      this.ds.query(`SELECT COUNT(*)::int AS cnt FROM orders WHERE address IS NULL OR address = ''`),
      this.ds.query(`
        SELECT COUNT(*)::int AS cnt FROM orders
        WHERE LOWER(status) = 'shipped' AND ("trackingNumber" IS NULL OR "trackingNumber" = '')
      `),
      this.ds.query(`SELECT COUNT(*)::int AS cnt FROM products WHERE description IS NULL OR description = ''`),
      this.ds.query(`SELECT COUNT(*)::int AS cnt FROM products WHERE supplier IS NULL OR supplier = ''`),
    ]);

    // ── KPI scores ──────────────────────────────────────────────────────────
    const totalOpt = (custTotal.total * 3) + (connectors.length > 0 ? 1 : 0); // optional fields weighted
    const missingFields = custNoEmail.cnt + custNoPhone.cnt + orderNoAddr.cnt + prodNoDesc.cnt;
    const filledOptional = Math.max(0, totalOpt * 2 - missingFields);
    const completeness = totalOpt > 0
      ? Math.round(Math.min(100, (filledOptional / (totalOpt * 2)) * 100))
      : 91;

    // Freshness: based on connector lastSync timestamps
    const activeConnectors = connectors.filter((c: any) => c.status === 'active' || c.status === 'syncing');
    const syncedRecently = connectors.filter((c: any) => {
      if (!c.lastSync) return false;
      const ms = Date.now() - new Date(c.lastSync).getTime();
      return ms < 24 * 3600 * 1000; // synced within 24 hours
    });
    const freshness = connectors.length > 0
      ? Math.round((syncedRecently.length / connectors.length) * 100)
      : 98;

    // Health score = average of active ratio, freshness, completeness
    const activeRatio = connectors.length > 0
      ? Math.round((activeConnectors.length / connectors.length) * 100)
      : 100;
    const healthScore = Math.round((activeRatio + freshness + completeness) / 3);

    // ── Source statuses from real connectors ────────────────────────────────
    const sources = connectors.map((c: any) => {
      let displayStatus = c.status;
      let lastSyncLabel = 'never';
      if (c.lastSync) {
        const ms = Date.now() - new Date(c.lastSync).getTime();
        const mins = Math.round(ms / 60000);
        const hours = Math.round(ms / 3600000);
        if (mins < 60) lastSyncLabel = `${mins} min${mins !== 1 ? 's' : ''} ago`;
        else if (hours < 48) lastSyncLabel = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        else lastSyncLabel = new Date(c.lastSync).toLocaleDateString('en-GB');
        if (hours > 6 && displayStatus === 'active') displayStatus = 'delayed';
      }
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        status: displayStatus,
        lastSync: lastSyncLabel,
        records: c.records,
      };
    });

    // ── Quality issues from real null/invalid data ──────────────────────────
    const issues: any[] = [];

    if (custNoEmail.cnt > 0) {
      issues.push({
        type: 'warning',
        title: 'Missing Email Addresses',
        description: `${custNoEmail.cnt} customer record${custNoEmail.cnt !== 1 ? 's' : ''} are missing an email address.`,
        source: 'Customers DB',
        count: custNoEmail.cnt,
        issueKey: 'missing-emails',
      });
    }

    if (custNoPhone.cnt > 0) {
      issues.push({
        type: 'info',
        title: 'Missing Phone Numbers',
        description: `${custNoPhone.cnt} customer record${custNoPhone.cnt !== 1 ? 's' : ''} have no phone number on file.`,
        source: 'Customers DB',
        count: custNoPhone.cnt,
        issueKey: 'missing-phones',
      });
    }

    if (orderNoTracking.cnt > 0) {
      issues.push({
        type: 'error',
        title: 'Shipped Orders Without Tracking',
        description: `${orderNoTracking.cnt} order${orderNoTracking.cnt !== 1 ? 's' : ''} marked as Shipped but missing a tracking number.`,
        source: 'Orders DB',
        count: orderNoTracking.cnt,
        issueKey: 'no-tracking',
      });
    }

    if (prodNoDesc.cnt > 0) {
      issues.push({
        type: 'info',
        title: 'Products Without Description',
        description: `${prodNoDesc.cnt} product${prodNoDesc.cnt !== 1 ? 's' : ''} in the catalogue have no description text.`,
        source: 'Products DB',
        count: prodNoDesc.cnt,
        issueKey: 'no-description',
      });
    }

    if (prodNoSupplier.cnt > 0) {
      issues.push({
        type: 'warning',
        title: 'Products Without Supplier',
        description: `${prodNoSupplier.cnt} product${prodNoSupplier.cnt !== 1 ? 's' : ''} have no supplier assigned.`,
        source: 'Products DB',
        count: prodNoSupplier.cnt,
        issueKey: 'no-supplier',
      });
    }

    if (orderNoAddr.cnt > 0) {
      issues.push({
        type: 'warning',
        title: 'Orders Without Shipping Address',
        description: `${orderNoAddr.cnt} order${orderNoAddr.cnt !== 1 ? 's' : ''} have no shipping address recorded.`,
        source: 'Orders DB',
        count: orderNoAddr.cnt,
        issueKey: 'no-address',
      });
    }

    return {
      stats: {
        healthScore,
        freshness,
        completeness,
        lastUpdated: new Date().toISOString(),
      },
      sources,
      issues,
    };
  }
}
