import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { interval, Subscription } from 'rxjs';
import { takeWhile, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-source-connectors',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'SOURCE_CONNECTORS.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'SOURCE_CONNECTORS.SUBTITLE' | translate }}</p>
        </div>
        <button (click)="scrollToForm()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
          <span class="material-icons text-[18px]">add</span> {{ 'SOURCE_CONNECTORS.BTN_REGISTER' | translate }}
        </button>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.KPI_TOTAL_CONNECTORS' | translate }}</div>
          <div class="text-3xl font-bold text-text-primary mb-1">{{ dataService.connectors().length }}</div>
          <div class="text-xs text-text-secondary">{{ activeCount() }} {{ 'SOURCE_CONNECTORS.KPI_TOTAL_ACTIVE' | translate }} {{ syncingCount() }} {{ 'SOURCE_CONNECTORS.KPI_TOTAL_SYNCING' | translate }}</div>
        </div>
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.KPI_RECORDS_INGESTED' | translate }}</div>
          <div class="text-3xl font-bold text-text-primary mb-1">{{ totalRecords() }}</div>
          <div class="text-xs text-text-secondary">{{ 'SOURCE_CONNECTORS.KPI_RECORDS_COMBINED' | translate }}</div>
        </div>
        <div class="bg-bg-card border border-border-subtle rounded-lg p-5">
          <div class="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.KPI_LAST_REFRESH' | translate }}</div>
          <div class="text-3xl font-bold text-text-primary mb-1">{{ lastSync() }}</div>
          <div class="text-xs text-text-secondary">{{ 'SOURCE_CONNECTORS.KPI_MOST_RECENT' | translate }}</div>
        </div>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <div class="p-5 border-b border-border-subtle">
          <h2 class="text-base font-semibold text-text-primary">{{ 'SOURCE_CONNECTORS.SECTION_CONNECTORS' | translate }}</h2>
          <p class="text-xs text-text-secondary">{{ 'SOURCE_CONNECTORS.SECTION_CREDENTIALS' | translate }}</p>
        </div>
        @if (isLoading()) {
          <div class="px-5 py-10 text-center text-text-secondary text-sm">
            <span class="material-icons text-[40px] block mx-auto mb-2 opacity-30 animate-spin">autorenew</span>{{ 'SOURCE_CONNECTORS.LOADING_CONNECTORS' | translate }}
          </div>
        } @else {
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_ID' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_TYPE' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_HOST' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_SECRET' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_LAST_SYNC' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_COL_RECORDS' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'SOURCE_CONNECTORS.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (conn of dataService.connectors(); track conn.id) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4">
                  <div class="font-mono text-indigo-400 text-xs bg-indigo-400/10 px-2 py-1 rounded inline-block mb-1">{{ conn.id }}</div>
                  <div class="text-text-primary">{{ conn.name }}</div>
                </td>
                <td class="px-5 py-4">
                  <span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded text-xs font-medium">{{ conn.type }}</span>
                </td>
                <td class="px-5 py-4 text-text-secondary font-mono text-xs">{{ conn.host }}</td>
                <td class="px-5 py-4 text-text-secondary font-mono text-xs truncate max-w-[200px]">{{ conn.secretPath }}</td>
                <td class="px-5 py-4">
                  @if (conn.status === 'active') {
                    <span class="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs font-medium">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> active
                    </span>
                  } @else if (conn.status === 'syncing') {
                    <span class="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs font-medium">
                      <span class="material-icons text-[12px] animate-spin">autorenew</span> {{ 'SOURCE_CONNECTORS.BADGE_SYNCING' | translate }}
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded text-xs font-medium">
                      <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {{ conn.status }}
                    </span>
                  }
                </td>
                <td class="px-5 py-4 text-text-secondary">{{ conn.lastSync }}</td>
                <td class="px-5 py-4 text-text-secondary">{{ conn.records }}</td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button (click)="syncConnector(conn)" [disabled]="syncingIds().has(conn.id)"
                      class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors disabled:opacity-60">
                      {{ syncingIds().has(conn.id) ? ('SOURCE_CONNECTORS.BTN_SYNCING' | translate) : ('SOURCE_CONNECTORS.BTN_SYNC' | translate) }}
                    </button>
                    <button (click)="openEditModal(conn)"
                      class="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded text-xs font-medium transition-colors">{{ 'SOURCE_CONNECTORS.BTN_EDIT' | translate }}</button>
                    <button (click)="deleteConnector(conn)"
                      class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-xs font-medium transition-colors">{{ 'SOURCE_CONNECTORS.BTN_DELETE' | translate }}</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
        }
      </div>

      <div id="register-form" class="bg-bg-card border border-border-subtle rounded-lg p-5">
        <h2 class="text-base font-semibold text-text-primary mb-6">{{ 'SOURCE_CONNECTORS.SECTION_REGISTER' | translate }}</h2>
        <form [formGroup]="connectorForm" (ngSubmit)="registerConnector()">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label for="systemType" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">
                {{ 'SOURCE_CONNECTORS.FORM_LBL_TYPE' | translate }}
                @if (airflowAvailable()) {
                  <span class="ml-2 text-sky-400 font-normal normal-case">({{ 'SOURCE_CONNECTORS.FORM_FROM_AIRFLOW' | translate }})</span>
                }
              </label>
              <select id="systemType" formControlName="type" (change)="onTypeChange($event)"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
                @for (t of availableTypes(); track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </select>
            </div>
            <div>
              <label for="connectorName" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.FORM_LBL_NAME' | translate }}</label>
              <input id="connectorName" formControlName="name" type="text" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label for="host" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.FORM_LBL_HOST' | translate }}</label>
              <input id="host" formControlName="host" type="text" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label for="port" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.FORM_LBL_PORT' | translate }}</label>
              <input id="port" formControlName="port" type="text" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label for="dbName" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.FORM_LBL_DB_NAME' | translate }}</label>
              <input id="dbName" formControlName="dbName" type="text" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label for="secretPath" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">{{ 'SOURCE_CONNECTORS.FORM_LBL_SECRET' | translate }}</label>
              <input id="secretPath" formControlName="secretPath" type="text" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label for="username" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">USERNAME</label>
              <input id="username" formControlName="username" type="text" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label for="password" class="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-2">PASSWORD</label>
              <input id="password" formControlName="password" type="password" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
          </div>
          <div class="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs text-indigo-300">
            {{ 'SOURCE_CONNECTORS.FORM_NOTE' | translate }}
            @if (getDAGId(connectorForm.value.type ?? '')) {
              <div class="mt-2 text-sky-300">{{ 'SOURCE_CONNECTORS.FORM_NOTE_AIRFLOW' | translate }} <span class="font-mono">{{ getDAGId(connectorForm.value.type ?? '') }}</span></div>
            }
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" (click)="connectorForm.reset()" class="px-4 py-2 bg-transparent hover:bg-bg-hover text-text-primary rounded-md text-sm font-medium transition-colors">{{ 'SOURCE_CONNECTORS.FORM_BTN_CANCEL' | translate }}</button>
            <button type="submit" [disabled]="!connectorForm.valid || isRegistering()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2">
              @if (isRegistering()) {
                <span class="material-icons text-[16px] animate-spin">autorenew</span> {{ 'SOURCE_CONNECTORS.FORM_BTN_REGISTERING' | translate }}
              } @else {
                {{ 'SOURCE_CONNECTORS.FORM_BTN_REGISTER' | translate }}
              }
            </button>
          </div>
        </form>
      </div>

      <!-- ── Airflow DAG Monitor ─────────────────────────────────────────── -->
      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <div class="p-5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-text-primary flex items-center gap-2">
              <span class="material-icons text-[18px] text-sky-400">air</span>
              {{ 'SOURCE_CONNECTORS.SECTION_AIRFLOW' | translate }}
            </h2>
            <p class="text-xs text-text-secondary">{{ 'SOURCE_CONNECTORS.SECTION_AIRFLOW_DESC' | translate }}</p>
          </div>
          <button (click)="refreshDAGs()"
            class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors flex items-center gap-1">
            <span class="material-icons text-[14px]" [class.animate-spin]="isLoadingDAGs()">refresh</span> {{ 'SOURCE_CONNECTORS.BTN_REFRESH_DAGS' | translate }}
          </button>
        </div>

        @if (isLoadingDAGs()) {
          <div class="px-5 py-10 text-center text-text-secondary text-sm">
            <span class="material-icons text-[40px] block mx-auto mb-2 opacity-30 animate-spin">autorenew</span>
            {{ 'SOURCE_CONNECTORS.AIRFLOW_LOADING' | translate }}
          </div>
        } @else if (!airflowAvailable()) {
          <div class="px-5 py-10 text-center text-text-secondary text-sm space-y-2">
            <span class="material-icons text-[40px] block mx-auto opacity-20">cloud_off</span>
            <div class="font-medium">{{ 'SOURCE_CONNECTORS.AIRFLOW_ERROR' | translate }} <span class="font-mono text-xs text-text-primary">http://localhost:8091</span></div>
            <div class="text-xs">{{ 'SOURCE_CONNECTORS.AIRFLOW_ERROR_MSG' | translate }} <span class="font-mono text-xs bg-bg-input px-2 py-0.5 rounded">docker compose up airflow-webserver airflow-scheduler</span></div>
          </div>
        } @else if (nexusDags().length === 0) {
          <div class="px-5 py-10 text-center text-text-secondary text-sm">
            <span class="material-icons text-[40px] block mx-auto mb-2 opacity-20">schedule</span>
            {{ 'SOURCE_CONNECTORS.DAG_EMPTY' | translate }} <span class="font-mono text-xs">airflow/dags/</span>.
          </div>
        } @else {
          <table class="w-full text-left text-sm">
            <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
              <tr>
                <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_DAGS_COL_ID' | translate }}</th>
                <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_DAGS_COL_TYPE' | translate }}</th>
                <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_DAGS_COL_STATUS' | translate }}</th>
                <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_DAGS_COL_LAST_RUN' | translate }}</th>
                <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_DAGS_COL_STATE' | translate }}</th>
                <th class="px-5 py-3 font-semibold text-right">{{ 'SOURCE_CONNECTORS.TABLE_DAGS_COL_ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              @for (dag of nexusDags(); track dag.dag_id) {
                <tr class="hover:bg-bg-hover transition-colors">
                  <td class="px-5 py-4">
                    <div class="font-mono text-sky-400 text-xs bg-sky-400/10 px-2 py-1 rounded inline-block">{{ dag.dag_id }}</div>
                  </td>
                  <td class="px-5 py-4">
                    <span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded text-xs font-medium">
                      {{ dagDbLabel(dag.dag_id) }}
                    </span>
                  </td>
                  <td class="px-5 py-4">
                    @if (!dag.is_paused) {
                      <span class="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs font-medium">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {{ 'SOURCE_CONNECTORS.DAG_STATUS_ACTIVE' | translate }}
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs font-medium">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {{ 'SOURCE_CONNECTORS.DAG_STATUS_PAUSED' | translate }}
                      </span>
                    }
                  </td>
                  <td class="px-5 py-4 text-text-secondary text-xs">{{ dag.last_run ?? '—' }}</td>
                  <td class="px-5 py-4">
                    @if (dag.last_state === 'success') {
                      <span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-xs font-medium">{{ 'SOURCE_CONNECTORS.DAG_STATE_SUCCESS' | translate }}</span>
                    } @else if (dag.last_state === 'running') {
                      <span class="bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded text-xs font-medium animate-pulse">{{ 'SOURCE_CONNECTORS.DAG_STATE_RUNNING' | translate }}</span>
                    } @else if (dag.last_state === 'failed') {
                      <span class="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded text-xs font-medium">{{ 'SOURCE_CONNECTORS.DAG_STATE_FAILED' | translate }}</span>
                    } @else {
                      <span class="bg-bg-hover text-text-secondary px-2 py-0.5 rounded text-xs">{{ dag.last_state ?? 'no runs' }}</span>
                    }
                  </td>
                  <td class="px-5 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button (click)="triggerDAG(dag.dag_id)"
                        class="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded text-xs font-medium transition-colors">
                        {{ 'SOURCE_CONNECTORS.BTN_TRIGGER' | translate }}
                      </button>
                      <button (click)="toggleDAG(dag)"
                        class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors">
                        {{ dag.is_paused ? ('SOURCE_CONNECTORS.BTN_RESUME' | translate) : ('SOURCE_CONNECTORS.BTN_PAUSE' | translate) }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    <!-- ── Sync Job History ───────────────────────────────────────────── -->
    <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
      <div class="p-5 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-text-primary flex items-center gap-2">
            <span class="material-icons text-[18px] text-indigo-400">history</span>
            {{ 'SOURCE_CONNECTORS.SECTION_HISTORY' | translate }}
          </h2>
          <p class="text-xs text-text-secondary">{{ 'SOURCE_CONNECTORS.SECTION_HISTORY_DESC' | translate }}</p>
        </div>
        <button (click)="loadSyncHistory()"
          class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors flex items-center gap-1">
          <span class="material-icons text-[14px]" [class.animate-spin]="isLoadingSyncHistory()">refresh</span> {{ 'SOURCE_CONNECTORS.BTN_REFRESH_DAGS' | translate }}
        </button>
      </div>
      @if (isLoadingSyncHistory()) {
        <div class="px-5 py-8 text-center text-text-secondary text-sm">
            <span class="material-icons text-[32px] block mx-auto mb-2 opacity-30 animate-spin">autorenew</span>{{ 'SOURCE_CONNECTORS.HISTORY_LOADING' | translate }}
        </div>
      } @else if (syncHistory().length === 0) {
        <div class="px-5 py-8 text-center text-text-secondary text-sm">
          <span class="material-icons text-[32px] block mx-auto mb-2 opacity-20">sync_disabled</span>
          {{ 'SOURCE_CONNECTORS.HISTORY_EMPTY' | translate }}
        </div>
      } @else {
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_HISTORY_COL_CONNECTOR' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_HISTORY_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_HISTORY_COL_TRIGGER' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_HISTORY_COL_RECORDS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_HISTORY_COL_STARTED' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'SOURCE_CONNECTORS.TABLE_HISTORY_COL_DURATION' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (job of syncHistory(); track job.id) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-3 font-medium text-text-primary">{{ job.connectorName }}</td>
                <td class="px-5 py-3">
                  @if (job.status === 'completed') {
                    <span class="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-medium">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{{ 'SOURCE_CONNECTORS.HISTORY_STATUS_COMPLETED' | translate }}
                    </span>
                  } @else if (job.status === 'running') {
                    <span class="inline-flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded text-xs font-medium animate-pulse">
                      <span class="material-icons text-[10px] animate-spin">autorenew</span>{{ 'SOURCE_CONNECTORS.HISTORY_STATUS_RUNNING' | translate }}
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-xs font-medium">
                      <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>{{ job.status }}
                    </span>
                  }
                </td>
                <td class="px-5 py-3 text-text-secondary text-xs">{{ job.triggerType }}</td>
                <td class="px-5 py-3 text-text-secondary">{{ job.recordsExtracted | number }}</td>
                <td class="px-5 py-3 text-text-secondary text-xs">{{ job.startedAt | date:'dd MMM HH:mm' }}</td>
                <td class="px-5 py-3 text-text-secondary text-xs">
                  {{ job.completedAt ? calcDuration(job.startedAt, job.completedAt) : '—' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- Edit Connector Modal -->
    @if (editingConnector()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeEditModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl p-6 w-full max-w-md shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'SOURCE_CONNECTORS.EDIT_MODAL_TITLE' | translate }}</h2>
            <button (click)="closeEditModal()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'SOURCE_CONNECTORS.EDIT_LBL_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="editForm.name" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'SOURCE_CONNECTORS.EDIT_LBL_HOST' | translate }}</label>
              <input type="text" [(ngModel)]="editForm.host" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'SOURCE_CONNECTORS.EDIT_LBL_SECRET' | translate }}</label>
              <input type="text" [(ngModel)]="editForm.secretPath" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'SOURCE_CONNECTORS.EDIT_LBL_STATUS' | translate }}</label>
              <select [(ngModel)]="editForm.status" class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
                <option value="active">{{ 'SOURCE_CONNECTORS.EDIT_OPT_ACTIVE' | translate }}</option>
                <option value="disabled">{{ 'SOURCE_CONNECTORS.EDIT_OPT_DISABLED' | translate }}</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button (click)="closeEditModal()" class="px-4 py-2 bg-transparent hover:bg-bg-hover text-text-primary rounded-md text-sm font-medium border border-border-subtle transition-colors">{{ 'SOURCE_CONNECTORS.EDIT_BTN_CANCEL' | translate }}</button>
            <button (click)="saveEdit()" [disabled]="isSavingEdit()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-70 flex items-center gap-2">
              @if (isSavingEdit()) { <span class="material-icons text-[16px] animate-spin">autorenew</span> {{ 'SOURCE_CONNECTORS.EDIT_BTN_SAVING' | translate }} }
              @else { {{ 'SOURCE_CONNECTORS.EDIT_BTN_SAVE' | translate }} }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class SourceConnectorsComponent implements OnInit, OnDestroy {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);
  fb = inject(FormBuilder);
  private pollSubs = new Map<string, Subscription>();
  readonly destroyRef = inject(DestroyRef);

  // ── Signals ────────────────────────────────────────────────────────────────
  isLoading = signal(false);
  isRegistering = signal(false);
  syncingIds = signal<Set<string>>(new Set());
  editingConnector = signal<any>(null);
  isSavingEdit = signal(false);
  editForm = { name: '', host: '', secretPath: '', status: 'active' };
  // Maps connector_name → M1 connector_id (UUID) for Kafka sync trigger
  m1ConnectorMap = signal<Map<string, string>>(new Map());

  // ── Sync Job History ───────────────────────────────────────────────────────
  syncHistory = signal<any[]>([]);
  isLoadingSyncHistory = signal(false);

  // ── Static type catalog (fallback when Airflow is unreachable) ─────────────
  readonly TYPE_DEFAULTS: Array<{ value: string; label: string }> = [
    { value: 'PostgreSQL',  label: 'PostgreSQL'  },
    { value: 'MySQL',       label: 'MySQL'        },
    { value: 'SQL Server',  label: 'SQL Server'   },
    { value: 'Salesforce',  label: 'Salesforce'   },
    { value: 'ServiceNow',  label: 'ServiceNow'   },
  ];

  // UI type → M1 API system_type (spec requires lowercase, no spaces)
  readonly TYPE_TO_M1: Record<string, string> = {
    'PostgreSQL': 'postgresql', 'MySQL': 'mysql', 'SQL Server': 'sqlserver',
    'Salesforce': 'salesforce', 'ServiceNow': 'servicenow',
  };

  // ── Airflow signals ────────────────────────────────────────────────────────
  isLoadingDAGs = signal(false);
  airflowAvailable = signal(false);
  nexusDags = signal<any[]>([]);
  availableTypes = signal<Array<{ value: string; label: string }>>(this.TYPE_DEFAULTS);

  readonly TYPE_PORT_MAP: Record<string, string> = {
    'PostgreSQL': '5432',
    'MySQL':      '3306',
    'SQL Server': '1433',
    'Salesforce': '443',
    'ServiceNow': '443',
  };

  // DAGs registered in airflow/dags/ for M1 ingestion
  readonly NEXUS_DAG_PREFIX = 'nexus_m1_';

  connectorForm = this.fb.group({
    type: ['PostgreSQL', Validators.required],
    name: ['', Validators.required],
    host: ['', Validators.required],
    port: ['5432', Validators.required],
    dbName: ['', Validators.required],
    secretPath: ['nexus/tenants/acme-corp/connector-new/credentials', Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadConnectors();
    this.loadAirflowConnectionTypes();
    this.refreshDAGs();
    this.loadM1ConnectorMap();
    this.loadSyncHistory();
  }

  private loadConnectors() {
    this.isLoading.set(true);
    this.api.getConnectors().subscribe({
      next: (data) => {
        if (data.length) {
          this.dataService.connectors.set(data.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            host: c.host + (c.port ? `:${c.port}` : ''),
            secretPath: c.secretPath,
            status: c.status,
            lastSync: c.lastSync ?? 'never',
            records: c.records ? String(c.records) : '0',
          })));
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  // ── M1 Connector Lifecycle: load UUID map for Kafka sync trigger ───────────
  private loadM1ConnectorMap() {
    this.api.m1GetConnectors().subscribe({
      next: (connectors: any[]) => {
        const map = new Map<string, string>();
        connectors.forEach((c: any) => {
          if (c.connector_name && c.connector_id) map.set(c.connector_name, c.connector_id);
        });
        this.m1ConnectorMap.set(map);
      },
    });
  }

  // ── Airflow: load connection types and populate type selector ──────────────
  private loadAirflowConnectionTypes() {
    this.api.getAirflowConnectionTypes().subscribe({
      next: (types) => {
        if (!types?.length) return;
        // Map Airflow hooks to human-readable labels
        const hookMap: Record<string, string> = {
          postgres: 'PostgreSQL', mysql: 'MySQL', mssql: 'SQL Server',
          salesforce: 'Salesforce', servicenow: 'ServiceNow',
        };
        const fromAirflow = types
          .filter((t: any) => hookMap[t.connection_type])
          .map((t: any) => ({ value: hookMap[t.connection_type], label: hookMap[t.connection_type] }));

        // Merge with defaults to ensure all types present (dedup by value)
        const seen = new Set(fromAirflow.map((t: any) => t.value));
        const merged = [...fromAirflow, ...this.TYPE_DEFAULTS.filter(t => !seen.has(t.value))];
        this.availableTypes.set(merged);
      },
    });
  }

  // ── Airflow: DAG monitor ───────────────────────────────────────────────────
  refreshDAGs() {
    this.isLoadingDAGs.set(true);
    this.api.getAirflowDAGs().subscribe({
      next: (dags) => {
        this.airflowAvailable.set(true);
        const nexus = dags.filter((d: any) => (d.dag_id as string).startsWith(this.NEXUS_DAG_PREFIX));
        this.nexusDags.set(nexus.map((d: any) => ({ ...d, last_run: null, last_state: null })));
        this.isLoadingDAGs.set(false);
        nexus.forEach((d: any) => this.loadLastRun(d.dag_id));
      },
      error: () => {
        this.airflowAvailable.set(false);
        this.isLoadingDAGs.set(false);
      },
    });
  }

  private loadLastRun(dagId: string) {
    this.api.getAirflowDAGRuns(dagId).subscribe({
      next: (runs) => {
        if (!runs?.length) return;
        const last = runs[runs.length - 1];
        this.nexusDags.update(dags => dags.map(d =>
          d.dag_id === dagId
            ? { ...d, last_run: last.start_date ?? last.execution_date, last_state: last.state }
            : d
        ));
      },
    });
  }

  triggerDAG(dagId: string) {
    this.api.triggerAirflowDAG(dagId).subscribe({
      next: (run) => {
        if (run) {
          this.toastService.show(`DAG ${dagId} triggered`, 'success');
          setTimeout(() => this.loadLastRun(dagId), 3000);
        } else {
          this.toastService.show('Could not trigger DAG — is Airflow running?', 'error');
        }
      },
      error: () => this.toastService.show('Could not trigger DAG', 'error'),
    });
  }

  toggleDAG(dag: any) {
    this.api.toggleAirflowDAG(dag.dag_id, !dag.is_paused).subscribe({
      next: (updated) => {
        if (!updated) return;
        this.nexusDags.update(dags => dags.map(d =>
          d.dag_id === dag.dag_id ? { ...d, is_paused: !dag.is_paused } : d
        ));
        this.toastService.show(`DAG ${dag.dag_id} ${dag.is_paused ? 'resumed' : 'paused'}`, 'success');
      },
    });
  }

  /** Returns the Airflow DAG ID for a given connector type, or '' if none. */
  getDAGId(type: string): string {
    const map: Record<string, string> = {
      'PostgreSQL': 'nexus_m1_postgres_sync',
      'MySQL':      'nexus_m1_mysql_sync',
      'SQL Server': 'nexus_m1_sqlserver_sync',
    };
    return map[type] ?? '';
  }

  /** Returns a short DB label for a DAG id (for the monitor table). */
  dagDbLabel(dagId: string): string {
    if (dagId.includes('postgres')) return 'PostgreSQL';
    if (dagId.includes('mysql'))    return 'MySQL';
    if (dagId.includes('sqlserver') || dagId.includes('mssql')) return 'SQL Server';
    return 'DB';
  }

  // ── Type selection: auto-fill default port ─────────────────────────────────
  onTypeChange(event: Event) {
    const type = (event.target as HTMLSelectElement).value;
    this.connectorForm.patchValue({ port: this.TYPE_PORT_MAP[type] ?? '443' });
  }

  // ── Summary helpers ────────────────────────────────────────────────────────
  activeCount() { return this.dataService.connectors().filter(c => c.status === 'active').length; }
  syncingCount() { return this.dataService.connectors().filter(c => c.status === 'syncing').length; }
  totalRecords() {
    const sum = this.dataService.connectors().reduce((acc, c) => {
      const n = parseInt((c.records ?? '0').replace(/[^0-9]/g, ''), 10);
      return acc + (isNaN(n) ? 0 : n);
    }, 0);
    return sum > 1_000_000 ? `${(sum / 1_000_000).toFixed(2)}M` : sum > 1000 ? `${(sum / 1000).toFixed(0)}K` : String(sum);
  }
  lastSync() {
    const synced = this.dataService.connectors().filter(c => c.lastSync && c.lastSync !== 'never');
    return synced.length ? synced[0].lastSync : 'never';
  }

  scrollToForm() {
    document.getElementById('register-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Connector sync polling ─────────────────────────────────────────────────
  syncConnector(conn: any) {
    this.syncingIds.update(s => { const n = new Set(s); n.add(conn.id); return n; });
    this.dataService.connectors.update(cs => cs.map(c => c.id === conn.id ? { ...c, status: 'syncing' } : c));
    this.toastService.show(`Sync started for ${conn.name}`, 'info');
    this.api.triggerSync(conn.id).subscribe({
      next: () => {
        // Also trigger M1 API → publishes to Kafka m1.int.sync_requested
        const m1Id = this.m1ConnectorMap().get(conn.name);
        if (m1Id) {
          this.api.m1TriggerSync(m1Id).subscribe({
            next: (res) => { if (res) this.toastService.show(`M1 Kafka sync enqueued for ${conn.name}`, 'info'); },
            error: () => {},
          });
        }
        let attempts = 0;
        const sub = interval(2000)
          .pipe(
            takeWhile(() => this.syncingIds().has(conn.id) && attempts < 15),
            switchMap(() => { attempts++; return this.api.getConnectors(); }),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe(data => {
            if (!data?.length) return;
            const updated = data.find((c: any) => c.id === conn.id);
            if (updated && updated.status !== 'syncing') {
              this.dataService.connectors.set(data.map((c: any) => ({
                id: c.id, name: c.name, type: c.type,
                host: c.host + (c.port ? `:${c.port}` : ''),
                secretPath: c.secretPath, status: c.status,
                lastSync: c.lastSync ?? 'never', records: c.records ? String(c.records) : '0',
              })));
              this.syncingIds.update(s => { const n = new Set(s); n.delete(conn.id); return n; });
              this.pollSubs.delete(conn.id);
              sub.unsubscribe();
              this.toastService.show(`Sync completed for ${conn.name}`, 'success');
              this.loadSyncHistory();
            }
          });
        this.pollSubs.set(conn.id, sub);
      },
      error: () => {
        this.syncingIds.update(s => { const n = new Set(s); n.delete(conn.id); return n; });
        this.dataService.connectors.update(cs => cs.map(c => c.id === conn.id ? { ...c, status: 'active' } : c));
        this.toastService.show('Sync failed', 'error');
      },
    });
  }

  // ── Sync Job History ───────────────────────────────────────────────────────
  loadSyncHistory() {
    this.isLoadingSyncHistory.set(true);
    this.api.getSyncJobs(undefined, 20).subscribe({
      next: (jobs) => {
        this.syncHistory.set(jobs.slice(0, 20));
        this.isLoadingSyncHistory.set(false);
      },
      error: () => this.isLoadingSyncHistory.set(false),
    });
  }

  calcDuration(startedAt: string, completedAt: string): string {
    const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    if (ms < 0) return '—';
    const secs = Math.floor(ms / 1000);
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  ngOnDestroy() {
    this.pollSubs.forEach(sub => sub.unsubscribe());
  }

  // ── Edit modal ─────────────────────────────────────────────────────────────
  openEditModal(conn: any) {
    this.editForm = { name: conn.name, host: conn.host.split(':')[0], secretPath: conn.secretPath, status: conn.status };
    this.editingConnector.set(conn);
  }

  closeEditModal() { this.editingConnector.set(null); }

  saveEdit() {
    const conn = this.editingConnector();
    if (!conn) return;
    this.isSavingEdit.set(true);
    this.api.updateConnector(conn.id, {
      name: this.editForm.name, host: this.editForm.host,
      secretPath: this.editForm.secretPath, status: this.editForm.status,
    }).subscribe({
      next: () => {
        this.isSavingEdit.set(false);
        this.dataService.connectors.update(cs => cs.map(c => c.id === conn.id
          ? { ...c, name: this.editForm.name, host: this.editForm.host, secretPath: this.editForm.secretPath, status: this.editForm.status }
          : c));
        this.editingConnector.set(null);
        this.toastService.show(`${this.editForm.name} updated`, 'success');
      },
      error: () => { this.isSavingEdit.set(false); this.toastService.show('Update failed', 'error'); },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  deleteConnector(conn: any) {
    if (!confirm(`Delete connector "${conn.name}"? This cannot be undone.`)) return;
    this.api.deleteConnector(conn.id).subscribe({
      next: () => {
        this.dataService.connectors.update(cs => cs.filter(c => c.id !== conn.id));
        this.toastService.show(`${conn.name} deleted`, 'success');
      },
      error: () => this.toastService.show('Delete failed', 'error'),
    });
  }

  // ── Register new connector + M1 real registration + Airflow DAG ────────────
  registerConnector() {
    if (!this.connectorForm.valid) return;
    this.isRegistering.set(true);
    const v = this.connectorForm.value;
    const typeMap: Record<string, string> = {
      'PostgreSQL': 'postgresql', 'MySQL': 'mysql', 'SQL Server': 'sqlserver',
      'Salesforce': 'salesforce', 'ServiceNow': 'servicenow',
    };
    const nextIdx = this.dataService.connectors().length + 1;

    // 1) Register in NestJS backend (UI metadata)
    const nestPayload = {
      id: `connector-${String(nextIdx).padStart(3, '0')}`,
      name: v.name!, type: v.type!, host: v.host!,
      port: v.port ? parseInt(v.port, 10) : undefined,
      dbName: v.dbName ?? undefined, secretPath: v.secretPath!,
    };

    // 2) Register in M1 API (real connector lifecycle with credentials)
    const m1Payload = {
      connector_name: v.name!,
      system_type: typeMap[v.type!] ?? v.type!.toLowerCase().replace(' ', ''),
      credentials_secret_path: v.secretPath!,
      sync_schedule: '0 2 * * *',
      enabled: true,
      config: {
        host: v.host!, port: v.port ? parseInt(v.port, 10) : 5432,
        database: v.dbName!, username: v.username!, password: v.password!,
      },
    };

    // Fire both registrations
    this.api.createConnector(nestPayload).subscribe({
      next: (created) => {
        if (created) {
          this.dataService.connectors.update(cs => [...cs, {
            id: created.id, name: created.name, type: created.type,
            host: created.host + (created.port ? `:${created.port}` : ''),
            secretPath: created.secretPath, status: created.status ?? 'registered',
            lastSync: created.lastSync ?? 'never', records: '0',
          }]);
        }
      },
    });

    // M1 real registration (this is the important one)
    this.api.m1RegisterConnector(m1Payload).subscribe({
      next: (m1Result) => {
        this.isRegistering.set(false);
        if (m1Result?.connector_id) {
          this.toastService.show(
            `Real connector registered in M1: ${m1Result.connector_id} (${m1Result.status})`,
            'success'
          );
          this.connectorForm.reset({
            type: 'PostgreSQL', name: '', host: '', port: '5432',
            dbName: '', secretPath: '', username: '', password: '',
          });
          setTimeout(() => this.loadM1ConnectorMap(), 1000);

          // Trigger Airflow DAG if available
          const dagId = this.getDAGId(v.type!);
          if (dagId) {
            const tenantId = 'acme-corp';
            this.api.triggerAirflowDAG(dagId, {
              connector_id: m1Result.connector_id,
              tenant_id: tenantId,
              host: v.host, db_name: v.dbName,
              secret_path: v.secretPath,
            }).subscribe({
              next: (run) => {
                if (run) {
                  this.toastService.show(`Airflow DAG triggered: ${dagId}`, 'info');
                  setTimeout(() => this.refreshDAGs(), 4000);
                }
              },
            });
          }
        } else {
          this.toastService.show('M1 registration failed — check the API', 'error');
        }
      },
      error: (err: any) => {
        this.isRegistering.set(false);
        if (err?.status === 409) {
          this.toastService.show(`Ya existe un conector con el nombre "${m1Payload.connector_name}". Usa un nombre diferente.`, 'error');
        } else {
          this.toastService.show('M1 registration failed — check the API', 'error');
        }
      },
    });
  }
}
