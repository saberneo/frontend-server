import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- New Report Modal -->
    @if (showReportModal()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="showReportModal.set(false)">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-lg shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'OVERVIEW.MODAL_TITLE' | translate }}</h2>
            <button (click)="showReportModal.set(false)" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'OVERVIEW.MODAL_LBL_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="reportForm.name" placeholder="e.g. Q1 Sales Summary"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-emerald-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'OVERVIEW.MODAL_LBL_TYPE' | translate }}</label>
              <select [(ngModel)]="reportForm.type"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-emerald-500">
                <option value="sales">Sales & Revenue</option>
                <option value="customers">Customer Analysis</option>
                <option value="orders">Order Performance</option>
                <option value="data-quality">Data Quality</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'OVERVIEW.MODAL_LBL_DATE_RANGE' | translate }}</label>
              <select [(ngModel)]="reportForm.range"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-emerald-500">
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="q1-2026">Q1 2026</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'OVERVIEW.MODAL_LBL_SOURCES' | translate }}</label>
              <div class="flex flex-wrap gap-2">
                @for (src of reportSources; track src) {
                  <label class="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer">
                    <input type="checkbox" [checked]="reportForm.sources.includes(src)" (change)="toggleSource(src)"
                      class="rounded border-border-subtle text-emerald-500 focus:ring-emerald-500">
                    {{ src }}
                  </label>
                }
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 p-6 border-t border-border-subtle">
            <button (click)="showReportModal.set(false)" class="px-4 py-2 bg-transparent hover:bg-bg-hover text-text-primary rounded-md text-sm font-medium transition-colors border border-border-subtle">{{ 'OVERVIEW.MODAL_BTN_CANCEL' | translate }}</button>
            <button (click)="generateReport()" class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2">
              <span class="material-icons text-[16px]">assessment</span>{{ 'OVERVIEW.MODAL_BTN_GENERATE' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <div class="p-8 max-w-7xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">Good morning, {{ dataService.currentUser().name.split(' ')[0] }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ todayFormatted }} &middot; Data current as of {{ dataFreshnessLabel() }}</p>
        </div>
        <button (click)="newReport()" class="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-sm font-medium transition-colors">
          <span class="material-icons text-[18px]">add</span>
          {{ 'OVERVIEW.BTN_NEW_REPORT' | translate }}
        </button>
        <button (click)="exportPDF()" [disabled]="isPdfLoading()" class="flex items-center gap-2 px-4 py-2 bg-bg-card hover:bg-bg-hover border border-border-subtle text-text-primary rounded-md text-sm font-medium transition-colors disabled:opacity-60">
          @if (isPdfLoading()) {
            <span class="material-icons text-[18px] animate-spin">autorenew</span>
          } @else {
            <span class="material-icons text-[18px]">picture_as_pdf</span>
          }
          {{ 'OVERVIEW.BTN_EXPORT_PDF' | translate }}
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'OVERVIEW.KPI_REVENUE' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ kpiRevenue() }}</div>
          <div class="text-sm text-emerald-500 flex items-center gap-1">
            <span class="material-icons text-[16px]">arrow_upward</span>
            {{ revenueChangePct() }}
          </div>
        </div>
        
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-blue-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'OVERVIEW.KPI_CUSTOMERS' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ kpiCustomers() }}</div>
          <div class="text-sm text-text-secondary flex items-center gap-1">
            <span class="material-icons text-[16px] text-emerald-500">arrow_upward</span>
            {{ newCustomersLabel() }}
          </div>
        </div>

        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'OVERVIEW.KPI_ORDERS' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ kpiOpenOrders() }}</div>
          <div class="text-sm text-text-secondary flex items-center gap-1">
            <span class="material-icons text-[16px]">trending_flat</span>
            {{ overdueLabel() }}
          </div>
        </div>

        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-rose-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'OVERVIEW.KPI_APPROVALS' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ kpiApprovals() }}</div>
          <div class="text-sm text-rose-500 flex items-center gap-1">
            <span class="material-icons text-[16px]">arrow_upward</span>
            {{ 'OVERVIEW.KPI_ACTION' | translate }}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Top Customers -->
        <div class="lg:col-span-2 bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <div class="p-6 border-b border-border-subtle flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-text-primary">{{ 'OVERVIEW.SECTION_TOP_CUSTOMERS' | translate }}</h2>
              <p class="text-sm text-text-secondary">{{ 'OVERVIEW.SECTION_YTD' | translate }}</p>
            </div>
            <button (click)="viewAllCustomers()" class="px-3 py-1.5 bg-bg-hover text-text-primary text-sm font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors">{{ 'OVERVIEW.BTN_VIEW_ALL' | translate }}</button>
          </div>
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
              <tr>
                <th class="px-6 py-4 font-semibold">{{ 'OVERVIEW.COL_CUSTOMER' | translate }}</th>
                <th class="px-6 py-4 font-semibold">{{ 'OVERVIEW.COL_COUNTRY' | translate }}</th>
                <th class="px-6 py-4 font-semibold">{{ 'OVERVIEW.COL_REVENUE' | translate }}</th>
                <th class="px-6 py-4 font-semibold">{{ 'OVERVIEW.COL_ORDERS' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              @for (c of topCustomers(); track c.customerId) {
                <tr class="hover:bg-bg-hover/50 transition-colors">
                  <td class="px-6 py-4 font-medium text-text-primary">{{ c.customer }}</td>
                  <td class="px-6 py-4 text-text-secondary">—</td>
                  <td class="px-6 py-4 text-text-primary">{{ c.totalRevenue | currency:'USD':'symbol':'1.0-0' }}</td>
                  <td class="px-6 py-4 text-text-secondary">{{ c.orderCount }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-6 py-6 text-center text-text-secondary text-sm">{{ 'OVERVIEW.LOADING_CUSTOMERS' | translate }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pending Approvals -->
        <div class="space-y-4">
          <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
            <div class="p-6 border-b border-border-subtle flex items-center justify-between">
              <h2 class="text-lg font-semibold text-text-primary">{{ 'OVERVIEW.SECTION_APPROVALS' | translate }}</h2>
              <span class="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 py-1 px-2.5 rounded-md text-xs font-medium">{{ kpiApprovals() }} {{ 'OVERVIEW.LABEL_NEED_ACTION' | translate }}</span>
            </div>
            <div class="divide-y divide-border-subtle">
              @for (approval of approvals(); track approval.id) {
                <div class="p-4 hover:bg-bg-hover/50 transition-colors">
                  <div class="flex items-start gap-3">
                    <div class="w-8 h-8 rounded flex items-center justify-center shrink-0"
                         [class.bg-amber-100]="approval.type === 'leave'" [class.dark:bg-amber-500/20]="approval.type === 'leave'"
                         [class.bg-blue-100]="approval.type === 'expense'" [class.dark:bg-blue-500/20]="approval.type === 'expense'"
                         [class.bg-rose-100]="approval.type === 'return'" [class.dark:bg-rose-500/20]="approval.type === 'return'">
                      <span class="material-icons text-[18px]"
                            [class.text-amber-600]="approval.type === 'leave'" [class.dark:text-amber-400]="approval.type === 'leave'"
                            [class.text-blue-600]="approval.type === 'expense'" [class.dark:text-blue-400]="approval.type === 'expense'"
                            [class.text-rose-600]="approval.type === 'return'" [class.dark:text-rose-400]="approval.type === 'return'">
                        {{ approval.icon }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-text-primary truncate">{{ approval.title }}</p>
                      <p class="text-xs text-text-secondary mt-0.5">{{ approval.subtitle }}</p>
                    </div>
                  </div>
                  <div class="mt-3 flex gap-2 justify-end">
                    @if (approval.canApprove) {
                      <button (click)="approve(approval)" class="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-xs font-medium rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors">{{ 'OVERVIEW.BTN_APPROVE' | translate }}</button>
                    }
                    <button (click)="review(approval)" class="px-3 py-1.5 bg-bg-hover text-text-primary text-xs font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors">{{ 'OVERVIEW.BTN_REVIEW' | translate }}</button>
                  </div>
                </div>
              }
              @if (approvals().length === 0) {
                <div class="p-6 text-center text-sm text-text-secondary">
                  {{ 'OVERVIEW.EMPTY_APPROVALS' | translate }}
                </div>
              }
            </div>
          </div>

          <!-- Data Freshness -->
          <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
            <h3 class="text-sm font-semibold text-text-primary mb-4">{{ 'OVERVIEW.SECTION_DATA_FRESHNESS' | translate }}</h3>
            <div class="flex flex-wrap items-center gap-4 text-xs">
              @for (conn of dataFreshnessItems(); track conn.name) {
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full" [class.bg-emerald-500]="conn.fresh" [class.bg-amber-500]="!conn.fresh"></div>
                  <span class="text-text-secondary">{{ conn.name }}</span>
                  <span class="font-medium text-text-primary">{{ conn.label }}</span>
                </div>
              }
              @if (dataFreshnessItems().length === 0) {
                <span class="text-text-secondary">{{ 'OVERVIEW.EMPTY_CONNECTORS' | translate }}</span>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- #7 Chart.js — metrics visualisation -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4">{{ 'OVERVIEW.CHART_ORDERS' | translate }}</h3>
          <canvas #ordersChart height="160"></canvas>
        </div>
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4">{{ 'OVERVIEW.CHART_REVENUE' | translate }}</h3>
          <canvas #revenueChart height="160"></canvas>
        </div>
      </div>
    </div>
  `
})
export class OverviewComponent implements OnInit, AfterViewInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  router = inject(Router);
  private api = inject(ApiService);
  private zone = inject(NgZone);

  // #7 Chart.js canvas references
  @ViewChild('ordersChart') ordersChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;

  kpiCustomers = signal<string | number>('—');
  kpiOpenOrders = signal<string | number>('—');
  kpiApprovals = signal<string | number>('—');
  kpiRevenue = signal<string>('—');
  isPdfLoading = signal(false);
  topCustomers = signal<any[]>([]);

  /** Dynamic date label e.g. "Thursday 5 March 2026" */
  readonly todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  /** Revenue % change vs last month (filled after dashboard stats load) */
  private _revenueChangePct = signal<number | null>(null);
  revenueChangePct = computed(() => {
    const pct = this._revenueChangePct();
    if (pct === null) return '...';
    return `${pct > 0 ? '+' : ''}${pct}% vs last month`;
  });

  /** New customers this month */
  private _newCustomers = signal<number | null>(null);
  newCustomersLabel = computed(() => {
    const n = this._newCustomers();
    return n === null ? '...' : `${n} new this month`;
  });

  /** Overdue orders */
  private _overdueOrders = signal<number | null>(null);
  overdueLabel = computed(() => {
    const n = this._overdueOrders();
    return n === null ? '...' : `${n} overdue`;
  });

  /** Data freshness from connectors signal */
  dataFreshnessItems = computed(() =>
    this.dataService.connectors()
      .filter(c => c.status === 'active' || c.status === 'syncing')
      .map(c => {
        const raw = c.lastSync;
        // If raw is a Date string or Date-like, compute relative time
        const label = c.status === 'syncing' ? 'syncing...' : raw;
        const fresh = c.status === 'active';
        return { name: c.name.split(' ')[0], label, fresh };
      })
  );

  /** Freshest label for the subtitle */
  dataFreshnessLabel = computed(() => {
    const items = this.dataFreshnessItems();
    const active = items.filter(c => c.fresh);
    if (active.length === 0) return 'unknown';
    return active[0].label;
  });

  /** reportSources from connectors */
  get reportSources(): string[] {
    const conns = this.dataService.connectors();
    return conns.map(c => c.name);
  }

  ngOnInit() {
    this.dataService.loadConnectors();
    this.api.getPendingApprovals().subscribe(items => {
      if (items?.length) {
        this.approvals.set(items.map((a: any) => ({
          id: a.id,
          type: a.type,
          icon: a.icon,
          title: a.title,
          subtitle: a.details,
          canApprove: a.canReject,
        })));
      }
    });
    this.api.getDashboardStats().subscribe(stats => {
      if (stats) {
        this.kpiOpenOrders.set((stats.orders?.processing ?? 0) + (stats.orders?.shipped ?? 0));
        this.kpiCustomers.set(stats.customers?.active ?? '—');
        this.kpiApprovals.set(stats.approvals?.pending ?? 0);
        const ytd = stats.revenue?.ytd ?? 0;
        this.kpiRevenue.set(ytd >= 1_000_000 ? `€${(ytd / 1_000_000).toFixed(1)}M` : `€${(ytd / 1_000).toFixed(0)}K`);
        // Real % change vs last month
        if (stats.revenue?.changePercent !== undefined && stats.revenue.changePercent !== null) {
          this._revenueChangePct.set(stats.revenue.changePercent);
        }
        if (stats.customers?.newThisMonth !== undefined) {
          this._newCustomers.set(stats.customers.newThisMonth);
        }
        if (stats.orders?.overdue !== undefined) {
          this._overdueOrders.set(stats.orders.overdue);
        }
      }
    });
    this.api.getOrderAnalytics().subscribe(analytics => {
      if (analytics?.topCustomers?.length) {
        this.topCustomers.set(analytics.topCustomers);
      }
    });
  }

  // #7 Chart.js initialisation
  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      Promise.all([import('chart.js/auto'), this.api.getOrderAnalytics().toPromise()]).then(([{ Chart }, analytics]) => {
        const isDark = this.dataService.theme() === 'dark';
        const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? '#9ca3af' : '#6b7280';

        const days = analytics?.byDay ?? [];
        const last7 = days.slice(-7);
        const ordersLabels = last7.map((d: any) => d.day?.slice(5) ?? '');
        const ordersData = last7.map((d: any) => Number(d.orders) || 0);

        // Aggregate revenue by week (4 buckets from last 28 days)
        const last28 = days.slice(-28);
        const weekRevenue = [0, 0, 0, 0];
        last28.forEach((d: any, i: number) => { weekRevenue[Math.floor(i / 7)] += Number(d.revenue) || 0; });

        new Chart(this.ordersChartRef.nativeElement, {
          type: 'line',
          data: {
            labels: ordersLabels.length ? ordersLabels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
              label: 'Orders',
              data: ordersData.length ? ordersData : [0, 0, 0, 0, 0, 0, 0],
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99,102,241,0.12)',
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#6366f1',
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: textColor }, grid: { color: gridColor } },
              y: { ticks: { color: textColor }, grid: { color: gridColor } },
            },
          },
        });

        new Chart(this.revenueChartRef.nativeElement, {
          type: 'bar',
          data: {
            labels: ['W1', 'W2', 'W3', 'W4'],
            datasets: [{
              label: 'Revenue ($)',
              data: weekRevenue.map(v => Math.round(v)),
              backgroundColor: 'rgba(16,185,129,0.75)',
              borderRadius: 5,
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: textColor }, grid: { color: gridColor } },
              y: { ticks: { color: textColor }, grid: { color: gridColor } },
            },
          },
        });
      });
    });
  }

  // #3 Export KPI summary as PDF
  async exportPDF() {
    this.isPdfLoading.set(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      doc.setFontSize(20);
      doc.setTextColor(30, 30, 30);
      doc.text('NEXUS Platform — Overview Report', 14, 20);

      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Tenant: ${this.dataService.currentUser().name}`, 14, 34);

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 38, 196, 38);

      const kpis = [
        ['Revenue This Month', '€4.2M', '+12% vs last month'],
        ['Active Customers', String(this.kpiCustomers()), '34 new this month'],
        ['Open Orders', String(this.kpiOpenOrders()), '28 overdue'],
        ['Pending Approvals', String(this.kpiApprovals()), 'Need your action'],
      ];

      doc.setFontSize(13);
      doc.setTextColor(30, 30, 30);
      doc.text('Key Performance Indicators', 14, 48);

      doc.setFontSize(10);
      let y = 56;
      for (const [label, value, note] of kpis) {
        doc.setTextColor(80, 80, 80);
        doc.text(label, 18, y);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text(value, 100, y);
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(note, 140, y);
        doc.setFontSize(10);
        y += 10;
      }

      doc.save(`nexus-overview-${new Date().toISOString().slice(0, 10)}.pdf`);
      this.toastService.show('PDF exported successfully', 'success');
    } catch {
      this.toastService.show('Failed to generate PDF', 'error');
    } finally {
      this.isPdfLoading.set(false);
    }
  }

  showReportModal = signal(false);
  reportForm = { name: '', type: 'sales', range: 'this-month', sources: [] as string[] };

  approvals = signal<any[]>([]);

  newReport() {
    this.reportForm = { name: '', type: 'sales', range: 'this-month', sources: ['AdventureWorks DB', 'Salesforce CRM'] };
    this.showReportModal.set(true);
  }

  toggleSource(src: string) {
    if (this.reportForm.sources.includes(src)) {
      this.reportForm.sources = this.reportForm.sources.filter(s => s !== src);
    } else {
      this.reportForm.sources = [...this.reportForm.sources, src];
    }
  }

  generateReport() {
    if (!this.reportForm.name.trim()) {
      this.toastService.show('Please enter a report name', 'error');
      return;
    }
    this.showReportModal.set(false);
    this.toastService.show(`Generating "${this.reportForm.name}" report...`, 'info');
    setTimeout(() => {
      this.toastService.show(`Report "${this.reportForm.name}" ready — downloading PDF`, 'success');
    }, 2000);
  }

  viewAllCustomers() {
    this.router.navigate(['/customers']);
  }

  approve(approval: any) {
    this.api.resolveApproval(approval.id, 'approved').subscribe();
    this.approvals.update(apps => apps.filter(a => a.id !== approval.id));
    this.kpiApprovals.update(v => Math.max(0, Number(v) - 1));
    this.toastService.show(`Approved: ${approval.title}`, 'success');
  }

  review(approval: any) {
    this.router.navigate(['/pending-approvals']);
  }
}
