import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-field-mappings',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold text-text-primary">{{ 'FIELD_MAPPINGS.TITLE' | translate }}</h1>
        <p class="text-sm text-text-secondary">{{ 'FIELD_MAPPINGS.SUBTITLE' | translate }}</p>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'FIELD_MAPPINGS.TABLE_COL_SOURCE_FIELD' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'FIELD_MAPPINGS.TABLE_COL_SUGGESTED_CDM' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'FIELD_MAPPINGS.TABLE_COL_TIER' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'FIELD_MAPPINGS.TABLE_COL_CONFIDENCE' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'FIELD_MAPPINGS.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'FIELD_MAPPINGS.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (mapping of dataService.mappings(); track mapping.sourceField; let i = $index) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 font-mono text-indigo-400 text-xs">{{ mapping.sourceField }}</td>
                <td class="px-5 py-4 text-text-primary font-mono text-xs">{{ mapping.suggestedCdmField }}</td>
                <td class="px-5 py-4">
                  <span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs font-medium">{{ mapping.tier }}</span>
                </td>
                <td class="px-5 py-4">
                  <span class="text-amber-400 font-medium text-xs">{{ mapping.confidence }}%</span>
                </td>
                <td class="px-5 py-4">
                  <span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs font-medium">{{ mapping.status }}</span>
                </td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button (click)="approveMapping(i)" class="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-xs font-medium transition-colors">{{ 'FIELD_MAPPINGS.BTN_TIER1' | translate }}</button>
                    <button (click)="rejectMapping(i)" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-xs font-medium transition-colors">{{ 'FIELD_MAPPINGS.BTN_REJECT' | translate }}</button>
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
export class FieldMappingsComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);

  ngOnInit() {
    this.dataService.loadMappings();
  }

  approveMapping(index: number) {
    const mapping = this.dataService.mappings()[index];
    this.dataService.approveMapping(index);
    this.toastService.show('Mapping approved to Tier-1', 'success');
    if (mapping) {
      if (mapping.id) this.api.approveMappingReview(mapping.id).subscribe();
      this.api.logGovernanceAction('approve_mapping', mapping.sourceField, mapping.suggestedCdmField).subscribe();
    }
  }

  rejectMapping(index: number) {
    const mapping = this.dataService.mappings()[index];
    this.dataService.rejectMapping(index);
    this.toastService.show('Mapping rejected to Tier-3', 'info');
    if (mapping) {
      if (mapping.id) this.api.rejectMappingReview(mapping.id).subscribe();
      this.api.logGovernanceAction('reject_mapping', mapping.sourceField, mapping.suggestedCdmField).subscribe();
    }
  }
}
