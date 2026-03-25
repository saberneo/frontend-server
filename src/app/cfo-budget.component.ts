import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cfo-budget',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Budget vs Actual</h1>
        <p class="text-sm text-text-secondary mt-1">Q1 2026 &middot; consolidated &middot; as of Mar 5</p>
      </div>

      <!-- Summary KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Revenue vs Budget</h3>
          <div class="text-3xl font-bold text-emerald-500 mb-1">+4.2%</div>
          <p class="text-sm text-text-secondary">€11.8M actual vs €11.3M budget</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-rose-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">OpEx vs Budget</h3>
          <div class="text-3xl font-bold text-rose-400 mb-1">+8.0%</div>
          <p class="text-sm text-text-secondary">€5.2M actual vs €4.8M budget</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Net Variance</h3>
          <div class="text-3xl font-bold text-amber-400 mb-1">-€130K</div>
          <p class="text-sm text-text-secondary">Cost overruns offset revenue gains</p>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-6 border-b border-border-subtle">
          <h2 class="text-lg font-semibold text-text-primary">Line-by-Line Variance</h2>
        </div>
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-3 font-semibold">Category</th>
              <th class="px-6 py-3 font-semibold text-right">Budget</th>
              <th class="px-6 py-3 font-semibold text-right">Actual</th>
              <th class="px-6 py-3 font-semibold text-right">Variance</th>
              <th class="px-6 py-3 font-semibold text-right">%</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (row of budgetLines(); track row.category) {
              <tr class="hover:bg-bg-hover/50 transition-colors" [class.font-semibold]="row.bold">
                <td class="px-6 py-3 text-text-primary" [class.pl-10]="row.indent">{{ row.category }}</td>
                <td class="px-6 py-3 text-right text-text-secondary">{{ row.budget }}</td>
                <td class="px-6 py-3 text-right text-text-primary">{{ row.actual }}</td>
                <td class="px-6 py-3 text-right" [class.text-emerald-500]="row.favorable" [class.text-rose-400]="!row.favorable">{{ row.variance }}</td>
                <td class="px-6 py-3 text-right" [class.text-emerald-500]="row.favorable" [class.text-rose-400]="!row.favorable">{{ row.pct }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Variance Highlights -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span class="material-icons text-[18px] text-emerald-500">thumb_up</span>
            Favorable Variances
          </h3>
          <div class="space-y-3">
            @for (item of favorable(); track item.label) {
              <div class="flex items-center justify-between">
                <span class="text-sm text-text-secondary">{{ item.label }}</span>
                <span class="text-sm font-medium text-emerald-500">{{ item.amount }}</span>
              </div>
            }
          </div>
        </div>
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span class="material-icons text-[18px] text-rose-400">warning</span>
            Unfavorable Variances
          </h3>
          <div class="space-y-3">
            @for (item of unfavorable(); track item.label) {
              <div class="flex items-center justify-between">
                <span class="text-sm text-text-secondary">{{ item.label }}</span>
                <span class="text-sm font-medium text-rose-400">{{ item.amount }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class CfoBudgetComponent {
  budgetLines = signal([
    { category: 'Revenue', budget: '€11,320,000', actual: '€11,840,000', variance: '+€520,000', pct: '+4.6%', favorable: true, bold: true, indent: false },
    { category: 'Products', budget: '€8,900,000', actual: '€9,480,000', variance: '+€580,000', pct: '+6.5%', favorable: true, bold: false, indent: true },
    { category: 'Services', budget: '€2,420,000', actual: '€2,360,000', variance: '-€60,000', pct: '-2.5%', favorable: false, bold: false, indent: true },
    { category: 'COGS', budget: '€(6,400,000)', actual: '€(6,830,000)', variance: '-€430,000', pct: '+6.7%', favorable: false, bold: true, indent: false },
    { category: 'Gross Profit', budget: '€4,920,000', actual: '€5,010,000', variance: '+€90,000', pct: '+1.8%', favorable: true, bold: true, indent: false },
    { category: 'Sales & Marketing', budget: '€(1,200,000)', actual: '€(1,350,000)', variance: '-€150,000', pct: '+12.5%', favorable: false, bold: false, indent: false },
    { category: 'R&D', budget: '€(980,000)', actual: '€(1,052,000)', variance: '-€72,000', pct: '+7.3%', favorable: false, bold: false, indent: false },
    { category: 'G&A', budget: '€(850,000)', actual: '€(868,000)', variance: '-€18,000', pct: '+2.1%', favorable: false, bold: false, indent: false },
    { category: 'EBITDA', budget: '€1,890,000', actual: '€1,740,000', variance: '-€150,000', pct: '-7.9%', favorable: false, bold: true, indent: false },
  ]);

  favorable = signal([
    { label: 'Product revenue above plan (Belgium)', amount: '+€340K' },
    { label: 'Netherlands expansion ahead of forecast', amount: '+€180K' },
    { label: 'SaaS license revenue uplift', amount: '+€60K' },
  ]);

  unfavorable = signal([
    { label: 'Hired 3 extra sales reps (Germany)', amount: '-€150K' },
    { label: 'Cloud infrastructure cost overrun', amount: '-€72K' },
    { label: 'Raw materials price increase (Q1)', amount: '-€430K' },
  ]);
}
