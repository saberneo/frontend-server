import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';

@Component({
  selector: 'app-schema-registry',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'SCHEMA_REGISTRY.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'SCHEMA_REGISTRY.SUBTITLE' | translate }}</p>
        </div>
        @if (activeTab() === 'source') {
          <button (click)="snapshotAll()" [disabled]="snapshottingAll()"
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-70">
            @if (snapshottingAll()) {
              <span class="material-icons text-[18px] animate-spin">autorenew</span> {{ 'SCHEMA_REGISTRY.BTN_SNAPSHOTTING' | translate }}
            } @else {
              <span class="material-icons text-[18px]">camera_alt</span> {{ 'SCHEMA_REGISTRY.BTN_SNAPSHOT_ALL' | translate }}
            }
          </button>
        }
      </div>

      <!-- Tab switcher -->
      <div class="flex gap-1 bg-bg-main border border-border-subtle rounded-lg p-1 w-fit">
        <button (click)="activeTab.set('source')"
          [class]="activeTab() === 'source' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2">
          <span class="material-icons text-[16px]">storage</span> {{ 'SCHEMA_REGISTRY.TAB_SOURCE_SCHEMAS' | translate }}
        </button>
        <button (click)="activateCdmTab()"
          [class]="activeTab() === 'cdm' ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2">
          <span class="material-icons text-[16px]">account_tree</span> {{ 'SCHEMA_REGISTRY.TAB_CDM_DOMAINS' | translate }}
          @if (cdmDomains().length) {
            <span class="bg-indigo-500/20 text-indigo-400 text-xs px-1.5 py-0.5 rounded-full">{{ cdmDomains().length }}</span>
          }
        </button>
      </div>

      <!-- Source Schemas tab -->
      @if (activeTab() === 'source') {
      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'SCHEMA_REGISTRY.TABLE_COL_CONNECTOR' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SCHEMA_REGISTRY.TABLE_COL_TABLES' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SCHEMA_REGISTRY.TABLE_COL_COLUMNS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SCHEMA_REGISTRY.TABLE_COL_SNAPSHOT' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SCHEMA_REGISTRY.TABLE_COL_DRIFT' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SCHEMA_REGISTRY.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'SCHEMA_REGISTRY.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (schema of dataService.schemas(); track schema.id) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 font-mono text-indigo-400 text-xs">{{ schema.id }}</td>
                <td class="px-5 py-4 text-text-primary">{{ schema.tables }}</td>
                <td class="px-5 py-4 text-text-primary">{{ schema.columns }}</td>
                <td class="px-5 py-4 text-text-secondary">{{ schema.snapshot }}</td>
                <td class="px-5 py-4">
                  @if (schema.drift === 'none') {
                    <span class="bg-neutral-800 text-text-secondary px-2 py-1 rounded text-xs font-medium border border-neutral-700">{{ 'SCHEMA_REGISTRY.BADGE_NONE' | translate }}</span>
                  } @else {
                    <span class="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-medium border border-amber-500/20">{{ schema.drift }}</span>
                  }
                </td>
                <td class="px-5 py-4">
                  @if (schema.status === 'current') {
                    <span class="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20">{{ 'SCHEMA_REGISTRY.BADGE_CURRENT' | translate }}</span>
                  } @else {
                    <span class="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-medium border border-amber-500/20">{{ schema.status }}</span>
                  }
                </td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    @if (schema.status !== 'current' || schema.drift !== 'none') {
                      <button (click)="reprofileSchema(schema)" [disabled]="reprofilingId() === schema.id"
                        class="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-xs font-medium transition-colors disabled:opacity-70">
                        {{ reprofilingId() === schema.id ? ('SCHEMA_REGISTRY.BTN_PROFILING' | translate) : ('SCHEMA_REGISTRY.BTN_REPROFILE' | translate) }}
                      </button>
                    }
                    <button (click)="viewSchema(schema)" [disabled]="viewingId() === schema.id"
                      class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors disabled:opacity-60">
                      {{ viewingId() === schema.id ? ('SCHEMA_REGISTRY.BTN_LOADING' | translate) : ('SCHEMA_REGISTRY.BTN_VIEW_SCHEMA' | translate) }}
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      } <!-- end source tab -->

      <!-- CDM Domains tab -->
      @if (activeTab() === 'cdm') {
        @if (cdmLoading()) {
          <div class="flex items-center justify-center py-16 text-text-secondary gap-3">
            <span class="material-icons animate-spin text-indigo-400">autorenew</span>
            <span class="text-sm">{{ 'SCHEMA_REGISTRY.BADGE_LOADING' | translate }}</span>
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-4">
            @for (domain of cdmDomains(); track domain.name) {
              <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
                <div class="px-5 py-4 border-b border-border-subtle flex items-center gap-3 bg-bg-main">
                  <span class="material-icons text-indigo-400 text-[18px]">folder</span>
                  <span class="font-semibold text-text-primary">{{ domain.name }}</span>
                  @if (domain.description) {
                    <span class="text-xs text-text-secondary">— {{ domain.description }}</span>
                  }
                </div>
                <div class="p-4 space-y-2">
                  @for (schema of getSchemasForDomain(domain.name); track schema.id) {
                    <div class="flex items-center justify-between px-4 py-3 bg-bg-main rounded-lg border border-border-subtle hover:border-indigo-500/40 transition-colors cursor-pointer"
                         (click)="toggleCdmSchema(schema.id)">
                      <div class="flex items-center gap-3">
                        <span class="material-icons text-[16px] text-text-secondary">{{ expandedCdmSchemas().has(schema.id) ? 'expand_less' : 'expand_more' }}</span>
                        <span class="font-mono text-sm text-indigo-300 font-medium">{{ schema.name }}</span>
                        <span class="text-xs text-text-secondary">v{{ schema.version }}</span>
                        @if (schema.piiFields > 0) {
                          <span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs px-2 py-0.5 rounded-full">{{ schema.piiFields }} PII</span>
                        }
                      </div>
                      <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2 py-0.5 rounded-full">{{ schema.fieldCount ?? 0 }} fields</span>
                    </div>
                    @if (expandedCdmSchemas().has(schema.id)) {
                      <div class="ml-8 mt-1 mb-2">
                        @if (cdmFieldsMap()[schema.id]) {
                          <div class="flex flex-wrap gap-2 px-3 py-2">
                            @for (field of cdmFieldsMap()[schema.id]; track field.name) {
                              <span class="bg-bg-card border text-xs px-2.5 py-1 rounded font-mono"
                                [class.border-rose-500]="field.pii"
                                [class.text-rose-300]="field.pii"
                                [class.border-border-subtle]="!field.pii"
                                [class.text-text-secondary]="!field.pii">
                                {{ field.pii ? '🔒 ' : '' }}{{ field.name }}
                                <span class="text-text-secondary opacity-60">:{{ field.type }}</span>
                              </span>
                            }
                          </div>
                        } @else {
                          <div class="flex items-center gap-2 px-3 py-2 text-text-secondary text-xs">
                            <span class="material-icons animate-spin text-[14px]">autorenew</span> {{ 'SCHEMA_REGISTRY.FIELD_LOADING' | translate }}
                          </div>
                        }
                      </div>
                    }
                  } @empty {
                    <p class="text-xs text-text-secondary px-2 py-2">{{ 'SCHEMA_REGISTRY.LABEL_NO_SCHEMAS' | translate }}</p>
                  }
                </div>
              </div>
            }
          </div>
        }
      }
    </div>

    <!-- Schema Viewer Modal -->
    @if (schemaDetail()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto" (click)="closeModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-4xl my-6 shadow-2xl" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-start justify-between p-6 border-b border-border-subtle">
            <div>
              <div class="flex items-center gap-3 mb-1">
                <span class="material-icons text-indigo-400 text-[22px]">schema</span>
                <h2 class="text-lg font-semibold text-text-primary">{{ schemaDetail().connectorName }}</h2>
                <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-medium">{{ schemaDetail().status }}</span>
              </div>
              <p class="text-xs text-text-secondary">{{ schemaDetail().tables }} {{ 'SCHEMA_REGISTRY.MODAL_TABLES' | translate }} {{ schemaDetail().columns }} {{ 'SCHEMA_REGISTRY.MODAL_COLUMNS' | translate }} {{ schemaDetail().snapshot }}</p>
            </div>
            <button (click)="closeModal()" class="text-text-secondary hover:text-text-primary transition-colors mt-1">
              <span class="material-icons">close</span>
            </button>
          </div>
          <!-- Drift Banner -->
          @if (schemaDetail().drift !== 'none') {
            <div class="mx-6 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <span class="material-icons text-amber-400 text-[20px]">warning</span>
              <div>
                <p class="text-sm font-medium text-amber-300">{{ 'SCHEMA_REGISTRY.MODAL_DRIFT_DETECTED' | translate }} {{ schemaDetail().drift }}</p>
                <p class="text-xs text-text-secondary">{{ 'SCHEMA_REGISTRY.MODAL_DRIFT_MSG' | translate }}</p>
              </div>
            </div>
          }
          <!-- Table List -->
          <div class="p-6 space-y-3">
            @for (tbl of schemaDetail().tableList; track tbl.name) {
              <div class="border border-border-subtle rounded-lg overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3 bg-bg-main cursor-pointer hover:bg-bg-hover transition-colors"
                     (click)="toggleTable(tbl.name)">
                  <div class="flex items-center gap-3">
                    <span class="material-icons text-[16px] text-text-secondary">{{ expandedTables().has(tbl.name) ? 'expand_less' : 'expand_more' }}</span>
                    <span class="font-mono text-sm text-indigo-400 font-medium">{{ tbl.name }}</span>
                    <span class="text-xs text-text-secondary">{{ tbl.columns.length }} columns</span>
                  </div>
                  <div class="flex items-center gap-4 text-xs text-text-secondary">
                    <span>{{ tbl.rows?.toLocaleString() }} {{ 'SCHEMA_REGISTRY.MODAL_LABEL_ROWS' | translate }}</span>
                    <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono text-xs">{{ 'SCHEMA_REGISTRY.MODAL_LABEL_PK' | translate }} {{ tbl.primaryKey }}</span>
                  </div>
                </div>
                @if (expandedTables().has(tbl.name)) {
                  <div class="px-4 pb-4 pt-2 bg-bg-card">
                    <div class="flex flex-wrap gap-2">
                      @for (col of tbl.columns; track col) {
                        <span class="bg-bg-main border border-border-subtle text-text-secondary font-mono text-xs px-2.5 py-1 rounded"
                          [class.border-indigo-500]="col === tbl.primaryKey"
                          [class.text-indigo-400]="col === tbl.primaryKey">
                          {{ col === tbl.primaryKey ? '🔑 ' : '' }}{{ col }}
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
          <div class="border-t border-border-subtle px-6 py-4 flex justify-end">
            <button (click)="closeModal()" class="px-4 py-2 bg-bg-hover hover:bg-border-subtle text-text-primary rounded-md text-sm font-medium transition-colors">{{ 'SCHEMA_REGISTRY.MODAL_BTN_CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }
  `
})
export class SchemaRegistryComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);

  activeTab = signal<'source' | 'cdm'>('source');
  schemaDetail = signal<any>(null);
  viewingId = signal<string | null>(null);
  reprofilingId = signal<string | null>(null);
  snapshottingAll = signal(false);
  expandedTables = signal<Set<string>>(new Set());

  cdmLoading = signal(false);
  cdmDomains = signal<any[]>([]);
  cdmSchemas = signal<any[]>([]);
  cdmFieldsMap = signal<Record<string, any[]>>({});
  expandedCdmSchemas = signal<Set<string>>(new Set());

  ngOnInit() {}

  activateCdmTab() {
    this.activeTab.set('cdm');
    if (!this.cdmDomains().length) {
      this.cdmLoading.set(true);
      this.api.getCdmDomains().subscribe({
        next: (domains) => {
          this.cdmDomains.set(domains);
          this.api.getCdmSchemas().subscribe({
            next: (schemas) => {
              this.cdmSchemas.set(schemas);
              this.cdmLoading.set(false);
            },
            error: () => this.cdmLoading.set(false),
          });
        },
        error: () => this.cdmLoading.set(false),
      });
    }
  }

  getSchemasForDomain(domainName: string): any[] {
    return this.cdmSchemas().filter(s => s.domain === domainName);
  }

  toggleCdmSchema(schemaId: string) {
    this.expandedCdmSchemas.update(s => {
      const next = new Set(s);
      if (next.has(schemaId)) {
        next.delete(schemaId);
      } else {
        next.add(schemaId);
        if (!this.cdmFieldsMap()[schemaId]) {
          this.api.getCdmSchemaFields(schemaId).subscribe({
            next: (fields) => this.cdmFieldsMap.update(m => ({ ...m, [schemaId]: fields })),
            error: () => this.cdmFieldsMap.update(m => ({ ...m, [schemaId]: [] })),
          });
        }
      }
      return next;
    });
  }

  viewSchema(schema: any) {
    this.viewingId.set(schema.id);
    const apiId = schema.realId || schema.id;
    this.api.getSchemaDetail(apiId).subscribe({
      next: (detail) => {
        this.viewingId.set(null);
        if (detail) {
          this.expandedTables.set(new Set());
          this.schemaDetail.set(detail);
        } else {
          this.toastService.show('Schema detail not available', 'error');
        }
      },
      error: () => {
        this.viewingId.set(null);
        this.toastService.show('Error loading schema', 'error');
      },
    });
  }

  closeModal() {
    this.schemaDetail.set(null);
  }

  toggleTable(name: string) {
    this.expandedTables.update(s => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  reprofileSchema(schema: any) {
    this.reprofilingId.set(schema.id);
    const apiId = schema.realId || schema.id;
    this.api.reprofileSchema(apiId).subscribe({
      next: (updated) => {
        this.reprofilingId.set(null);
        if (updated) {
          this.dataService.schemas.update(schemas =>
            schemas.map(s => s.id === schema.id
              ? { ...s, status: 'current', drift: 'none', snapshot: updated.snapshot ?? 'just now' }
              : s)
          );
          this.toastService.show(`${schema.id} re-profiled — drift resolved`, 'success');
        } else {
          this.toastService.show('Re-profile failed', 'error');
        }
      },
      error: () => {
        this.reprofilingId.set(null);
        this.toastService.show('Re-profile failed', 'error');
      },
    });
  }

  snapshotAll() {
    this.snapshottingAll.set(true);
    this.api.snapshotAllSchemas().subscribe({
      next: (result) => {
        this.snapshottingAll.set(false);
        this.dataService.schemas.update(schemas =>
          schemas.map(s => ({ ...s, snapshot: 'just now', status: 'current', drift: 'none' }))
        );
        this.toastService.show(`All ${result?.count ?? ''} schemas snapshotted successfully`, 'success');
      },
      error: () => {
        this.snapshottingAll.set(false);
        this.toastService.show('Snapshot failed', 'error');
      },
    });
  }
}
