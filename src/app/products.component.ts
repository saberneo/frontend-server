import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-8 max-w-7xl mx-auto space-y-6">

      <!-- Header + stats -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">{{ 'PRODUCTS.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ stats()?.total ?? '—' }} products · inventory value {{ (stats()?.inventoryValue ?? 0) | currency:'USD':'symbol':'1.0-0' }}</p>
        </div>
        <div class="flex gap-3">
          @if (stats()) {
            <div class="flex gap-2 text-xs font-medium">
              <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-1">{{ stats()!.active }} Active</span>
              <span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-1">{{ stats()!.outOfStock }} Out of Stock</span>
              <span class="bg-slate-500/10 text-text-secondary border border-border-subtle rounded-full px-2.5 py-1">{{ stats()!.discontinued }} Discontinued</span>
            </div>
          }
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3 items-center">
        <div class="relative">
          <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
          <input type="text" [(ngModel)]="searchInput" (ngModelChange)="onSearch($event)"
            placeholder="{{ 'PRODUCTS.SEARCH_PLACEHOLDER' | translate }}"
            class="pl-9 pr-4 py-2 bg-bg-card border border-border-subtle rounded-md text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-indigo-400 w-56 transition-colors">
        </div>
        <select [(ngModel)]="selectedCategory" (change)="onCategoryChange()"
          class="bg-bg-card border border-border-subtle rounded-md text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-indigo-400 transition-colors">
          <option value="">{{ 'PRODUCTS.FILTER_ALL_CATEGORIES' | translate }}</option>
          @for (cat of categories(); track cat.category) {
            <option [value]="cat.category">{{ cat.category }} ({{ cat.count }})</option>
          }
        </select>
        <select [(ngModel)]="selectedStatus" (change)="onStatusChange()"
          class="bg-bg-card border border-border-subtle rounded-md text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-indigo-400 transition-colors">
          <option value="">{{ 'PRODUCTS.FILTER_ALL_STATUSES' | translate }}</option>
          <option value="active">{{ 'PRODUCTS.FILTER_ACTIVE' | translate }}</option>
          <option value="out_of_stock">{{ 'PRODUCTS.FILTER_OUT_OF_STOCK' | translate }}</option>
          <option value="discontinued">{{ 'PRODUCTS.FILTER_DISCONTINUED' | translate }}</option>
        </select>
        @if (isLoading()) {
          <div class="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        }
        <span class="ml-auto text-xs text-text-secondary">{{ total() }} result{{ total() !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Table -->
      <div class="bg-bg-card rounded-xl border border-border-subtle shadow-sm overflow-hidden">
        <table class="w-full text-sm text-left">
          <thead class="text-xs text-text-secondary uppercase bg-bg-hover/50 border-b border-border-subtle">
            <tr>
              <th class="px-6 py-3 font-semibold">{{ 'PRODUCTS.TABLE_COL_PRODUCT' | translate }}</th>
              <th class="px-6 py-3 font-semibold">{{ 'PRODUCTS.TABLE_COL_SKU' | translate }}</th>
              <th class="px-6 py-3 font-semibold">{{ 'PRODUCTS.TABLE_COL_CATEGORY' | translate }}</th>
              <th class="px-6 py-3 font-semibold text-right">{{ 'PRODUCTS.TABLE_COL_PRICE' | translate }}</th>
              <th class="px-6 py-3 font-semibold text-right">{{ 'PRODUCTS.TABLE_COL_STOCK' | translate }}</th>
              <th class="px-6 py-3 font-semibold">{{ 'PRODUCTS.TABLE_COL_STATUS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @for (p of products(); track p.id) {
              <tr class="hover:bg-bg-hover/50 transition-colors">
                <td class="px-6 py-3">
                  <div class="font-medium text-text-primary">{{ p.name }}</div>
                  @if (p.supplier) { <div class="text-xs text-text-secondary">{{ p.supplier }}</div> }
                </td>
                <td class="px-6 py-3 font-mono text-xs text-text-secondary">{{ p.sku }}</td>
                <td class="px-6 py-3 text-text-primary">{{ p.category }}</td>
                <td class="px-6 py-3 text-right font-medium text-text-primary">{{ p.price | currency:'USD' }}</td>
                <td class="px-6 py-3 text-right text-text-primary">{{ p.stock | number }}</td>
                <td class="px-6 py-3">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    [class]="statusClass(p.status)">
                    {{ statusLabel(p.status) }}
                  </span>
                </td>
              </tr>
            }
            @if (!isLoading() && products().length === 0) {
              <tr>
                <td colspan="6" class="px-6 py-12 text-center text-text-secondary">{{ 'PRODUCTS.EMPTY_PRODUCTS' | translate }}</td>
              </tr>
            }
            @if (isLoading() && products().length === 0) {
              @for (_ of [1,2,3,4,5]; track $index) {
                <tr class="animate-pulse">
                  <td class="px-6 py-4"><div class="h-4 bg-bg-hover rounded w-40"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-bg-hover rounded w-24"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-bg-hover rounded w-20"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-bg-hover rounded w-16 ml-auto"></div></td>
                  <td class="px-6 py-4"><div class="h-4 bg-bg-hover rounded w-12 ml-auto"></div></td>
                  <td class="px-6 py-4"><div class="h-5 bg-bg-hover rounded-full w-16"></div></td>
                </tr>
              }
            }
          </tbody>
        </table>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="px-6 py-4 border-t border-border-subtle flex items-center justify-between text-sm text-text-secondary">
            <span>{{ 'PRODUCTS.PAGINATION_PAGE' | translate }} {{ currentPage() }} {{ 'PRODUCTS.PAGINATION_OF' | translate }} {{ totalPages() }}</span>
            <div class="flex gap-2">
              <button (click)="prevPage()" [disabled]="currentPage() === 1"
                class="px-3 py-1.5 bg-bg-hover border border-border-subtle rounded-md text-xs hover:bg-border-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {{ 'PRODUCTS.BTN_PREV' | translate }}
              </button>
              <button (click)="nextPage()" [disabled]="currentPage() >= totalPages()"
                class="px-3 py-1.5 bg-bg-hover border border-border-subtle rounded-md text-xs hover:bg-border-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {{ 'PRODUCTS.BTN_NEXT' | translate }}
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ProductsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  products = signal<any[]>([]);
  stats = signal<any>(null);
  categories = signal<any[]>([]);
  isLoading = signal(true);
  total = signal(0);
  currentPage = signal(1);
  totalPages = signal(1);

  searchInput = '';
  selectedCategory = '';
  selectedStatus = '';

  ngOnInit() {
    this.api.getProductStats().pipe(takeUntil(this.destroy$)).subscribe(s => this.stats.set(s));
    this.api.getProductCategories().pipe(takeUntil(this.destroy$)).subscribe(c => this.categories.set(c));
    this.loadProducts();

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => { this.currentPage.set(1); this.loadProducts(); });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(val: string) { this.searchSubject.next(val); }
  onCategoryChange() { this.currentPage.set(1); this.loadProducts(); }
  onStatusChange() { this.currentPage.set(1); this.loadProducts(); }

  loadProducts() {
    this.isLoading.set(true);
    this.api.getProducts(this.searchInput.trim() || undefined, this.selectedCategory || undefined, this.selectedStatus || undefined, this.currentPage(), 20)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.products.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      });
  }

  prevPage() { if (this.currentPage() > 1) { this.currentPage.update(p => p - 1); this.loadProducts(); } }
  nextPage() { if (this.currentPage() < this.totalPages()) { this.currentPage.update(p => p + 1); this.loadProducts(); } }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      out_of_stock: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      discontinued: 'bg-slate-500/10 text-text-secondary border border-border-subtle',
    };
    return map[status] ?? 'bg-bg-hover text-text-secondary';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = { active: 'Active', out_of_stock: 'Out of Stock', discontinued: 'Discontinued' };
    return map[status] ?? status;
  }
}
