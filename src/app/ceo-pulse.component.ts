import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ceo-pulse',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Company Pulse</h1>
        <p class="text-sm text-text-secondary mt-1">Executive overview &middot; updated in real-time</p>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        @for (kpi of kpis(); track kpi.label) {
          <div class="bg-bg-card p-6 rounded-xl shadow-sm border border-border-subtle"
               [class.border-t-4]="true"
               [class.border-t-emerald-500]="kpi.color === 'emerald'"
               [class.border-t-blue-500]="kpi.color === 'blue'"
               [class.border-t-amber-500]="kpi.color === 'amber'"
               [class.border-t-violet-500]="kpi.color === 'violet'">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold uppercase text-text-secondary tracking-wide">{{ kpi.label }}</span>
              <span class="material-icons text-[18px]"
                [class.text-emerald-500]="kpi.color === 'emerald'"
                [class.text-blue-500]="kpi.color === 'blue'"
                [class.text-amber-500]="kpi.color === 'amber'"
                [class.text-violet-500]="kpi.color === 'violet'">
                {{ kpi.icon }}
              </span>
            </div>
            <div class="text-2xl font-bold text-text-primary">{{ kpi.value }}</div>
            <div class="flex items-center gap-1 mt-1 text-xs"
              [class.text-emerald-500]="kpi.positive"
              [class.text-rose-400]="!kpi.positive">
              <span class="material-icons text-[14px]">{{ kpi.positive ? 'trending_up' : 'trending_down' }}</span>
              {{ kpi.change }}
            </div>
          </div>
        }
      </div>

      <!-- Business Scorecard -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-6">Business Scorecard</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (pillar of scorecard(); track pillar.name) {
            <div class="flex items-center gap-4 bg-bg-hover/40 rounded-lg p-4">
              <div class="relative w-16 h-16 flex-shrink-0">
                <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" class="text-bg-hover" stroke-width="6"/>
                  <circle cx="32" cy="32" r="28" fill="none"
                    [attr.stroke-dasharray]="pillar.dash"
                    stroke-dashoffset="0"
                    stroke-width="6" stroke-linecap="round"
                    [class.stroke-emerald-500]="pillar.score >= 8"
                    [class.stroke-blue-500]="pillar.score >= 7 && pillar.score < 8"
                    [class.stroke-amber-400]="pillar.score >= 6 && pillar.score < 7"
                    [class.stroke-rose-400]="pillar.score < 6"/>
                </svg>
                <span class="absolute inset-0 flex items-center justify-center text-sm font-bold text-text-primary">{{ pillar.score }}</span>
              </div>
              <div>
                <div class="text-sm font-semibold text-text-primary">{{ pillar.name }}</div>
                <div class="text-xs text-text-secondary mt-0.5">{{ pillar.detail }}</div>
                <div class="flex items-center gap-1 mt-1 text-xs"
                  [class.text-emerald-500]="pillar.trend === 'up'"
                  [class.text-amber-400]="pillar.trend === 'flat'"
                  [class.text-rose-400]="pillar.trend === 'down'">
                  <span class="material-icons text-[14px]">
                    {{ pillar.trend === 'up' ? 'trending_up' : pillar.trend === 'flat' ? 'trending_flat' : 'trending_down' }}
                  </span>
                  {{ pillar.trendLabel }}
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Requires your attention -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span class="material-icons text-amber-400 text-[20px]">notifications_active</span>
          Requires your attention
        </h2>
        <div class="space-y-3">
          @for (alert of alerts(); track alert.title) {
            <div class="flex items-start gap-4 bg-bg-hover/40 rounded-lg p-4 border-l-4"
              [class.border-l-rose-400]="alert.severity === 'high'"
              [class.border-l-amber-400]="alert.severity === 'medium'"
              [class.border-l-blue-400]="alert.severity === 'low'">
              <span class="material-icons text-[20px] mt-0.5"
                [class.text-rose-400]="alert.severity === 'high'"
                [class.text-amber-400]="alert.severity === 'medium'"
                [class.text-blue-400]="alert.severity === 'low'">
                {{ alert.icon }}
              </span>
              <div class="flex-1">
                <div class="text-sm font-semibold text-text-primary">{{ alert.title }}</div>
                <div class="text-xs text-text-secondary mt-0.5">{{ alert.detail }}</div>
              </div>
              <span class="py-0.5 px-2 rounded-full text-[10px] font-medium"
                [class.bg-rose-500/20]="alert.severity === 'high'" [class.text-rose-400]="alert.severity === 'high'"
                [class.bg-amber-500/20]="alert.severity === 'medium'" [class.text-amber-400]="alert.severity === 'medium'"
                [class.bg-blue-500/20]="alert.severity === 'low'" [class.text-blue-400]="alert.severity === 'low'">
                {{ alert.severity }}
              </span>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class CeoPulseComponent {
  kpis = signal([
    { label: 'Revenue', value: '€11.8M', change: '+12.4% vs LY', positive: true, icon: 'euro', color: 'emerald' },
    { label: 'Gross Margin', value: '42.3%', change: '+1.8pp vs LY', positive: true, icon: 'pie_chart', color: 'blue' },
    { label: 'Active Customers', value: '1,847', change: '+164 this quarter', positive: true, icon: 'groups', color: 'amber' },
    { label: 'Headcount', value: '142', change: '+8 since Jan', positive: true, icon: 'person', color: 'violet' },
  ]);

  scorecard = signal([
    { name: 'Revenue Growth', score: 8.3, detail: '+12.4% YoY — Belgium +14%, Netherlands +9%', trend: 'up' as const, trendLabel: 'Accelerating', dash: '146 176' },
    { name: 'Customer Health', score: 7.8, detail: 'NPS 61 · Churn 2.1% · Expansion 18%', trend: 'up' as const, trendLabel: 'Improving', dash: '137 176' },
    { name: 'Operational Efficiency', score: 7.1, detail: 'OpEx ratio 31% · GP/headcount €35K', trend: 'flat' as const, trendLabel: 'Stable', dash: '125 176' },
    { name: 'NEXUS Programme', score: 6.5, detail: 'M1 live · M2 pilot Q2 · Innoviris deadline Apr 15', trend: 'down' as const, trendLabel: 'Needs attention', dash: '114 176' },
  ]);

  alerts = signal<{ title: string; detail: string; severity: 'high' | 'medium' | 'low'; icon: string }[]>([
    { title: 'Northwind Traders — €62.8K overdue', detail: 'Invoice 90+ days past due. AR team escalated Mar 1. Decision needed on collections strategy.', severity: 'high', icon: 'payments' },
    { title: 'Germany expansion — Q2 go/no-go', detail: 'Pipeline €1.8M qualified. Regional hire pending your sign-off. Board presentation Apr 10.', severity: 'medium', icon: 'flight_takeoff' },
    { title: 'NEXUS Innoviris funding deadline', detail: 'Final report due Apr 15. Technical team on track. Finance section needs CFO review.', severity: 'low', icon: 'event' },
    { title: 'Key talent risk — VP Engineering', detail: 'Competitor offer reported. Retention package drafted by HR, awaiting your approval.', severity: 'high', icon: 'person_alert' },
  ]);
}
