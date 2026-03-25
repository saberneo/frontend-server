import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { TranslatePipe } from '@ngx-translate/core';

// Full CDM entity definitions by version
const CDM_ENTITIES: Record<string, { entity: string; color: string; fields: { name: string; type: string; required: boolean; since?: string }[] }[]> = {
  '1.0': [
    { entity: 'party', color: 'indigo', fields: [
      { name: 'party_id', type: 'uuid', required: true },
      { name: 'party_name', type: 'string(255)', required: true },
      { name: 'party_type', type: 'enum(person,org,system)', required: true },
      { name: 'party_email', type: 'string(320)', required: false },
    ]},
    { entity: 'transaction', color: 'emerald', fields: [
      { name: 'transaction_id', type: 'uuid', required: true },
      { name: 'transaction_amount', type: 'decimal(18,4)', required: true },
      { name: 'transaction_date', type: 'timestamp', required: true },
      { name: 'transaction_currency', type: 'char(3)', required: true },
    ]},
    { entity: 'product', color: 'blue', fields: [
      { name: 'product_id', type: 'uuid', required: true },
      { name: 'product_name', type: 'string(500)', required: true },
      { name: 'product_sku', type: 'string(100)', required: false },
      { name: 'product_price', type: 'decimal(18,4)', required: false },
    ]},
  ],
  '1.1': [
    { entity: 'party', color: 'indigo', fields: [
      { name: 'party_id', type: 'uuid', required: true },
      { name: 'party_name', type: 'string(255)', required: true },
      { name: 'party_type', type: 'enum(person,org,system)', required: true },
      { name: 'party_email', type: 'string(320)', required: false },
      { name: 'party_country', type: 'char(2)', required: false, since: '1.1' },
      { name: 'party_phone', type: 'string(50)', required: false, since: '1.1' },
    ]},
    { entity: 'transaction', color: 'emerald', fields: [
      { name: 'transaction_id', type: 'uuid', required: true },
      { name: 'transaction_amount', type: 'decimal(18,4)', required: true },
      { name: 'transaction_date', type: 'timestamp', required: true },
      { name: 'transaction_currency', type: 'char(3)', required: true },
      { name: 'transaction_status', type: 'enum(pending,complete,cancelled)', required: false, since: '1.1' },
      { name: 'transaction_ref', type: 'string(100)', required: false, since: '1.1' },
    ]},
    { entity: 'product', color: 'blue', fields: [
      { name: 'product_id', type: 'uuid', required: true },
      { name: 'product_name', type: 'string(500)', required: true },
      { name: 'product_sku', type: 'string(100)', required: false },
      { name: 'product_price', type: 'decimal(18,4)', required: false },
      { name: 'product_category', type: 'string(200)', required: false, since: '1.1' },
    ]},
    { entity: 'location', color: 'amber', fields: [
      { name: 'location_id', type: 'uuid', required: true, since: '1.1' },
      { name: 'location_name', type: 'string(255)', required: true, since: '1.1' },
      { name: 'location_country', type: 'char(2)', required: false, since: '1.1' },
      { name: 'location_city', type: 'string(100)', required: false, since: '1.1' },
      { name: 'location_address', type: 'string(500)', required: false, since: '1.1' },
    ]},
    { entity: 'event', color: 'rose', fields: [
      { name: 'event_id', type: 'uuid', required: true, since: '1.1' },
      { name: 'event_type', type: 'string(100)', required: true, since: '1.1' },
      { name: 'event_timestamp', type: 'timestamp', required: true, since: '1.1' },
      { name: 'event_source', type: 'string(100)', required: false, since: '1.1' },
      { name: 'event_actor_id', type: 'uuid → party', required: false, since: '1.1' },
    ]},
  ],
  '1.2': [
    { entity: 'party', color: 'indigo', fields: [
      { name: 'party_id', type: 'uuid', required: true },
      { name: 'party_name', type: 'string(255)', required: true },
      { name: 'party_type', type: 'enum(person,org,system)', required: true },
      { name: 'party_email', type: 'string(320)', required: false },
      { name: 'party_country', type: 'char(2)', required: false },
      { name: 'party_phone', type: 'string(50)', required: false },
      { name: 'party_external_id', type: 'string(200)', required: false, since: '1.2' },
      { name: 'party_source_system', type: 'string(100)', required: false, since: '1.2' },
    ]},
    { entity: 'transaction', color: 'emerald', fields: [
      { name: 'transaction_id', type: 'uuid', required: true },
      { name: 'transaction_amount', type: 'decimal(18,4)', required: true },
      { name: 'transaction_date', type: 'timestamp', required: true },
      { name: 'transaction_currency', type: 'char(3)', required: true },
      { name: 'transaction_status', type: 'enum(pending,complete,cancelled)', required: false },
      { name: 'transaction_ref', type: 'string(100)', required: false },
      { name: 'transaction_party_id', type: 'uuid → party', required: false, since: '1.2' },
      { name: 'transaction_product_id', type: 'uuid → product', required: false, since: '1.2' },
    ]},
    { entity: 'product', color: 'blue', fields: [
      { name: 'product_id', type: 'uuid', required: true },
      { name: 'product_name', type: 'string(500)', required: true },
      { name: 'product_sku', type: 'string(100)', required: false },
      { name: 'product_price', type: 'decimal(18,4)', required: false },
      { name: 'product_category', type: 'string(200)', required: false },
      { name: 'product_status', type: 'enum(active,retired)', required: false, since: '1.2' },
    ]},
    { entity: 'location', color: 'amber', fields: [
      { name: 'location_id', type: 'uuid', required: true },
      { name: 'location_name', type: 'string(255)', required: true },
      { name: 'location_country', type: 'char(2)', required: false },
      { name: 'location_city', type: 'string(100)', required: false },
      { name: 'location_address', type: 'string(500)', required: false },
    ]},
    { entity: 'event', color: 'rose', fields: [
      { name: 'event_id', type: 'uuid', required: true },
      { name: 'event_type', type: 'string(100)', required: true },
      { name: 'event_timestamp', type: 'timestamp', required: true },
      { name: 'event_source', type: 'string(100)', required: false },
      { name: 'event_actor_id', type: 'uuid → party', required: false },
    ]},
    { entity: 'opportunity', color: 'violet', fields: [
      { name: 'opportunity_id', type: 'uuid', required: true, since: '1.2' },
      { name: 'opportunity_name', type: 'string(500)', required: true, since: '1.2' },
      { name: 'opportunity_amount', type: 'decimal(18,4)', required: false, since: '1.2' },
      { name: 'opportunity_stage', type: 'string(100)', required: false, since: '1.2' },
      { name: 'opportunity_close_date', type: 'date', required: false, since: '1.2' },
      { name: 'opportunity_party_id', type: 'uuid → party', required: false, since: '1.2' },
      { name: 'opportunity_probability', type: 'decimal(5,2)', required: false, since: '1.2' },
    ]},
  ],
  '1.3': [
    { entity: 'party', color: 'indigo', fields: [
      { name: 'party_id', type: 'uuid', required: true },
      { name: 'party_name', type: 'string(255)', required: true },
      { name: 'party_type', type: 'enum(person,org,system)', required: true },
      { name: 'party_email', type: 'string(320)', required: false },
      { name: 'party_country', type: 'char(2)', required: false },
      { name: 'party_phone', type: 'string(50)', required: false },
      { name: 'party_external_id', type: 'string(200)', required: false },
      { name: 'party_source_system', type: 'string(100)', required: false },
      { name: 'party_industry', type: 'string(100)', required: false, since: '1.3' },
      { name: 'party_annual_revenue', type: 'decimal(18,4)', required: false, since: '1.3' },
    ]},
    { entity: 'transaction', color: 'emerald', fields: [
      { name: 'transaction_id', type: 'uuid', required: true },
      { name: 'transaction_amount', type: 'decimal(18,4)', required: true },
      { name: 'transaction_date', type: 'timestamp', required: true },
      { name: 'transaction_currency', type: 'char(3)', required: true },
      { name: 'transaction_status', type: 'enum(pending,complete,cancelled)', required: false },
      { name: 'transaction_ref', type: 'string(100)', required: false },
      { name: 'transaction_party_id', type: 'uuid → party', required: false },
      { name: 'transaction_product_id', type: 'uuid → product', required: false },
      { name: 'transaction_tax', type: 'decimal(18,4)', required: false, since: '1.3' },
      { name: 'transaction_discount', type: 'decimal(5,4)', required: false, since: '1.3' },
    ]},
    { entity: 'product', color: 'blue', fields: [
      { name: 'product_id', type: 'uuid', required: true },
      { name: 'product_name', type: 'string(500)', required: true },
      { name: 'product_sku', type: 'string(100)', required: false },
      { name: 'product_price', type: 'decimal(18,4)', required: false },
      { name: 'product_category', type: 'string(200)', required: false },
      { name: 'product_status', type: 'enum(active,retired)', required: false },
    ]},
    { entity: 'location', color: 'amber', fields: [
      { name: 'location_id', type: 'uuid', required: true },
      { name: 'location_name', type: 'string(255)', required: true },
      { name: 'location_country', type: 'char(2)', required: false },
      { name: 'location_city', type: 'string(100)', required: false },
      { name: 'location_address', type: 'string(500)', required: false },
    ]},
    { entity: 'event', color: 'rose', fields: [
      { name: 'event_id', type: 'uuid', required: true },
      { name: 'event_type', type: 'string(100)', required: true },
      { name: 'event_timestamp', type: 'timestamp', required: true },
      { name: 'event_source', type: 'string(100)', required: false },
      { name: 'event_actor_id', type: 'uuid → party', required: false },
    ]},
    { entity: 'opportunity', color: 'violet', fields: [
      { name: 'opportunity_id', type: 'uuid', required: true },
      { name: 'opportunity_name', type: 'string(500)', required: true },
      { name: 'opportunity_amount', type: 'decimal(18,4)', required: false },
      { name: 'opportunity_stage', type: 'string(100)', required: false },
      { name: 'opportunity_close_date', type: 'date', required: false },
      { name: 'opportunity_party_id', type: 'uuid → party', required: false },
      { name: 'opportunity_probability', type: 'decimal(5,2)', required: false },
    ]},
  ],
};

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

@Component({
  selector: 'app-cdm-versions',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold text-text-primary">{{ 'CDM_VERSIONS.TITLE' | translate }}</h1>
        <p class="text-sm text-text-secondary">{{ 'CDM_VERSIONS.SUBTITLE' | translate }}</p>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_VERSIONS.TABLE_COL_VERSION' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_VERSIONS.TABLE_COL_PUBLISHED' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_VERSIONS.TABLE_COL_BY' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_VERSIONS.TABLE_COL_CHANGES' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'CDM_VERSIONS.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'CDM_VERSIONS.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (version of dataService.versions(); track version.version) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 font-mono text-indigo-400 text-xs">{{ version.version }}</td>
                <td class="px-5 py-4 text-text-secondary text-xs">{{ version.publishedAt }}</td>
                <td class="px-5 py-4 text-text-primary text-xs">{{ version.publishedBy }}</td>
                <td class="px-5 py-4 text-text-primary text-xs">{{ version.changes }}</td>
                <td class="px-5 py-4">
                  @if (version.status === 'active') {
                    <span class="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20">{{ 'CDM_VERSIONS.MODAL_STATUS_ACTIVE' | translate }}</span>
                  } @else {
                    <span class="bg-neutral-800 text-text-secondary px-2 py-1 rounded text-xs font-medium border border-neutral-700">{{ 'CDM_VERSIONS.MODAL_STATUS_RETIRED' | translate }}</span>
                  }
                </td>
                <td class="px-5 py-4 text-right">
                  <button (click)="viewSchema(version)"
                    class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors">
                    {{ 'CDM_VERSIONS.BTN_VIEW_SCHEMA' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal CDM Schema Viewer -->
    @if (selectedVersion()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" (click)="closeModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-5xl my-6 shadow-2xl" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-start justify-between p-6 border-b border-border-subtle">
            <div>
              <div class="flex items-center gap-3 mb-1">
                <span class="material-icons text-indigo-400 text-[22px]">account_tree</span>
                <h2 class="text-lg font-semibold text-text-primary">{{ 'CDM_VERSIONS.MODAL_TITLE' | translate }} {{ selectedVersion()!.version }}</h2>
                @if (selectedVersion()!.status === 'active') {
                  <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-medium">{{ 'CDM_VERSIONS.MODAL_BADGE_ACTIVE' | translate }}</span>
                } @else {
                  <span class="bg-neutral-800 text-text-secondary border border-neutral-700 px-2 py-0.5 rounded-full text-xs font-medium">{{ 'CDM_VERSIONS.MODAL_BADGE_RETIRED' | translate }}</span>
                }
              </div>
              <p class="text-xs text-text-secondary">
                Published {{ selectedVersion()!.publishedAt }} by {{ selectedVersion()!.publishedBy }} •
                {{ entities().length }} entities · {{ totalFields() }} fields
              </p>
            </div>
            <button (click)="closeModal()" class="text-text-secondary hover:text-text-primary transition-colors mt-1">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Resumen de cambios -->
          <div class="mx-6 mt-4 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
            <span class="material-icons text-indigo-400 text-[18px] mt-0.5">info</span>
            <p class="text-sm text-indigo-300">{{ selectedVersion()!.changes }}</p>
          </div>

          <!-- Entities and fields -->
          <div class="p-6 grid grid-cols-1 gap-4">
            @for (ent of entities(); track ent.entity) {
              <div class="border border-border-subtle rounded-lg overflow-hidden">
                <!-- Cabecera entidad -->
                <div class="flex items-center justify-between px-4 py-3 bg-bg-main cursor-pointer hover:bg-bg-hover transition-colors"
                     (click)="toggleEntity(ent.entity)">
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-[16px] text-text-secondary">{{ expandedEntities().has(ent.entity) ? 'expand_less' : 'expand_more' }}</span>
                    <span [class]="entityBadge(ent.color)"
                      class="px-2.5 py-1 rounded-full text-xs font-semibold border font-mono">
                      {{ ent.entity }}
                    </span>
                    <span class="text-xs text-text-secondary">{{ ent.fields.length }} fields</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-text-secondary">{{ ent.fields.filter(f => f.required).length }} required</span>
                    @if (newFieldCount(ent) > 0) {
                      <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs">+{{ newFieldCount(ent) }} new in {{ selectedVersion()!.version }}</span>
                    }
                  </div>
                </div>
                <!-- Fields -->
                @if (expandedEntities().has(ent.entity)) {
                  <div class="divide-y divide-border-subtle">
                    <div class="grid grid-cols-4 gap-0 px-4 py-2 bg-bg-main text-[10px] uppercase tracking-widest text-text-secondary font-semibold">
                      <span>{{ 'CDM_VERSIONS.TABLE_HEADER_FIELDS' | translate }}</span><span>{{ 'CDM_VERSIONS.TABLE_HEADER_TYPE' | translate }}</span><span>{{ 'CDM_VERSIONS.TABLE_HEADER_REQUIRED' | translate }}</span><span>{{ 'CDM_VERSIONS.TABLE_HEADER_ADDED' | translate }}</span>
                    </div>
                    @for (field of ent.fields; track field.name) {
                      <div class="grid grid-cols-4 gap-0 px-4 py-2.5 hover:bg-bg-hover transition-colors"
                           [class.bg-emerald-500/5]="field.since === selectedVersion()!.version">
                        <span class="font-mono text-xs" [class.text-indigo-400]="field.name.endsWith('_id') && !field.name.includes('_id →')" [class.text-text-primary]="!field.name.endsWith('_id')">{{ field.name }}</span>
                        <span class="font-mono text-xs text-blue-400">{{ field.type }}</span>
                        <span class="text-xs">
                          @if (field.required) {
                            <span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px]">{{ 'CDM_VERSIONS.LABEL_REQUIRED' | translate }}</span>
                          } @else {
                            <span class="text-text-secondary text-[10px]">{{ 'CDM_VERSIONS.LABEL_OPTIONAL' | translate }}</span>
                          }
                        </span>
                        <span class="text-xs">
                          @if (field.since) {
                            <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono">v{{ field.since }}</span>
                          } @else {
                            <span class="text-text-secondary text-[10px]">v1.0</span>
                          }
                        </span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <div class="border-t border-border-subtle px-6 py-4 flex justify-end">
            <button (click)="closeModal()" class="px-4 py-2 bg-bg-hover hover:bg-border-subtle text-text-primary rounded-md text-sm font-medium transition-colors">{{ 'CDM_VERSIONS.BTN_CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `
})
export class CdmVersionsComponent implements OnInit {
  dataService = inject(DataService);
  selectedVersion = signal<any>(null);
  expandedEntities = signal<Set<string>>(new Set());

  ngOnInit() {
    this.dataService.loadCdmVersions();
  }

  viewSchema(version: any) {
    this.expandedEntities.set(new Set());
    this.selectedVersion.set(version);
  }

  closeModal() { this.selectedVersion.set(null); }

  entities() {
    const v = this.selectedVersion();
    if (!v) return [];
    return CDM_ENTITIES[v.version] ?? CDM_ENTITIES['1.3'];
  }

  totalFields() {
    return this.entities().reduce((acc, e) => acc + e.fields.length, 0);
  }

  newFieldCount(ent: any) {
    const v = this.selectedVersion();
    if (!v) return 0;
    return ent.fields.filter((f: any) => f.since === v.version).length;
  }

  toggleEntity(name: string) {
    this.expandedEntities.update(s => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  entityBadge(color: string) {
    return COLOR_MAP[color] ?? COLOR_MAP['indigo'];
  }
}
