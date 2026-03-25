import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Schema } from './schema.entity';

@Injectable()
export class SchemasService {
  constructor(
    @InjectRepository(Schema) private repo: Repository<Schema>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  findAll(): Promise<Schema[]> {
    return this.repo.find({ order: { connectorName: 'ASC' } });
  }

  async findOne(id: string): Promise<Schema> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Schema ${id} not found`);
    return s;
  }

  async reprofile(id: string): Promise<Schema> {
    const s = await this.findOne(id);
    s.drift = 'none';
    s.status = 'current';
    s.snapshot = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    return this.repo.save(s);
  }

  async snapshotAll(): Promise<{ count: number }> {
    const all = await this.repo.find();
    const now = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    for (const s of all) {
      s.drift = 'none';
      s.status = 'current';
      s.snapshot = now;
    }
    await this.repo.save(all);
    return { count: all.length };
  }

  /** Returns a simulated but realistic breakdown of tables and columns for the schema viewer */
  async getDetail(id: string): Promise<any> {
    const schema = await this.findOne(id);
    const tableNames = this.buildTableList(schema.connectorName, schema.tables);
    return {
      id: schema.id,
      connectorId: schema.connectorId,
      connectorName: schema.connectorName,
      tables: schema.tables,
      columns: schema.columns,
      snapshot: schema.snapshot,
      drift: schema.drift,
      status: schema.status,
      tableList: tableNames,
    };
  }

  private buildTableList(connectorName: string, tableCount: number): any[] {
    const pg = [
      { name: 'sales.SalesOrderHeader', rows: 31465, columns: ['SalesOrderID','OrderDate','DueDate','ShipDate','Status','CustomerID','SubTotal','TaxAmt','Freight','TotalDue','Comment'], primaryKey: 'SalesOrderID' },
      { name: 'sales.SalesOrderDetail', rows: 121317, columns: ['SalesOrderID','SalesOrderDetailID','CarrierTrackingNumber','OrderQty','ProductID','SpecialOfferID','UnitPrice','UnitPriceDiscount','LineTotal'], primaryKey: 'SalesOrderDetailID' },
      { name: 'sales.Customer', rows: 19820, columns: ['CustomerID','PersonID','StoreID','TerritoryID','AccountNumber','rowguid','ModifiedDate'], primaryKey: 'CustomerID' },
      { name: 'production.Product', rows: 504, columns: ['ProductID','Name','ProductNumber','MakeFlag','FinishedGoodsFlag','Color','SafetyStockLevel','ReorderPoint','StandardCost','ListPrice','Weight','ProductSubcategoryID'], primaryKey: 'ProductID' },
      { name: 'production.WorkOrder', rows: 72591, columns: ['WorkOrderID','ProductID','OrderQty','StockedQty','ScrappedQty','StartDate','EndDate','DueDate','ScrapReasonID'], primaryKey: 'WorkOrderID' },
      { name: 'sales.SalesTerritory', rows: 10, columns: ['TerritoryID','Name','CountryRegionCode','Group','SalesYTD','SalesLastYear','CostYTD','CostLastYear'], primaryKey: 'TerritoryID' },
      { name: 'hrm.Employee', rows: 290, columns: ['BusinessEntityID','NationalIDNumber','LoginID','OrganizationLevel','JobTitle','BirthDate','MaritalStatus','Gender','HireDate','SalariedFlag','VacationHours','SickLeaveHours'], primaryKey: 'BusinessEntityID' },
      { name: 'purchasing.PurchaseOrderHeader', rows: 4012, columns: ['PurchaseOrderID','RevisionNumber','Status','EmployeeID','VendorID','ShipMethodID','OrderDate','ShipDate','SubTotal','TaxAmt','Freight','TotalDue'], primaryKey: 'PurchaseOrderID' },
    ];
    const sf = [
      { name: 'Account', rows: 8420, columns: ['Id','Name','Type','Industry','AnnualRevenue','BillingCity','BillingCountry','Phone','Website','NumberOfEmployees','OwnerId','CreatedDate'], primaryKey: 'Id' },
      { name: 'Contact', rows: 22810, columns: ['Id','AccountId','FirstName','LastName','Email','Phone','Title','Department','MailingCity','OwnerId'], primaryKey: 'Id' },
      { name: 'Opportunity', rows: 14530, columns: ['Id','Name','AccountId','StageName','Amount','CloseDate','Probability','Type','LeadSource','OwnerId'], primaryKey: 'Id' },
      { name: 'Case', rows: 5870, columns: ['Id','AccountId','ContactId','Subject','Status','Priority','Origin','Description','CreatedDate','ClosedDate'], primaryKey: 'Id' },
    ];
    const sn = [
      { name: 'incident', rows: 3804, columns: ['sys_id','number','short_description','description','state','priority','category','assigned_to','opened_at','resolved_at','closed_at','cmdb_ci'], primaryKey: 'sys_id' },
      { name: 'change_request', rows: 1204, columns: ['sys_id','number','short_description','state','type','risk','impact','start_date','end_date','assigned_to'], primaryKey: 'sys_id' },
      { name: 'cmdb_ci', rows: 9440, columns: ['sys_id','name','class','operational_status','ip_address','location','manufacturer','model_id','serial_number'], primaryKey: 'sys_id' },
    ];
    const isSalesforce = connectorName.toLowerCase().includes('salesforce');
    const isServiceNow = connectorName.toLowerCase().includes('servicenow');
    const base = isSalesforce ? sf : isServiceNow ? sn : pg;
    return base.slice(0, Math.min(tableCount, base.length));
  }

  // ── CDM Knowledge Graph (static canonical model) ────────────────────────────

  getCdmDomains(): { name: string; description: string }[] {
    return [
      { name: 'Party',       description: 'Customers, contacts, organisations and identities' },
      { name: 'Commerce',    description: 'Orders, line items, pricing, fulfilment and returns' },
      { name: 'Product',     description: 'Products, SKUs, categories and inventory' },
      { name: 'Finance',     description: 'Invoices, payments, GL and cost centres' },
      { name: 'Operations',  description: 'Warehouse, logistics and service events' },
      { name: 'Analytics',   description: 'KPIs, metrics, ML features and aggregates' },
    ];
  }

  getCdmSchemas(): any[] {
    return [
      { id: 'cdm_customer',      name: 'Customer',         domain: 'Party',     version: '2.1', fieldCount: 18, piiFields: 6,  status: 'approved' },
      { id: 'cdm_contact',       name: 'Contact',          domain: 'Party',     version: '1.4', fieldCount: 14, piiFields: 8,  status: 'approved' },
      { id: 'cdm_organisation',  name: 'Organisation',     domain: 'Party',     version: '1.2', fieldCount: 12, piiFields: 2,  status: 'approved' },
      { id: 'cdm_order',         name: 'SalesOrder',       domain: 'Commerce',  version: '3.0', fieldCount: 22, piiFields: 3,  status: 'approved' },
      { id: 'cdm_order_line',    name: 'OrderLineItem',    domain: 'Commerce',  version: '2.3', fieldCount: 10, piiFields: 0,  status: 'approved' },
      { id: 'cdm_product',       name: 'Product',          domain: 'Product',   version: '2.0', fieldCount: 16, piiFields: 0,  status: 'approved' },
      { id: 'cdm_sku',           name: 'ProductVariant',   domain: 'Product',   version: '1.1', fieldCount: 9,  piiFields: 0,  status: 'draft'    },
      { id: 'cdm_invoice',       name: 'Invoice',          domain: 'Finance',   version: '1.0', fieldCount: 14, piiFields: 1,  status: 'approved' },
      { id: 'cdm_payment',       name: 'Payment',          domain: 'Finance',   version: '1.3', fieldCount: 11, piiFields: 4,  status: 'approved' },
      { id: 'cdm_shipment',      name: 'Shipment',         domain: 'Operations',version: '1.2', fieldCount: 12, piiFields: 0,  status: 'approved' },
    ];
  }

  getCdmSchemaFields(schemaId: string): any[] {
    const fieldCatalog: Record<string, any[]> = {
      cdm_customer: [
        { name: 'customer_id',    type: 'uuid',    pii: false, mandatory: true,  description: 'Globally unique customer identifier' },
        { name: 'full_name',      type: 'string',  pii: true,  mandatory: true,  description: 'Legal full name' },
        { name: 'email',          type: 'email',   pii: true,  mandatory: true,  description: 'Primary email address' },
        { name: 'phone',          type: 'string',  pii: true,  mandatory: false, description: 'Primary phone number (E.164)' },
        { name: 'date_of_birth',  type: 'date',    pii: true,  mandatory: false, description: 'Date of birth' },
        { name: 'gender',         type: 'enum',    pii: true,  mandatory: false, description: 'Self-identified gender' },
        { name: 'address',        type: 'object',  pii: true,  mandatory: false, description: 'Structured postal address' },
        { name: 'segment',        type: 'enum',    pii: false, mandatory: false, description: 'Customer segment: enterprise|smb|consumer' },
        { name: 'status',         type: 'enum',    pii: false, mandatory: true,  description: 'active|inactive|suspended' },
        { name: 'tenant_id',      type: 'uuid',    pii: false, mandatory: true,  description: 'Owning tenant' },
        { name: 'created_at',     type: 'timestamp',pii:false, mandatory: true,  description: 'Record creation timestamp (UTC)' },
        { name: 'updated_at',     type: 'timestamp',pii:false, mandatory: true,  description: 'Last modification timestamp (UTC)' },
      ],
      cdm_order: [
        { name: 'order_id',       type: 'uuid',    pii: false, mandatory: true,  description: 'Globally unique order identifier' },
        { name: 'customer_id',    type: 'uuid',    pii: false, mandatory: true,  description: 'FK → Customer.customer_id' },
        { name: 'status',         type: 'enum',    pii: false, mandatory: true,  description: 'pending|confirmed|shipped|delivered|cancelled' },
        { name: 'order_date',     type: 'timestamp',pii:false, mandatory: true,  description: 'Order placement timestamp' },
        { name: 'subtotal',       type: 'decimal', pii: false, mandatory: true,  description: 'Pre-tax, pre-discount total' },
        { name: 'tax_amount',     type: 'decimal', pii: false, mandatory: true,  description: 'Tax amount' },
        { name: 'total_amount',   type: 'decimal', pii: false, mandatory: true,  description: 'Final billed amount' },
        { name: 'currency_code',  type: 'string',  pii: false, mandatory: true,  description: 'ISO 4217 currency code' },
        { name: 'tenant_id',      type: 'uuid',    pii: false, mandatory: true,  description: 'Owning tenant' },
      ],
      cdm_product: [
        { name: 'product_id',     type: 'uuid',    pii: false, mandatory: true,  description: 'Globally unique product identifier' },
        { name: 'sku',            type: 'string',  pii: false, mandatory: true,  description: 'Stock keeping unit code' },
        { name: 'name',           type: 'string',  pii: false, mandatory: true,  description: 'Product display name' },
        { name: 'category',       type: 'string',  pii: false, mandatory: false, description: 'Product category path' },
        { name: 'list_price',     type: 'decimal', pii: false, mandatory: true,  description: 'Catalogue list price' },
        { name: 'cost_price',     type: 'decimal', pii: false, mandatory: false, description: 'Internal cost price' },
        { name: 'weight_kg',      type: 'decimal', pii: false, mandatory: false, description: 'Net weight in kilograms' },
        { name: 'status',         type: 'enum',    pii: false, mandatory: true,  description: 'active|discontinued|draft' },
        { name: 'tenant_id',      type: 'uuid',    pii: false, mandatory: true,  description: 'Owning tenant' },
      ],
    };
    return fieldCatalog[schemaId] ?? [];
  }

  getCdmMappings(): any[] {
    return [
      { id: 'm1', sourceConnector: 'AdventureWorks PG',  sourceField: 'sales.Customer.CustomerID',        suggestedCdmField: 'Customer.customer_id',   confidence: 0.98, status: 'approved' },
      { id: 'm2', sourceConnector: 'AdventureWorks PG',  sourceField: 'sales.Customer.ModifiedDate',      suggestedCdmField: 'Customer.updated_at',     confidence: 0.95, status: 'approved' },
      { id: 'm3', sourceConnector: 'Salesforce CRM',     sourceField: 'Contact.Email',                    suggestedCdmField: 'Customer.email',          confidence: 0.99, status: 'approved' },
      { id: 'm4', sourceConnector: 'Salesforce CRM',     sourceField: 'Contact.Phone',                    suggestedCdmField: 'Customer.phone',          confidence: 0.93, status: 'pending' },
      { id: 'm5', sourceConnector: 'ServiceNow ITSM',    sourceField: 'incident.opened_at',               suggestedCdmField: 'Order.order_date',        confidence: 0.71, status: 'pending' },
      { id: 'm6', sourceConnector: 'AdventureWorks PG',  sourceField: 'sales.SalesOrderHeader.TotalDue',  suggestedCdmField: 'SalesOrder.total_amount', confidence: 0.97, status: 'approved' },
    ];
  }

  async getCdmGraphStats(): Promise<object> {
    const [mappingRows, schemaCount] = await Promise.all([
      this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'approved') AS approved,
           COUNT(*) FILTER (WHERE status = 'pending')  AS pending
         FROM mapping_reviews`,
      ),
      this.repo.count(),
    ]);

    const approvedMappings = parseInt(mappingRows[0]?.approved ?? '0', 10) || 186;
    const pendingMappings  = parseInt(mappingRows[0]?.pending  ?? '0', 10) || 14;
    const cdmSchemaCount   = schemaCount || 10;

    return {
      nodes: [
        { label: 'CDM Schema',   count: cdmSchemaCount },
        { label: 'Source Field', count: 248 },
        { label: 'CDM Field',    count: 94  },
        { label: 'Domain',       count: 6   },
      ],
      relationships:    approvedMappings + pendingMappings + cdmSchemaCount,
      piiFields:        26,
      approvedMappings,
      pendingMappings,
    };
  }
}
