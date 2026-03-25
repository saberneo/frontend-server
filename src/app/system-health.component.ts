import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  statusText: string;
  uptime: string;
}

interface AlertItem {
  id: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
  time: string;
}

interface LogEntry {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Log Stream Modal -->
    @if (logsModal()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeLogsModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
            <div class="flex items-center gap-3">
              <span class="material-icons text-text-secondary">article</span>
              <div>
                <h2 class="text-base font-semibold text-text-primary">{{ logsModal()!.name }}</h2>
                <p class="text-xs text-text-secondary">{{ 'SYSTEM_HEALTH.LOG_MODAL_TITLE' | translate }}</p>
              </div>
            </div>
            <button (click)="closeLogsModal()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="overflow-y-auto flex-1 bg-neutral-950 p-4 font-mono text-xs leading-relaxed">
            @for (entry of logsModal()!.entries; track $index) {
              <div class="flex gap-3 py-0.5">
                <span class="text-neutral-500 shrink-0">{{ entry.time }}</span>
                <span class="shrink-0 font-semibold w-10"
                      [class.text-blue-400]="entry.level === 'INFO'"
                      [class.text-amber-400]="entry.level === 'WARN'"
                      [class.text-rose-400]="entry.level === 'ERROR'">{{ entry.level }}</span>
                <span [class.text-neutral-300]="entry.level === 'INFO'"
                      [class.text-amber-300]="entry.level === 'WARN'"
                      [class.text-rose-300]="entry.level === 'ERROR'">{{ entry.message }}</span>
              </div>
            }
          </div>
          <div class="p-4 border-t border-border-subtle shrink-0 flex justify-end">
            <button (click)="closeLogsModal()" class="px-4 py-2 bg-bg-hover text-text-primary border border-border-subtle hover:bg-border-subtle rounded-md text-sm font-medium transition-colors">{{ 'SYSTEM_HEALTH.LOG_MODAL_BTN_CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'SYSTEM_HEALTH.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'SYSTEM_HEALTH.SUBTITLE' | translate }}</p>
        </div>
        <button (click)="refreshMetrics()" [disabled]="refreshing()"
          class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
          <span class="material-icons text-[18px]" [class.animate-spin]="refreshing()">refresh</span>
          {{ refreshing() ? ('SYSTEM_HEALTH.BTN_REFRESHING' | translate) : ('SYSTEM_HEALTH.BTN_REFRESH_METRICS' | translate) }}
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        @for (metric of metrics(); track metric.label) {
          <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
            <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ metric.label }}</div>
            <div class="text-3xl font-bold mb-1"
                 [class.text-emerald-400]="metric.variant === 'success'"
                 [class.text-amber-400]="metric.variant === 'warning'"
                 [class.text-rose-400]="metric.variant === 'error'"
                 [class.text-text-primary]="metric.variant === 'neutral'">{{ metric.value }}</div>
            <div class="text-xs text-text-secondary">{{ metric.sub }}</div>
          </div>
        }
      </div>

      <!-- Kafka offline banner -->
      @if (kafkaDown()) {
        <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <span class="material-icons text-amber-400 text-[22px] mt-0.5 shrink-0">warning</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-amber-300 mb-1">{{ 'SYSTEM_HEALTH.KAFKA_WARNING' | translate }}</p>
            <p class="text-xs text-text-secondary mb-2">{{ 'SYSTEM_HEALTH.KAFKA_MSG' | translate }}</p>
            <div class="flex items-center gap-2 bg-neutral-900 border border-amber-500/20 rounded px-3 py-2 font-mono text-xs text-amber-200 overflow-x-auto">
              <span class="select-all flex-1">docker compose up kafka kafdrop -d</span>
              <button (click)="copyKafkaCmd()" title="Copy to clipboard"
                class="shrink-0 text-text-secondary hover:text-amber-300 transition-colors">
                <span class="material-icons text-[16px]">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      }

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <div class="p-5 border-b border-border-subtle flex items-center justify-between">
          <h2 class="text-base font-semibold text-text-primary">{{ 'SYSTEM_HEALTH.SECTION_COMPONENT_STATUS' | translate }}</h2>
          <span class="text-xs text-text-secondary">{{ operationalCount() }}/{{ components().length }} operational</span>
        </div>
        <div class="p-5 space-y-3">
          @for (comp of components(); track comp.name) {
            <div class="flex items-center justify-between p-3 bg-bg-input rounded border border-border-subtle">
              <div class="flex items-center gap-3">
                <span class="w-2 h-2 rounded-full"
                      [class.bg-emerald-500]="comp.status === 'operational'"
                      [class.bg-amber-500]="comp.status === 'degraded'"
                      [class.bg-rose-500]="comp.status === 'down'"></span>
                <div>
                  <span class="font-medium text-text-primary">{{ comp.name }}</span>
                  <span class="text-xs text-text-secondary ml-2">· {{ comp.uptime }} uptime</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs"
                      [class.text-text-secondary]="comp.status === 'operational'"
                      [class.text-amber-500]="comp.status === 'degraded'"
                      [class.text-rose-500]="comp.status === 'down'">{{ comp.statusText }}</span>
                @if (comp.status === 'degraded' || comp.status === 'down') {
                  <button (click)="restartComponent(comp)"
                    class="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-xs font-medium transition-colors flex items-center gap-1">
                    <span class="material-icons text-[14px]">restart_alt</span>
                    {{ 'SYSTEM_HEALTH.BTN_RESTART' | translate }}
                  </button>
                }
                <button (click)="viewLogs(comp)"
                  class="px-3 py-1 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors flex items-center gap-1">
                  <span class="material-icons text-[14px]">article</span>
                  {{ 'SYSTEM_HEALTH.BTN_LOGS' | translate }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
        <h2 class="text-base font-semibold text-text-primary mb-4">{{ 'SYSTEM_HEALTH.SECTION_RECENT_ALERTS' | translate }}</h2>
        <div class="space-y-2">
          @for (alert of alerts(); track alert.id) {
            <div class="flex items-start gap-3 p-3 rounded border"
                 [class.border-amber-500/20]="alert.severity === 'warning'"
                 [class.bg-amber-500/5]="alert.severity === 'warning'"
                 [class.border-rose-500/20]="alert.severity === 'error'"
                 [class.bg-rose-500/5]="alert.severity === 'error'"
                 [class.border-blue-500/20]="alert.severity === 'info'"
                 [class.bg-blue-500/5]="alert.severity === 'info'">
              <span class="material-icons text-[18px] mt-0.5"
                    [class.text-amber-400]="alert.severity === 'warning'"
                    [class.text-rose-400]="alert.severity === 'error'"
                    [class.text-blue-400]="alert.severity === 'info'">
                {{ alert.severity === 'warning' ? 'warning' : alert.severity === 'error' ? 'error' : 'info' }}
              </span>
              <div class="flex-1">
                <p class="text-sm font-medium text-text-primary">{{ alert.message }}</p>
                <p class="text-xs text-text-secondary mt-0.5">{{ alert.time }}</p>
              </div>
              <button (click)="dismissAlert(alert.id)" class="text-text-secondary hover:text-text-primary transition-colors">
                <span class="material-icons text-[16px]">close</span>
              </button>
            </div>
          }
          @if (alerts().length === 0) {
            <div class="text-center text-sm text-text-secondary py-4 flex items-center justify-center gap-2">
              <span class="material-icons text-[18px] text-emerald-500">check_circle</span>
              {{ 'SYSTEM_HEALTH.EMPTY_ALERTS' | translate }}
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class SystemHealthComponent implements OnInit {
  toastService = inject(ToastService);
  private api = inject(ApiService);
  /** DestroyRef completes takeUntilDestroyed when the component is destroyed. */
  private destroyRef = inject(DestroyRef);

  refreshing = signal(false);
  logsModal = signal<{ name: string; entries: LogEntry[] } | null>(null);

  private logTemplates: Record<string, LogEntry[]> = {
    'API Gateway': [
      { time: '10:59:12', level: 'INFO', message: 'GET /api/v2/orders 200 12ms' },
      { time: '10:59:11', level: 'INFO', message: 'POST /api/v2/schemas/snapshot 201 45ms' },
      { time: '10:59:09', level: 'INFO', message: 'GET /api/v2/customers 200 8ms' },
      { time: '10:58:54', level: 'WARN', message: 'Rate limit threshold at 82% for tenant contoso-benelux' },
      { time: '10:58:51', level: 'INFO', message: 'GET /api/v2/approvals 200 6ms' },
      { time: '10:58:40', level: 'INFO', message: 'PUT /api/v2/orders/SO-48291/ship 200 22ms' },
      { time: '10:57:33', level: 'INFO', message: 'Health check passed · upstream services nominal' },
      { time: '10:56:10', level: 'INFO', message: 'Certificate renewal scheduled for Apr 15, 2026' },
    ],
    'Ingestion Engine': [
      { time: '10:59:15', level: 'INFO', message: 'Batch AdventureWorks.Sales.Orders ingested · 1,204 records' },
      { time: '10:59:10', level: 'INFO', message: 'Batch Salesforce.Accounts ingested · 87 records' },
      { time: '10:58:55', level: 'INFO', message: 'Schema drift check: 0 fields changed' },
      { time: '10:58:40', level: 'INFO', message: 'Checkpoint saved · offset=9821043' },
      { time: '10:57:30', level: 'INFO', message: 'Starting ingestion cycle #48291' },
      { time: '10:56:55', level: 'INFO', message: 'Connector AdventureWorks DB · healthy · lag 0ms' },
    ],
    'M2 AI Mapping Service': [
      { time: '10:59:18', level: 'WARN', message: 'Response time elevated: 820ms (threshold: 500ms)' },
      { time: '10:59:05', level: 'WARN', message: 'GPU memory utilization at 91% · throttling possible' },
      { time: '10:58:50', level: 'ERROR', message: 'Embedding model timeout for proposal PRO-0041 · retrying (1/3)' },
      { time: '10:58:52', level: 'INFO', message: 'Proposal PRO-0041 retry successful · similarity=0.94' },
      { time: '10:58:30', level: 'WARN', message: 'Batch queue depth: 24 proposals pending (normal: <5)' },
      { time: '10:57:10', level: 'INFO', message: 'Model nexus-mapping-v3.1 loaded · 2.4GB VRAM' },
      { time: '10:56:00', level: 'INFO', message: 'Service started · workers=4 · gpu=A100-40GB' },
    ],
    'Database Cluster': [
      { time: '10:59:20', level: 'INFO', message: 'Query nexus_main.orders: 4ms · rows=1204' },
      { time: '10:59:18', level: 'INFO', message: 'Replication lag: 0ms · replica in sync' },
      { time: '10:58:10', level: 'INFO', message: 'Checkpoint completed · WAL size=142MB' },
      { time: '10:57:00', level: 'INFO', message: 'Autovacuum: table nexus_main.audit_log · 0 dead rows' },
      { time: '10:55:30', level: 'INFO', message: 'Backup completed · size=4.2GB · duration=8m12s' },
    ],
    'Event Bus (Kafka)': [
      { time: '10:59:22', level: 'INFO', message: 'Topic nexus.ingestion.events · offset=192840 · lag=0' },
      { time: '10:59:15', level: 'INFO', message: 'Consumer group nexus-workers committed offset 192839' },
      { time: '10:58:40', level: 'INFO', message: 'Partition rebalance complete · 4 consumers active' },
      { time: '10:57:55', level: 'INFO', message: 'Broker nexus-kafka-2 leader election: OK' },
    ],
    'Secret Manager Proxy': [
      { time: '10:59:00', level: 'INFO', message: 'Secret rotation check: all secrets within TTL' },
      { time: '10:58:00', level: 'INFO', message: 'Vault token renewed · TTL=3600s' },
      { time: '10:55:00', level: 'INFO', message: 'Health check passed · vault=unsealed · latency=2ms' },
    ],
  };

  metrics = signal<any[]>([]);

  components = signal<ComponentStatus[]>([]);

  alerts = signal<AlertItem[]>([]);

  operationalCount = () => this.components().filter(c => c.status === 'operational').length;

  kafkaDown = computed(() =>
    this.components().some(c =>
      (c.name.toLowerCase().includes('kafka') || c.name.toLowerCase().includes('event bus')) &&
      c.status !== 'operational'
    )
  );

  ngOnInit() {
    this.loadLiveMetrics();
    this.loadComponents();
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadLiveMetrics();
        this.loadComponents();
      });
  }

  private loadComponents() {
    this.api.getSystemHealthComponents().subscribe(data => {
      if (!data) return;
      if (data.components?.length) {
        const mapStatus = (s: string): 'operational' | 'degraded' | 'down' => {
          if (s === 'healthy' || s === 'operational') return 'operational';
          if (s === 'degraded') return 'degraded';
          return 'down'; // 'error', 'not_configured', etc.
        };
        this.components.set(data.components.map((c: any) => {
          const status = mapStatus(c.status);
          return {
            name: c.name,
            status,
            statusText: status === 'operational'
              ? (c.message || 'Operational')
              : status === 'degraded'
                ? (c.message || 'Degraded')
                : (c.message || 'Down'),
            uptime: c.uptime ?? '—',
          };
        }));
      }
      if (data.alerts?.length) {
        this.alerts.set(data.alerts.map((a: any, i: number) => ({
          id: i + 1,
          severity: a.severity ?? 'info',
          message: a.message ?? a.detail ?? 'System alert',
          time: a.time ?? (a.timestamp ? new Date(a.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
        })));
      } else {
        // No alerts is good news
        this.alerts.set([{ id: 0, severity: 'info', message: 'All systems operating normally — no recent alerts', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }]);
      }
    });
  }

  // ngOnDestroy not needed — takeUntilDestroyed handles cleanup automatically

  private loadLiveMetrics() {
    this.api.getSystemHealth().subscribe(data => {
      if (!data) return;
      const cpu = data.cpu?.usagePercent ?? 0;
      const memPct = data.memory?.usagePercent ?? 0;
      this.metrics.set([
        { label: 'Node Heap',    value: `${Math.round(data.node?.heapUsedMb ?? 0)}MB`, sub: `of ${Math.round(data.node?.heapTotalMb ?? 0)}MB total`, variant: 'neutral' },
        { label: 'Memory Usage', value: `${memPct}%`, sub: `${Math.round(data.memory?.usedMb ?? 0)} / ${Math.round(data.memory?.totalMb ?? 0)} MB`, variant: memPct > 85 ? 'error' : memPct > 70 ? 'warning' : 'neutral' },
        { label: 'CPU Usage',    value: `${cpu}%`, sub: `${data.cpu?.cores ?? 0} cores`, variant: cpu > 80 ? 'warning' : 'success' },
        { label: 'Uptime',       value: data.uptime?.formatted ?? '—', sub: 'server uptime', variant: 'neutral' },
      ]);
    });
  }

  refreshMetrics() {
    this.refreshing.set(true);
    this.toastService.show('Refreshing system metrics...', 'info');
    this.api.getSystemHealth().subscribe({
      next: (data) => {
        if (data) this.loadLiveMetrics();
        this.refreshing.set(false);
        this.toastService.show('Metrics refreshed successfully', 'success');
      },
      error: () => {
        this.refreshing.set(false);
        this.toastService.show('Could not reach system-health endpoint', 'error');
      },
    });
  }

  restartComponent(comp: ComponentStatus) {
    this.toastService.show(`Restarting ${comp.name}...`, 'info');
    this.components.update(cs => cs.map(c => c.name === comp.name ? { ...c, statusText: 'Restarting...' } : c));
    setTimeout(() => {
      this.components.update(cs => cs.map(c => c.name === comp.name
        ? { ...c, status: 'operational', statusText: 'Operational' } : c));
      this.toastService.show(`${comp.name} restarted — status: Operational`, 'success');
    }, 2500);
  }

  viewLogs(comp: ComponentStatus) {
    const entries = this.logTemplates[comp.name] ?? [
      { time: '10:59:00', level: 'INFO' as const, message: `Service ${comp.name} is running normally.` }
    ];
    this.logsModal.set({ name: comp.name, entries });
  }

  closeLogsModal() {
    this.logsModal.set(null);
  }

  dismissAlert(id: number) {
    this.alerts.update(a => a.filter(alert => alert.id !== id));
  }

  copyKafkaCmd() {
    navigator.clipboard.writeText('docker compose up kafka kafdrop -d').then(() => {
      this.toastService.show('Command copied to clipboard', 'success');
    }).catch(() => {
      this.toastService.show('Could not copy — use: docker compose up kafka kafdrop -d', 'info');
    });
  }
}

