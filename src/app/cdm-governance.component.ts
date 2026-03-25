import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-cdm-governance',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'CDM_GOVERNANCE.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'CDM_GOVERNANCE.SUBTITLE' | translate }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-amber-400 text-sm font-medium bg-amber-500/10 px-3 py-1.5 rounded-md border border-amber-500/20">{{ dataService.proposals().length }} {{ 'CDM_GOVERNANCE.BADGE_PENDING' | translate }}</span>
          <button (click)="approveHighConfidence()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            {{ 'CDM_GOVERNANCE.BTN_APPROVE_90' | translate }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'CDM_GOVERNANCE.KPI_PENDING_REVIEW' | translate }}</div>
          <div class="text-3xl font-bold text-amber-400 mb-1">{{ dataService.proposals().length }}</div>
        </div>
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'CDM_GOVERNANCE.KPI_APPROVED_MAPPINGS' | translate }}</div>
          <div class="text-3xl font-bold text-emerald-400 mb-1">{{ cdmStats()?.approvedMappings ?? '—' }}</div>
          <div class="text-xs text-text-secondary mt-1">{{ 'CDM_GOVERNANCE.KPI_APPROVED_IN_CDM' | translate }}</div>
        </div>
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'CDM_GOVERNANCE.KPI_AVG_CONFIDENCE' | translate }}</div>
          <div class="text-3xl font-bold text-text-primary mb-1">{{ avgConfidence() }}%</div>
          <div class="text-xs text-text-secondary mt-1">{{ 'CDM_GOVERNANCE.KPI_CONFIDENCE_ACROSS' | translate }}</div>
        </div>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <div class="p-5 border-b border-border-subtle flex justify-between items-center">
          <h2 class="text-base font-semibold text-text-primary">{{ 'CDM_GOVERNANCE.TABLE_HEADER' | translate }}</h2>
          <p class="text-xs text-text-secondary">{{ 'CDM_GOVERNANCE.TABLE_DESC' | translate }}</p>
        </div>
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_GOVERNANCE.TABLE_COL_SOURCE_FIELD' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_GOVERNANCE.TABLE_COL_CDM_ENTITY' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_GOVERNANCE.TABLE_COL_CDM_FIELD' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_GOVERNANCE.TABLE_COL_CONFIDENCE' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_GOVERNANCE.TABLE_COL_SOURCE' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_GOVERNANCE.TABLE_COL_SUBMITTED' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'CDM_GOVERNANCE.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (prop of dataService.proposals(); track prop.sourceField; let i = $index) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 font-mono text-indigo-400 text-xs">{{ prop.sourceField }}</td>
                <td class="px-5 py-4">
                  <span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded text-xs font-medium">{{ prop.entity }}</span>
                </td>
                <td class="px-5 py-4 text-text-primary font-mono text-xs">{{ prop.cdmField }}</td>
                <td class="px-5 py-4">
                  <div class="flex items-center gap-2">
                    <div class="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div class="h-full rounded-full" 
                           [class.bg-emerald-500]="prop.confidence >= 90"
                           [class.bg-amber-500]="prop.confidence >= 80 && prop.confidence < 90"
                           [class.bg-rose-500]="prop.confidence < 80"
                           [style.width.%]="prop.confidence"></div>
                    </div>
                    <span class="text-xs text-text-secondary font-medium">{{ prop.confidence }}%</span>
                  </div>
                </td>
                <td class="px-5 py-4 text-text-secondary text-xs">{{ prop.source }}</td>
                <td class="px-5 py-4 text-text-secondary text-xs">{{ prop.submitted }}</td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button (click)="approveProposal(i)" class="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-xs font-medium transition-colors">{{ 'CDM_GOVERNANCE.BTN_APPROVE' | translate }}</button>
                    <button (click)="rejectProposal(i)" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-xs font-medium transition-colors">{{ 'CDM_GOVERNANCE.BTN_REJECT' | translate }}</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CdmGovernanceComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);

  cdmStats = signal<any>(null);

  avgConfidence = computed(() => {
    const proposals = this.dataService.proposals();
    if (!proposals.length) return 0;
    const avg = proposals.reduce((sum, p) => sum + (p.confidence ?? 0), 0) / proposals.length;
    return Math.round(avg);
  });

  ngOnInit() {
    this.dataService.loadProposals();
    this.api.getCdmGraphStats().subscribe({
      next: (stats) => this.cdmStats.set(stats),
      error: () => {},
    });
  }

  approveHighConfidence() {
    const toApprove = this.dataService.proposals().filter(p => p.confidence >= 90);
    if (!toApprove.length) {
      this.toastService.show('No high confidence proposals to approve', 'info');
      return;
    }
    toApprove.forEach(p => {
      if (p.id) this.api.approveGovernanceProposal(p.id).subscribe();
      this.api.logGovernanceAction('approve_proposal', p.sourceField, p.cdmField).subscribe();
    });
    this.dataService.proposals.update(ps => ps.filter(p => p.confidence < 90));
    this.toastService.show(`Approved ${toApprove.length} high confidence proposals`, 'success');
  }

  approveProposal(index: number) {
    const prop = this.dataService.proposals()[index];
    this.dataService.approveProposal(index);
    this.toastService.show('Proposal approved', 'success');
    if (prop) {
      if (prop.id) this.api.approveGovernanceProposal(prop.id).subscribe();
      this.api.logGovernanceAction('approve_proposal', prop.sourceField, prop.cdmField).subscribe();
    }
  }

  rejectProposal(index: number) {
    const prop = this.dataService.proposals()[index];
    this.dataService.rejectProposal(index);
    this.toastService.show('Proposal rejected', 'info');
    if (prop) {
      if (prop.id) this.api.rejectGovernanceProposal(prop.id, 'Rejected by reviewer').subscribe();
      this.api.logGovernanceAction('reject_proposal', prop.sourceField, prop.cdmField).subscribe();
    }
  }
}
