import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from './users/user.entity';
import { Order } from './orders/order.entity';
import { Customer } from './customers/customer.entity';
import { Approval } from './approvals/approval.entity';
import { Connector } from './connectors/connector.entity';
import { SyncJob } from './connectors/sync-job.entity';
import { Schema } from './schemas/schema.entity';
import { AuditLog } from './audit/audit-log.entity';
import { Product } from './products/product.entity';
import { Tenant } from './tenants/tenant.entity';
import { CdmVersion } from './cdm-versions/cdm-version.entity';
import { GovernanceProposal } from './governance/governance-proposal.entity';
import { MappingReview } from './governance/mapping-review.entity';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'nexus_db',
  synchronize: true,
  entities: [User, Order, Customer, Approval, Connector, SyncJob, Schema, AuditLog, Product, Tenant, CdmVersion, GovernanceProposal, MappingReview],
});

async function seed() {
  await ds.initialize();
  console.log('Connected – seeding …');

  // ── Users ────────────────────────────────────────────────────────────────
  const usersRepo = ds.getRepository(User);
  await usersRepo.clear();
  const hash = await bcrypt.hash('Admin1234!', 12);
  const demoHash = await bcrypt.hash('Demo#NEXUS2026!', 12);
  await usersRepo.save([
    { name: 'Alice Martin', email: 'alice@nexus.io', passwordHash: hash, role: 'platform-admin', status: 'active', source: 'local' },
    { name: 'Bob Torres', email: 'bob@nexus.io', passwordHash: hash, role: 'data-steward', status: 'active', source: 'local' },
    { name: 'Clara Nguyen', email: 'clara@nexus.io', passwordHash: hash, role: 'business-analyst', status: 'active', source: 'local' },
    { name: 'Dev Patel', email: 'dev@nexus.io', passwordHash: hash, role: 'read-only', status: 'inactive', source: 'local' },
    { name: 'Demo User', email: 'demo@nexus.io', passwordHash: demoHash, role: 'business-analyst', status: 'active', source: 'local' },
  ]);
  console.log('✓ users');

  // ── Products ──────────────────────────────────────────────────────────────
  const productsRepo = ds.getRepository(Product);
  await productsRepo.clear();
  await productsRepo.save([
    { id: 'PROD-001', name: 'CDM Pro License', category: 'Software', sku: 'NX-CDM-PRO', price: 800, stock: 9999, status: 'active', description: 'Full CDM Professional licence, annual subscription. Includes up to 20 users and 10 connectors.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 82.00 },
    { id: 'PROD-002', name: 'CDM Standard License', category: 'Software', sku: 'NX-CDM-STD', price: 600, stock: 9999, status: 'active', description: 'CDM Standard licence for SMB customers. Up to 5 users and 3 connectors.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 78.50 },
    { id: 'PROD-003', name: 'Enterprise Suite (Annual)', category: 'Software', sku: 'NX-ENT-SUITE', price: 28000, stock: 9999, status: 'active', description: 'Full enterprise platform suite — unlimited users, all modules, priority support included.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 70.00 },
    { id: 'PROD-004', name: 'SAP S/4HANA Connector', category: 'Connectors', sku: 'NX-CONN-SAP', price: 1200, stock: 500, status: 'active', description: 'Certified SAP S/4HANA connector with real-time CDC support.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 75.00 },
    { id: 'PROD-005', name: 'Salesforce Connector', category: 'Connectors', sku: 'NX-CONN-SF', price: 2400, stock: 500, status: 'active', description: 'Salesforce CRM connector with bi‑directional sync and field mapping.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 73.50 },
    { id: 'PROD-006', name: 'SQL Server Connector', category: 'Connectors', sku: 'NX-CONN-SQL', price: 900, stock: 500, status: 'active', description: 'Microsoft SQL Server 2016+ connector with bulk-load optimisation.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 71.00 },
    { id: 'PROD-007', name: 'HubSpot Connector', category: 'Connectors', sku: 'NX-CONN-HUB', price: 1800, stock: 500, status: 'active', description: 'HubSpot CRM/Marketing connector, contacts and deals sync.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 72.00 },
    { id: 'PROD-008', name: 'P1 Support Add-on', category: 'Services', sku: 'NX-SUPPORT-P1', price: 800, stock: 100, status: 'active', description: '24/7 Priority-1 support with 1h response SLA. Annual subscription.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 65.00 },
    { id: 'PROD-009', name: 'P2 Support Add-on', category: 'Services', sku: 'NX-SUPPORT-P2', price: 1000, stock: 100, status: 'active', description: 'Business-hours P2 support, 4h response SLA. Annual subscription.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 64.00 },
    { id: 'PROD-010', name: 'Basic Implementation', category: 'Services', sku: 'NX-IMPL-BASIC', price: 2400, stock: 50, status: 'active', description: 'Guided 5-day implementation: environment setup, basic connector config, user training.', supplier: 'NEXUS Professional Services', unit: 'pcs', marginPercent: 55.00 },
    { id: 'PROD-011', name: 'Onboarding Package', category: 'Services', sku: 'NX-ONBOARD', price: 1550, stock: 50, status: 'active', description: 'Remote onboarding package for new customers – 3 sessions of 2h each.', supplier: 'NEXUS Professional Services', unit: 'pcs', marginPercent: 58.00 },
    { id: 'PROD-012', name: 'Training Workshop', category: 'Services', sku: 'NX-TRAINING', price: 2250, stock: 30, status: 'active', description: 'On-site or remote 2-day training workshop for platform administrators and data stewards.', supplier: 'NEXUS Professional Services', unit: 'pcs', marginPercent: 52.00 },
    { id: 'PROD-013', name: '1-Year Maintenance', category: 'Software', sku: 'NX-MAINT-1Y', price: 900, stock: 9999, status: 'active', description: 'Annual maintenance plan: patch updates, minor version upgrades, bug-fix guarantee.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 80.00 },
    { id: 'PROD-014', name: 'User Pack 50', category: 'Software', sku: 'NX-USERS-50', price: 4500, stock: 9999, status: 'active', description: 'Add-on pack for 50 additional named users on any Enterprise tier licence.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 76.00 },
    { id: 'PROD-015', name: 'Oracle DB Connector', category: 'Connectors', sku: 'NX-CONN-ORA', price: 1500, stock: 200, status: 'out_of_stock', description: 'Oracle Database 12c+ connector — currently pending recertification for Oracle 23ai.', supplier: 'NEXUS Internal', unit: 'license', marginPercent: 70.00 },
  ]);
  console.log('✓ products');

  // ── Customers ────────────────────────────────────────────────────────────
  const custRepo = ds.getRepository(Customer);
  await custRepo.clear();
  await custRepo.save([
    { id: 'acme-corp', name: 'Acme Corp', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 3, status: 'Active', email: 'procurement@acme.com', phone: '+1 (555) 234-5678', accountManager: 'Alice Martin', memberSince: '2019-03-12', totalOrders: 148, revenueYtd: 128400.00, lastActivity: '2025-07-18', notes: 'Key strategic account. Negotiating Q3 volume discount.' },
    { id: 'globex-inc', name: 'Globex Inc', countryCode: 'DE', country: 'Germany', segment: 'Mid-Market', openOrders: 1, status: 'Active', email: 'orders@globex.de', phone: '+49 30 9988-7766', accountManager: 'Bob Torres', memberSince: '2020-11-05', totalOrders: 74, revenueYtd: 45200.00, lastActivity: '2025-07-12', notes: 'Expanding into DACH market with new SAP connector.' },
    { id: 'initech-llc', name: 'Initech LLC', countryCode: 'CA', country: 'Canada', segment: 'SMB', openOrders: 0, status: 'At Risk', email: 'billing@initech.ca', phone: '+1 (416) 555-0199', accountManager: 'Clara Nguyen', memberSince: '2021-06-30', totalOrders: 29, revenueYtd: 9800.00, lastActivity: '2025-05-22', notes: 'Last two invoices overdue. Follow-up scheduled.' },
    { id: 'umbrella-ltd', name: 'Umbrella Ltd', countryCode: 'GB', country: 'United Kingdom', segment: 'Enterprise', openOrders: 5, status: 'Active', email: 'purchasing@umbrella.co.uk', phone: '+44 20 7946 0803', accountManager: 'Alice Martin', memberSince: '2018-01-15', totalOrders: 312, revenueYtd: 247600.00, lastActivity: '2025-07-19', notes: 'Largest account by revenue. Annual contract renewal in Sept.' },
    { id: 'soylent-corp', name: 'Soylent Corp', countryCode: 'AU', country: 'Australia', segment: 'Mid-Market', openOrders: 2, status: 'Active', email: 'ops@soylent.com.au', phone: '+61 2 8765 4321', accountManager: 'Bob Torres', memberSince: '2025-04-01', totalOrders: 7, revenueYtd: 12300.00, lastActivity: '2025-07-10', notes: 'New customer onboarded in April. Pilot phase.' },
    { id: 'initrode-bv', name: 'Initrode BV', countryCode: 'NL', country: 'Netherlands', segment: 'SMB', openOrders: 1, status: 'Active', email: 'info@initrode.nl', phone: '+31 20 555 8800', accountManager: 'Bob Torres', memberSince: '2022-03-20', totalOrders: 18, revenueYtd: 22400.00, lastActivity: '2025-07-08', notes: 'Growing Dutch fintech — evaluating Enterprise tier.' },
    { id: 'veridian', name: 'Veridian Dynamics', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 4, status: 'Active', email: 'tech@veridian.com', phone: '+1 (415) 555-0120', accountManager: 'Alice Martin', memberSince: '2017-07-04', totalOrders: 205, revenueYtd: 196800.00, lastActivity: '2025-07-17', notes: 'Long-standing partner. Custom SLA in place.' },
    { id: 'massive-dynamic', name: 'Massive Dynamic', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 2, status: 'Active', email: 'procurement@massivedynamic.com', phone: '+1 (212) 555-3100', accountManager: 'Alice Martin', memberSince: '2020-09-01', totalOrders: 88, revenueYtd: 87300.00, lastActivity: '2025-07-14', notes: 'R&D division uses platform for experimental data pipelines.' },
    { id: 'reynholm-industries', name: 'Reynholm Industries', countryCode: 'GB', country: 'United Kingdom', segment: 'Mid-Market', openOrders: 1, status: 'Active', email: 'dougal@reynholm.co.uk', phone: '+44 20 7946 1234', accountManager: 'Bob Torres', memberSince: '2021-11-11', totalOrders: 34, revenueYtd: 31500.00, lastActivity: '2025-06-30', notes: 'IT dept manages integration. Support tickets frequent.' },
    { id: 'praxis-co', name: 'Praxis Corp', countryCode: 'BR', country: 'Brazil', segment: 'Mid-Market', openOrders: 2, status: 'Active', email: 'compras@praxis.com.br', phone: '+55 11 3355-8800', accountManager: 'Clara Nguyen', memberSince: '2023-01-15', totalOrders: 21, revenueYtd: 19200.00, lastActivity: '2025-07-05', notes: 'LATAM expansion pilot. Portuguese localisation requested.' },
    { id: 'genco-shipping', name: 'Genco Shipping & Trading', countryCode: 'GR', country: 'Greece', segment: 'SMB', openOrders: 0, status: 'Inactive', email: 'it@genco.gr', phone: '+30 210 555 7654', accountManager: 'Clara Nguyen', memberSince: '2022-08-10', totalOrders: 12, revenueYtd: 0.00, lastActivity: '2024-12-01', notes: 'Account dormant since Dec 2024. Win-back campaign planned.' },
    { id: 'oceanic-airlines', name: 'Oceanic Airlines', countryCode: 'AU', country: 'Australia', segment: 'Enterprise', openOrders: 3, status: 'Active', email: 'datateam@oceanic.com.au', phone: '+61 3 9012 3456', accountManager: 'Alice Martin', memberSince: '2019-12-01', totalOrders: 76, revenueYtd: 112400.00, lastActivity: '2025-07-15', notes: 'Multi-site deployment across 8 airports.' },
    { id: 'dunder-mifflin', name: 'Dunder Mifflin', countryCode: 'US', country: 'United States', segment: 'SMB', openOrders: 1, status: 'Active', email: 'oscar@dundermifflin.com', phone: '+1 (570) 555-0100', accountManager: 'Bob Torres', memberSince: '2023-06-01', totalOrders: 9, revenueYtd: 8700.00, lastActivity: '2025-07-02', notes: 'Small account. Finance uses platform for expense analytics.' },
    { id: 'bluth-company', name: 'Bluth Company', countryCode: 'US', country: 'United States', segment: 'SMB', openOrders: 0, status: 'At Risk', email: 'lucille@bluth.com', phone: '+1 (949) 555-0177', accountManager: 'Clara Nguyen', memberSince: '2022-04-01', totalOrders: 14, revenueYtd: 4100.00, lastActivity: '2025-04-15', notes: 'Usage dropped significantly in Q2. Churn risk flagged.' },
    { id: 'wernham-hogg', name: 'Wernham Hogg', countryCode: 'GB', country: 'United Kingdom', segment: 'SMB', openOrders: 1, status: 'Active', email: 'gareth@wernhamhogg.co.uk', phone: '+44 1923 555 200', accountManager: 'Bob Torres', memberSince: '2024-01-08', totalOrders: 5, revenueYtd: 6200.00, lastActivity: '2025-07-01', notes: 'New account. Paper procurement analytics use case.' },
    { id: 'stagg-enterprises', name: 'Stagg Enterprises', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 2, status: 'Active', email: 'ops@stagg.com', phone: '+1 (312) 555-8800', accountManager: 'Alice Martin', memberSince: '2018-11-20', totalOrders: 134, revenueYtd: 154200.00, lastActivity: '2025-07-13', notes: 'METACHEMICAL division expanding next quarter.' },
    { id: 'cyberdyne-tech', name: 'Cyberdyne Technologies', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 1, status: 'Active', email: 'sarah@cyberdyne-tech.com', phone: '+1 (408) 555-2029', accountManager: 'Alice Martin', memberSince: '2021-05-19', totalOrders: 60, revenueYtd: 72400.00, lastActivity: '2025-07-09', notes: 'AI/ML data pipeline heavy user. High API volume.' },
    { id: 'oscorp-labs', name: 'OsCorp Labs', countryCode: 'US', country: 'United States', segment: 'Mid-Market', openOrders: 1, status: 'Active', email: 'r.d@oscorplabs.com', phone: '+1 (646) 555-2099', accountManager: 'Clara Nguyen', memberSince: '2022-10-01', totalOrders: 28, revenueYtd: 33600.00, lastActivity: '2025-06-25', notes: 'R&D data team. Evaluating advanced analytics module.' },
    { id: 'wayne-enterprises', name: 'Wayne Enterprises', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 6, status: 'Active', email: 'lucius@wayne-enterprises.com', phone: '+1 (212) 555-1939', accountManager: 'Alice Martin', memberSince: '2016-09-05', totalOrders: 421, revenueYtd: 398500.00, lastActivity: '2025-07-20', notes: 'Flagship account. Board-level relationship. DO NOT churn.' },
    { id: 'stark-industries', name: 'Stark Industries', countryCode: 'US', country: 'United States', segment: 'Enterprise', openOrders: 4, status: 'Active', email: 'pepper@stark.com', phone: '+1 (310) 555-4000', accountManager: 'Alice Martin', memberSince: '2017-03-01', totalOrders: 287, revenueYtd: 312700.00, lastActivity: '2025-07-18', notes: 'Strategic partner — co-developing NEXUS Arc integration.' },
  ]);
  console.log('✓ customers (20)');

  // ── Orders ────────────────────────────────────────────────────────────────
  const ordersRepo = ds.getRepository(Order);
  await ordersRepo.clear();
  const orders = [
    { id: 'SO-48291', date: '2025-07-18', customer: 'Acme Corp', customerId: 'acme-corp', amount: 12400.00, status: 'Processing', address: '1600 Pennsylvania Ave, Washington DC 20500, US', paymentMethod: 'Net 30', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 10, unitPrice: 800, total: 8000 }, { sku: 'NX-CONN-SAP', name: 'SAP Connector Pack', qty: 3, unitPrice: 1200, total: 3600 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support Add-on', qty: 1, unitPrice: 800, total: 800 }] },
    { id: 'SO-48290', date: '2025-07-17', customer: 'Wayne Enterprises', customerId: 'wayne-enterprises', amount: 56000.00, status: 'Processing', address: '1007 Mountain Drive, Gotham, US', paymentMethod: 'Net 60', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 2, unitPrice: 28000, total: 56000 }] },
    { id: 'SO-48287', date: '2025-07-16', customer: 'Stark Industries', customerId: 'stark-industries', amount: 34000.00, status: 'Processing', address: '10880 Malibu Point, Malibu CA 90265, US', paymentMethod: 'Credit Card', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-USERS-50', name: 'User Pack 50', qty: 1, unitPrice: 4500, total: 4500 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support', qty: 1, unitPrice: 800, total: 800 }, { sku: 'NX-TRAINING', name: 'Training Workshop', qty: 1, unitPrice: 2250, total: 2250 }] },
    { id: 'SO-48280', date: '2025-07-15', customer: 'Wayne Enterprises', customerId: 'wayne-enterprises', amount: 8100.00, status: 'Shipped', address: '1007 Mountain Drive, Gotham, US', paymentMethod: 'Net 60', trackingNumber: 'UPS-WE7X4K9L', items: [{ sku: 'NX-CONN-SF', name: 'Salesforce Connector', qty: 3, unitPrice: 2400, total: 7200 }, { sku: 'NX-MAINT-1Y', name: '1-Year Maintenance', qty: 1, unitPrice: 900, total: 900 }] },
    { id: 'SO-48187', date: '2025-07-15', customer: 'Umbrella Ltd', customerId: 'umbrella-ltd', amount: 34750.00, status: 'Shipped', address: '1 Royal Exchange, London EC3V 3DG, UK', paymentMethod: 'Credit Card', trackingNumber: 'UPS-7G3H2K9L', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite (annual)', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-USERS-50', name: 'User Pack 50', qty: 1, unitPrice: 4500, total: 4500 }, { sku: 'NX-TRAINING', name: 'Training Workshop', qty: 1, unitPrice: 2250, total: 2250 }] },
    { id: 'SO-48175', date: '2025-07-14', customer: 'Stagg Enterprises', customerId: 'stagg-enterprises', amount: 22400.00, status: 'Shipped', address: '233 N Michigan Ave, Chicago IL 60601, US', paymentMethod: 'Net 30', trackingNumber: 'FEDEX-ST2M8N1R', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 20, unitPrice: 800, total: 16000 }, { sku: 'NX-IMPL-BASIC', name: 'Implementation', qty: 1, unitPrice: 2400, total: 2400 }, { sku: 'NX-MAINT-1Y', name: '1-Year Maintenance', qty: 4, unitPrice: 900, total: 3600 }, { sku: 'NX-SUPPORT-P2', name: 'P2 Support', qty: 1, unitPrice: 1000, total: 1000 }] },
    { id: 'SO-48102', date: '2025-07-12', customer: 'Veridian Dynamics', customerId: 'veridian', amount: 19600.00, status: 'Delivered', address: '888 Industrial Blvd, Hawthorne NV 89415, US', paymentMethod: 'Bank Transfer', trackingNumber: 'DHL-VD4F9E2X', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }] },
    { id: 'SO-48065', date: '2025-07-10', customer: 'Globex Inc', customerId: 'globex-inc', amount: 7200.00, status: 'Delivered', address: 'Unter den Linden 17, 10117 Berlin, DE', paymentMethod: 'Bank Transfer', trackingNumber: 'DHL-4F8R2M1X', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 5, unitPrice: 600, total: 3000 }, { sku: 'NX-CONN-SQL', name: 'SQL Server Connector', qty: 2, unitPrice: 900, total: 1800 }, { sku: 'NX-IMPL-BASIC', name: 'Basic Implementation', qty: 1, unitPrice: 2400, total: 2400 }] },
    { id: 'SO-48050', date: '2025-07-09', customer: 'Oceanic Airlines', customerId: 'oceanic-airlines', amount: 33600.00, status: 'Delivered', address: '123 Qantas Dr, Sydney NSW 2020, AU', paymentMethod: 'Net 30', trackingNumber: 'AUSPOST-4R8P1T', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-CONN-SF', name: 'Salesforce Connector', qty: 2, unitPrice: 2400, total: 4800 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support', qty: 1, unitPrice: 800, total: 800 }] },
    { id: 'SO-48030', date: '2025-07-08', customer: 'Massive Dynamic', customerId: 'massive-dynamic', amount: 9300.00, status: 'Processing', address: '354 W 57th St, New York NY 10019, US', paymentMethod: 'Credit Card', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 8, unitPrice: 800, total: 6400 }, { sku: 'NX-CONN-HUB', name: 'HubSpot Connector', qty: 1, unitPrice: 1800, total: 1800 }, { sku: 'NX-MAINT-1Y', name: '1-Year Maintenance', qty: 1, unitPrice: 900, total: 900 }] },
    { id: 'SO-48010', date: '2025-07-07', customer: 'Cyberdyne Technologies', customerId: 'cyberdyne-tech', amount: 31200.00, status: 'Shipped', address: '18144 El Camino Real, Sunnyvale CA 94087, US', paymentMethod: 'Net 30', trackingNumber: 'FEDEX-CY9P4Q2S', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-CONN-SQL', name: 'SQL Server Connector', qty: 2, unitPrice: 900, total: 1800 }, { sku: 'NX-TRAINING', name: 'Training Workshop', qty: 1, unitPrice: 2250, total: 2250 }] },
    { id: 'SO-47998', date: '2025-07-05', customer: 'Umbrella Ltd', customerId: 'umbrella-ltd', amount: 5100.00, status: 'Processing', address: '1 Royal Exchange, London EC3V 3DG, UK', paymentMethod: 'Net 60', notes: 'Awaiting PO approval from Finance.', items: [{ sku: 'NX-CONN-SF', name: 'Salesforce Connector', qty: 1, unitPrice: 2400, total: 2400 }, { sku: 'NX-CONN-HUB', name: 'HubSpot Connector', qty: 1, unitPrice: 1800, total: 1800 }, { sku: 'NX-MAINT-1Y', name: '1-Year Maintenance', qty: 1, unitPrice: 900, total: 900 }] },
    { id: 'SO-47980', date: '2025-07-04', customer: 'Praxis Corp', customerId: 'praxis-co', amount: 4800.00, status: 'Delivered', address: 'Av. Paulista 1374, São Paulo SP 01310-100, BR', paymentMethod: 'Bank Transfer', trackingNumber: 'CORREIOS-BR8X2Y', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 5, unitPrice: 600, total: 3000 }, { sku: 'NX-ONBOARD', name: 'Onboarding Package', qty: 1, unitPrice: 1550, total: 1550 }, { sku: 'NX-SUPPORT-P2', name: 'P2 Support', qty: 1, unitPrice: 250, total: 250 }] },
    { id: 'SO-47954', date: '2025-07-03', customer: 'OsCorp Labs', customerId: 'oscorp-labs', amount: 3700.00, status: 'Delivered', address: '32nd & 6th Avenue, New York NY 10001, US', paymentMethod: 'Credit Card', trackingNumber: 'UPS-OS5N3K8R', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 3, unitPrice: 600, total: 1800 }, { sku: 'NX-CONN-SQL', name: 'SQL Server Connector', qty: 1, unitPrice: 900, total: 900 }, { sku: 'NX-IMPL-BASIC', name: 'Basic Impl', qty: 1, unitPrice: 1000, total: 1000 }] },
    { id: 'SO-47920', date: '2025-07-01', customer: 'Stark Industries', customerId: 'stark-industries', amount: 14400.00, status: 'Delivered', address: '10880 Malibu Point, Malibu CA 90265, US', paymentMethod: 'Net 30', trackingNumber: 'FEDEX-SI7H2P9Q', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 18, unitPrice: 800, total: 14400 }] },
    { id: 'SO-47891', date: '2025-06-28', customer: 'Acme Corp', customerId: 'acme-corp', amount: 9100.00, status: 'Delivered', address: '1600 Pennsylvania Ave, Washington DC 20500, US', paymentMethod: 'Net 30', trackingNumber: 'UPS-AC2B5L7D', items: [{ sku: 'NX-CONN-SAP', name: 'SAP Connector', qty: 5, unitPrice: 1200, total: 6000 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support', qty: 1, unitPrice: 800, total: 800 }, { sku: 'NX-TRAINING', name: 'Training', qty: 1, unitPrice: 2250, total: 2250 }] },
    { id: 'SO-47854', date: '2025-06-28', customer: 'Soylent Corp', customerId: 'soylent-corp', amount: 3350.00, status: 'Delivered', address: '123 George St, Sydney NSW 2000, AU', paymentMethod: 'Credit Card', trackingNumber: 'FEDEX-9K2P5Q7R', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 3, unitPrice: 600, total: 1800 }, { sku: 'NX-ONBOARD', name: 'Onboarding Package', qty: 1, unitPrice: 1550, total: 1550 }] },
    { id: 'SO-47820', date: '2025-06-26', customer: 'Wayne Enterprises', customerId: 'wayne-enterprises', amount: 45000.00, status: 'Delivered', address: '1007 Mountain Drive, Gotham, US', paymentMethod: 'Net 60', trackingNumber: 'FEDEX-WE4D8R2T', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-USERS-50', name: 'User Pack 50', qty: 3, unitPrice: 4500, total: 13500 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support', qty: 1, unitPrice: 800, total: 800 }, { sku: 'NX-CONN-SF', name: 'Salesforce Connector', qty: 1, unitPrice: 2400, total: 2400 }] },
    { id: 'SO-47799', date: '2025-06-25', customer: 'Initrode BV', customerId: 'initrode-bv', amount: 6000.00, status: 'Delivered', address: 'Herengracht 420, 1017 BZ Amsterdam, NL', paymentMethod: 'Bank Transfer', trackingNumber: 'DHL-IN5X9P3M', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 5, unitPrice: 600, total: 3000 }, { sku: 'NX-CONN-SQL', name: 'SQL Server Connector', qty: 2, unitPrice: 900, total: 1800 }, { sku: 'NX-ONBOARD', name: 'Onboarding', qty: 1, unitPrice: 1200, total: 1200 }] },
    { id: 'SO-47760', date: '2025-06-20', customer: 'Reynholm Industries', customerId: 'reynholm-industries', amount: 7700.00, status: 'Delivered', address: '123 Reynholm Tower, London EC1A 1BB, UK', paymentMethod: 'Net 30', trackingNumber: 'UPS-RI6T3N8K', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 8, unitPrice: 600, total: 4800 }, { sku: 'NX-IMPL-BASIC', name: 'Implementation', qty: 1, unitPrice: 2400, total: 2400 }, { sku: 'NX-MAINT-1Y', name: 'Maintenance', qty: 1, unitPrice: 500, total: 500 }] },
    { id: 'SO-47730', date: '2025-06-18', customer: 'Massive Dynamic', customerId: 'massive-dynamic', amount: 28800.00, status: 'Delivered', address: '354 W 57th St, New York NY 10019, US', paymentMethod: 'Credit Card', trackingNumber: 'FEDEX-MD3F7P2Q', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support', qty: 1, unitPrice: 800, total: 800 }] },
    { id: 'SO-47700', date: '2025-06-15', customer: 'Umbrella Ltd', customerId: 'umbrella-ltd', amount: 13500.00, status: 'Delivered', address: '1 Royal Exchange, London EC3V 3DG, UK', paymentMethod: 'Net 60', trackingNumber: 'DHL-UB9R4K2X', items: [{ sku: 'NX-USERS-50', name: 'User Pack 50', qty: 3, unitPrice: 4500, total: 13500 }] },
    { id: 'SO-47690', date: '2025-06-15', customer: 'Dunder Mifflin', customerId: 'dunder-mifflin', amount: 3200.00, status: 'Delivered', address: '1725 Slough Ave, Scranton PA 18503, US', paymentMethod: 'Credit Card', trackingNumber: 'UPS-DM2K5L9R', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 2, unitPrice: 600, total: 1200 }, { sku: 'NX-ONBOARD', name: 'Onboarding', qty: 1, unitPrice: 1550, total: 1550 }, { sku: 'NX-SUPPORT-P2', name: 'P2 Support', qty: 1, unitPrice: 450, total: 450 }] },
    { id: 'SO-47621', date: '2025-06-15', customer: 'Initech LLC', customerId: 'initech-llc', amount: 2200.00, status: 'Cancelled', address: '789 King St W, Toronto ON M5V 2W4, CA', paymentMethod: 'Net 30', notes: 'Customer cancelled due to budget freeze.', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 2, unitPrice: 600, total: 1200 }, { sku: 'NX-SUPPORT-P2', name: 'P2 Support Add-on', qty: 1, unitPrice: 1000, total: 1000 }] },
    { id: 'SO-47590', date: '2025-06-10', customer: 'Stark Industries', customerId: 'stark-industries', amount: 29700.00, status: 'Delivered', address: '10880 Malibu Point, Malibu CA 90265, US', paymentMethod: 'Net 30', trackingNumber: 'FEDEX-SI4H8N5M', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 1, unitPrice: 28000, total: 28000 }, { sku: 'NX-CONN-HUB', name: 'HubSpot Connector', qty: 1, unitPrice: 1700, total: 1700 }] },
    { id: 'SO-47488', date: '2025-06-10', customer: 'Acme Corp', customerId: 'acme-corp', amount: 18900.00, status: 'Delivered', address: '1600 Pennsylvania Ave, Washington DC 20500, US', paymentMethod: 'Net 30', trackingNumber: 'UPS-2A5B8C1D', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite (annual)', qty: 1, unitPrice: 28000, total: 28000 }] },
    { id: 'SO-47455', date: '2025-06-05', customer: 'Oceanic Airlines', customerId: 'oceanic-airlines', amount: 18000.00, status: 'Delivered', address: '123 Qantas Dr, Sydney NSW 2020, AU', paymentMethod: 'Net 30', trackingNumber: 'AUSPOST-OA6Y3Z', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 15, unitPrice: 800, total: 12000 }, { sku: 'NX-TRAINING', name: 'Training Workshop', qty: 2, unitPrice: 2250, total: 4500 }, { sku: 'NX-MAINT-1Y', name: 'Maintenance 1Y', qty: 1, unitPrice: 1500, total: 1500 }] },
    { id: 'SO-47400', date: '2025-06-01', customer: 'Wayne Enterprises', customerId: 'wayne-enterprises', amount: 62000.00, status: 'Delivered', address: '1007 Mountain Drive, Gotham, US', paymentMethod: 'Net 60', trackingNumber: 'FEDEX-WE2Z7K1R', items: [{ sku: 'NX-ENT-SUITE', name: 'Enterprise Suite', qty: 2, unitPrice: 28000, total: 56000 }, { sku: 'NX-USERS-50', name: 'User Pack 50', qty: 1, unitPrice: 4500, total: 4500 }, { sku: 'NX-SUPPORT-P1', name: 'P1 Support', qty: 1, unitPrice: 1500, total: 1500 }] },
    { id: 'SO-47310', date: '2025-05-25', customer: 'Stagg Enterprises', customerId: 'stagg-enterprises', amount: 3600.00, status: 'Delivered', address: '233 N Michigan Ave, Chicago IL 60601, US', paymentMethod: 'Net 30', trackingNumber: 'UPS-ST5H3N7P', items: [{ sku: 'NX-CONN-SAP', name: 'SAP Connector', qty: 3, unitPrice: 1200, total: 3600 }] },
    { id: 'SO-47250', date: '2025-05-20', customer: 'Wernham Hogg', customerId: 'wernham-hogg', amount: 3750.00, status: 'Delivered', address: 'Units 1-4 Slough Trading Estate, Slough SL1 4PH, UK', paymentMethod: 'Credit Card', trackingNumber: 'DHL-WH7R2N5K', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 3, unitPrice: 600, total: 1800 }, { sku: 'NX-IMPL-BASIC', name: 'Implementation', qty: 1, unitPrice: 1950, total: 1950 }] },
    { id: 'SO-47100', date: '2025-05-10', customer: 'Soylent Corp', customerId: 'soylent-corp', amount: 8950.00, status: 'Delivered', address: '123 George St, Sydney NSW 2000, AU', paymentMethod: 'Net 30', trackingNumber: 'AUSPOST-SC3M8X', items: [{ sku: 'NX-CDM-PRO', name: 'CDM Pro License', qty: 5, unitPrice: 800, total: 4000 }, { sku: 'NX-CONN-SF', name: 'Salesforce Connector', qty: 1, unitPrice: 2400, total: 2400 }, { sku: 'NX-TRAINING', name: 'Training', qty: 1, unitPrice: 2250, total: 2250 }, { sku: 'NX-SUPPORT-P2', name: 'P2 Support', qty: 1, unitPrice: 300, total: 300 }] },
    { id: 'SO-47050', date: '2025-05-05', customer: 'Bluth Company', customerId: 'bluth-company', amount: 1800.00, status: 'Delivered', address: '71 Pier Walk, Newport Beach CA 92663, US', paymentMethod: 'Credit Card', trackingNumber: 'FEDEX-BC4K9N2R', items: [{ sku: 'NX-CDM-STD', name: 'CDM Standard License', qty: 3, unitPrice: 600, total: 1800 }] },
  ];
  await (ordersRepo.save as Function)(orders);
  console.log(`✓ orders (${orders.length})`);

  // ── Approvals ─────────────────────────────────────────────────────────────
  const approvalsRepo = ds.getRepository(Approval);
  await approvalsRepo.clear();
  await approvalsRepo.save([
    { type: 'schema-change', icon: '🗂️', title: 'Schema Change Request', category: 'CDM Update', details: 'Add nullable `loyalty_tier` (VARCHAR 20) to `customer_master`', description: 'Required for Q3 loyalty programme launch. Backward-compatible.', isHighPriority: true, canReject: true, status: 'pending' },
    { type: 'new-connector', icon: '🔌', title: 'New Data Source', category: 'Connector Activation', details: 'Activate SAP S/4HANA connector for Umbrella Ltd tenant', description: 'Tenant provisioned but connector not yet live. Customer is waiting.', isHighPriority: true, canReject: false, status: 'pending' },
    { type: 'access-request', icon: '🔐', title: 'Elevated Access Request', category: 'Security', details: 'Grant `data-steward` role to dev.patel@nexus.io', description: 'Required to support Globex onboarding project for next 30 days.', isHighPriority: false, canReject: true, status: 'pending' },
    { type: 'field-mapping', icon: '🔄', title: 'Field Mapping Override', category: 'Data Mapping', details: 'Override `order_date` → `transaction_date` for Soylent Corp feed', description: 'Source system uses non-standard column name. Mapping fix needed.', isHighPriority: false, canReject: true, status: 'pending' },
    { type: 'schema-change', icon: '🗂️', title: 'CDM Field Deprecation', category: 'CDM Update', details: 'Deprecate `fax_number` field across all customer entities', description: 'Fax number field is unused (0% fill rate). Safe to deprecate.', isHighPriority: false, canReject: true, status: 'pending' },
    { type: 'new-connector', icon: '🔌', title: 'Snowflake Connector Request', category: 'Connector Activation', details: 'Activate Snowflake Data Cloud connector for Wayne Enterprises', description: 'Customer migrating analytics DW to Snowflake by end of Q3.', isHighPriority: true, canReject: false, status: 'pending' },
  ]);
  console.log('✓ approvals');

  // ── Connectors ────────────────────────────────────────────────────────────
  const connRepo = ds.getRepository(Connector);
  await connRepo.clear();
  await (connRepo.save as Function)([
    { id: 'sf-prod', name: 'Salesforce Production', type: 'salesforce', host: 'nexus.my.salesforce.com', secretPath: 'secret/salesforce/prod', status: 'active', lastSync: new Date(Date.now() - 3 * 60000), records: 142850, tenantId: 'acme-corp' },
    { id: 'sap-umb', name: 'SAP S/4HANA – Umbrella', type: 'sap', host: 'sap-prod.umbrella.co.uk', port: 3300, dbName: 'PRD', secretPath: 'secret/sap/umbrella', status: 'syncing', lastSync: new Date(Date.now() - 25 * 60000), records: 98432, tenantId: 'umbrella-ltd' },
    { id: 'pg-analytics', name: 'Analytics PostgreSQL', type: 'postgresql', host: 'analytics-db.nexus.internal', port: 5432, dbName: 'analytics', secretPath: 'secret/postgres/analytics', status: 'error', lastSync: new Date(Date.now() - 2 * 3600000), records: 0, tenantId: null },
    { id: 'hubspot-stark', name: 'HubSpot – Stark Industries', type: 'hubspot', host: 'api.hubapi.com', secretPath: 'secret/hubspot/stark', status: 'active', lastSync: new Date(Date.now() - 15 * 60000), records: 54200, tenantId: 'stark-industries' },
    { id: 'sql-wayne', name: 'SQL Server – Wayne Enterprises', type: 'mssql', host: 'sql01.wayne-enterprises.internal', port: 1433, dbName: 'WE_ERP', secretPath: 'secret/mssql/wayne', status: 'active', lastSync: new Date(Date.now() - 5 * 60000), records: 221800, tenantId: 'wayne-enterprises' },
  ]);
  console.log('✓ connectors');

  // ── Schemas ───────────────────────────────────────────────────────────────
  const schemasRepo = ds.getRepository(Schema);
  await schemasRepo.clear();
  await (schemasRepo.save as Function)([
    { connectorId: 'sf-prod', connectorName: 'Salesforce Production', tables: 14, columns: 187, snapshot: new Date(Date.now() - 3 * 60000), drift: 'none', status: 'current' },
    { connectorId: 'sap-umb', connectorName: 'SAP S/4HANA – Umbrella', tables: 31, columns: 412, snapshot: new Date(Date.now() - 2 * 3600000), drift: 'minor', status: 'needs-reprofiling' },
    { connectorId: 'pg-analytics', connectorName: 'Analytics PostgreSQL', tables: 8, columns: 94, snapshot: new Date(Date.now() - 48 * 3600000), drift: 'major', status: 'stale' },
    { connectorId: 'hubspot-stark', connectorName: 'HubSpot – Stark Industries', tables: 9, columns: 118, snapshot: new Date(Date.now() - 10 * 60000), drift: 'none', status: 'current' },
    { connectorId: 'sql-wayne', connectorName: 'SQL Server – Wayne Enterprises', tables: 47, columns: 634, snapshot: new Date(Date.now() - 45 * 60000), drift: 'minor', status: 'needs-reprofiling' },
  ]);
  console.log('✓ schemas');

  // ── Audit logs ────────────────────────────────────────────────────────────
  const auditRepo = ds.getRepository(AuditLog);
  await auditRepo.clear();
  await auditRepo.save([
    { actor: 'alice@nexus.io', action: 'LOGIN', entity: 'User', detail: 'Successful login', result: 'success', severity: 'info', ipAddress: '192.168.1.10' },
    { actor: 'alice@nexus.io', action: 'APPROVE', entity: 'Approval', entityId: '1', detail: 'Approved schema change for Q3', result: 'success', severity: 'info', ipAddress: '192.168.1.10' },
    { actor: 'bob@nexus.io', action: 'LOGIN', entity: 'User', detail: 'Successful login', result: 'success', severity: 'info', ipAddress: '192.168.1.22' },
    { actor: 'bob@nexus.io', action: 'SYNC_TRIGGER', entity: 'Connector', entityId: 'sf-prod', detail: 'Manual sync triggered on Salesforce Production', result: 'success', severity: 'info', ipAddress: '192.168.1.22' },
    { actor: 'system', action: 'SYNC_ERROR', entity: 'Connector', entityId: 'pg-analytics', detail: 'Connection refused on port 5432', result: 'failure', severity: 'critical' },
    { actor: 'alice@nexus.io', action: 'ORDER_SHIPPED', entity: 'Order', entityId: 'SO-48187', detail: 'Order SO-48187 marked as shipped (UPS-7G3H2K9L)', result: 'success', severity: 'info', ipAddress: '192.168.1.10' },
    { actor: 'clara@nexus.io', action: 'LOGIN', entity: 'User', detail: 'Successful login', result: 'success', severity: 'info', ipAddress: '10.0.1.45' },
    { actor: 'unknown', action: 'LOGIN_FAILED', entity: 'User', detail: 'Invalid credentials for admin@nexus.io (3 attempts)', result: 'failure', severity: 'warning', ipAddress: '203.0.113.42' },
    { actor: 'alice@nexus.io', action: 'ORDER_CANCELLED', entity: 'Order', entityId: 'SO-47621', detail: 'Order SO-47621 cancelled — budget freeze', result: 'success', severity: 'warning', ipAddress: '192.168.1.10' },
    { actor: 'bob@nexus.io', action: 'SCHEMA_UPDATED', entity: 'Schema', entityId: 'sap-umb', detail: 'Schema reprofiling completed for SAP S/4HANA – Umbrella', result: 'success', severity: 'info', ipAddress: '192.168.1.22' },
    { actor: 'system', action: 'RATE_LIMIT_EXCEEDED', entity: 'API', detail: 'Rate limit exceeded from IP 198.51.100.7 (152 req/min)', result: 'blocked', severity: 'warning', ipAddress: '198.51.100.7' },
    { actor: 'alice@nexus.io', action: 'USER_CREATED', entity: 'User', detail: 'New user priya@nexus.io created with role business-analyst', result: 'success', severity: 'info', ipAddress: '192.168.1.10' },
    { actor: 'alice@nexus.io', action: 'APPROVE', entity: 'Approval', entityId: '2', detail: 'SAP connector activation approved for Umbrella Ltd', result: 'success', severity: 'info', ipAddress: '192.168.1.10' },
    { actor: 'system', action: 'BACKUP_COMPLETED', entity: 'System', detail: 'Full database backup completed (4.2 GB)', result: 'success', severity: 'info' },
    { actor: 'bob@nexus.io', action: 'FIELD_MAPPING_UPDATED', entity: 'FieldMapping', entityId: 'fm-034', detail: 'Updated order_date → transaction_date mapping for Soylent Corp', result: 'success', severity: 'info', ipAddress: '192.168.1.22' },
    { actor: 'system', action: 'SYNC_COMPLETED', entity: 'Connector', entityId: 'sf-prod', detail: 'Sync completed: 1,248 records updated, 0 errors', result: 'success', severity: 'info' },
    { actor: 'clara@nexus.io', action: 'REPORT_EXPORTED', entity: 'Report', detail: 'Q2 Revenue report exported as PDF by clara@nexus.io', result: 'success', severity: 'info', ipAddress: '10.0.1.45' },
    { actor: 'alice@nexus.io', action: 'CUSTOMER_UPDATED', entity: 'Customer', entityId: 'bluth-company', detail: 'Customer bluth-company status changed from Active to At Risk', result: 'success', severity: 'warning', ipAddress: '192.168.1.10' },
    { actor: 'system', action: 'CERT_EXPIRY_ALERT', entity: 'System', detail: 'TLS certificate for analytics-db.nexus.internal expires in 14 days', result: 'warning', severity: 'warning' },
    { actor: 'bob@nexus.io', action: 'CONNECTOR_RESTARTED', entity: 'Connector', entityId: 'pg-analytics', detail: 'Connector pg-analytics restarted after error recovery', result: 'success', severity: 'info', ipAddress: '192.168.1.22' },
    { actor: 'alice@nexus.io', action: 'TOTP_ENABLED', entity: 'User', detail: '2FA enabled for alice@nexus.io', result: 'success', severity: 'info', ipAddress: '192.168.1.10' },
    { actor: 'system', action: 'HEALTH_CHECK_FAIL', entity: 'System', detail: 'DB ping timeout exceeded 500ms threshold', result: 'failure', severity: 'critical' },
  ]);
  console.log('✓ audit logs (22)');

  // ── Tenants ────────────────────────────────────────────────────────────────
  const tenantsRepo = ds.getRepository(Tenant);
  await tenantsRepo.clear();
  await tenantsRepo.save([
    { id: 'acme-corp', name: 'Acme Corp', plan: 'enterprise', status: 'active', connectors: 3, cdmVersion: '1.3' },
    { id: 'umbrella-ltd', name: 'Umbrella Ltd', plan: 'enterprise', status: 'active', connectors: 2, cdmVersion: '1.3' },
    { id: 'globex-inc', name: 'Globex Inc', plan: 'professional', status: 'active', connectors: 1, cdmVersion: '1.2' },
    { id: 'veridian', name: 'Veridian Dynamics', plan: 'enterprise', status: 'active', connectors: 2, cdmVersion: '1.3' },
    { id: 'wayne-enterprises', name: 'Wayne Enterprises', plan: 'enterprise', status: 'active', connectors: 4, cdmVersion: '1.3' },
    { id: 'stark-industries', name: 'Stark Industries', plan: 'enterprise', status: 'active', connectors: 3, cdmVersion: '1.3' },
    { id: 'soylent-corp', name: 'Soylent Corp', plan: 'professional', status: 'active', connectors: 2, cdmVersion: '1.2' },
    { id: 'demo-tenant', name: 'Demo Tenant', plan: 'sandbox', status: 'active', connectors: 0, cdmVersion: '1.3' },
  ]);
  console.log('✓ tenants');

  // ── CDM Versions ──────────────────────────────────────────────────────────
  const cdmRepo = ds.getRepository(CdmVersion);
  await cdmRepo.clear();
  await cdmRepo.save([
    { version: '1.0', status: 'retired', changes: 'Initial CDM schema — core customer and order entities', publishedBy: 'alice@nexus.io' },
    { version: '1.1', status: 'retired', changes: 'Added loyalty_tier, segment fields; deprecated fax_number', publishedBy: 'alice@nexus.io' },
    { version: '1.2', status: 'deprecated', changes: 'Multi-currency support, address normalisation improvements, product catalogue entity', publishedBy: 'bob@nexus.io' },
    { version: '1.3', status: 'active', changes: 'Connector metadata, real-time CDC flags, order line items schema, GDPR consent fields', publishedBy: 'alice@nexus.io' },
  ]);
  console.log('✓ CDM versions');

  // ── Governance Proposals ──────────────────────────────────────────────────
  // These simulate proposals created by M2 Structural Agent (confidence 0.70–0.90)
  const proposalsRepo = ds.getRepository(GovernanceProposal);
  await proposalsRepo.clear();
  await proposalsRepo.save([
    {
      tenantId: 'acme-corp', proposalType: 'mapping_confidence_review',
      sourceSystem: 'postgresql', sourceTable: 'sales.SalesOrderHeader', sourceField: 'CustomerID',
      cdmEntity: 'party', cdmField: 'party_id', confidence: 0.92,
      justification: 'CustomerID is a foreign key referencing customer master table — maps to CDM party_id with high confidence.',
    },
    {
      tenantId: 'acme-corp', proposalType: 'mapping_confidence_review',
      sourceSystem: 'postgresql', sourceTable: 'sales.SalesOrderDetail', sourceField: 'UnitPrice',
      cdmEntity: 'transaction', cdmField: 'transaction_amount', confidence: 0.88,
      justification: 'UnitPrice represents the monetary value of a transaction line — maps to CDM transaction_amount (Tier 2: currency context unresolved).',
    },
    {
      tenantId: 'acme-corp', proposalType: 'mapping_confidence_review',
      sourceSystem: 'postgresql', sourceTable: 'production.Product', sourceField: 'ListPrice',
      cdmEntity: 'product', cdmField: 'product_price', confidence: 0.84,
      justification: 'ListPrice is the catalogue retail price — maps to CDM product_price. Note: StandardCost may be preferred in some contexts.',
    },
    {
      tenantId: 'acme-corp', proposalType: 'mapping_confidence_review',
      sourceSystem: 'salesforce', sourceTable: 'Opportunity', sourceField: 'CloseDate',
      cdmEntity: 'transaction', cdmField: 'event_timestamp', confidence: 0.85,
      justification: 'CloseDate represents the expected transaction closure date — mapped to CDM event_timestamp. Verify if actual or planned.',
    },
    {
      tenantId: 'acme-corp', proposalType: 'mapping_confidence_review',
      sourceSystem: 'salesforce', sourceTable: 'Account', sourceField: 'BillingCountry',
      cdmEntity: 'party', cdmField: 'party_country', confidence: 0.83,
      justification: 'BillingCountry maps to CDM party_country. ISO 3166 normalisation required (source contains free-text values).',
    },
    {
      tenantId: 'umbrella-ltd', proposalType: 'cdm_interpretation',
      sourceSystem: 'sap', sourceTable: 'KNVV', sourceField: 'KUNNR',
      cdmEntity: 'party', cdmField: 'party_id', confidence: 0.91,
      justification: 'SAP KUNNR (customer number) in KNVV (customer sales data) — standard SAP key, maps to CDM party_id with high confidence.',
    },
    {
      tenantId: 'umbrella-ltd', proposalType: 'mapping_confidence_review',
      sourceSystem: 'sap', sourceTable: 'VBAK', sourceField: 'NETWR',
      cdmEntity: 'transaction', cdmField: 'transaction_amount', confidence: 0.89,
      justification: 'SAP VBAK.NETWR (net order value) maps to CDM transaction_amount. Currency in WAERK field should be extracted jointly.',
    },
    {
      tenantId: 'wayne-enterprises', proposalType: 'mapping_confidence_review',
      sourceSystem: 'mssql', sourceTable: 'sales.SalesOrderHeader', sourceField: 'OrderDate',
      cdmEntity: 'transaction', cdmField: 'transaction_date', confidence: 0.87,
      justification: 'OrderDate is the transaction initiation date — maps to CDM transaction_date. Consider using ShipDate as event_timestamp instead.',
    },
  ]);
  console.log('✓ governance proposals (8)');

  // ── Mapping Reviews (Tier 2 & Tier 3) ────────────────────────────────────
  const mappingReviewRepo = ds.getRepository(MappingReview);
  await mappingReviewRepo.clear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mappingReviewRepo.save(<any[]>[
    // Tier 2 — apply + flag for human review
    {
      tenantId: 'acme-corp', sourceSystem: 'postgresql',
      sourceTable: 'sales.SalesTerritory', sourceField: 'Name',
      cdmEntity: 'party', suggestedCdmField: 'territory_name',
      confidence: 0.82, tier: 2,
    },
    {
      tenantId: 'acme-corp', sourceSystem: 'postgresql',
      sourceTable: 'production.Location', sourceField: 'Name',
      cdmEntity: 'party', suggestedCdmField: 'location_name',
      confidence: 0.81, tier: 2,
    },
    {
      tenantId: 'acme-corp', sourceSystem: 'salesforce',
      sourceTable: 'Contact', sourceField: 'Email',
      cdmEntity: 'party', suggestedCdmField: 'party_email',
      confidence: 0.91, tier: 2,
    },
    {
      tenantId: 'acme-corp', sourceSystem: 'postgresql',
      sourceTable: 'hrm.Employee', sourceField: 'JobTitle',
      cdmEntity: 'employee', suggestedCdmField: 'employee_title',
      confidence: 0.78, tier: 2,
    },
    {
      tenantId: 'umbrella-ltd', sourceSystem: 'sap',
      sourceTable: 'BKPF', sourceField: 'BUKRS',
      cdmEntity: 'party', suggestedCdmField: 'company_code',
      confidence: 0.76, tier: 2,
    },
    // Tier 3 — no sufficient mapping, needs full review
    {
      tenantId: 'acme-corp', sourceSystem: 'postgresql',
      sourceTable: 'sales.SalesOrderHeader', sourceField: 'CreditCardApprovalCode',
      cdmEntity: null, suggestedCdmField: null,
      confidence: 0.0, tier: 3,
    },
    {
      tenantId: 'acme-corp', sourceSystem: 'servicenow',
      sourceTable: 'incident', sourceField: 'u_custom_priority_override',
      cdmEntity: 'incident', suggestedCdmField: null,
      confidence: 0.31, tier: 3,
    },
    {
      tenantId: 'wayne-enterprises', sourceSystem: 'mssql',
      sourceTable: 'WE_ERP.dbo.SpecialOrders', sourceField: 'bat_cave_location',
      cdmEntity: null, suggestedCdmField: null,
      confidence: 0.0, tier: 3,
    },
  ]);
  console.log('✓ mapping reviews (8)');

  await ds.destroy();
  console.log('\n✅  Seed complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
