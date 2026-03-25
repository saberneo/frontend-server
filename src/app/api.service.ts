import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, of, map, throwError } from 'rxjs';
import { environment } from '../environments/environment';

export interface NexusAiReasoningStep {
  step: string;
  status: 'completed' | 'running' | 'pending';
  detail: string;
}

export interface NexusAiResponse {
  reply: string;
  reasoning_trace: NexusAiReasoningStep[];
  model: string;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private kong = environment.kongUrl;

  // ── Kong API Gateway (M1 via Kong) ─────────────────────────────────────────
  /** Call M1 API through Kong Gateway (uses Okta Bearer token via interceptor) */
  getKongM1Health(): Observable<any> {
    return this.http.get<any>(`${this.kong}/api/v1/m1/api/v1/health`, {
      headers: { 'X-Tenant-ID': this.m1TenantId },
    }).pipe(catchError(() => of({ status: 'unreachable' })));
  }

  getKongM1Docs(): Observable<any> {
    return this.http.get<any>(`${this.kong}/api/v1/m1/api/v1/docs`, {
      headers: { 'X-Tenant-ID': this.m1TenantId },
    }).pipe(catchError(() => of(null)));
  }

  getKongM1Connectors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.kong}/api/v1/m1/api/v1/connectors`, {
      headers: { 'X-Tenant-ID': this.m1TenantId },
    }).pipe(catchError(() => of([])));
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  login(email: string, password: string): Observable<{ access_token: string; user: any }> {
    return this.http.post<{ access_token: string; user: any }>(`${this.base}/auth/login`, { email, password });
  }

  demoLogin(): Observable<{ access_token: string; user: any }> {
    return this.http.post<{ access_token: string; user: any }>(`${this.base}/auth/demo-login`, {});
  }

  // ── Orders ─────────────────────────────────────────────────────────────────
  getOrders(status?: string, customer?: string, page = 1, limit = 50): Observable<{ data: any[]; total: number; page: number; totalPages: number }> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (customer) params = params.set('customer', customer);
    params = params.set('page', page).set('limit', limit);
    return this.http.get<any>(`${this.base}/orders`, { params }).pipe(catchError(() => of({ data: [], total: 0, page: 1, totalPages: 0 })));
  }

  getOrder(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/orders/${id}`).pipe(catchError(() => of(null)));
  }

  getOrderStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/orders/stats`).pipe(catchError(() => of(null)));
  }

  updateOrderStatus(id: string, status: string, trackingNumber?: string): Observable<any> {
    return this.http.patch<any>(`${this.base}/orders/${id}/status`, { status, trackingNumber }).pipe(catchError(() => of(null)));
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  getCustomers(search?: string, status?: string, segment?: string, page = 1, limit = 50): Observable<{ data: any[]; total: number; page: number; totalPages: number }> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (segment) params = params.set('segment', segment);
    params = params.set('page', page).set('limit', limit);
    return this.http.get<any>(`${this.base}/customers`, { params }).pipe(catchError(() => of({ data: [], total: 0, page: 1, totalPages: 0 })));
  }

  getCustomer(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/customers/${id}`).pipe(catchError(() => of(null)));
  }

  getCustomerOrders(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/customers/${id}/orders`).pipe(catchError(() => of([])));
  }

  // ── Approvals ──────────────────────────────────────────────────────────────
  getPendingApprovals(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/approvals/pending`).pipe(catchError(() => of([])));
  }

  getApprovalStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/approvals/stats`).pipe(catchError(() => of(null)));
  }

  resolveApproval(id: number, action: 'approved' | 'rejected', comment?: string): Observable<any> {
    return this.http.patch<any>(`${this.base}/approvals/${id}/resolve`, { action, comment }).pipe(catchError(() => of(null)));
  }

  resolveAllApprovals(): Observable<any> {
    return this.http.post<any>(`${this.base}/approvals/resolve-all`, {}).pipe(catchError(() => of(null)));
  }

  // ── Connectors ──────────────────────────────────────────────────────────────
  getConnectors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/connectors`).pipe(catchError(() => of([])));
  }

  updateConnector(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/connectors/${id}`, data).pipe(catchError(() => of(null)));
  }

  createConnector(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/connectors`, data).pipe(catchError(() => of(null)));
  }

  triggerSync(id: string): Observable<any> {
    return this.http.post<any>(`${this.base}/connectors/${id}/sync`, {}).pipe(catchError(() => of(null)));
  }

  deleteConnector(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/connectors/${id}`).pipe(catchError(() => of(null)));
  }

  getConnectorSyncJobs(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/connectors/${id}/sync-jobs`).pipe(catchError(() => of([])));
  }

  // ── Schemas ─────────────────────────────────────────────────────────────────
  getSchemas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/schemas`).pipe(catchError(() => of([])));
  }

  getSchemaDetail(id: string): Observable<any> {
    return this.http.get<any>(`${this.base}/schemas/${id}/tables`).pipe(catchError(() => of(null)));
  }

  reprofileSchema(id: string): Observable<any> {
    return this.http.patch<any>(`${this.base}/schemas/${id}/reprofile`, {}).pipe(catchError(() => of(null)));
  }

  snapshotAllSchemas(): Observable<any> {
    return this.http.post<any>(`${this.base}/schemas/snapshot-all`, {}).pipe(catchError(() => of(null)));
  }

  // ── Users ────────────────────────────────────────────────────────────────────
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/users`).pipe(catchError(() => of([])));
  }

  createUser(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/users`, data).pipe(catchError(() => of(null)));
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/users/${id}`, data).pipe(catchError(() => of(null)));
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/users/${id}`).pipe(catchError(() => of(null)));
  }

  // ── Audit ────────────────────────────────────────────────────────────────────
  getAuditLogs(limit = 50, page = 1): Observable<{ data: any[]; total: number; page: number; totalPages: number }> {
    const params = new HttpParams().set('limit', limit).set('page', page);
    return this.http.get<any>(`${this.base}/audit`, { params }).pipe(catchError(() => of({ data: [], total: 0, page: 1, totalPages: 0 })));
  }

  logGovernanceAction(action: string, sourceField: string, cdmField: string): Observable<any> {
    return this.http.post<any>(`${this.base}/audit/governance-action`, { action, sourceField, cdmField }).pipe(catchError(() => of(null)));
  }

  // ── System Health ────────────────────────────────────────────────────────────
  getSystemHealth(): Observable<any> {
    return this.http.get<any>(`${this.base}/system-health`).pipe(catchError(() => of(null)));
  }

  // ── Data Health ──────────────────────────────────────────────────────────────
  getDataHealth(): Observable<{ stats: any; sources: any[]; issues: any[] }> {
    return this.http.get<any>(`${this.base}/data-health`).pipe(
      catchError(() => of({ stats: null, sources: [], issues: [] }))
    );
  }

  // ── Forgot Password ──────────────────────────────────────────────────────────
  forgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/forgot-password`, { email }).pipe(catchError(() => of(null)));
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────────
  /** Returns the current user from the httpOnly cookie (server validates it). */
  me(): Observable<{ user: any }> {
    return this.http.get<{ user: any }>(`${this.base}/auth/me`).pipe(catchError(() => of({ user: null })));
  }

  /** Clears the httpOnly session cookie. */
  logout(): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/logout`, {}).pipe(catchError(() => of(null)));
  }

  /** #4 Validate a TOTP code during login (2FA step). */
  validateTotp(code: string): Observable<{ verified: boolean }> {
    return this.http.post<{ verified: boolean }>(`${this.base}/auth/totp/validate`, { code });
  }

  /** #4 Set up TOTP for the current user (returns QR code data URL). */
  setupTotp(): Observable<{ qrCodeUrl: string; manualKey: string }> {
    return this.http.post<{ qrCodeUrl: string; manualKey: string }>(`${this.base}/auth/totp/setup`, {});
  }

  /** #4 Verify TOTP code and enable 2FA. */
  enableTotp(code: string): Observable<{ enabled: boolean }> {
    return this.http.post<{ enabled: boolean }>(`${this.base}/auth/totp/verify`, { code });
  }

  /** #4 Disable 2FA. */
  disableTotp(): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/totp/disable`, {}).pipe(catchError(() => of(null)));
  }

  /** Okta OIDC: check if Okta SSO is configured server-side. */
  getOktaConfig(): Observable<{ configured: boolean; issuer: string; clientId: string; redirectUri: string }> {
    return this.http.get<any>(`${this.base}/auth/okta/config`).pipe(
      catchError(() => of({ configured: false, issuer: '', clientId: '', redirectUri: '' }))
    );
  }

  /** Okta OIDC: start PKCE authorization flow — returns the Okta authorization URL. */
  getOktaAuthorizeUrl(): Observable<{ authorizationUrl: string; state: string }> {
    return this.http.get<{ authorizationUrl: string; state: string }>(`${this.base}/auth/okta/authorize`);
  }

  // ── Products ─────────────────────────────────────────────────────────────────
  getProducts(search?: string, category?: string, status?: string, page = 1, limit = 50): Observable<{ data: any[]; total: number; page: number; totalPages: number }> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (category) params = params.set('category', category);
    if (status) params = params.set('status', status);
    params = params.set('page', page).set('limit', limit);
    return this.http.get<any>(`${this.base}/products`, { params }).pipe(catchError(() => of({ data: [], total: 0, page: 1, totalPages: 0 })));
  }

  getProductStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/products/stats`).pipe(catchError(() => of(null)));
  }

  getProductCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/products/categories`).pipe(catchError(() => of([])));
  }

  // ── Orders analytics ─────────────────────────────────────────────────────────
  getOrderAnalytics(): Observable<{ byDay: any[]; byStatus: any; topCustomers: any[]; totalOrders?: number; avgOrderValue?: number; fulfillmentRate?: number; revenueYtd?: number }> {
    return this.http.get<any>(`${this.base}/orders/analytics`).pipe(catchError(() => of({ byDay: [], byStatus: {}, topCustomers: [] })));
  }

  // ── Governance proposals ──────────────────────────────────────────────────────
  getProposals(tenantId?: string, status = 'pending'): Observable<any[]> {
    let params = new HttpParams().set('status', status);
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<any[]>(`${this.base}/governance/proposals`, { params }).pipe(catchError(() => of([])));
  }

  approveGovernanceProposal(id: string, reviewedBy?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/governance/proposals/${id}/approve`, { reviewedBy }).pipe(catchError(() => of(null)));
  }

  rejectGovernanceProposal(id: string, reason = '', reviewedBy?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/governance/proposals/${id}/reject`, { reason, reviewedBy }).pipe(catchError(() => of(null)));
  }

  // ── Mapping reviews ───────────────────────────────────────────────────────────
  getMappingReviews(tenantId?: string, status = 'pending'): Observable<any[]> {
    let params = new HttpParams().set('status', status);
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<any[]>(`${this.base}/governance/mapping-reviews`, { params }).pipe(catchError(() => of([])));
  }

  approveMappingReview(id: string, reviewedBy?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/governance/mapping-reviews/${id}/approve`, { reviewedBy }).pipe(catchError(() => of(null)));
  }

  rejectMappingReview(id: string, reviewedBy?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/governance/mapping-reviews/${id}/reject`, { reviewedBy }).pipe(catchError(() => of(null)));
  }

  // ── Sync job history ──────────────────────────────────────────────────────────
  getSyncJobs(connectorId?: string, limit = 20): Observable<any[]> {
    let params = new HttpParams().set('limit', limit);
    if (connectorId) params = params.set('connectorId', connectorId);
    return this.http.get<any[]>(`${this.base}/governance/sync-jobs`, { params }).pipe(catchError(() => of([])));
  }

  createOrder(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/orders`, data).pipe(catchError(() => of(null)));
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/dashboard/stats`).pipe(catchError(() => of(null)));
  }

  // ── System health DB ping ─────────────────────────────────────────────────────
  getDbHealth(): Observable<any> {
    return this.http.get<any>(`${this.base}/system-health/db`).pipe(catchError(() => of(null)));
  }

  // ── System health components (real DB ping + audit alerts) ────────────────────
  getSystemHealthComponents(): Observable<{ components: any[]; alerts: any[]; checkedAt: string }> {
    return this.http.get<any>(`${this.base}/system-health/components`).pipe(
      catchError(() => of({ components: [], alerts: [], checkedAt: new Date().toISOString() }))
    );
  }

  // ── Tenants ────────────────────────────────────────────────────────────────────
  getTenants(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/tenants`).pipe(catchError(() => of([])));
  }

  // ── CDM Versions ──────────────────────────────────────────────────────────────
  getCdmVersions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/cdm-versions`).pipe(catchError(() => of([])));
  }

  // ── AI / Ask NEXUS ────────────────────────────────────────────────────────────
  askNexus(message: string): Observable<NexusAiResponse> {
    return this.http.post<NexusAiResponse>(`${this.base}/ai/chat`, { message }).pipe(
      catchError(() => of({ reply: 'Lo siento, no puedo conectarme con el servicio AI en este momento.', reasoning_trace: [], model: 'error', usage: {} }))
    );
  }

  // ── Customer CRUD ─────────────────────────────────────────────────────────────
  createCustomer(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/customers`, data).pipe(catchError(() => of(null)));
  }

  updateCustomer(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.base}/customers/${id}`, data).pipe(catchError(() => of(null)));
  }

  deleteCustomer(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/customers/${id}`).pipe(catchError(() => of(null)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.base}/auth/change-password`, { currentPassword, newPassword }).pipe(catchError(() => of(null)));
  }

  // ── Pipeline M1 / M2 / M3 ────────────────────────────────────────────────────
  getPipelineStatus(): Observable<any> {
    return this.http.get<any>(`${this.base}/pipeline/status`).pipe(catchError(() => of(null)));
  }

  getM1Status(): Observable<any> {
    return this.http.get<any>(`${this.base}/pipeline/m1/status`).pipe(catchError(() => of(null)));
  }

  getM1Jobs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/pipeline/m1/jobs`).pipe(catchError(() => of([])));
  }

  triggerM1(connectorId?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/pipeline/m1/trigger`, connectorId ? { connectorId } : {}).pipe(catchError(() => of(null)));
  }

  getM2Status(): Observable<any> {
    return this.http.get<any>(`${this.base}/pipeline/m2/status`).pipe(catchError(() => of(null)));
  }

  getM2Lag(): Observable<any> {
    return this.http.get<any>(`${this.base}/pipeline/m2/lag`).pipe(catchError(() => of(null)));
  }

  getM3Status(): Observable<any> {
    return this.http.get<any>(`${this.base}/pipeline/m3/status`).pipe(catchError(() => of(null)));
  }

  getM3Timeseries(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/pipeline/m3/timeseries`).pipe(catchError(() => of([])));
  }

  // ── Airflow REST API ──────────────────────────────────────────────────────────
  // Dev  (ng serve) : airflowUrl = 'http://localhost:8091/api/v1'  (direct, CORS allowed)
  // Prod (Docker)   : airflowUrl = '/airflow/api/v1'  (proxied by nginx → nexus-airflow-webserver:8080)
  private readonly airflowBase = environment.airflowUrl;
  private readonly airflowAuth = { Authorization: 'Basic ' + btoa('admin:admin') };

  // ── M1 Connector Lifecycle API (via nginx → Kong) ──────────────────────
  // Direct call to Kong Gateway (no nginx /kong-m1 proxy)
  // Auth: Okta Bearer token attached by auth.interceptor.ts
  // Tenant: X-Tenant-ID header forwarded by Kong
  private readonly m1Base = environment.m1Url;
  private readonly m1TenantId = 'acme-corp'; // default demo tenant

  m1GetConnectors(): Observable<any[]> {
    return this.http.get<any>(`${this.m1Base}/connectors`,
      { headers: { 'X-Tenant-ID': this.m1TenantId } }
    ).pipe(map((r: any) => r.connectors ?? r ?? []), catchError(() => of([])));
  }

  m1RegisterConnector(payload: {
    connector_name: string; system_type: string;
    credentials_secret_path: string; sync_schedule?: string;
    enabled?: boolean; config?: Record<string, unknown>;
  }): Observable<any> {
    return this.http.post<any>(`${this.m1Base}/connectors`, payload,
      { headers: { 'X-Tenant-ID': this.m1TenantId, 'Content-Type': 'application/json' } }
    ).pipe(catchError((err: HttpErrorResponse) => throwError(() => err)));
  }

  m1TriggerSync(connectorId: string, mode: 'full' | 'incremental' = 'incremental'): Observable<any> {
    return this.http.post<any>(`${this.m1Base}/connectors/${connectorId}/sync`,
      { sync_mode: mode },
      { headers: { 'X-Tenant-ID': this.m1TenantId, 'Content-Type': 'application/json' } }
    ).pipe(catchError(() => of(null)));
  }

  m1GetSyncJobs(connectorId: string): Observable<any[]> {
    return this.http.get<any>(`${this.m1Base}/connectors/${connectorId}/sync-jobs`,
      { headers: { 'X-Tenant-ID': this.m1TenantId } }
    ).pipe(map((r: any) => r.sync_jobs ?? r ?? []), catchError(() => of([])));
  }

  /**
   * List all installed Airflow provider packages.
   * Used to build the connector gallery in M6 — no manual maintenance needed
   * as new providers are added to the Dockerfile.
   * GET /api/v1/providers
   */
  getAirflowProviders(): Observable<any[]> {
    return this.http.get<any>(`${this.airflowBase}/providers`, { headers: this.airflowAuth }).pipe(
      map((r: any) => r.providers ?? []),
      catchError(() => of([]))
    );
  }

  /**
   * List all configured Airflow connections (connection metadata only — no passwords).
   * GET /api/v1/connections
   */
  getAirflowConnections(): Observable<any[]> {
    return this.http.get<any>(`${this.airflowBase}/connections`, { headers: this.airflowAuth }).pipe(
      map((r: any) => r.connections ?? []),
      catchError(() => of([]))
    );
  }

  /**
   * Derive Airflow connection types from installed providers.
   * /api/v1/connection-types does not exist in Airflow 2.x — this maps
   * each provider package name to its connection_type using the official
   * Airflow provider registry convention (package suffix = conn type).
   * Result is fully dynamic: reflects exactly what providers are installed.
   */
  getAirflowConnectionTypes(): Observable<any[]> {
    const PACKAGE_CONN_TYPE: Record<string, { connection_type: string; hook_name: string }> = {
      'apache-airflow-providers-postgres':         { connection_type: 'postgres',              hook_name: 'PostgreSQL' },
      'apache-airflow-providers-mysql':            { connection_type: 'mysql',                 hook_name: 'MySQL' },
      'apache-airflow-providers-microsoft-mssql':  { connection_type: 'mssql',                 hook_name: 'SQL Server' },
      'apache-airflow-providers-snowflake':        { connection_type: 'snowflake',             hook_name: 'Snowflake' },
      'apache-airflow-providers-amazon':           { connection_type: 'aws',                   hook_name: 'Amazon Web Services' },
      'apache-airflow-providers-google':           { connection_type: 'google_cloud_platform', hook_name: 'Google Cloud' },
      'apache-airflow-providers-microsoft-azure':  { connection_type: 'wasb',                  hook_name: 'Azure Blob Storage' },
      'apache-airflow-providers-sftp':             { connection_type: 'sftp',                  hook_name: 'SFTP' },
      'apache-airflow-providers-ssh':              { connection_type: 'ssh',                   hook_name: 'SSH' },
      'apache-airflow-providers-elasticsearch':    { connection_type: 'elasticsearch',         hook_name: 'Elasticsearch' },
      'apache-airflow-providers-http':             { connection_type: 'http',                  hook_name: 'HTTP' },
      'apache-airflow-providers-slack':            { connection_type: 'slack',                 hook_name: 'Slack' },
      'apache-airflow-providers-hashicorp':        { connection_type: 'vault',                 hook_name: 'HashiCorp Vault' },
    };
    return this.http.get<any>(`${this.airflowBase}/providers`, { headers: this.airflowAuth }).pipe(
      map((r: any) =>
        (r.providers ?? [])
          .filter((p: any) => Object.prototype.hasOwnProperty.call(PACKAGE_CONN_TYPE, p.package_name))
          .map((p: any) => PACKAGE_CONN_TYPE[p.package_name])
      ),
      catchError(() => of([]))
    );
  }

  /** List all DAGs registered in Airflow. */
  getAirflowDAGs(): Observable<any[]> {
    return this.http.get<any>(`${this.airflowBase}/dags`, { headers: this.airflowAuth }).pipe(
      map((r: any) => r.dags ?? []),
      catchError(() => of([]))
    );
  }

  /**
   * Get DAG runs for a specific DAG, ordered ascending.
   * If dagId is omitted, returns all runs across all DAGs.
   */
  getAirflowDAGRuns(dagId: string): Observable<any[]> {
    return this.http.get<any>(
      `${this.airflowBase}/dags/${dagId}/dagRuns?order_by=start_date&limit=1`,
      { headers: this.airflowAuth }
    ).pipe(
      map((r: any) => r.dag_runs ?? []),
      catchError(() => of([]))
    );
  }

  /**
   * Trigger a DAG run.
   * @param dagId  The DAG identifier, e.g. 'nexus_m1_postgres_sync'
   * @param conf   Key/value pairs passed to the DAG as `conf` (connector metadata)
   */
  triggerAirflowDAG(dagId: string, conf: Record<string, any> = {}): Observable<any> {
    return this.http.post<any>(
      `${this.airflowBase}/dags/${dagId}/dagRuns`,
      { conf },
      { headers: this.airflowAuth }
    ).pipe(catchError(() => of(null)));
  }

  /**
   * Pause or resume a DAG.
   * @param isPaused  true = pause, false = resume
   */
  toggleAirflowDAG(dagId: string, isPaused: boolean): Observable<any> {
    return this.http.patch<any>(
      `${this.airflowBase}/dags/${dagId}`,
      { is_paused: isPaused },
      { headers: this.airflowAuth }
    ).pipe(catchError(() => of(null)));
  }

  // ── CDM Knowledge Graph (Neo4j-backed) ───────────────────────────────────────
  getCdmDomains(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/schemas/cdm/domains`).pipe(catchError(() => of([])));
  }

  getCdmSchemas(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/schemas/cdm/schemas`).pipe(catchError(() => of([])));
  }

  getCdmSchemaFields(schemaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/schemas/cdm/schemas/${schemaId}/fields`).pipe(catchError(() => of([])));
  }

  getCdmMappings(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/schemas/cdm/mappings`).pipe(catchError(() => of([])));
  }

  getCdmGraphStats(): Observable<{
    nodes: { label: string; count: number }[];
    relationships: number;
    piiFields: number;
    approvedMappings: number;
    pendingMappings: number;
  }> {
    return this.http.get<any>(`${this.base}/schemas/cdm/graph-stats`).pipe(
      catchError(() => of({ nodes: [], relationships: 0, piiFields: 0, approvedMappings: 0, pendingMappings: 0 }))
    );
  }
}
