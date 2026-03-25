import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ceo-growth',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Growth &amp; Revenue</h1>
        <p class="text-sm text-text-secondary mt-1">Revenue trajectory &middot; Q1 2026</p>
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

      <!-- Revenue by Region -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-6">Revenue by Region</h2>
        <div class="space-y-4">
          @for (region of regions(); track region.name) {
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-text-primary font-medium">{{ region.name }}</span>
                <span class="text-sm text-text-secondary">{{ region.revenue }} ({{ region.share }})</span>
              </div>
              <div class="w-full bg-bg-hover rounded-full h-3">
                <div class="h-3 rounded-full transition-all duration-500"
                  [class.bg-emerald-500]="region.color === 'emerald'"
                  [class.bg-blue-500]="region.color === 'blue'"
                  [class.bg-amber-400]="region.color === 'amber'"
                  [class.bg-violet-500]="region.color === 'violet'"
                  [style.width]="region.pct + '%'"></div>
              </div>
              <div class="flex items-center gap-1 mt-0.5 text-xs"
                [class.text-emerald-500]="region.growth > 0"
                [class.text-rose-400]="region.growth < 0">
                <span class="material-icons text-[14px]">{{ region.growth > 0 ? 'trending_up' : 'trending_down' }}</span>
                {{ region.growth > 0 ? '+' : '' }}{{ region.growth }}% YoY
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Monthly Trend & Top Deals -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Monthly Revenue Trend -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4">Monthly Revenue Trend</h3>
          <div class="space-y-3">
            @for (m of monthlyTrend(); track m.month) {
              <div>
                <div class="flex items-center justify-between mb-1 text-xs">
                  <span class="text-text-secondary">{{ m.month }}</span>
                  <span class="text-text-primary font-medium">{{ m.revenue }}</span>
                </div>
                <div class="w-full bg-bg-hover rounded-full h-2.5">
                  <div class="bg-indigo-500 h-2.5 rounded-full transition-all" [style.width]="m.pct + '%'"></div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Top Deals Pipeline -->
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4">Top Deals Pipeline</h3>
          <div class="space-y-3">
            @for (deal of topDeals(); track deal.name) {
              <div class="flex items-center justify-between bg-bg-hover/40 rounded-lg p-3">
                <div>
                  <div class="text-sm font-medium text-text-primary">{{ deal.name }}</div>
                  <div class="text-xs text-text-secondary">{{ deal.stage }} &middot; {{ deal.owner }}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-semibold text-text-primary">{{ deal.value }}</div>
                  <div class="text-xs"
                    [class.text-emerald-500]="deal.probability >= 70"
                    [class.text-amber-400]="deal.probability >= 40 && deal.probability < 70"
                    [class.text-rose-400]="deal.probability < 40">
                    {{ deal.probability }}% prob.
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class CeoGrowthComponent {
  kpis = signal([
    { label: 'Q1 Revenue', value: '€11.8M', change: '+12.4% vs LY', positive: true, color: 'emerald' },
    { label: 'ARR', value: '€9.2M', change: '+18% YoY', positive: true, color: 'blue' },
    { label: 'New Logos', value: '34', change: '+11 vs Q4', positive: true, color: 'amber' },
    { label: 'Net Revenue Retention', value: '112%', change: '+3pp vs LY', positive: true, color: 'rose' },
  ]);

  regions = signal([
    { name: 'Belgium', revenue: '€5.3M', share: '45%', pct: 45, growth: 14, color: 'emerald' },
    { name: 'Netherlands', revenue: '€3.1M', share: '26%', pct: 26, growth: 9, color: 'blue' },
    { name: 'Germany', revenue: '€2.1M', share: '18%', pct: 18, growth: 22, color: 'amber' },
    { name: 'Other EU', revenue: '€1.3M', share: '11%', pct: 11, growth: 6, color: 'violet' },
  ]);

  monthlyTrend = signal([
    { month: 'Jan 2026', revenue: '€3.7M', pct: 88 },
    { month: 'Feb 2026', revenue: '€3.9M', pct: 93 },
    { month: 'Mar 2026', revenue: '€4.2M', pct: 100 },
  ]);

  topDeals = signal([
    { name: 'TechCorp Belgium', value: '€420K', stage: 'Negotiation', owner: 'Sophie V.', probability: 80 },
    { name: 'Northwind Enterprise', value: '€240K', stage: 'Proposal', owner: 'Jan M.', probability: 65 },
    { name: 'Hamburg Logistics', value: '€185K', stage: 'Discovery', owner: 'Felix R.', probability: 40 },
    { name: 'Rotterdam Ports', value: '€310K', stage: 'Negotiation', owner: 'Lisa K.', probability: 75 },
  ]);
}
