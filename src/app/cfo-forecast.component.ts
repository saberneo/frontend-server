import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cfo-forecast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Forecast</h1>
        <p class="text-sm text-text-secondary mt-1">FY 2026 &middot; rolling quarterly forecast &middot; last updated Mar 5</p>
      </div>

      <!-- Annual Target -->
      <div class="bg-bg-card p-6 rounded-xl border border-border-subtle shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-text-primary">Annual Revenue Target</h2>
          <span class="text-sm text-text-secondary">FY 2026</span>
        </div>
        <div class="flex items-center gap-6 mb-3">
          <div>
            <span class="text-3xl font-bold text-text-primary">€48.5M</span>
            <span class="text-sm text-text-secondary ml-2">target</span>
          </div>
          <div class="text-sm text-emerald-500 flex items-center gap-1">
            <span class="material-icons text-[16px]">trending_up</span>
            On track — 102% confidence
          </div>
        </div>
        <div class="w-full bg-bg-hover rounded-full h-4">
          <div class="h-4 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500" style="width: 24.3%"></div>
        </div>
        <div class="flex items-center justify-between mt-2 text-xs text-text-secondary">
          <span>€11.8M (Q1 actual)</span>
          <span>€48.5M target</span>
        </div>
      </div>

      <!-- Quarterly Forecast -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-6 border-b border-border-subtle">
          <h2 class="text-lg font-semibold text-text-primary">Quarterly Forecast</h2>
        </div>
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-3 font-semibold">Quarter</th>
              <th class="px-6 py-3 font-semibold text-right">Revenue</th>
              <th class="px-6 py-3 font-semibold text-right">Gross Profit</th>
              <th class="px-6 py-3 font-semibold text-right">EBITDA</th>
              <th class="px-6 py-3 font-semibold text-right">Confidence</th>
              <th class="px-6 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (q of quarterlyForecast(); track q.quarter) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-3 text-text-primary font-medium">{{ q.quarter }}</td>
                <td class="px-6 py-3 text-right text-text-primary">{{ q.revenue }}</td>
                <td class="px-6 py-3 text-right text-text-secondary">{{ q.grossProfit }}</td>
                <td class="px-6 py-3 text-right text-text-secondary">{{ q.ebitda }}</td>
                <td class="px-6 py-3 text-right">
                  <span class="font-medium" [class.text-emerald-500]="q.confidence >= 90" [class.text-amber-400]="q.confidence >= 70 && q.confidence < 90" [class.text-rose-400]="q.confidence < 70">{{ q.confidence }}%</span>
                </td>
                <td class="px-6 py-3">
                  <span class="py-0.5 px-2 rounded-full text-[10px] font-medium"
                    [class.bg-emerald-500/20]="q.status === 'Actual'" [class.text-emerald-400]="q.status === 'Actual'"
                    [class.bg-blue-500/20]="q.status === 'Forecast'" [class.text-blue-400]="q.status === 'Forecast'"
                    [class.bg-amber-500/20]="q.status === 'Preliminary'" [class.text-amber-400]="q.status === 'Preliminary'">
                    {{ q.status }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Key Assumptions -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span class="material-icons text-[18px] text-emerald-500">check_circle</span>
            Upside Drivers
          </h3>
          <div class="space-y-3">
            @for (item of upsideDrivers(); track item) {
              <div class="flex items-start gap-2">
                <span class="material-icons text-[14px] text-emerald-500 mt-0.5">arrow_right</span>
                <span class="text-sm text-text-secondary">{{ item }}</span>
              </div>
            }
          </div>
        </div>
        <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
          <h3 class="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span class="material-icons text-[18px] text-amber-400">warning</span>
            Downside Risks
          </h3>
          <div class="space-y-3">
            @for (item of downsideRisks(); track item) {
              <div class="flex items-start gap-2">
                <span class="material-icons text-[14px] text-amber-400 mt-0.5">arrow_right</span>
                <span class="text-sm text-text-secondary">{{ item }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class CfoForecastComponent {
  quarterlyForecast = signal([
    { quarter: 'Q1 2026', revenue: '€11.8M', grossProfit: '€5.01M', ebitda: '€1.74M', confidence: 100, status: 'Actual' },
    { quarter: 'Q2 2026', revenue: '€12.4M', grossProfit: '€5.33M', ebitda: '€1.92M', confidence: 88, status: 'Forecast' },
    { quarter: 'Q3 2026', revenue: '€12.1M', grossProfit: '€5.14M', ebitda: '€1.85M', confidence: 74, status: 'Forecast' },
    { quarter: 'Q4 2026', revenue: '€12.2M', grossProfit: '€5.20M', ebitda: '€1.88M', confidence: 62, status: 'Preliminary' },
  ]);

  upsideDrivers = signal([
    'Germany expansion pipeline €1.8M qualified — hiring regional account manager',
    'Enterprise deal Northwind upsell possible (€240K ARR)',
    'New SaaS pricing tier launching Q2 (+15% ARPU projected)',
    'Belgium government contract RFP shortlisted (€800K)',
  ]);

  downsideRisks = signal([
    'EUR/USD headwind: -2% revenue if EUR strengthens to 1.12',
    'Key customer Oceanic Imports potential churn (€28K outstanding)',
    'Raw material costs up 6% — could erode gross margin by 0.8pp',
    'Hiring delays in Germany — may push revenue to Q3',
  ]);
}
