import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ceo-risks',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Risks &amp; Watchlist</h1>
        <p class="text-sm text-text-secondary mt-1">Enterprise risk register &middot; reviewed Mar 3</p>
      </div>

      <!-- Risk Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div class="bg-bg-card p-6 rounded-xl shadow-sm border border-border-subtle border-t-4 border-t-rose-500 text-center">
          <div class="text-3xl font-bold text-rose-400">{{ highCount() }}</div>
          <div class="text-sm text-text-secondary mt-1">High Risks</div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl shadow-sm border border-border-subtle border-t-4 border-t-amber-500 text-center">
          <div class="text-3xl font-bold text-amber-400">{{ mediumCount() }}</div>
          <div class="text-sm text-text-secondary mt-1">Medium Risks</div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl shadow-sm border border-border-subtle border-t-4 border-t-blue-500 text-center">
          <div class="text-3xl font-bold text-blue-400">{{ lowCount() }}</div>
          <div class="text-sm text-text-secondary mt-1">Low / Watchlist</div>
        </div>
      </div>

      <!-- Risk Register -->
      <div class="space-y-4">
        @for (risk of risks(); track risk.title) {
          <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6 border-l-4"
            [class.border-l-rose-400]="risk.severity === 'High'"
            [class.border-l-amber-400]="risk.severity === 'Medium'"
            [class.border-l-blue-400]="risk.severity === 'Low'">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <span class="material-icons text-[22px] mt-0.5"
                  [class.text-rose-400]="risk.severity === 'High'"
                  [class.text-amber-400]="risk.severity === 'Medium'"
                  [class.text-blue-400]="risk.severity === 'Low'">
                  {{ risk.icon }}
                </span>
                <div>
                  <h3 class="text-sm font-semibold text-text-primary">{{ risk.title }}</h3>
                  <p class="text-xs text-text-secondary mt-1">{{ risk.description }}</p>
                </div>
              </div>
              <span class="py-1 px-3 rounded-full text-[10px] font-medium flex-shrink-0"
                [class.bg-rose-500/20]="risk.severity === 'High'" [class.text-rose-400]="risk.severity === 'High'"
                [class.bg-amber-500/20]="risk.severity === 'Medium'" [class.text-amber-400]="risk.severity === 'Medium'"
                [class.bg-blue-500/20]="risk.severity === 'Low'" [class.text-blue-400]="risk.severity === 'Low'">
                {{ risk.severity }}
              </span>
            </div>

            <div class="mt-3 flex items-center gap-6 text-xs text-text-secondary">
              <span class="flex items-center gap-1">
                <span class="material-icons text-[14px]">assessment</span>
                Impact: {{ risk.impact }}
              </span>
              <span class="flex items-center gap-1">
                <span class="material-icons text-[14px]">casino</span>
                Likelihood: {{ risk.likelihood }}
              </span>
              <span class="flex items-center gap-1">
                <span class="material-icons text-[14px]">person</span>
                {{ risk.owner }}
              </span>
            </div>

            <div class="mt-3 bg-bg-hover/40 rounded-lg p-3">
              <div class="text-xs font-medium text-text-primary mb-1">Mitigation</div>
              <div class="text-xs text-text-secondary">{{ risk.mitigation }}</div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class CeoRisksComponent {
  risks = signal([
    {
      title: 'Key talent attrition — VP Engineering',
      description: 'Competitor offer reported. Loss would impact NEXUS M2/M3 timeline and team morale.',
      severity: 'High' as const, impact: 'Critical', likelihood: 'Probable',
      owner: 'HR Director',
      icon: 'person_alert',
      mitigation: 'Retention package drafted (equity + bonus). HR scheduling counter-offer meeting this week. Succession planning activated.'
    },
    {
      title: 'Northwind Traders — €62.8K overdue receivable',
      description: '90+ days past due. Collections escalated. Risk of write-off if not resolved by Q2.',
      severity: 'High' as const, impact: 'High', likelihood: 'Possible',
      owner: 'CFO',
      icon: 'payments',
      mitigation: 'Legal review initiated. Payment plan proposed. Escalation to Northwind CEO scheduled this Friday.'
    },
    {
      title: 'Germany expansion delay',
      description: 'Regional hire still pending. Pipeline €1.8M but no local presence to close. Revenue target at risk.',
      severity: 'Medium' as const, impact: 'High', likelihood: 'Possible',
      owner: 'VP Sales',
      icon: 'flight_takeoff',
      mitigation: 'Interim solution: Belgian team covering remotely. Headhunter engaged for Hamburg-based lead. Decision deadline Apr 10.'
    },
    {
      title: 'Innoviris funding compliance',
      description: 'Final report due Apr 15. Technical sections complete but financial reconciliation pending CFO review.',
      severity: 'Medium' as const, impact: 'Medium', likelihood: 'Unlikely',
      owner: 'CTO + CFO',
      icon: 'description',
      mitigation: 'Weekly sync between CTO and CFO. Finance team allocated 2 FTEs for report preparation. Draft due Apr 8.'
    },
    {
      title: 'Cybersecurity — ransomware threat landscape',
      description: 'Industry-wide increase in ransomware targeting mid-market companies. Last pen-test was 6 months ago.',
      severity: 'Medium' as const, impact: 'Critical', likelihood: 'Unlikely',
      owner: 'CISO',
      icon: 'security',
      mitigation: 'Pen-test scheduled Q2. SOC monitoring upgraded. Employee phishing training completed Feb. Cyber insurance renewed.'
    },
    {
      title: 'EUR/USD currency exposure',
      description: '18% of revenue in USD-linked contracts. EUR strengthening could erode margins.',
      severity: 'Low' as const, impact: 'Medium', likelihood: 'Possible',
      owner: 'CFO',
      icon: 'currency_exchange',
      mitigation: 'Hedging strategy covering 60% of exposure. Monthly FX review with treasury. Natural hedge via USD-denominated costs.'
    },
  ]);

  highCount = signal(this.risks().filter(r => r.severity === 'High').length);
  mediumCount = signal(this.risks().filter(r => r.severity === 'Medium').length);
  lowCount = signal(this.risks().filter(r => r.severity === 'Low').length);
}
