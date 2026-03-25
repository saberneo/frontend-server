import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cfo-cost-analysis',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Cost Analysis</h1>
        <p class="text-sm text-text-secondary mt-1">Q1 2026 &middot; OpEx breakdown by department</p>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-indigo-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Total OpEx Q1</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">€5.2M</div>
          <p class="text-sm text-rose-400">+9% vs Q1 2025</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">OpEx Ratio</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">43.9%</div>
          <p class="text-sm text-text-secondary">of revenue</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Cost Savings YTD</h3>
          <div class="text-3xl font-bold text-emerald-500 mb-1">€186K</div>
          <p class="text-sm text-text-secondary">vs optimization targets</p>
        </div>
      </div>

      <!-- Department Breakdown -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-6">Cost by Department</h2>
        <div class="space-y-5">
          @for (dept of departments(); track dept.name) {
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-3">
                  <span class="material-icons text-[18px]" [style.color]="dept.color">{{ dept.icon }}</span>
                  <span class="text-sm text-text-primary font-medium">{{ dept.name }}</span>
                </div>
                <div class="flex items-center gap-4">
                  <span class="text-xs text-text-secondary">{{ dept.pctOfTotal }}% of total</span>
                  <span class="text-sm font-semibold text-text-primary w-20 text-right">{{ dept.amount }}</span>
                </div>
              </div>
              <div class="w-full bg-bg-hover rounded-full h-2.5">
                <div class="h-2.5 rounded-full transition-all duration-500" [style.width.%]="dept.barPct" [style.background-color]="dept.color"></div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Cost Trends Table -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-6 border-b border-border-subtle">
          <h2 class="text-lg font-semibold text-text-primary">Quarterly Trend</h2>
        </div>
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-3 font-semibold">Category</th>
              <th class="px-6 py-3 font-semibold text-right">Q3 2025</th>
              <th class="px-6 py-3 font-semibold text-right">Q4 2025</th>
              <th class="px-6 py-3 font-semibold text-right">Q1 2026</th>
              <th class="px-6 py-3 font-semibold text-right">Trend</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (row of costTrends(); track row.category) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-3 text-text-primary font-medium">{{ row.category }}</td>
                <td class="px-6 py-3 text-right text-text-secondary">{{ row.q3 }}</td>
                <td class="px-6 py-3 text-right text-text-secondary">{{ row.q4 }}</td>
                <td class="px-6 py-3 text-right text-text-primary font-medium">{{ row.q1 }}</td>
                <td class="px-6 py-3 text-right">
                  <span class="material-icons text-[16px]" [class.text-rose-400]="row.trendUp" [class.text-emerald-500]="!row.trendUp">
                    {{ row.trendUp ? 'trending_up' : 'trending_down' }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CfoCostAnalysisComponent {
  departments = signal([
    { name: 'Sales & Marketing', amount: '€1.35M', pctOfTotal: 26, barPct: 100, color: '#6366f1', icon: 'campaign' },
    { name: 'R&D / Engineering', amount: '€1.05M', pctOfTotal: 20, barPct: 78, color: '#8b5cf6', icon: 'code' },
    { name: 'COGS / Production', amount: '€980K', pctOfTotal: 19, barPct: 73, color: '#f59e0b', icon: 'precision_manufacturing' },
    { name: 'General & Admin', amount: '€868K', pctOfTotal: 17, barPct: 64, color: '#10b981', icon: 'business' },
    { name: 'IT Infrastructure', amount: '€620K', pctOfTotal: 12, barPct: 46, color: '#3b82f6', icon: 'cloud' },
    { name: 'Other', amount: '€337K', pctOfTotal: 6, barPct: 25, color: '#64748b', icon: 'more_horiz' },
  ]);

  costTrends = signal([
    { category: 'Payroll', q3: '€1.42M', q4: '€1.48M', q1: '€1.68M', trendUp: true },
    { category: 'Cloud & IT', q3: '€540K', q4: '€570K', q1: '€620K', trendUp: true },
    { category: 'Office & Facilities', q3: '€220K', q4: '€218K', q1: '€215K', trendUp: false },
    { category: 'Travel & Events', q3: '€180K', q4: '€160K', q1: '€145K', trendUp: false },
    { category: 'Professional Services', q3: '€290K', q4: '€310K', q1: '€265K', trendUp: false },
    { category: 'Marketing Spend', q3: '€480K', q4: '€520K', q1: '€560K', trendUp: true },
  ]);
}
