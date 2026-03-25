import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cfo-cashflow',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Cash Flow</h1>
        <p class="text-sm text-text-secondary mt-1">Q1 2026 &middot; 13-week rolling forecast</p>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Cash Position</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">€3.2M</div>
          <p class="text-sm text-emerald-500">+€420K vs last month</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-blue-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Operating Cash Flow</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">€1.1M</div>
          <p class="text-sm text-text-secondary">Q1 cumulative</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Burn Rate</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">€890K</div>
          <p class="text-sm text-text-secondary">Monthly average</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-indigo-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Runway</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">42 mo.</div>
          <p class="text-sm text-emerald-500">Healthy runway</p>
        </div>
      </div>

      <!-- Cash Flow Waterfall -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-6 border-b border-border-subtle">
          <h2 class="text-lg font-semibold text-text-primary">Cash Flow Waterfall — Q1</h2>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            @for (item of waterfall(); track item.label) {
              <div class="flex items-center gap-4">
                <span class="text-sm text-text-secondary w-40 shrink-0">{{ item.label }}</span>
                <div class="flex-1 relative h-8 flex items-center">
                  <div class="h-6 rounded" [style.width.%]="item.widthPct" [style.margin-left.%]="item.offsetPct"
                       [class.bg-emerald-500/80]="item.positive" [class.bg-rose-500/80]="!item.positive"></div>
                </div>
                <span class="text-sm font-medium w-24 text-right" [class.text-emerald-500]="item.positive" [class.text-rose-400]="!item.positive">{{ item.value }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Monthly Breakdown -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-6 border-b border-border-subtle">
          <h2 class="text-lg font-semibold text-text-primary">Monthly Cash Flow</h2>
        </div>
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-3 font-semibold">Month</th>
              <th class="px-6 py-3 font-semibold text-right">Inflows</th>
              <th class="px-6 py-3 font-semibold text-right">Outflows</th>
              <th class="px-6 py-3 font-semibold text-right">Net</th>
              <th class="px-6 py-3 font-semibold text-right">Balance</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (m of monthlyCash(); track m.month) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-3 text-text-primary font-medium">{{ m.month }}</td>
                <td class="px-6 py-3 text-right text-emerald-500">{{ m.inflows }}</td>
                <td class="px-6 py-3 text-right text-rose-400">{{ m.outflows }}</td>
                <td class="px-6 py-3 text-right font-medium" [class.text-emerald-500]="m.netPositive" [class.text-rose-400]="!m.netPositive">{{ m.net }}</td>
                <td class="px-6 py-3 text-right text-text-primary font-semibold">{{ m.balance }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CfoCashflowComponent {
  waterfall = signal([
    { label: 'Opening Balance', value: '€2.78M', widthPct: 70, offsetPct: 0, positive: true },
    { label: 'Customer Receipts', value: '+€3.92M', widthPct: 98, offsetPct: 0, positive: true },
    { label: 'Payroll', value: '-€1.68M', widthPct: 42, offsetPct: 0, positive: false },
    { label: 'Supplier Payments', value: '-€1.24M', widthPct: 31, offsetPct: 0, positive: false },
    { label: 'Tax & Social', value: '-€480K', widthPct: 12, offsetPct: 0, positive: false },
    { label: 'Capex', value: '-€110K', widthPct: 3, offsetPct: 0, positive: false },
    { label: 'Closing Balance', value: '€3.19M', widthPct: 80, offsetPct: 0, positive: true },
  ]);

  monthlyCash = signal([
    { month: 'January', inflows: '€1,180K', outflows: '€(1,040K)', net: '+€140K', balance: '€2.92M', netPositive: true },
    { month: 'February', inflows: '€1,280K', outflows: '€(1,120K)', net: '+€160K', balance: '€3.08M', netPositive: true },
    { month: 'March (est.)', inflows: '€1,460K', outflows: '€(1,350K)', net: '+€110K', balance: '€3.19M', netPositive: true },
  ]);
}
