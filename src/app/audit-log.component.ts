import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'AUDIT_LOG.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'AUDIT_LOG.SUBTITLE' | translate }} {{ dataService.auditLogs().length }} {{ 'AUDIT_LOG.SUBTITLE_ENTRIES' | translate }}</p>
        </div>
        <div class="flex items-center gap-3">
          <input type="text" [value]="searchTerm()" (input)="updateSearch($event)"
            [placeholder]="'AUDIT_LOG.SEARCH_PLACEHOLDER' | translate" class="bg-bg-card border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500 w-72">
          <select [value]="limitValue()" (change)="changeLimit($event)"
            class="bg-bg-card border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            <option value="50">{{ 'AUDIT_LOG.SELECT_LAST_50' | translate }}</option>
            <option value="100">{{ 'AUDIT_LOG.SELECT_LAST_100' | translate }}</option>
            <option value="250">{{ 'AUDIT_LOG.SELECT_LAST_250' | translate }}</option>
            <option value="500">{{ 'AUDIT_LOG.SELECT_LAST_500' | translate }}</option>
          </select>
          <button (click)="refresh()" [disabled]="isLoading()"
            class="bg-bg-hover hover:bg-border-subtle text-text-primary px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60">
            <span class="material-icons text-[18px]" [class.animate-spin]="isLoading()">refresh</span>
            {{ 'AUDIT_LOG.BTN_REFRESH' | translate }}
          </button>
        </div>
      </div>

      <!-- #9 Advanced filters -->
      <div class="bg-bg-card border border-border-subtle rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1 min-w-[150px]">
          <label class="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{{ 'AUDIT_LOG.FILTER_LBL_FROM_DATE' | translate }}</label>
          <input type="date" [(ngModel)]="filterDateFrom"
            class="bg-bg-main border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
        </div>
        <div class="flex flex-col gap-1 min-w-[150px]">
          <label class="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{{ 'AUDIT_LOG.FILTER_LBL_TO_DATE' | translate }}</label>
          <input type="date" [(ngModel)]="filterDateTo"
            class="bg-bg-main border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
        </div>
        <div class="flex flex-col gap-1 min-w-[160px]">
          <label class="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{{ 'AUDIT_LOG.FILTER_LBL_ACTOR' | translate }}</label>
          <input type="text" [(ngModel)]="filterActor" [placeholder]="'AUDIT_LOG.FILTER_PLACEHOLDER_ACTOR' | translate"
            class="bg-bg-main border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
        </div>
        <div class="flex flex-col gap-1 min-w-[140px]">
          <label class="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">{{ 'AUDIT_LOG.FILTER_LBL_RESULT' | translate }}</label>
          <select [(ngModel)]="filterSeverity"
            class="bg-bg-main border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            <option value="">{{ 'AUDIT_LOG.FILTER_OPT_ALL' | translate }}</option>
            <option value="success">{{ 'AUDIT_LOG.FILTER_OPT_SUCCESS' | translate }}</option>
            <option value="error">{{ 'AUDIT_LOG.FILTER_OPT_ERROR' | translate }}</option>
            <option value="auth">{{ 'AUDIT_LOG.FILTER_OPT_AUTH' | translate }}</option>
          </select>
        </div>
        <button (click)="clearFilters()"
          class="ml-auto bg-bg-hover border border-border-subtle hover:bg-border-subtle text-text-primary px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
          <span class="material-icons text-[16px]">filter_alt_off</span>
          {{ 'AUDIT_LOG.BTN_CLEAR_FILTERS' | translate }}
        </button>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        @if (isLoading()) {
          <div class="px-5 py-10 text-center text-text-secondary text-sm">
            <span class="material-icons text-[40px] block mx-auto mb-2 opacity-30 animate-spin">autorenew</span>{{ 'AUDIT_LOG.LOADING' | translate }}
          </div>
        } @else {
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'AUDIT_LOG.TABLE_COL_TIMESTAMP' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'AUDIT_LOG.TABLE_COL_ACTOR' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'AUDIT_LOG.TABLE_COL_ACTION' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'AUDIT_LOG.TABLE_COL_ENTITY' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'AUDIT_LOG.TABLE_COL_RESULT' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (log of filteredLogs(); track log.timestamp + log.action) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 text-text-secondary font-mono text-xs whitespace-nowrap">{{ log.timestamp }}</td>
                <td class="px-5 py-4 text-text-primary font-medium">{{ log.actor }}</td>
                <td class="px-5 py-4">
                  <span [class]="actionBadgeClass(log.action)"
                    class="px-2 py-1 rounded text-xs font-medium">{{ log.action }}</span>
                </td>
                <td class="px-5 py-4 font-mono text-indigo-400 text-xs">{{ log.entity }}</td>
                <td class="px-5 py-4 text-text-secondary text-xs truncate max-w-xs">{{ log.result }}</td>
              </tr>
            }
            @if (filteredLogs().length === 0) {
              <tr><td colspan="5" class="px-5 py-10 text-center text-text-secondary">{{ 'AUDIT_LOG.EMPTY_LOGS' | translate }}</td></tr>
            }
          </tbody>
        </table>
        }
        @if (totalPages() > 1) {
          <div class="px-6 py-3 border-t border-border-subtle flex items-center justify-between text-sm text-text-secondary">
            <span>{{ totalLogs() }} {{ 'AUDIT_LOG.PAGINATION_ENTRIES' | translate }} {{ currentPage() }} {{ 'AUDIT_LOG.PAGINATION_OF' | translate }} {{ totalPages() }}</span>
            <div class="flex items-center gap-2">
              <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1"
                class="px-3 py-1 rounded border border-border-subtle bg-bg-hover hover:bg-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <span class="material-icons text-[16px]">chevron_left</span>
              </button>
              <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === totalPages()"
                class="px-3 py-1 rounded border border-border-subtle bg-bg-hover hover:bg-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <span class="material-icons text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class AuditLogComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);

  searchTerm = signal('');
  isLoading = signal(false);
  limitValue = signal(100);
  currentPage = signal(1);
  totalLogs = signal(0);
  totalPages = signal(0);

  // #9 Advanced filters
  filterDateFrom = '';
  filterDateTo = '';
  filterActor = '';
  filterSeverity = '';

  ngOnInit() { this.loadLogs(); }

  private loadLogs() {
    this.isLoading.set(true);
    this.api.getAuditLogs(this.limitValue(), this.currentPage()).subscribe({
      next: (res) => {
        this.totalLogs.set(res.total);
        this.totalPages.set(res.totalPages);
        if (res.data.length) {
          this.dataService.auditLogs.set(res.data.map((l: any) => ({
            timestamp: l.createdAt ? new Date(l.createdAt).toLocaleString() : l.timestamp,
            actor: l.actor,
            action: l.action,
            entity: l.entity + (l.entityId ? ` (${l.entityId})` : ''),
            result: l.result ?? 'ok',
          })));
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  refresh() { this.currentPage.set(1); this.loadLogs(); }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadLogs();
  }

  changeLimit(event: Event) {
    this.limitValue.set(parseInt((event.target as HTMLSelectElement).value, 10));
    this.currentPage.set(1);
    this.loadLogs();
  }

  filteredLogs = computed(() => {
    // force reactivity on search term
    const term = this.searchTerm().toLowerCase();
    let logs = this.dataService.auditLogs();

    if (term) {
      logs = logs.filter(log =>
        log.action.toLowerCase().includes(term) ||
        log.actor.toLowerCase().includes(term) ||
        log.entity.toLowerCase().includes(term) ||
        (log.result ?? '').toLowerCase().includes(term)
      );
    }

    // #9 Advanced filters (applied on top of search)
    if (this.filterActor) {
      const a = this.filterActor.toLowerCase();
      logs = logs.filter(l => l.actor.toLowerCase().includes(a));
    }
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= from);
    }
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo + 'T23:59:59').getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= to);
    }
    if (this.filterSeverity) {
      const sev = this.filterSeverity;
      logs = logs.filter(l => {
        const combined = (l.action + ' ' + (l.result ?? '')).toLowerCase();
        if (sev === 'success') return combined.includes('success') || combined.includes('approved') || combined.includes('completed');
        if (sev === 'error') return combined.includes('error') || combined.includes('failed') || combined.includes('rejected');
        if (sev === 'auth') return combined.includes('login') || combined.includes('auth');
        return true;
      });
    }
    return logs;
  });

  clearFilters() {
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterActor = '';
    this.filterSeverity = '';
    this.searchTerm.set('');
  }

  updateSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  actionBadgeClass(action: string): string {
    if (action.includes('approved') || action.includes('success') || action.includes('completed')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (action.includes('rejected') || action.includes('error') || action.includes('failed')) return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    if (action.includes('login') || action.includes('auth')) return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    return 'bg-neutral-800 text-text-primary border border-neutral-700';
  }
}
