import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { TranslatePipe } from '@ngx-translate/core';

interface Order {
  id: string;
  date: string;
  customer: string;
  amount: string;
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  items?: { name: string; qty: number; price: string }[];
  address?: string;
  paymentMethod?: string;
  trackingNumber?: string;
  notes?: string;
}

@Component({
  selector: 'app-orders-sales',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Order Detail Modal -->
    @if (selectedOrder()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="closeOrderModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between p-6 border-b border-border-subtle">
            <div>
              <h2 class="text-lg font-semibold text-text-primary">{{ selectedOrder()!.id }}</h2>
              <p class="text-sm text-text-secondary mt-0.5">{{ selectedOrder()!.date }} · {{ selectedOrder()!.customer }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border"
                    [class.bg-amber-100]="selectedOrder()!.status === 'Processing'" [class.text-amber-800]="selectedOrder()!.status === 'Processing'" [class.border-amber-200]="selectedOrder()!.status === 'Processing'"
                    [class.bg-blue-100]="selectedOrder()!.status === 'Shipped'" [class.text-blue-800]="selectedOrder()!.status === 'Shipped'" [class.border-blue-200]="selectedOrder()!.status === 'Shipped'"
                    [class.bg-emerald-100]="selectedOrder()!.status === 'Delivered'" [class.text-emerald-800]="selectedOrder()!.status === 'Delivered'" [class.border-emerald-200]="selectedOrder()!.status === 'Delivered'"
                    [class.bg-rose-100]="selectedOrder()!.status === 'Cancelled'" [class.text-rose-800]="selectedOrder()!.status === 'Cancelled'" [class.border-rose-200]="selectedOrder()!.status === 'Cancelled'">
                {{ selectedOrder()!.status }}
              </span>
              <button (click)="closeOrderModal()" class="text-text-secondary hover:text-text-primary transition-colors">
                <span class="material-icons">close</span>
              </button>
            </div>
          </div>
          <div class="p-6 space-y-6">
            <!-- Order Lines -->
            <div>
              <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{{ 'ORDERS_SALES.MODAL_LBL_ORDER_LINES' | translate }}</h3>
              <div class="bg-bg-input rounded-lg border border-border-subtle overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="text-xs text-text-secondary bg-bg-hover/50">
                    <tr>
                      <th class="px-4 py-2.5 text-left font-medium">{{ 'ORDERS_SALES.TABLE_COL_PRODUCT' | translate }}</th>
                      <th class="px-4 py-2.5 text-center font-medium">{{ 'ORDERS_SALES.TABLE_COL_QTY' | translate }}</th>
                      <th class="px-4 py-2.5 text-right font-medium">{{ 'ORDERS_SALES.TABLE_COL_UNIT_PRICE' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-subtle">
                    @for (item of selectedOrder()!.items; track item.name) {
                      <tr>
                        <td class="px-4 py-3 text-text-primary">{{ item.name }}</td>
                        <td class="px-4 py-3 text-center text-text-secondary">{{ item.qty }}</td>
                        <td class="px-4 py-3 text-right text-text-primary font-medium">{{ item.price }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot class="border-t-2 border-border-subtle">
                    <tr>
                      <td colspan="2" class="px-4 py-3 text-right text-sm font-semibold text-text-secondary">{{ 'ORDERS_SALES.TABLE_COL_TOTAL' | translate }}</td>
                      <td class="px-4 py-3 text-right text-base font-bold text-text-primary">{{ selectedOrder()!.amount }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <!-- Details Grid -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-bg-input rounded-lg border border-border-subtle p-4">
                <div class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'ORDERS_SALES.MODAL_LBL_SHIPPING_ADDRESS' | translate }}</div>
                <p class="text-sm text-text-primary">{{ selectedOrder()!.address }}</p>
              </div>
              <div class="bg-bg-input rounded-lg border border-border-subtle p-4">
                <div class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{{ 'ORDERS_SALES.MODAL_LBL_PAYMENT_METHOD' | translate }}</div>
                <p class="text-sm text-text-primary">{{ selectedOrder()!.paymentMethod }}</p>
                @if (selectedOrder()!.trackingNumber) {
                  <div class="text-xs font-semibold text-text-secondary uppercase tracking-wider mt-3 mb-1">{{ 'ORDERS_SALES.MODAL_LBL_TRACKING' | translate }}</div>
                  <p class="text-sm text-indigo-400 font-mono">{{ selectedOrder()!.trackingNumber }}</p>
                }
              </div>
            </div>
            @if (selectedOrder()!.notes) {
              <div class="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                <div class="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">{{ 'ORDERS_SALES.MODAL_LBL_NOTES' | translate }}</div>
                <p class="text-sm text-text-primary">{{ selectedOrder()!.notes }}</p>
              </div>
            }
          </div>
          <div class="flex justify-end gap-3 p-6 border-t border-border-subtle">
            @if (selectedOrder()!.status === 'Processing') {
              <button (click)="shipOrder(selectedOrder()!); closeOrderModal()"
                class="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                <span class="material-icons text-[16px]">local_shipping</span>{{ 'ORDERS_SALES.MODAL_BTN_MARK_SHIPPED' | translate }}
              </button>
            }
            <button (click)="closeOrderModal()" class="px-4 py-2 bg-bg-hover text-text-primary border border-border-subtle hover:bg-border-subtle rounded-md text-sm font-medium transition-colors">{{ 'ORDERS_SALES.MODAL_BTN_CLOSE' | translate }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Cancel Order Confirmation Modal -->
    @if (confirmCancelOrder()) {
      <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" (click)="confirmCancelOrder.set(null)">
        <div class="bg-bg-card border border-border-subtle rounded-xl w-full max-w-sm shadow-2xl p-6" (click)="$event.stopPropagation()">
          <div class="flex items-center gap-3 mb-4">
            <span class="material-icons text-rose-400 text-[32px]">cancel</span>
            <div>
              <h2 class="text-base font-semibold text-text-primary">{{ 'ORDERS_SALES.CANCEL_MODAL_TITLE' | translate }}</h2>
              <p class="text-sm text-text-secondary font-mono">{{ confirmCancelOrder()!.id }}</p>
            </div>
          </div>
          <p class="text-sm text-text-secondary mb-6">{{ 'ORDERS_SALES.CANCEL_MODAL_Q1' | translate }} <span class="text-text-primary font-medium">{{ confirmCancelOrder()!.customer }}</span>{{ 'ORDERS_SALES.CANCEL_MODAL_Q2' | translate }}</p>
          <div class="flex justify-end gap-3">
            <button (click)="confirmCancelOrder.set(null)" class="px-4 py-2 bg-bg-hover text-text-primary border border-border-subtle hover:bg-border-subtle rounded-md text-sm font-medium transition-colors">{{ 'ORDERS_SALES.CANCEL_MODAL_BTN_KEEP' | translate }}</button>
            <button (click)="cancelOrder(confirmCancelOrder()!); confirmCancelOrder.set(null)"
              class="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
              <span class="material-icons text-[15px]">cancel</span>{{ 'ORDERS_SALES.CANCEL_MODAL_BTN_CANCEL' | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    <div class="p-8 max-w-7xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">{{ 'ORDERS_SALES.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ 'ORDERS_SALES.SUBTITLE' | translate }}</p>
        </div>
        <div class="flex gap-2">
          <button (click)="exportOrders()" class="px-3 py-1.5 bg-bg-hover text-text-primary text-sm font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors flex items-center gap-2">
            <span class="material-icons text-[18px]">download</span>
            {{ 'ORDERS_SALES.BTN_EXPORT_CSV' | translate }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-bg-card p-6 rounded-xl border border-border-subtle shadow-sm">
          <h3 class="text-sm font-medium text-text-secondary mb-1">{{ 'ORDERS_SALES.KPI_TOTAL_ORDERS' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary">{{ kpiTotalOrders() }}</div>
          <div class="text-xs text-text-secondary mt-1">{{ filteredOrders().length }} {{ 'ORDERS_SALES.KPI_SHOWN' | translate }}</div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border border-border-subtle shadow-sm">
          <h3 class="text-sm font-medium text-text-secondary mb-1">{{ 'ORDERS_SALES.KPI_AVG_ORDER_VALUE' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary">{{ kpiAvgOrderValue() }}</div>
        </div>
        <div class="bg-bg-card p-6 rounded-xl border border-border-subtle shadow-sm">
          <h3 class="text-sm font-medium text-text-secondary mb-1">{{ 'ORDERS_SALES.KPI_FULFILLMENT_RATE' | translate }}</h3>
          <div class="text-3xl font-bold text-text-primary">{{ kpiFulfillmentRate() }}</div>
        </div>
      </div>

      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <div class="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-hover/30">
          <h2 class="font-medium text-text-primary">{{ 'ORDERS_SALES.TABLE_HEADER_RECENT_ORDERS' | translate }}</h2>
          <div class="flex gap-1 text-sm">
            @for (f of filterOptions; track f) {
              <button (click)="setFilter(f)"
                class="px-3 py-1 rounded transition-colors"
                [class.bg-bg-card]="currentFilter() === f"
                [class.border]="currentFilter() === f"
                [class.border-border-subtle]="currentFilter() === f"
                [class.text-text-primary]="currentFilter() === f"
                [class.font-medium]="currentFilter() === f"
                [class.text-text-secondary]="currentFilter() !== f"
                [class.hover:text-text-primary]="currentFilter() !== f">
                {{ f }}
              </button>
            }
          </div>
        </div>
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50">
            <tr>
              <th class="px-6 py-4 font-semibold">{{ 'ORDERS_SALES.TABLE_COL_ORDER_ID' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'ORDERS_SALES.TABLE_COL_DATE' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'ORDERS_SALES.TABLE_COL_CUSTOMER' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'ORDERS_SALES.TABLE_COL_AMOUNT' | translate }}</th>
              <th class="px-6 py-4 font-semibold">{{ 'ORDERS_SALES.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-6 py-4 font-semibold text-right">{{ 'ORDERS_SALES.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @if (isLoading()) {
              @for (i of [1,2,3,4,5]; track i) {
                <tr>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-24 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-20 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-36 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-3.5 bg-bg-hover rounded animate-pulse w-16 my-0.5"></div></td>
                  <td class="px-6 py-4"><div class="h-5 bg-bg-hover rounded animate-pulse w-20"></div></td>
                  <td class="px-6 py-4 text-right"><div class="h-7 bg-bg-hover rounded animate-pulse w-14 ml-auto"></div></td>
                </tr>
              }
            } @else {
            @for (order of filteredOrders(); track order.id) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-4 font-medium text-indigo-500 cursor-pointer hover:underline" (click)="viewOrder(order)">{{ order.id }}</td>
                <td class="px-6 py-4 text-text-secondary">{{ order.date }}</td>
                <td class="px-6 py-4 text-text-primary">{{ order.customer }}</td>
                <td class="px-6 py-4 text-text-primary font-medium">{{ order.amount }}</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                        [class.bg-amber-100]="order.status === 'Processing'"
                        [class.text-amber-800]="order.status === 'Processing'"
                        [class.dark:bg-amber-500/20]="order.status === 'Processing'"
                        [class.dark:text-amber-400]="order.status === 'Processing'"
                        [class.border-amber-200]="order.status === 'Processing'"
                        [class.bg-blue-100]="order.status === 'Shipped'"
                        [class.text-blue-800]="order.status === 'Shipped'"
                        [class.dark:bg-blue-500/20]="order.status === 'Shipped'"
                        [class.dark:text-blue-400]="order.status === 'Shipped'"
                        [class.border-blue-200]="order.status === 'Shipped'"
                        [class.bg-emerald-100]="order.status === 'Delivered'"
                        [class.text-emerald-800]="order.status === 'Delivered'"
                        [class.dark:bg-emerald-500/20]="order.status === 'Delivered'"
                        [class.dark:text-emerald-400]="order.status === 'Delivered'"
                        [class.border-emerald-200]="order.status === 'Delivered'"
                        [class.bg-rose-100]="order.status === 'Cancelled'"
                        [class.text-rose-800]="order.status === 'Cancelled'"
                        [class.dark:bg-rose-500/20]="order.status === 'Cancelled'"
                        [class.dark:text-rose-400]="order.status === 'Cancelled'"
                        [class.border-rose-200]="order.status === 'Cancelled'">
                    {{ order.status }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button (click)="viewOrder(order)" class="px-3 py-1.5 bg-bg-hover text-text-primary text-xs font-medium rounded-md border border-border-subtle hover:bg-border-subtle transition-colors">{{ 'ORDERS_SALES.BTN_VIEW' | translate }}</button>
                    @if (order.status === 'Processing') {
                      <button (click)="shipOrder(order)" class="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-md border border-blue-500/20 hover:bg-blue-500/20 transition-colors">{{ 'ORDERS_SALES.BTN_SHIP' | translate }}</button>
                      <button (click)="confirmCancelOrder.set(order)" class="px-3 py-1.5 bg-rose-500/10 text-rose-400 text-xs font-medium rounded-md border border-rose-500/20 hover:bg-rose-500/20 transition-colors">{{ 'ORDERS_SALES.BTN_CANCEL' | translate }}</button>
                    }
                  </div>
                </td>
              </tr>
            }
            @if (filteredOrders().length === 0) {
              <tr>
                <td colspan="6" class="px-6 py-10 text-center text-text-secondary">
                  <span class="material-icons text-[40px] block mb-2 opacity-30">inbox</span>
                  {{ 'ORDERS_SALES.EMPTY_ORDERS' | translate }} <span class="font-medium text-text-primary">{{ currentFilter() }}</span>
                </td>
              </tr>
            }
            }
          </tbody>
        </table>
      </div>
      @if (totalPages() > 1) {
        <div class="px-6 py-3 border-t border-border-subtle flex items-center justify-between text-sm text-text-secondary">
          <span>{{ totalOrders() }} {{ 'ORDERS_SALES.PAGINATION_ORDERS' | translate }} · {{ 'ORDERS_SALES.PAGINATION_PAGE' | translate }} {{ currentPage() }} {{ 'ORDERS_SALES.PAGINATION_OF' | translate }} {{ totalPages() }}</span>
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
export class OrdersSalesComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api  = inject(ApiService);

  filterOptions = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  currentFilter = signal('All');
  selectedOrder = signal<Order | null>(null);
  isLoading = signal(false);
  currentPage = signal(1);
  totalOrders = signal(0);
  totalPages = signal(0);

  // KPI cards from analytics API
  kpiTotalOrders = signal<string>('—');
  kpiAvgOrderValue = signal<string>('—');
  kpiFulfillmentRate = signal<string>('—');

  ngOnInit() {
    this.loadOrders();
    this.api.getOrderAnalytics().subscribe(analytics => {
      if (analytics) {
        if (analytics.totalOrders !== undefined) {
          this.kpiTotalOrders.set(Number(analytics.totalOrders).toLocaleString());
        }
        if (analytics.avgOrderValue !== undefined) {
          this.kpiAvgOrderValue.set(`€${Number(analytics.avgOrderValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
        }
        if (analytics.fulfillmentRate !== undefined) {
          this.kpiFulfillmentRate.set(`${analytics.fulfillmentRate}%`);
        }
      }
    });
  }

  private loadOrders(status?: string) {
    this.isLoading.set(true);
    const filter = status && status !== 'All' ? status : undefined;
    this.api.getOrders(filter, undefined, this.currentPage(), 50).subscribe({
      next: (res) => {
        this.totalOrders.set(res.total);
        this.totalPages.set(res.totalPages);
        this.orders.set((res.data ?? []).map(o => ({
            id:             o.id,
            date:           o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : (o.date ?? '—'),
            customer:       o.customerName ?? o.customer ?? '—',
            amount:         `€${Number(o.totalAmount ?? o.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            status:         (o.status.charAt(0).toUpperCase() + o.status.slice(1)) as Order['status'],
            items:          (o.items || []).map((it: any) => ({
              name:  it.name,
              qty:   it.qty,
              price: `€${Number(it.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            })),
            address:        o.address,
            paymentMethod:  o.paymentMethod,
            trackingNumber: o.trackingNumber,
            notes:          o.notes,
          })));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  setFilter(filter: string) {
    this.currentFilter.set(filter);
    this.currentPage.set(1);
    this.loadOrders(filter);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadOrders(this.currentFilter());
  }

  orders = signal<Order[]>([]);
  filteredOrders = computed(() => this.orders());
  confirmCancelOrder = signal<Order | null>(null);

  viewOrder(order: Order) {
    this.selectedOrder.set(order);
  }

  closeOrderModal() {
    this.selectedOrder.set(null);
  }

  shipOrder(order: Order) {
    this.api.updateOrderStatus(order.id, 'shipped').subscribe({
      next: () => {
        this.orders.update(orders => orders.map(o => o.id === order.id ? { ...o, status: 'Shipped' as const } : o));
        this.selectedOrder.update(o => o?.id === order.id ? { ...o, status: 'Shipped' as const } : o);
        this.toastService.show(`Order ${order.id} marked as Shipped`, 'success');
      },
      error: () => this.toastService.show('Failed to update order status', 'error'),
    });
  }

  cancelOrder(order: Order) {
    this.api.updateOrderStatus(order.id, 'cancelled').subscribe({
      next: () => {
        this.orders.update(orders => orders.map(o => o.id === order.id ? { ...o, status: 'Cancelled' as const } : o));
        this.selectedOrder.update(o => o?.id === order.id ? { ...o, status: 'Cancelled' as const } : o);
        this.toastService.show(`Order ${order.id} cancelled`, 'success');
      },
      error: () => this.toastService.show('Failed to cancel order', 'error'),
    });
  }

  exportOrders() {
    const rows = this.filteredOrders();
    const csv = [
      'Order ID,Date,Customer,Amount,Status',
      ...rows.map(o => `${o.id},${o.date},${o.customer},${o.amount},${o.status}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${this.currentFilter().toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toastService.show(`Exported ${rows.length} orders to CSV`, 'success');
  }
}
