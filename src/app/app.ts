import { ChangeDetectionStrategy, Component, inject, signal, HostListener, OnInit, effect } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { WsService } from './ws.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  wsService = inject(WsService);
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  roles = ['Business User', 'CFO', 'CEO', 'Platform Admin'];

  // #10 i18n
  readonly langs = ['EN', 'FR', 'ES'];
  activeLang = signal('EN');
  langReady = signal(true);

  constructor() {
    this.translate.addLangs(['en', 'fr', 'es']);
    this.translate.setDefaultLang('en');
    this.translate.use('en');
    // Reactively connect/disconnect WebSocket when login state changes
    effect(() => {
      if (this.dataService.isLoggedIn()) {
        this.wsService.connect();
      } else {
        this.wsService.disconnect();
      }
    });
  }

  ngOnInit() {
    this.loadPendingCount();
  }

  pendingCount = signal(0);

  private loadPendingCount() {
    this.api.getApprovalStats().subscribe({
      next: (s: any) => this.pendingCount.set(s?.pending ?? 0),
      error: () => {},
    });
  }

  switchLang(lang: string) {
    this.activeLang.set(lang);
    this.translate.use(lang.toLowerCase()).subscribe(() => {
      this.langReady.set(false);
      setTimeout(() => this.langReady.set(true));
    });
  }

  // #6 Global search
  searchQuery = signal('');
  searchResults = signal<{ type: string; label: string; route: string }[]>([]);
  showSearchDropdown = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  onSearchInput(query: string) {
    this.searchQuery.set(query);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (!query.trim()) {
      this.searchResults.set([]);
      this.showSearchDropdown.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => {
      const q = query.toLowerCase();
      const navItems = [
        { type: 'page', label: 'Overview', route: '/overview' },
        { type: 'page', label: 'Customers', route: '/customers' },
        { type: 'page', label: 'Orders & Sales', route: '/orders-sales' },
        { type: 'page', label: 'Products', route: '/products' },
        { type: 'page', label: 'Pending Approvals', route: '/pending-approvals' },
        { type: 'page', label: 'Data Health', route: '/data-health' },
        { type: 'page', label: 'Source Connectors', route: '/source-connectors' },
        { type: 'page', label: 'Schema Registry', route: '/schema-registry' },
        { type: 'page', label: 'CDM Governance', route: '/cdm-governance' },
        { type: 'page', label: 'Field Mappings', route: '/field-mappings' },
        { type: 'page', label: 'CDM Versions', route: '/cdm-versions' },
        { type: 'page', label: 'System Health', route: '/system-health' },
        { type: 'page', label: 'Tenants', route: '/tenants' },
        { type: 'page', label: 'Users & Roles', route: '/users-roles' },
        { type: 'page', label: 'Audit Log', route: '/audit-log' },
        { type: 'page', label: 'Ask NEXUS', route: '/ask-nexus' },
        { type: 'page', label: 'P&L Overview (CFO)', route: '/cfo-pnl' },
        { type: 'page', label: 'Budget vs Actual (CFO)', route: '/cfo-budget' },
        { type: 'page', label: 'Cash Flow (CFO)', route: '/cfo-cashflow' },
        { type: 'page', label: 'Receivables (CFO)', route: '/cfo-receivables' },
        { type: 'page', label: 'Cost Analysis (CFO)', route: '/cfo-cost-analysis' },
        { type: 'page', label: 'Forecast (CFO)', route: '/cfo-forecast' },
        { type: 'page', label: 'Company Pulse (CEO)', route: '/ceo-pulse' },
        { type: 'page', label: 'Growth & Revenue (CEO)', route: '/ceo-growth' },
        { type: 'page', label: 'Market & Customers (CEO)', route: '/ceo-market' },
        { type: 'page', label: 'Strategic Priorities (CEO)', route: '/ceo-strategy' },
        { type: 'page', label: 'Risks & Watchlist (CEO)', route: '/ceo-risks' },
      ];
      const matched = navItems.filter(item => item.label.toLowerCase().includes(q));
      this.searchResults.set(matched.slice(0, 6));
      this.showSearchDropdown.set(matched.length > 0);
    }, 200);
  }

  selectSearchResult(route: string) {
    this.showSearchDropdown.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.router.navigate([route]);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showSearchDropdown.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.global-search-container')) {
      this.showSearchDropdown.set(false);
    }
  }

  setRole(role: string) {
    this.dataService.currentRole.set(role);
    if (role === 'Platform Admin') {
      this.dataService.router.navigate(['/source-connectors']);
    } else if (role === 'CFO') {
      this.dataService.router.navigate(['/cfo-pnl']);
    } else if (role === 'CEO') {
      this.dataService.router.navigate(['/ceo-pulse']);
    } else {
      this.dataService.router.navigate(['/overview']);
    }
  }
}
