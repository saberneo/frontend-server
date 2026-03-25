import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DataService } from './data.service';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'TENANTS.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'TENANTS.SUBTITLE' | translate }}</p>
        </div>
        <button (click)="openProvisionModal()"
          class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
          <span class="material-icons text-[18px]">add</span> {{ 'TENANTS.BTN_PROVISION' | translate }}
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.KPI_TOTAL_TENANTS' | translate }}</div>
          <div class="text-3xl font-bold text-text-primary">{{ dataService.tenants().length }}</div>
          <div class="text-xs text-text-secondary mt-1">{{ activeTenants() }} {{ 'TENANTS.KPI_ACTIVE' | translate }}</div>
        </div>
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.KPI_PROFESSIONAL' | translate }}</div>
          <div class="text-3xl font-bold text-text-primary">{{ professionalCount() }}</div>
          <div class="text-xs text-text-secondary mt-1">{{ sandboxCount() }} {{ 'TENANTS.KPI_SANDBOX' | translate }}</div>
        </div>
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.KPI_ACTIVE_CDM' | translate }}</div>
          <div class="text-3xl font-bold text-indigo-400 font-mono">v1.3</div>
          <div class="text-xs text-text-secondary mt-1">{{ 'TENANTS.KPI_PLATFORM_VERSION' | translate }}</div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_TENANT_ID' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_NAME' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_PLAN' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_CONNECTORS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_CDM' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'TENANTS.TABLE_COL_ACTIVATED' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'TENANTS.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (tenant of dataService.tenants(); track tenant.id) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 font-mono text-indigo-400 text-xs">{{ tenant.id }}</td>
                <td class="px-5 py-4 text-text-primary font-medium">{{ tenant.name }}</td>
                <td class="px-5 py-4">
                  @if (tenant.plan === 'professional') {
                    <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded text-xs font-medium">{{ 'TENANTS.BADGE_PROFESSIONAL' | translate }}</span>
                  } @else if (tenant.plan === 'enterprise') {
                    <span class="bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-1 rounded text-xs font-medium">{{ 'TENANTS.BADGE_ENTERPRISE' | translate }}</span>
                  } @else {
                    <span class="bg-neutral-700 text-text-secondary border border-neutral-600 px-2 py-1 rounded text-xs font-medium">{{ 'TENANTS.BADGE_SANDBOX' | translate }}</span>
                  }
                </td>
                <td class="px-5 py-4 text-text-secondary">{{ tenant.connectors }}</td>
                <td class="px-5 py-4 text-text-secondary font-mono text-xs">{{ tenant.cdmVersion }}</td>
                <td class="px-5 py-4">
                  @if (tenant.status === 'active') {
                    <span class="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {{ 'TENANTS.BADGE_ACTIVE' | translate }}
                    </span>
                  } @else if (tenant.status === 'suspended') {
                    <span class="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 px-2 py-1 rounded text-xs font-medium border border-rose-500/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {{ 'TENANTS.BADGE_SUSPENDED' | translate }}
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-medium border border-amber-500/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> {{ tenant.status }}
                    </span>
                  }
                </td>
                <td class="px-5 py-4 text-text-secondary text-xs">{{ tenant.activated }}</td>
                <td class="px-5 py-4 text-right">
                  <button (click)="manageTenant(tenant)"
                    class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors">
                    {{ 'TENANTS.BTN_MANAGE' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========== MODAL GESTIONAR TENANT ========== -->
    @if (managingTenant()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-start justify-end" (click)="closeManage()">
        <div class="bg-bg-card border-l border-border-subtle h-full w-full max-w-xl shadow-2xl overflow-y-auto flex flex-col" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <div>
              <h2 class="text-lg font-semibold text-text-primary">{{ managingTenant()!.name }}</h2>
              <p class="text-xs font-mono text-indigo-400 mt-0.5">{{ managingTenant()!.id }}</p>
            </div>
            <button (click)="closeManage()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="p-6 space-y-6 flex-1">
            <!-- Info general -->
            <div class="bg-bg-main rounded-lg border border-border-subtle p-4 grid grid-cols-2 gap-4">
              <div>
                <div class="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-1">{{ 'TENANTS.MANAGE_LBL_STATUS' | translate }}</div>
                @if (managingTenant()!.status === 'active') {
                  <span class="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {{ 'TENANTS.BADGE_ACTIVE' | translate }}
                  </span>
                } @else if (managingTenant()!.status === 'suspended') {
                  <span class="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 px-2 py-1 rounded text-xs font-medium border border-rose-500/20">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {{ 'TENANTS.BADGE_SUSPENDED' | translate }}
                  </span>
                } @else {
                  <span class="text-amber-400 text-xs">{{ managingTenant()!.status }}</span>
                }
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-1">{{ 'TENANTS.MANAGE_LBL_PLAN' | translate }}</div>
                <span class="text-text-primary text-sm font-medium capitalize">{{ managingTenant()!.plan }}</span>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-1">{{ 'TENANTS.MANAGE_LBL_CDM_VERSION' | translate }}</div>
                <span class="font-mono text-indigo-400 text-sm">{{ managingTenant()!.cdmVersion }}</span>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-1">{{ 'TENANTS.MANAGE_LBL_CONNECTORS' | translate }}</div>
                <span class="text-text-primary text-sm">{{ managingTenant()!.connectors }}</span>
              </div>
              <div class="col-span-2">
                <div class="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-1">{{ 'TENANTS.MANAGE_LBL_ACTIVATED' | translate }}</div>
                <span class="text-text-secondary text-xs">{{ managingTenant()!.activated }}</span>
              </div>
            </div>

            <!-- Cambiar plan -->
            <div class="bg-bg-main rounded-lg border border-border-subtle p-4 space-y-3">
              <h3 class="text-sm font-semibold text-text-primary">{{ 'TENANTS.MANAGE_SECTION_PLAN' | translate }}</h3>
              <div class="grid grid-cols-3 gap-2">
                @for (plan of ['sandbox','professional','enterprise']; track plan) {
                  <button (click)="changePlan(plan)"
                    [class.border-indigo-500]="managingTenant()!.plan === plan"
                    [class.bg-indigo-500/10]="managingTenant()!.plan === plan"
                    [class.text-indigo-400]="managingTenant()!.plan === plan"
                    [class.text-text-secondary]="managingTenant()!.plan !== plan"
                    class="border border-border-subtle rounded-lg px-3 py-2.5 text-xs font-medium transition-colors hover:border-indigo-500/50 flex flex-col items-center gap-1">
                    <span class="material-icons text-[18px]">{{ plan === 'sandbox' ? 'science' : plan === 'professional' ? 'workspace_premium' : 'diamond' }}</span>
                    <span class="capitalize">{{ plan }}</span>
                    @if (managingTenant()!.plan === plan) { <span class="text-[9px] text-indigo-400">{{ 'TENANTS.MANAGE_LBL_CURRENT_PLAN' | translate }}</span> }
                  </button>
                }
              </div>
            </div>

            <!-- Actualizar CDM -->
            <div class="bg-bg-main rounded-lg border border-border-subtle p-4 space-y-3">
              <h3 class="text-sm font-semibold text-text-primary">{{ 'TENANTS.MANAGE_SECTION_CDM' | translate }}</h3>
              <div class="flex items-center gap-3">
                <select [(ngModel)]="selectedCdmVersion"
                  class="flex-1 bg-bg-card border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
                  <option value="1.0">{{ 'TENANTS.MANAGE_OPT_CDM_1_0' | translate }}</option>
                  <option value="1.1">{{ 'TENANTS.MANAGE_OPT_CDM_1_1' | translate }}</option>
                  <option value="1.2">{{ 'TENANTS.MANAGE_OPT_CDM_1_2' | translate }}</option>
                  <option value="1.3">{{ 'TENANTS.MANAGE_OPT_CDM_1_3' | translate }}</option>
                </select>
                <button (click)="applyCdmVersion()"
                  [disabled]="selectedCdmVersion === managingTenant()!.cdmVersion"
                  class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ 'TENANTS.MANAGE_BTN_APPLY' | translate }}
                </button>
              </div>
              @if (selectedCdmVersion !== managingTenant()!.cdmVersion) {
                <p class="text-xs text-amber-400 flex items-center gap-1">
                  <span class="material-icons text-[14px]">warning</span>
                  {{ 'TENANTS.MANAGE_CDM_UPGRADE_WARNING' | translate: { from: managingTenant()!.cdmVersion, to: selectedCdmVersion } }}
                </p>
              }
            </div>

            <!-- Quick actions -->
            <div class="bg-bg-main rounded-lg border border-border-subtle p-4 space-y-3">
              <h3 class="text-sm font-semibold text-text-primary">{{ 'TENANTS.MANAGE_SECTION_ACTIONS' | translate }}</h3>
              <div class="space-y-2">
                @if (managingTenant()!.status === 'active') {
                  <button (click)="suspendTenant()"
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium transition-colors text-left">
                    <span class="material-icons text-[18px]">pause_circle</span>
                    <div>
                      <div>{{ 'TENANTS.MANAGE_BTN_SUSPEND' | translate }}</div>
                      <div class="text-xs text-amber-300/70 font-normal">{{ 'TENANTS.MANAGE_SUSPEND_DESC' | translate }}</div>
                    </div>
                  </button>
                } @else if (managingTenant()!.status === 'suspended') {
                  <button (click)="activateTenant()"
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors text-left">
                    <span class="material-icons text-[18px]">play_circle</span>
                    <div>
                      <div>{{ 'TENANTS.MANAGE_BTN_ACTIVATE' | translate }}</div>
                      <div class="text-xs text-emerald-300/70 font-normal">{{ 'TENANTS.MANAGE_ACTIVATE_DESC' | translate }}</div>
                    </div>
                  </button>
                }
                <button (click)="forceResyncConnectors()"
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-card hover:bg-bg-hover border border-border-subtle text-text-primary text-sm font-medium transition-colors text-left">
                  <span class="material-icons text-[18px] text-indigo-400">sync</span>
                  <div>
                    <div>{{ 'TENANTS.MANAGE_BTN_RESYNC' | translate }}</div>
                    <div class="text-xs text-text-secondary font-normal">{{ 'TENANTS.MANAGE_RESYNC_DESC' | translate }}</div>
                  </div>
                </button>
                <button (click)="exportTenantConfig()"
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-bg-card hover:bg-bg-hover border border-border-subtle text-text-primary text-sm font-medium transition-colors text-left">
                  <span class="material-icons text-[18px] text-blue-400">download</span>
                  <div>
                    <div>{{ 'TENANTS.MANAGE_BTN_EXPORT' | translate }}</div>
                    <div class="text-xs text-text-secondary font-normal">{{ 'TENANTS.MANAGE_EXPORT_DESC' | translate }}</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Zona peligrosa -->
            <div class="bg-rose-500/5 rounded-lg border border-rose-500/20 p-4 space-y-3">
              <h3 class="text-sm font-semibold text-rose-400 flex items-center gap-2">
                <span class="material-icons text-[16px]">warning</span> {{ 'TENANTS.MANAGE_SECTION_DANGER' | translate }}
              </h3>
              <button (click)="deleteTenant()"
                class="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm font-medium transition-colors text-left">
                <span class="material-icons text-[18px]">delete_forever</span>
                <div>
                    <div>{{ 'TENANTS.MANAGE_BTN_DELETE' | translate }}</div>
                    <div class="text-xs text-rose-300/70 font-normal">{{ 'TENANTS.MANAGE_DELETE_DESC' | translate }}</div>
                </div>
              </button>
            </div>
          </div>

          <div class="border-t border-border-subtle px-6 py-4 flex justify-end">
            <button (click)="closeManage()"
              class="px-4 py-2 bg-bg-hover hover:bg-border-subtle text-text-primary rounded-md text-sm font-medium transition-colors">
              {{ 'TENANTS.MANAGE_BTN_CLOSE' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ========== MODAL PROVISION TENANT ========== -->
    @if (showProvisionModal()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeProvisionModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-lg shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'TENANTS.PROVISION_MODAL_TITLE' | translate }}</h2>
            <button (click)="closeProvisionModal()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.PROVISION_LBL_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="provisionForm.name" [placeholder]="'TENANTS.PROVISION_PLACEHOLDER_NAME' | translate"
                class="w-full bg-bg-main border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.PROVISION_LBL_ID' | translate }}</label>
              <input type="text" [(ngModel)]="provisionForm.id" [placeholder]="'TENANTS.PROVISION_PLACEHOLDER_ID' | translate"
                class="w-full bg-bg-main border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500 font-mono">
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.PROVISION_LBL_PLAN' | translate }}</label>
              <div class="grid grid-cols-3 gap-2">
                @for (plan of ['sandbox','professional','enterprise']; track plan) {
                  <button (click)="provisionForm.plan = plan"
                    [class.border-indigo-500]="provisionForm.plan === plan"
                    [class.bg-indigo-500/10]="provisionForm.plan === plan"
                    [class.text-indigo-400]="provisionForm.plan === plan"
                    [class.text-text-secondary]="provisionForm.plan !== plan"
                    class="border border-border-subtle rounded-lg px-3 py-2 text-xs font-medium transition-colors capitalize">
                    {{ plan }}
                  </button>
                }
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'TENANTS.PROVISION_LBL_CDM' | translate }}</label>
              <select [(ngModel)]="provisionForm.cdmVersion"
                class="w-full bg-bg-main border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
                <option value="1.3">{{ 'TENANTS.PROVISION_OPT_CDM_ACTIVE' | translate }}</option>
                <option value="1.0">{{ 'TENANTS.PROVISION_OPT_CDM_MIN' | translate }}</option>
              </select>
            </div>
          </div>
          <div class="border-t border-border-subtle px-6 py-4 flex justify-end gap-3">
            <button (click)="closeProvisionModal()"
              class="px-4 py-2 bg-transparent hover:bg-bg-hover text-text-primary rounded-md text-sm font-medium transition-colors">
              {{ 'TENANTS.PROVISION_BTN_CANCEL' | translate }}
            </button>
            <button (click)="confirmProvision()" [disabled]="!provisionForm.name || !provisionForm.id || isProvisioning()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2">
              @if (isProvisioning()) {
                <span class="material-icons text-[16px] animate-spin">autorenew</span> {{ 'TENANTS.PROVISION_BTN_PROVISIONING' | translate }}
              } @else {
                <span class="material-icons text-[16px]">rocket_launch</span> {{ 'TENANTS.PROVISION_BTN_PROVISION' | translate }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class TenantsComponent implements OnInit {
  dataService = inject(DataService);
  private toast = inject(ToastService);

  managingTenant = signal<any>(null);
  showProvisionModal = signal(false);
  isProvisioning = signal(false);
  selectedCdmVersion = '1.3';

  provisionForm = { name: '', id: '', plan: 'sandbox', cdmVersion: '1.3' };

  ngOnInit() {
    this.dataService.loadTenants();
    this.dataService.loadCdmVersions();
  }

  // Computed stats
  activeTenants() { return this.dataService.tenants().filter(t => t.status === 'active').length; }
  professionalCount() { return this.dataService.tenants().filter(t => t.plan === 'professional' || t.plan === 'enterprise').length; }
  sandboxCount() { return this.dataService.tenants().filter(t => t.plan === 'sandbox').length; }

  manageTenant(tenant: any) {
    this.selectedCdmVersion = tenant.cdmVersion;
    this.managingTenant.set({ ...tenant });
  }

  closeManage() { this.managingTenant.set(null); }

  changePlan(plan: string) {
    if (this.managingTenant()?.plan === plan) return;
    this.dataService.tenants.update(ts =>
      ts.map(t => t.id === this.managingTenant()!.id ? { ...t, plan } : t)
    );
    this.managingTenant.update(t => ({ ...t, plan }));
    this.toast.show(`Plan changed to ${plan}`, 'success');
  }

  applyCdmVersion() {
    const v = this.selectedCdmVersion;
    if (v === this.managingTenant()?.cdmVersion) return;
    this.dataService.tenants.update(ts =>
      ts.map(t => t.id === this.managingTenant()!.id ? { ...t, cdmVersion: v } : t)
    );
    this.managingTenant.update(t => ({ ...t, cdmVersion: v }));
    this.toast.show(`CDM updated to v${v}`, 'success');
  }

  suspendTenant() {
    if (!confirm(`Suspend tenant "${this.managingTenant()?.name}"? Users will lose access.`)) return;
    this.dataService.tenants.update(ts =>
      ts.map(t => t.id === this.managingTenant()!.id ? { ...t, status: 'suspended' } : t)
    );
    this.managingTenant.update(t => ({ ...t, status: 'suspended' }));
    this.toast.show(`${this.managingTenant()?.name} suspended`, 'info');
  }

  activateTenant() {
    this.dataService.tenants.update(ts =>
      ts.map(t => t.id === this.managingTenant()!.id ? { ...t, status: 'active' } : t)
    );
    this.managingTenant.update(t => ({ ...t, status: 'active' }));
    this.toast.show(`${this.managingTenant()?.name} reactivated`, 'success');
  }

  forceResyncConnectors() {
    this.toast.show(`Re-sync triggered for ${this.managingTenant()?.name}`, 'info');
    setTimeout(() => this.toast.show('Re-sync completed', 'success'), 3000);
  }

  exportTenantConfig() {
    const tenant = this.managingTenant();
    const config = { tenant, exportedAt: new Date().toISOString(), platform: 'NEXUS v2' };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenant-${tenant.id}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show('Configuration exported', 'success');
  }

  deleteTenant() {
    const name = this.managingTenant()?.name;
    if (!confirm(`Permanently delete "${name}"? This action CANNOT be undone.`)) return;
    this.dataService.tenants.update(ts => ts.filter(t => t.id !== this.managingTenant()!.id));
    this.toast.show(`Tenant "${name}" deleted`, 'error');
    this.closeManage();
  }

  openProvisionModal() {
    this.provisionForm = { name: '', id: '', plan: 'sandbox', cdmVersion: '1.3' };
    this.showProvisionModal.set(true);
  }

  closeProvisionModal() { this.showProvisionModal.set(false); }

  confirmProvision() {
    if (!this.provisionForm.name || !this.provisionForm.id) return;
    this.isProvisioning.set(true);
    setTimeout(() => {
      this.dataService.tenants.update(ts => [
        ...ts,
        {
          id: this.provisionForm.id.toLowerCase().replace(/\s+/g, '-'),
          name: this.provisionForm.name,
          plan: this.provisionForm.plan,
          status: 'provisioning',
          connectors: 0,
          cdmVersion: this.provisionForm.cdmVersion,
          activated: 'just now',
        }
      ]);
      this.isProvisioning.set(false);
      this.showProvisionModal.set(false);
      this.toast.show(`Tenant "${this.provisionForm.name}" provisioned`, 'success');
    }, 1500);
  }
}
