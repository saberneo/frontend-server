import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

interface IssueRecord {
  id: string;
  field: string;
  value: string;
  source: string;
  detected: string;
}

@Component({
  selector: 'app-data-health',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Issue Records Modal -->
    @if (issueModal()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeIssueModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-5 border-b border-border-subtle">
            <div>
              <h2 class="text-base font-semibold text-text-primary">{{ issueModal()!.title }}</h2>
              <p class="text-xs text-text-secondary mt-0.5">{{ issueModal()!.records.length }} records · {{ issueModal()!.source }}</p>
            </div>
            <button (click)="closeIssueModal()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="overflow-y-auto flex-1">
            <table class="w-full text-sm">
              <thead class="text-xs text-text-secondary bg-bg-hover/50 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left font-medium">{{ 'DATA_HEALTH.MODAL_ISSUE_COL_RECORD_ID' | translate }}</th>
                  <th class="px-4 py-3 text-left font-medium">{{ 'DATA_HEALTH.MODAL_ISSUE_COL_FIELD' | translate }}</th>
                  <th class="px-4 py-3 text-left font-medium">{{ 'DATA_HEALTH.MODAL_ISSUE_COL_VALUE' | translate }}</th>
                  <th class="px-4 py-3 text-left font-medium">{{ 'DATA_HEALTH.MODAL_ISSUE_COL_DETECTED' | translate }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                @for (rec of issueModal()!.records; track rec.id) {
                  <tr class="hover:bg-bg-hover/50 transition-colors">
                    <td class="px-4 py-3 font-mono text-xs text-indigo-400">{{ rec.id }}</td>
                    <td class="px-4 py-3 text-text-secondary">{{ rec.field }}</td>
                    <td class="px-4 py-3 text-rose-400 font-mono text-xs">{{ rec.value }}</td>
                    <td class="px-4 py-3 text-text-secondary">{{ rec.detected }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="flex justify-between items-center p-4 border-t border-border-subtle">
            <p class="text-xs text-text-secondary">{{ 'DATA_HEALTH.MODAL_FOOTER_DATA_FROM' | translate }} {{ issueModal()!.source }} · {{ 'DATA_HEALTH.MODAL_FOOTER_AS_OF' | translate }}</p>
            <button (click)="closeIssueModal()" class="px-4 py-2 bg-bg-hover text-text-primary border border-border-subtle hover:bg-border-subtle rounded-md text-sm font-medium transition-colors">{{ 'DATA_HEALTH.MODAL_BTN_CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <div class="p-8 max-w-7xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">{{ 'DATA_HEALTH.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ 'DATA_HEALTH.SUBTITLE' | translate }}</p>
        </div>
        <button (click)="refreshAll()" class="px-3 py-1.5 bg-bg-hover text-text-primary text-sm font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors flex items-center gap-2">
          <span class="material-icons text-[18px]">refresh</span>
          {{ 'DATA_HEALTH.BTN_REFRESH_ALL' | translate }}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'DATA_HEALTH.KPI_HEALTH_SCORE' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ stats().healthScore ?? '—' }}%</div>
          <div class="text-sm text-emerald-500 flex items-center gap-1">
            <span class="material-icons text-[16px]">arrow_upward</span>
            Computed from {{ sources().length }} active source{{ sources().length !== 1 ? 's' : '' }}
          </div>
        </div>
        
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'DATA_HEALTH.KPI_FRESHNESS' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ stats().freshness ?? '—' }}%</div>
          <div class="text-sm text-text-secondary flex items-center gap-1">
            <span class="material-icons text-[16px] text-amber-500">access_time</span>
            {{ 'DATA_HEALTH.KPI_FRESHNESS_BASED' | translate }}
          </div>
        </div>

        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-blue-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'DATA_HEALTH.KPI_COMPLETENESS' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">{{ stats().completeness ?? '—' }}%</div>
          <div class="text-sm text-text-secondary flex items-center gap-1">
            <span class="material-icons text-[16px]">trending_flat</span>
            {{ 'DATA_HEALTH.KPI_COMPLETENESS_POPULATED' | translate }}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Source Status -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <div class="p-6 border-b border-border-subtle">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'DATA_HEALTH.SECTION_SOURCE_STATUS' | translate }}</h2>
          </div>
          <div class="divide-y divide-border-subtle">
            @for (src of sources(); track src.id) {
              <div class="p-4 flex items-center justify-between hover:bg-bg-hover/50 transition-colors">
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full"
                    [class.bg-emerald-500]="src.status === 'active' || src.status === 'syncing'"
                    [class.bg-amber-500]="src.status === 'delayed'"
                    [class.bg-rose-500]="src.status === 'error' || src.status === 'inactive'">
                  </div>
                  <div>
                    <p class="text-sm font-medium text-text-primary">{{ src.name }}</p>
                    <p class="text-xs text-text-secondary">{{ src.type }} &middot; {{ src.records ?? '0' }} records</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium"
                    [class.text-text-primary]="src.status === 'active'"
                    [class.text-emerald-400]="src.status === 'syncing'"
                    [class.text-amber-400]="src.status === 'delayed'"
                    [class.text-rose-400]="src.status === 'error' || src.status === 'inactive'">
                    {{ src.status | titlecase }}
                  </p>
                  <p class="text-xs text-text-secondary">{{ 'DATA_HEALTH.LABEL_LAST_SYNC' | translate }} {{ src.lastSync }}</p>
                </div>
              </div>
            }
            @if (sources().length === 0) {
              <div class="p-6 text-center text-text-secondary text-sm">{{ 'DATA_HEALTH.EMPTY_CONNECTORS' | translate }}</div>
            }
          </div>
        </div>

        <!-- Data Quality Issues -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <div class="p-6 border-b border-border-subtle flex items-center justify-between">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'DATA_HEALTH.SECTION_QUALITY_ISSUES' | translate }}</h2>
            @if (issues().length > 0) {
              <span class="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 py-1 px-2.5 rounded-md text-xs font-medium">{{ issues().length }} issue{{ issues().length !== 1 ? 's' : '' }} found</span>
            } @else {
              <span class="bg-emerald-500/10 text-emerald-400 py-1 px-2.5 rounded-md text-xs font-medium border border-emerald-500/20">{{ 'DATA_HEALTH.BADGE_ALL_CLEAN' | translate }}</span>
            }
          </div>
          <div class="divide-y divide-border-subtle">
            @for (issue of issues(); track issue.issueKey) {
              <div class="p-4 hover:bg-bg-hover/50 transition-colors">
                <div class="flex items-start gap-3">
                  <span class="material-icons text-[20px] mt-0.5"
                    [class.text-amber-500]="issue.type === 'warning'"
                    [class.text-rose-500]="issue.type === 'error'"
                    [class.text-blue-500]="issue.type === 'info'">
                    {{ issue.type === 'error' ? 'error_outline' : (issue.type === 'warning' ? 'warning' : 'info') }}
                  </span>
                  <div>
                    <p class="text-sm font-medium text-text-primary">{{ issue.title }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ issue.description }}</p>
                    <p class="text-xs text-text-secondary mt-0.5 opacity-60">Source: {{ issue.source }}</p>
                  </div>
                </div>
              </div>
            }
            @if (issues().length === 0 && !loading()) {
              <div class="p-6 text-center">
                <span class="material-icons text-emerald-500 text-3xl mb-2 block">check_circle</span>
                <p class="text-sm text-text-secondary">No data quality issues detected</p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class DataHealthComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);

  stats = signal<any>({ healthScore: null, freshness: null, completeness: null });
  sources = signal<any[]>([]);
  issues = signal<any[]>([]);
  loading = signal(true);

  issueModal = signal<{ title: string; source: string; records: IssueRecord[] } | null>(null);

  ngOnInit() {
    this.loadDataHealth();
  }

  private loadDataHealth() {
    this.loading.set(true);
    this.api.getDataHealth().subscribe(data => {
      if (data?.stats) this.stats.set(data.stats);
      if (data?.sources?.length) this.sources.set(data.sources);
      if (data?.issues) this.issues.set(data.issues);
      this.loading.set(false);
    });
  }

  refreshAll() {
    this.toastService.show('Refreshing all data sources...', 'info');
    this.loadDataHealth();
    setTimeout(() => {
      this.toastService.show('Data health refreshed', 'success');
    }, 1200);
  }

  closeIssueModal() {
    this.issueModal.set(null);
  }
}
