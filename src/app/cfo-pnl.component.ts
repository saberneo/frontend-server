import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cfo-pnl',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">P&L Overview</h1>
          <p class="text-sm text-text-secondary mt-1">Q1 2026 &middot; Jan–Mar 5 &middot; consolidated</p>
        </div>
        <div class="flex items-center gap-3">
          <button class="flex items-center gap-2 px-4 py-2 bg-bg-card hover:bg-bg-hover border border-border-subtle text-text-primary rounded-md text-sm font-medium transition-colors">
            <span class="material-icons text-[18px]">table_chart</span>
            Export XLSX
          </button>
          <button class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors">
            <span class="material-icons text-[18px]">description</span>
            Full report
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-indigo-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Revenue Q1</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">€11.8M</div>
          <div class="text-sm text-emerald-500 flex items-center gap-1">
            <span class="material-icons text-[16px]">arrow_upward</span>
            14% vs Q1 2025
          </div>
        </div>

        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Gross Margin</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">42.3%</div>
          <div class="text-sm text-emerald-500 flex items-center gap-1">
            <span class="material-icons text-[16px]">arrow_upward</span>
            1.8pp vs plan
          </div>
        </div>

        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-rose-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-2">Operating Cost</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">€5.2M</div>
          <div class="text-sm text-rose-400 flex items-center gap-1">
            <span class="material-icons text-[16px]">arrow_upward</span>
            8% over budget
          </div>
        </div>

        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">EBITDA</h3>
          <div class="text-3xl font-bold text-text-primary mb-2">€1.74M</div>
          <div class="text-sm text-text-secondary">Margin: 14.7%</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Income Statement -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <div class="p-6 border-b border-border-subtle">
            <h2 class="text-lg font-semibold text-text-primary">Income Statement</h2>
            <p class="text-sm text-text-secondary">Q1 2026 &middot; condensed</p>
          </div>
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
              <tr>
                <th class="px-6 py-3 font-semibold">Line</th>
                <th class="px-6 py-3 font-semibold text-right">Q1 2026</th>
                <th class="px-6 py-3 font-semibold text-right">Q1 2025</th>
                <th class="px-6 py-3 font-semibold text-right">Δ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              @for (row of incomeStatement(); track row.line) {
                <tr class="hover:bg-bg-hover/50 transition-colors" [class.font-semibold]="row.bold" [class.text-text-primary]="row.bold">
                  <td class="px-6 py-3" [class.pl-10]="row.indent">{{ row.line }}</td>
                  <td class="px-6 py-3 text-right text-text-primary">{{ row.q1_2026 }}</td>
                  <td class="px-6 py-3 text-right text-text-secondary">{{ row.q1_2025 }}</td>
                  <td class="px-6 py-3 text-right" [class.text-emerald-500]="row.deltaPositive" [class.text-rose-400]="!row.deltaPositive">{{ row.delta }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Revenue by Segment -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <div class="mb-6">
            <h2 class="text-lg font-semibold text-text-primary">Revenue by Segment</h2>
            <p class="text-sm text-text-secondary">Q1 2026 actuals vs plan</p>
          </div>
          <div class="space-y-5">
            @for (seg of revenueSegments(); track seg.name) {
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-sm text-text-primary font-medium">{{ seg.name }}</span>
                  <span class="text-sm font-semibold text-text-primary">{{ seg.value }}</span>
                </div>
                <div class="w-full bg-bg-hover rounded-full h-2.5">
                  <div class="h-2.5 rounded-full transition-all duration-500" [style.width.%]="seg.pct" [style.background-color]="seg.color"></div>
                </div>
              </div>
            }
          </div>

          <!-- Monthly Trend -->
          <div class="mt-8">
            <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">Monthly Trend — Q1</h3>
            <div class="grid grid-cols-3 gap-3">
              @for (m of monthlyTrend(); track m.month) {
                <div class="bg-indigo-500/20 rounded-lg p-4 text-center">
                  <div class="text-lg font-bold text-indigo-400">{{ m.value }}</div>
                  <div class="text-xs text-text-secondary mt-1">{{ m.month }}</div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CfoPnlComponent implements OnInit {
  dataService = inject(DataService);
  private router = inject(Router);

  incomeStatement = signal([
    { line: 'Revenue', q1_2026: '€11,840,000', q1_2025: '€10,388,000', delta: '+14%', deltaPositive: true, bold: true, indent: false },
    { line: 'Products', q1_2026: '€9,480,000', q1_2025: '€8,210,000', delta: '+15%', deltaPositive: true, bold: false, indent: true },
    { line: 'Services', q1_2026: '€2,360,000', q1_2025: '€2,178,000', delta: '+8%', deltaPositive: true, bold: false, indent: true },
    { line: 'COGS', q1_2026: '€(6,830,000)', q1_2025: '€(6,120,000)', delta: '+12%', deltaPositive: false, bold: true, indent: false },
    { line: 'Gross Profit', q1_2026: '€5,010,000', q1_2025: '€4,268,000', delta: '+17%', deltaPositive: true, bold: true, indent: false },
    { line: 'Gross Margin', q1_2026: '42.3%', q1_2025: '41.1%', delta: '+1.2pp', deltaPositive: true, bold: false, indent: true },
    { line: 'OpEx', q1_2026: '€(3,270,000)', q1_2025: '€(3,010,000)', delta: '+9%', deltaPositive: false, bold: true, indent: false },
    { line: 'EBITDA', q1_2026: '€1,740,000', q1_2025: '€1,258,000', delta: '+38%', deltaPositive: true, bold: true, indent: false },
  ]);

  revenueSegments = signal([
    { name: 'Belgium', value: '€4,820K', pct: 100, color: '#6366f1' },
    { name: 'Netherlands', value: '€3,600K', pct: 75, color: '#6366f1' },
    { name: 'Germany', value: '€2,240K', pct: 46, color: '#6366f1' },
    { name: 'Other EU', value: '€1,180K', pct: 24, color: '#6366f1' },
  ]);

  monthlyTrend = signal([
    { month: 'Jan', value: '€3.7M' },
    { month: 'Feb', value: '€3.9M' },
    { month: 'Mar', value: '€4.2M' },
  ]);

  ngOnInit() {}
}
