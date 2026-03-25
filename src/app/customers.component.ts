import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

interface Customer {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  segment: string;
  openOrders: number;
  revenue: string;
  lastActivity: string;
  status: string;
  email?: string;
  phone?: string;
  accountManager?: string;
  memberSince?: string;
  totalOrders?: number;
  recentOrders?: { id: string; date: string; amount: string; status: string }[];
  notes?: string;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Customer Detail Modal -->
    @if (selectedCustomer()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeCustomerModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between p-6 border-b border-border-subtle">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <span class="text-lg font-bold text-indigo-400">{{ selectedCustomer()!.name.charAt(0) }}</span>
              </div>
              <div>
                <h2 class="text-lg font-semibold text-text-primary">{{ selectedCustomer()!.name }}</h2>
                <p class="text-sm text-text-secondary">{{ selectedCustomer()!.countryCode }} · {{ selectedCustomer()!.country }} · {{ selectedCustomer()!.segment }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border"
                    [class.bg-emerald-100]="selectedCustomer()!.status === 'Active'" [class.text-emerald-800]="selectedCustomer()!.status === 'Active'" [class.border-emerald-200]="selectedCustomer()!.status === 'Active'"
                    [class.bg-rose-100]="selectedCustomer()!.status === 'At Risk'" [class.text-rose-800]="selectedCustomer()!.status === 'At Risk'" [class.border-rose-200]="selectedCustomer()!.status === 'At Risk'"
                    [class.bg-amber-100]="selectedCustomer()!.status === 'Inactive'" [class.text-amber-800]="selectedCustomer()!.status === 'Inactive'" [class.border-amber-200]="selectedCustomer()!.status === 'Inactive'">
                {{ selectedCustomer()!.status }}
              </span>
              <button (click)="closeCustomerModal()" class="text-text-secondary hover:text-text-primary transition-colors">
                <span class="material-icons">close</span>
              </button>
            </div>
          </div>
          <div class="p-6 space-y-5">
            <!-- KPI Row -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-bg-input border border-border-subtle rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-text-primary">{{ selectedCustomer()!.revenue }}</div>
                <div class="text-xs text-text-secondary mt-1">Revenue YTD</div>
              </div>
              <div class="bg-bg-input border border-border-subtle rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-text-primary">{{ selectedCustomer()!.openOrders }}</div>
                <div class="text-xs text-text-secondary mt-1">Open Orders</div>
              </div>
              <div class="bg-bg-input border border-border-subtle rounded-lg p-4 text-center">
                <div class="text-2xl font-bold text-text-primary">{{ selectedCustomer()!.totalOrders }}</div>
                <div class="text-xs text-text-secondary mt-1">Total Orders</div>
              </div>
            </div>
            <!-- Contact Info -->
            <div class="bg-bg-input border border-border-subtle rounded-lg p-4">
              <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{{ 'CUSTOMERS.MODAL_LBL_CONTACT_INFO' | translate }}</h3>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-text-secondary">{{ 'CUSTOMERS.MODAL_LBL_EMAIL' | translate }}</span>
                  <span class="text-text-primary ml-2">{{ selectedCustomer()!.email }}</span>
                </div>
                <div>
                  <span class="text-text-secondary">{{ 'CUSTOMERS.MODAL_LBL_PHONE' | translate }}</span>
                  <span class="text-text-primary ml-2">{{ selectedCustomer()!.phone }}</span>
                </div>
                <div>
                  <span class="text-text-secondary">{{ 'CUSTOMERS.MODAL_LBL_ACCOUNT_MGR' | translate }}</span>
                  <span class="text-text-primary ml-2">{{ selectedCustomer()!.accountManager }}</span>
                </div>
                <div>
                  <span class="text-text-secondary">{{ 'CUSTOMERS.MODAL_LBL_MEMBER_SINCE' | translate }}</span>
                  <span class="text-text-primary ml-2">{{ selectedCustomer()!.memberSince }}</span>
                </div>
              </div>
            </div>
            <!-- Recent Orders -->
            <div>
              <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{{ 'CUSTOMERS.MODAL_LBL_RECENT_ORDERS' | translate }}</h3>
              <div class="bg-bg-input border border-border-subtle rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="text-xs text-text-secondary bg-bg-hover/50">
                    <tr>
                      <th class="px-4 py-2.5 text-left font-medium">{{ 'CUSTOMERS.TABLE_COL_ORDER_ID' | translate }}</th>
                      <th class="px-4 py-2.5 text-left font-medium">{{ 'CUSTOMERS.TABLE_COL_DATE' | translate }}</th>
                      <th class="px-4 py-2.5 text-right font-medium">{{ 'CUSTOMERS.TABLE_COL_AMOUNT' | translate }}</th>
                      <th class="px-4 py-2.5 text-right font-medium">{{ 'CUSTOMERS.TABLE_COL_ORDER_STATUS' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-subtle">
                    @for (order of selectedCustomer()!.recentOrders; track order.id) {
                      <tr>
                        <td class="px-4 py-3 text-indigo-400 font-mono font-medium">{{ order.id }}</td>
                        <td class="px-4 py-3 text-text-secondary">{{ order.date }}</td>
                        <td class="px-4 py-3 text-right text-text-primary font-medium">{{ order.amount }}</td>
                        <td class="px-4 py-3 text-right">
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                [class.bg-amber-100]="order.status === 'Processing'" [class.text-amber-800]="order.status === 'Processing'"
                                [class.bg-blue-100]="order.status === 'Shipped'" [class.text-blue-800]="order.status === 'Shipped'"
                                [class.bg-emerald-100]="order.status === 'Delivered'" [class.text-emerald-800]="order.status === 'Delivered'">
                            {{ order.status }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            @if (selectedCustomer()!.notes) {
              <div class="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Account Notes</div>
                <p class="text-sm text-text-primary">{{ selectedCustomer()!.notes }}</p>
              </div>
            }
          </div>
          <div class="flex justify-end gap-3 p-6 border-t border-border-subtle">
            @if (selectedCustomer()!.status === 'At Risk') {
              <button (click)="contactCustomer(selectedCustomer()!); closeCustomerModal()"
                class="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                <span class="material-icons text-[16px]">outgoing_mail</span>{{ 'CUSTOMERS.MODAL_BTN_SEND_FOLLOWUP' | translate }}
              </button>
            }
            <button (click)="closeCustomerModal()" class="px-4 py-2 bg-bg-hover text-text-primary border border-border-subtle hover:bg-border-subtle rounded-md text-sm font-medium transition-colors">{{ 'CUSTOMERS.MODAL_BTN_CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <div class="p-8 max-w-7xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">{{ 'CUSTOMERS.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ totalCustomers() || '—' }} active &middot; unified from AdventureWorks + Salesforce</p>
        </div>
        <div class="relative">
          <input type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="{{ 'CUSTOMERS.SEARCH_PLACEHOLDER' | translate }}"
            class="w-64 bg-bg-card border border-border-subtle rounded-md py-2 pl-4 pr-10 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-colors">
          <span class="material-icons absolute right-3 top-2 text-text-secondary text-[20px]">search</span>
        </div>
      </div>

      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_CUSTOMER' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_COUNTRY' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_SEGMENT' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_OPEN_ORDERS' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_REVENUE' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_LAST_ACTIVITY' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'CUSTOMERS.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-6 py-4 font-semibold text-right">{{ 'CUSTOMERS.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @if (isLoading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-32 my-0.5"></div><div class="h-3 bg-bg-hover rounded animate-pulse w-20 mt-1.5"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-24 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-5 bg-bg-hover rounded animate-pulse w-20"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-8 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-16 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-20 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-5 bg-bg-hover rounded animate-pulse w-16"></div></td>
                  <td class="px-6 py-4 text-right"><div class="h-7 bg-bg-hover rounded animate-pulse w-12 ml-auto"></div></td>
                </tr>
              }
            } @else {
            @for (customer of filteredCustomers(); track customer.id) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-4">
                  <div class="font-medium text-text-primary">{{ customer.name }}</div>
                  <div class="text-xs text-text-secondary">{{ customer.id }}</div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <span class="text-text-primary font-medium">{{ customer.countryCode }}</span>
                    <span class="text-text-secondary">{{ customer.country }}</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        [class.bg-indigo-100]="customer.segment === 'Enterprise'" [class.text-indigo-800]="customer.segment === 'Enterprise'" [class.dark:bg-indigo-500/20]="customer.segment === 'Enterprise'" [class.dark:text-indigo-400]="customer.segment === 'Enterprise'" [class.border]="customer.segment === 'Enterprise'" [class.border-indigo-200]="customer.segment === 'Enterprise'" [class.dark:border-indigo-500/30]="customer.segment === 'Enterprise'"
                        [class.bg-slate-100]="customer.segment === 'SMB'" [class.text-slate-800]="customer.segment === 'SMB'" [class.dark:bg-slate-700]="customer.segment === 'SMB'" [class.dark:text-slate-300]="customer.segment === 'SMB'" [class.border]="customer.segment === 'SMB'" [class.border-slate-200]="customer.segment === 'SMB'" [class.dark:border-slate-600]="customer.segment === 'SMB'">
                    {{ customer.segment }}
                  </span>
                </td>
                <td class="px-6 py-4 text-text-primary">{{ customer.openOrders }}</td>
                <td class="px-6 py-4 text-text-primary">{{ customer.revenue }}</td>
                <td class="px-6 py-4 text-text-secondary">{{ customer.lastActivity }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        [class.bg-emerald-100]="customer.status === 'Active'" [class.text-emerald-800]="customer.status === 'Active'" [class.dark:bg-emerald-500/20]="customer.status === 'Active'" [class.dark:text-emerald-400]="customer.status === 'Active'" [class.border]="customer.status === 'Active'" [class.border-emerald-200]="customer.status === 'Active'" [class.dark:border-emerald-500/30]="customer.status === 'Active'"
                        [class.bg-amber-100]="customer.status === 'Inactive'" [class.text-amber-800]="customer.status === 'Inactive'" [class.dark:bg-amber-500/20]="customer.status === 'Inactive'" [class.dark:text-amber-400]="customer.status === 'Inactive'" [class.border]="customer.status === 'Inactive'" [class.border-amber-200]="customer.status === 'Inactive'" [class.dark:border-amber-500/30]="customer.status === 'Inactive'"
                        [class.bg-rose-100]="customer.status === 'At Risk'" [class.text-rose-800]="customer.status === 'At Risk'" [class.dark:bg-rose-500/20]="customer.status === 'At Risk'" [class.dark:text-rose-400]="customer.status === 'At Risk'" [class.border]="customer.status === 'At Risk'" [class.border-rose-200]="customer.status === 'At Risk'" [class.dark:border-rose-500/30]="customer.status === 'At Risk'">
                    {{ customer.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button (click)="viewCustomer(customer)" class="px-3 py-1.5 bg-bg-hover text-text-primary text-xs font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors">{{ 'CUSTOMERS.BTN_VIEW' | translate }}</button>
                    @if (customer.status === 'At Risk') {
                      <button (click)="contactCustomer(customer)" class="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium rounded-md transition-colors">{{ 'CUSTOMERS.BTN_CONTACT' | translate }}</button>
                    }
                  </div>
                </td>
              </tr>
            }
          @if (filteredCustomers().length === 0) {
              <tr>
                <td colspan="8" class="px-6 py-8 text-center text-text-secondary">
                  No customers found matching "{{ searchQuery() }}"
                </td>
              </tr>
            }
            }
          </tbody>
        </table>
      </div>
      @if (totalPages() > 1) {
        <div class="px-6 py-3 border-t border-border-subtle flex items-center justify-between text-sm text-text-secondary">
          <span>{{ totalCustomers() }} customers · page {{ currentPage() }} of {{ totalPages() }}</span>
          <div class="flex items-center gap-2">
            <button (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() === 1"
              class="px-3 py-1 rounded border border-border-subtle bg-bg-hover hover:bg-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <span class="material-icons text-[16px]">chevron_left</span>
            </button>
            <button (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() === totalPages()"
              class="px-3 py-1 rounded border border-border-subtle bg-bg-hover hover:bg-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <span class="material-icons text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class CustomersComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api  = inject(ApiService);

  searchQuery = signal('');
  selectedCustomer = signal<Customer | null>(null);
  isLoading = signal(false);
  currentPage = signal(1);
  totalCustomers = signal(0);
  totalPages = signal(0);

  ngOnInit() {
    this.loadCustomers();
  }

  private loadCustomers(search?: string) {
    this.isLoading.set(true);
    this.api.getCustomers(search, undefined, undefined, this.currentPage(), 50).subscribe({
      next: (res) => {
        this.totalCustomers.set(res.total);
        this.totalPages.set(res.totalPages);
        this.customers.set((res.data ?? []).map((c: any) => ({
            id:             c.id,
            name:           c.name ?? c.company ?? '—',
            countryCode:    c.countryCode ?? c.country?.substring(0, 2).toUpperCase() ?? '??',
            country:        c.country ?? '—',
            segment:        (c.segment ?? 'smb').charAt(0).toUpperCase() + (c.segment ?? 'smb').slice(1).replace(/-/g, ' '),
            openOrders:     c.openOrders ?? 0,
            revenue:        `€${Number(c.revenueYtd ?? c.totalValue ?? c.total_value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
            lastActivity:   c.lastActivity ?? (c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
            status:         c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1).replace(/-/g, ' ') : 'Active',
            email:          c.email ?? '—',
            phone:          c.phone ?? '—',
            accountManager: c.accountManager ?? '—',
            memberSince:    c.memberSince ?? (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'),
            totalOrders:    c.totalOrders ?? 0,
            recentOrders:   [],
            notes:          c.notes ?? '',
          })));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadCustomers(this.searchQuery() || undefined);
  }

  private searchDebounce?: ReturnType<typeof setTimeout>;

  onSearchChange(q: string) {
    this.searchQuery.set(q);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.currentPage.set(1);
      this.loadCustomers(q || undefined);
    }, 350);
  }

  customers = signal<Customer[]>([]);

  filteredCustomers = computed(() => this.customers());

  viewCustomer(customer: Customer) {
    this.selectedCustomer.set(customer);
  }

  closeCustomerModal() {
    this.selectedCustomer.set(null);
  }

  contactCustomer(customer: Customer) {
    this.toastService.show(`Creating follow-up task for ${customer.name} (At Risk)...`, 'info');
    setTimeout(() => {
      this.customers.update(cs => cs.map(c => c.id === customer.id ? { ...c, status: 'Active' } : c));
      this.toastService.show(`${customer.name} contacted — status updated to Active`, 'success');
    }, 1500);
  }
}
