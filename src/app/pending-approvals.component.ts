import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

interface ApprovalItem {
  id: number;
  type: string;
  icon: string;
  iconBgClass: string;
  iconColorClass: string;
  title: string;
  category: string;
  categoryColorClass: string;
  details: string;
  description: string;
  submittedAt: string;
  isHighPriority: boolean;
  canReject: boolean;
}

@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Review Detail Modal -->
    @if (reviewingItem()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeReviewModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-xl shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" [class]="reviewingItem()!.iconBgClass">
                <span class="material-icons text-[20px]" [class]="reviewingItem()!.iconColorClass">{{ reviewingItem()!.icon }}</span>
              </div>
              <div>
                <h2 class="text-base font-semibold text-text-primary">{{ reviewingItem()!.title }}</h2>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{{ reviewingItem()!.category }}</span>
                  @if (reviewingItem()!.isHighPriority) {
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">{{ 'PENDING_APPROVALS.BADGE_HIGH_PRIORITY' | translate }}</span>
                  }
                </div>
              </div>
            </div>
            <button (click)="closeReviewModal()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div class="bg-bg-input border border-border-subtle rounded-lg p-4">
              <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'PENDING_APPROVALS.MODAL_LBL_DETAILS' | translate }}</h3>
              <p class="text-sm font-medium text-text-primary">{{ reviewingItem()!.details }}</p>
            </div>
            <div class="bg-bg-input border border-border-subtle rounded-lg p-4">
              <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'PENDING_APPROVALS.MODAL_LBL_REQUESTER_NOTE' | translate }}</h3>
              <p class="text-sm text-text-primary italic">"{{ reviewingItem()!.description }}"</p>
            </div>
            <div class="bg-bg-input border border-border-subtle rounded-lg p-4 flex items-center gap-4 text-sm">
              <div>
                <span class="text-text-secondary">{{ 'PENDING_APPROVALS.MODAL_LBL_SUBMITTED' | translate }}</span>
                <span class="text-text-primary ml-1 font-medium">{{ reviewingItem()!.submittedAt }}</span>
              </div>
              <div>
                <span class="text-text-secondary">{{ 'PENDING_APPROVALS.MODAL_LBL_TYPE' | translate }}</span>
                <span class="text-text-primary ml-1 font-medium capitalize">{{ reviewingItem()!.type }}</span>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 p-6 border-t border-border-subtle">
            <button (click)="approve(reviewingItem()!); closeReviewModal()"
              class="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
              <span class="material-icons text-[16px]">check</span>{{ 'PENDING_APPROVALS.MODAL_BTN_APPROVE' | translate }}
            </button>
            <button (click)="reject(reviewingItem()!); closeReviewModal()"
              class="px-4 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/30 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
              <span class="material-icons text-[16px]">close</span>{{ 'PENDING_APPROVALS.MODAL_BTN_REJECT' | translate }}
            </button>
            <button (click)="closeReviewModal()" class="px-4 py-2 bg-bg-hover text-text-primary border border-border-subtle hover:bg-border-subtle rounded-md text-sm font-medium transition-colors">{{ 'PENDING_APPROVALS.MODAL_BTN_CANCEL' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <div class="p-8 max-w-7xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">{{ 'PENDING_APPROVALS.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ 'PENDING_APPROVALS.SUBTITLE' | translate }}</p>
        </div>
        <div class="flex gap-2">
          <button (click)="approveAll()" [disabled]="pendingItems().length === 0"
            class="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-sm font-medium rounded-md border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-icons text-[18px]">done_all</span>
            {{ 'PENDING_APPROVALS.BTN_APPROVE_ALL' | translate }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-bg-card p-6 rounded-xl border-l-4 border-l-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-sm font-medium text-text-secondary mb-1">{{ 'PENDING_APPROVALS.KPI_TOTAL_PENDING' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary">{{ totalPending() }}</div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-l-4 border-l-rose-500 border border-border-subtle shadow-sm">
          <h3 class="text-sm font-medium text-text-secondary mb-1">{{ 'PENDING_APPROVALS.KPI_HIGH_PRIORITY' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary">{{ highPriorityCount() }}</div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-l-4 border-l-blue-500 border border-border-subtle shadow-sm">
          <h3 class="text-sm font-medium text-text-secondary mb-1">{{ 'PENDING_APPROVALS.KPI_APPROVED_TODAY' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary">{{ approvedToday() }}</div>
        </div>
      </div>

      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-hover/30">
          <h2 class="font-medium text-text-primary">{{ 'PENDING_APPROVALS.SECTION_ACTION_REQUIRED' | translate }}</h2>
          @if (pendingItems().length > 0) {
            <span class="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 py-1 px-2.5 rounded-md text-xs font-medium">{{ pendingItems().length }} {{ 'PENDING_APPROVALS.BADGE_PENDING' | translate }}</span>
          }
        </div>

        @if (pendingItems().length === 0) {
          <div class="p-12 text-center">
            <span class="material-icons text-[48px] text-emerald-500 block mb-3">check_circle</span>
            <p class="text-lg font-medium text-text-primary">{{ 'PENDING_APPROVALS.EMPTY_STATE' | translate }}</p>
            <p class="text-sm text-text-secondary mt-1">{{ 'PENDING_APPROVALS.EMPTY_STATE_MSG' | translate }}</p>
          </div>
        }

        <div class="divide-y divide-border-subtle">
          @for (item of pendingItems(); track item.id) {
            <div class="p-6 hover:bg-bg-hover/50 transition-colors">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-4 flex-1 min-w-0">
                  <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" [class]="item.iconBgClass">
                    <span class="material-icons text-[20px]" [class]="item.iconColorClass">{{ item.icon }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="text-base font-medium text-text-primary">{{ item.title }}</h3>
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{{ item.category }}</span>
                      @if (item.isHighPriority) {
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">{{ 'PENDING_APPROVALS.BADGE_HIGH_PRIORITY' | translate }}</span>
                      }
                    </div>
                    <p class="text-sm text-text-secondary mt-1">{{ item.details }}</p>
                    <p class="text-sm text-text-secondary mt-1 italic">"{{ item.description }}"</p>
                    <div class="mt-2 text-xs text-text-secondary">{{ 'PENDING_APPROVALS.SUBMITTED_LABEL' | translate }} {{ item.submittedAt }}</div>
                  </div>
                </div>
                <div class="flex gap-2 shrink-0">
                  <button (click)="approve(item)"
                    class="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-sm font-medium rounded-md hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors">
                    {{ 'PENDING_APPROVALS.BTN_APPROVE' | translate }}
                  </button>
                  @if (item.canReject) {
                    <button (click)="reject(item)"
                      class="px-4 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 text-sm font-medium rounded-md hover:bg-rose-200 dark:hover:bg-rose-500/30 transition-colors">
                      {{ 'PENDING_APPROVALS.BTN_REJECT' | translate }}
                    </button>
                  } @else {
                    <button (click)="reviewDetails(item)"
                      class="px-4 py-2 bg-bg-hover text-text-primary text-sm font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors">
                      {{ 'PENDING_APPROVALS.BTN_REVIEW_DETAILS' | translate }}
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class PendingApprovalsComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api  = inject(ApiService);

  approvedToday = signal(0);
  reviewingItem = signal<ApprovalItem | null>(null);

  ngOnInit() {
    this.loadApprovals();
  }

  private loadApprovals() {
    this.api.getPendingApprovals().subscribe({
      next: (data) => {
        if (data.length) {
          const iconMap: Record<string, { icon: string; bg: string; color: string }> = {
            'schema-change':  { icon: 'table_chart',    bg: 'bg-indigo-100 dark:bg-indigo-500/20', color: 'text-indigo-600 dark:text-indigo-400' },
            'new-connector':  { icon: 'power',          bg: 'bg-blue-100 dark:bg-blue-500/20',    color: 'text-blue-600 dark:text-blue-400'    },
            'access-request': { icon: 'lock_person',    bg: 'bg-rose-100 dark:bg-rose-500/20',    color: 'text-rose-600 dark:text-rose-400'    },
            'field-mapping':  { icon: 'schema',         bg: 'bg-amber-100 dark:bg-amber-500/20',  color: 'text-amber-600 dark:text-amber-400'  },
          };
          this.pendingItems.set(data.map((a: any) => {
            const ic = iconMap[a.type] ?? { icon: 'pending', bg: 'bg-slate-100 dark:bg-slate-500/20', color: 'text-slate-600 dark:text-slate-400' };
            return {
              id:              a.id,
              type:            a.type,
              icon:            a.icon || ic.icon,
              iconBgClass:     ic.bg,
              iconColorClass:  ic.color,
              title:           a.title,
              category:        a.category,
              categoryColorClass: '',
              details:         a.details,
              description:     a.description,
              submittedAt:     'pending',
              isHighPriority:  a.isHighPriority,
              canReject:       a.canReject,
            };
          }));
        }
      },
    });
  }

  pendingItems = signal<ApprovalItem[]>([]);

  totalPending = computed(() => this.pendingItems().length);
  highPriorityCount = computed(() => this.pendingItems().filter(i => i.isHighPriority).length);

  approveAll() {
    this.api.resolveAllApprovals().subscribe();
    const count = this.pendingItems().length;
    this.pendingItems.set([]);
    this.approvedToday.update(n => n + count);
    this.toastService.show(`${count} item${count !== 1 ? 's' : ''} approved`, 'success');
  }

  approve(item: ApprovalItem) {
    this.api.resolveApproval(item.id, 'approved').subscribe();
    this.pendingItems.update(items => items.filter(i => i.id !== item.id));
    this.approvedToday.update(n => n + 1);
    this.toastService.show(`Approved: ${item.title}`, 'success');
  }

  reject(item: ApprovalItem) {
    this.api.resolveApproval(item.id, 'rejected').subscribe();
    this.pendingItems.update(items => items.filter(i => i.id !== item.id));
    this.toastService.show(`Rejected: ${item.title}`, 'info');
  }

  reviewDetails(item: ApprovalItem) {
    this.reviewingItem.set(item);
  }

  closeReviewModal() {
    this.reviewingItem.set(null);
  }
}

