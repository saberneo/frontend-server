import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ceo-market',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Market &amp; Customers</h1>
        <p class="text-sm text-text-secondary mt-1">Customer intelligence &middot; Q1 2026</p>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        @for (kpi of kpis(); track kpi.label) {
          <div class="bg-bg-card p-6 rounded-xl shadow-sm border border-border-subtle"
               [class.border-t-4]="true"
               [class.border-t-emerald-500]="kpi.color === 'emerald'"
               [class.border-t-blue-500]="kpi.color === 'blue'"
               [class.border-t-amber-500]="kpi.color === 'amber'"
               [class.border-t-rose-500]="kpi.color === 'rose'">
            <span class="text-xs font-semibold uppercase text-text-secondary tracking-wide">{{ kpi.label }}</span>
            <div class="text-2xl font-bold text-text-primary mt-2">{{ kpi.value }}</div>
            <div class="flex items-center gap-1 mt-1 text-xs"
              [class.text-emerald-500]="kpi.positive"
              [class.text-rose-400]="!kpi.positive">
              <span class="material-icons text-[14px]">{{ kpi.positive ? 'trending_up' : 'trending_down' }}</span>
              {{ kpi.change }}
            </div>
          </div>
        }
      </div>

      <!-- Customer Segments -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-6">Customer Segments</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          @for (seg of segments(); track seg.name) {
            <div class="bg-bg-hover/40 rounded-lg p-5 text-center">
              <div class="text-3xl font-bold text-text-primary">{{ seg.count }}</div>
              <div class="text-sm font-medium text-text-primary mt-1">{{ seg.name }}</div>
              <div class="text-xs text-text-secondary mt-0.5">{{ seg.revenue }} revenue</div>
              <div class="flex items-center justify-center gap-1 mt-2 text-xs"
                [class.text-emerald-500]="seg.growth > 0"
                [class.text-rose-400]="seg.growth < 0">
                <span class="material-icons text-[14px]">{{ seg.growth > 0 ? 'trending_up' : 'trending_down' }}</span>
                {{ seg.growth > 0 ? '+' : '' }}{{ seg.growth }}% YoY
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Top Customers & Churn Risk -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Top Customers by Revenue -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <div class="p-6 border-b border-border-subtle">
            <h3 class="text-sm font-semibold text-text-primary">Top 5 Customers</h3>
          </div>
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
              <tr>
                <th class="px-6 py-3 font-semibold">Customer</th>
                <th class="px-6 py-3 font-semibold text-right">Revenue</th>
                <th class="px-6 py-3 font-semibold text-right">Growth</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              @for (c of topCustomers(); track c.name) {
                <tr class="hover:bg-bg-hover/50 transition-colors">
                  <td class="px-6 py-3 text-text-primary font-medium">{{ c.name }}</td>
                  <td class="px-6 py-3 text-right text-text-secondary">{{ c.revenue }}</td>
                  <td class="px-6 py-3 text-right"
                    [class.text-emerald-500]="c.growth > 0"
                    [class.text-rose-400]="c.growth < 0">
                    {{ c.growth > 0 ? '+' : '' }}{{ c.growth }}%
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Churn Risk Watchlist -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span class="material-icons text-[18px] text-rose-400">warning</span>
            Churn Risk Watchlist
          </h3>
          <div class="space-y-3">
            @for (risk of churnRisks(); track risk.name) {
              <div class="flex items-center justify-between bg-bg-hover/40 rounded-lg p-3 border-l-4"
                [class.border-l-rose-400]="risk.risk === 'High'"
                [class.border-l-amber-400]="risk.risk === 'Medium'">
                <div>
                  <div class="text-sm font-medium text-text-primary">{{ risk.name }}</div>
                  <div class="text-xs text-text-secondary">{{ risk.reason }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-semibold text-text-primary">{{ risk.arr }}</div>
                  <span class="py-0.5 px-2 rounded-full text-[10px] font-medium"
                    [class.bg-rose-500/20]="risk.risk === 'High'" [class.text-rose-400]="risk.risk === 'High'"
                    [class.bg-amber-500/20]="risk.risk === 'Medium'" [class.text-amber-400]="risk.risk === 'Medium'">
                    {{ risk.risk }}
                  </span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- NPS & Satisfaction -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-4">Customer Satisfaction</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div class="text-center">
            <div class="text-4xl font-bold text-emerald-500">61</div>
            <div class="text-sm text-text-secondary mt-1">NPS Score</div>
            <div class="text-xs text-emerald-500 mt-0.5">+5 vs Q4</div>
          </div>
          <div class="text-center">
            <div class="text-4xl font-bold text-blue-500">4.3<span class="text-lg text-text-secondary">/5</span></div>
            <div class="text-sm text-text-secondary mt-1">CSAT Rating</div>
            <div class="text-xs text-emerald-500 mt-0.5">+0.2 vs Q4</div>
          </div>
          <div class="text-center">
            <div class="text-4xl font-bold text-amber-400">2.1<span class="text-lg text-text-secondary">%</span></div>
            <div class="text-sm text-text-secondary mt-1">Churn Rate</div>
            <div class="text-xs text-emerald-500 mt-0.5">-0.4pp vs Q4</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CeoMarketComponent {
  kpis = signal([
    { label: 'Active Customers', value: '1,847', change: '+164 this quarter', positive: true, color: 'emerald' },
    { label: 'NPS', value: '61', change: '+5 vs Q4', positive: true, color: 'blue' },
    { label: 'Avg. Deal Size', value: '€28.4K', change: '+12% YoY', positive: true, color: 'amber' },
    { label: 'Churn Rate', value: '2.1%', change: '-0.4pp vs Q4', positive: true, color: 'rose' },
  ]);

  segments = signal([
    { name: 'Enterprise', count: 124, revenue: '€6.8M', growth: 18 },
    { name: 'Mid-Market', count: 583, revenue: '€3.6M', growth: 11 },
    { name: 'SMB', count: 1140, revenue: '€1.4M', growth: 5 },
  ]);

  topCustomers = signal([
    { name: 'TechCorp Belgium', revenue: '€890K', growth: 22 },
    { name: 'Rotterdam Ports', revenue: '€720K', growth: 15 },
    { name: 'Northwind Traders', revenue: '€580K', growth: -3 },
    { name: 'Hamburg Logistics', revenue: '€460K', growth: 31 },
    { name: 'Brussels Airlines Cargo', revenue: '€410K', growth: 8 },
  ]);

  churnRisks = signal([
    { name: 'Oceanic Imports', arr: '€28K', risk: 'High' as const, reason: 'No login 45 days · support tickets unresolved' },
    { name: 'Nordic Freight', arr: '€42K', risk: 'Medium' as const, reason: 'Contract renewal in 30 days · no response' },
    { name: 'Alpine Solutions', arr: '€18K', risk: 'Medium' as const, reason: 'Usage dropped 60% · competitor eval reported' },
  ]);
}
