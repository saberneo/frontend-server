import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ceo-strategy',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Strategic Priorities</h1>
        <p class="text-sm text-text-secondary mt-1">FY 2026 strategic roadmap &middot; Board-approved Jan 15</p>
      </div>

      <!-- Priority Cards -->
      <div class="space-y-6">
        @for (p of priorities(); track p.title; let i = $index) {
          <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  [class.bg-emerald-500]="p.status === 'On Track'"
                  [class.bg-amber-500]="p.status === 'At Risk'"
                  [class.bg-blue-500]="p.status === 'Planning'"
                  [class.bg-rose-500]="p.status === 'Delayed'">
                  {{ i + 1 }}
                </div>
                <div>
                  <h3 class="text-base font-semibold text-text-primary">{{ p.title }}</h3>
                  <p class="text-sm text-text-secondary mt-1">{{ p.description }}</p>
                </div>
              </div>
              <span class="py-1 px-3 rounded-full text-xs font-medium flex-shrink-0"
                [class.bg-emerald-500/20]="p.status === 'On Track'" [class.text-emerald-400]="p.status === 'On Track'"
                [class.bg-amber-500/20]="p.status === 'At Risk'" [class.text-amber-400]="p.status === 'At Risk'"
                [class.bg-blue-500/20]="p.status === 'Planning'" [class.text-blue-400]="p.status === 'Planning'"
                [class.bg-rose-500/20]="p.status === 'Delayed'" [class.text-rose-400]="p.status === 'Delayed'">
                {{ p.status }}
              </span>
            </div>

            <!-- Progress bar -->
            <div class="mt-4">
              <div class="flex items-center justify-between mb-1 text-xs text-text-secondary">
                <span>Progress</span>
                <span>{{ p.progress }}%</span>
              </div>
              <div class="w-full bg-bg-hover rounded-full h-2">
                <div class="h-2 rounded-full transition-all duration-500"
                  [class.bg-emerald-500]="p.status === 'On Track'"
                  [class.bg-amber-400]="p.status === 'At Risk'"
                  [class.bg-blue-500]="p.status === 'Planning'"
                  [class.bg-rose-400]="p.status === 'Delayed'"
                  [style.width]="p.progress + '%'"></div>
              </div>
            </div>

            <!-- Milestones -->
            <div class="mt-4 flex flex-wrap gap-2">
              @for (m of p.milestones; track m.label) {
                <span class="inline-flex items-center gap-1 py-1 px-2.5 rounded-md text-xs bg-bg-hover text-text-secondary">
                  <span class="material-icons text-[14px]"
                    [class.text-emerald-500]="m.done"
                    [class.text-text-secondary]="!m.done">
                    {{ m.done ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  {{ m.label }}
                </span>
              }
            </div>

            <!-- Owner & Deadline -->
            <div class="mt-4 flex items-center gap-4 text-xs text-text-secondary">
              <span class="flex items-center gap-1"><span class="material-icons text-[14px]">person</span>{{ p.owner }}</span>
              <span class="flex items-center gap-1"><span class="material-icons text-[14px]">event</span>{{ p.deadline }}</span>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class CeoStrategyComponent {
  priorities = signal<{ title: string; description: string; status: 'On Track' | 'At Risk' | 'Planning' | 'Delayed'; progress: number; owner: string; deadline: string; milestones: { label: string; done: boolean }[] }[]>([
    {
      title: 'Germany Market Expansion',
      description: 'Establish presence in DACH region. Target €2M ARR by Q4 2026. Requires regional team, local partnerships, and localized product.',
      status: 'At Risk',
      progress: 35,
      owner: 'Felix R. — VP Sales',
      deadline: 'Q4 2026',
      milestones: [
        { label: 'Market research', done: true },
        { label: 'Hire regional lead', done: false },
        { label: 'First 10 customers', done: false },
        { label: '€500K pipeline', done: true },
        { label: 'Local partnerships', done: false },
      ]
    },
    {
      title: 'NEXUS Platform — Full Deployment',
      description: 'Complete M1-M4 rollout of NEXUS data platform. M1 (Connectivity) live, M2 (Quality) piloting Q2, M3/M4 planned.',
      status: 'On Track',
      progress: 55,
      owner: 'Sarah L. — CTO',
      deadline: 'Q3 2026',
      milestones: [
        { label: 'M1 Connectivity — LIVE', done: true },
        { label: 'M2 Quality — Pilot', done: true },
        { label: 'M3 Models — Dev', done: false },
        { label: 'M4 Analytics — Planned', done: false },
        { label: 'Innoviris report', done: false },
      ]
    },
    {
      title: 'Enterprise Tier Launch',
      description: 'New enterprise pricing tier with SLA guarantees, dedicated support, and custom integrations. Target 15% ARPU uplift.',
      status: 'On Track',
      progress: 70,
      owner: 'Marc D. — VP Product',
      deadline: 'Q2 2026',
      milestones: [
        { label: 'Pricing model defined', done: true },
        { label: 'Feature gating', done: true },
        { label: 'Sales enablement', done: true },
        { label: 'Launch campaign', done: false },
        { label: 'First 5 enterprise deals', done: false },
      ]
    },
    {
      title: 'Operational Excellence Program',
      description: 'Reduce OpEx ratio from 31% to 27% through automation, process optimization, and headcount efficiency.',
      status: 'Planning',
      progress: 15,
      owner: 'Anna B. — COO',
      deadline: 'Q4 2026',
      milestones: [
        { label: 'Process audit', done: true },
        { label: 'Automation targets identified', done: false },
        { label: 'Phase 1 implementation', done: false },
        { label: 'KPI dashboard', done: false },
      ]
    },
  ]);
}
