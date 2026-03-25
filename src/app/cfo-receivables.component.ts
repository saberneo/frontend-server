import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cfo-receivables',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">Receivables</h1>
        <p class="text-sm text-text-secondary mt-1">Outstanding invoices &middot; as of Mar 5, 2026</p>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-blue-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Total Receivables</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">€2.14M</div>
          <p class="text-sm text-text-secondary">48 open invoices</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-rose-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Overdue</h3>
          <div class="text-3xl font-bold text-rose-400 mb-1">€387K</div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-rose-500"></span>
            <p class="text-sm text-rose-400">4 invoices overdue</p>
          </div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-amber-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">DSO</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">38 days</div>
          <p class="text-sm text-emerald-500">-3 days vs last quarter</p>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border-t-4 border-t-emerald-500 border border-border-subtle shadow-sm">
          <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Collection Rate</h3>
          <div class="text-3xl font-bold text-text-primary mb-1">94.2%</div>
          <p class="text-sm text-emerald-500">Above 90% target</p>
        </div>
      </div>

      <!-- Aging Analysis -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm p-6">
        <h2 class="text-lg font-semibold text-text-primary mb-6">Aging Analysis</h2>
        <div class="space-y-4">
          @for (bucket of agingBuckets(); track bucket.label) {
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm text-text-primary">{{ bucket.label }}</span>
                <div class="flex items-center gap-3">
                  <span class="text-xs text-text-secondary">{{ bucket.count }} invoices</span>
                  <span class="text-sm font-semibold text-text-primary">{{ bucket.amount }}</span>
                </div>
              </div>
              <div class="w-full bg-bg-hover rounded-full h-3">
                <div class="h-3 rounded-full transition-all duration-500" [style.width.%]="bucket.pct" [style.background-color]="bucket.color"></div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Overdue Invoices -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-6 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Overdue Invoices</h2>
            <p class="text-sm text-text-secondary">Requires immediate attention</p>
          </div>
          <span class="bg-rose-500/20 text-rose-400 py-1 px-2.5 rounded-md text-xs font-medium">4 overdue</span>
        </div>
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-3 font-semibold">Customer</th>
              <th class="px-6 py-3 font-semibold">Invoice</th>
              <th class="px-6 py-3 font-semibold text-right">Amount</th>
              <th class="px-6 py-3 font-semibold text-right">Days Overdue</th>
              <th class="px-6 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (inv of overdueInvoices(); track inv.invoice) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-3 font-medium text-text-primary">{{ inv.customer }}</td>
                <td class="px-6 py-3 text-text-secondary">{{ inv.invoice }}</td>
                <td class="px-6 py-3 text-right text-text-primary font-medium">{{ inv.amount }}</td>
                <td class="px-6 py-3 text-right">
                  <span class="py-0.5 px-2 rounded-full text-xs font-medium"
                    [class.bg-rose-500/20]="inv.daysOverdue > 14" [class.text-rose-400]="inv.daysOverdue > 14"
                    [class.bg-amber-500/20]="inv.daysOverdue <= 14" [class.text-amber-400]="inv.daysOverdue <= 14">
                    {{ inv.daysOverdue }}d
                  </span>
                </td>
                <td class="px-6 py-3">
                  <span class="text-xs text-text-secondary">{{ inv.action }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CfoReceivablesComponent {
  agingBuckets = signal([
    { label: 'Current (0–30 days)', amount: '€1,240K', count: 28, pct: 100, color: '#10b981' },
    { label: '31–60 days', amount: '€513K', count: 12, pct: 41, color: '#f59e0b' },
    { label: '61–90 days', amount: '€324K', count: 4, pct: 26, color: '#f97316' },
    { label: '90+ days', amount: '€63K', count: 4, pct: 5, color: '#ef4444' },
  ]);

  overdueInvoices = signal([
    { customer: 'Northwind Traders', invoice: 'INV-2026-0142', amount: '€62.8K', daysOverdue: 18, action: 'CFO outreach recommended' },
    { customer: 'Alpine Logistics', invoice: 'INV-2026-0098', amount: '€41.2K', daysOverdue: 12, action: 'Payment plan requested' },
    { customer: 'Oceanic Imports', invoice: 'INV-2025-0891', amount: '€28.5K', daysOverdue: 34, action: 'Escalated to legal' },
    { customer: 'TechStart GmbH', invoice: 'INV-2026-0167', amount: '€18.3K', daysOverdue: 7, action: 'Reminder sent' },
  ]);
}
