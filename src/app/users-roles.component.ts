import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { DataService } from './data.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-users-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'USERS_ROLES.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary">{{ 'USERS_ROLES.SUBTITLE' | translate }}</p>
        </div>
        <button (click)="openInviteModal()" [disabled]="dataService.currentRole() !== 'Platform Admin'"
          class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
          <span class="material-icons text-[18px]">person_add</span> {{ 'USERS_ROLES.BTN_INVITE' | translate }}
        </button>
      </div>

      <div class="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
        <table class="w-full text-left text-sm">
          <thead class="text-[10px] uppercase tracking-widest text-text-secondary bg-bg-main">
            <tr>
              <th class="px-5 py-3 font-semibold">{{ 'USERS_ROLES.TABLE_COL_USER' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'USERS_ROLES.TABLE_COL_EMAIL' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'USERS_ROLES.TABLE_COL_ROLE' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'USERS_ROLES.TABLE_COL_STATUS' | translate }}</th>
              <th class="px-5 py-3 font-semibold">{{ 'USERS_ROLES.TABLE_COL_LAST_LOGIN' | translate }}</th>
              <th class="px-5 py-3 font-semibold text-right">{{ 'USERS_ROLES.TABLE_COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            @if (isLoading()) {
              <tr><td colspan="6" class="px-5 py-12 text-center text-text-secondary text-sm">
                <span class="material-icons text-[28px] mb-2 block animate-spin text-indigo-400">autorenew</span>
                {{ 'USERS_ROLES.LOADING' | translate }}
              </td></tr>
            } @else if (dataService.currentRole() !== 'Platform Admin') {
              <tr><td colspan="6" class="px-5 py-14 text-center">
                <span class="material-icons text-[40px] mb-3 block text-amber-400/60">lock</span>
                <p class="text-text-primary font-medium mb-1">{{ 'USERS_ROLES.ADMIN_ONLY' | translate }}</p>
                <p class="text-text-secondary text-xs max-w-xs mx-auto">{{ 'USERS_ROLES.ADMIN_ONLY_MSG' | translate }}</p>
              </td></tr>
            } @else if (dataService.users().length === 0) {
              <tr><td colspan="6" class="px-5 py-14 text-center">
                <span class="material-icons text-[40px] mb-3 block text-text-secondary/40">group_off</span>
                <p class="text-text-primary font-medium mb-1">{{ 'USERS_ROLES.EMPTY_USERS' | translate }}</p>
                <p class="text-text-secondary text-xs max-w-xs mx-auto">{{ 'USERS_ROLES.EMPTY_USERS_MSG' | translate }} <strong>{{ 'USERS_ROLES.EMPTY_USERS_BTN' | translate }}</strong> {{ 'USERS_ROLES.EMPTY_USERS_BUTTON_TEXT' | translate }}</p>
              </td></tr>
            } @else {
            @for (user of dataService.users(); track user.email) {
              <tr class="hover:bg-bg-hover transition-colors">
                <td class="px-5 py-4 text-text-primary font-medium">{{ user.name }}</td>
                <td class="px-5 py-4 text-text-secondary text-xs">{{ user.email }}</td>
                <td class="px-5 py-4">
                  <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded text-xs font-medium">{{ user.role }}</span>
                </td>
                <td class="px-5 py-4">
                  @if (user.status === 'active') {
                    <span class="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-medium border border-emerald-500/20">{{ 'USERS_ROLES.BADGE_ACTIVE' | translate }}</span>
                  } @else if (user.status === 'invited') {
                    <span class="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-medium border border-blue-500/20">{{ 'USERS_ROLES.BADGE_INVITED' | translate }}</span>
                  } @else {
                    <span class="bg-neutral-800 text-text-secondary px-2 py-1 rounded text-xs font-medium border border-neutral-700">{{ 'USERS_ROLES.BADGE_INACTIVE' | translate }}</span>
                  }
                </td>
                <td class="px-5 py-4 text-text-secondary text-xs">{{ user.lastLogin }}</td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button (click)="editUser(user)" class="px-3 py-1.5 bg-bg-hover hover:bg-border-subtle text-text-primary rounded text-xs font-medium transition-colors">{{ 'USERS_ROLES.BTN_EDIT' | translate }}</button>
                    <button (click)="toggleUserStatus(user)" class="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                      [class.bg-rose-500/10]="user.status === 'active'"
                      [class.text-rose-400]="user.status === 'active'"
                      [class.border]="true"
                      [class.border-rose-500/20]="user.status === 'active'"
                      [class.hover:bg-rose-500/20]="user.status === 'active'"
                      [class.bg-emerald-500/10]="user.status !== 'active'"
                      [class.text-emerald-400]="user.status !== 'active'"
                      [class.border-emerald-500/20]="user.status !== 'active'"
                      [class.hover:bg-emerald-500/20]="user.status !== 'active'">
                      {{ user.status === 'active' ? ('USERS_ROLES.BTN_DEACTIVATE' | translate) : ('USERS_ROLES.BTN_ACTIVATE' | translate) }}
                    </button>
                  </div>
                </td>
              </tr>
            }
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edit User Modal -->
    @if (editingUser()) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="closeEditModal()">
        <div class="bg-bg-card border border-border-subtle rounded-xl p-6 w-full max-w-md shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'USERS_ROLES.EDIT_MODAL_TITLE' | translate }}</h2>
            <button (click)="closeEditModal()" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.EDIT_LBL_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="editForm.name"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.EDIT_LBL_EMAIL' | translate }}</label>
              <input type="email" [(ngModel)]="editForm.email"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.EDIT_LBL_ROLE' | translate }}</label>
              <select [(ngModel)]="editForm.role"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
                <option value="platform-admin">{{ 'USERS_ROLES.ROLE_PLATFORM_ADMIN' | translate }}</option>
                <option value="data-steward">{{ 'USERS_ROLES.ROLE_DATA_STEWARD' | translate }}</option>
                <option value="business-user">{{ 'USERS_ROLES.ROLE_BUSINESS_USER' | translate }}</option>
                <option value="read-only">{{ 'USERS_ROLES.ROLE_READ_ONLY' | translate }}</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button (click)="closeEditModal()" class="px-4 py-2 bg-transparent hover:bg-bg-hover text-text-primary rounded-md text-sm font-medium transition-colors border border-border-subtle">{{ 'USERS_ROLES.EDIT_BTN_CANCEL' | translate }}</button>
            <button (click)="saveUser()" [disabled]="isSaving()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-70 flex items-center gap-2">
              @if (isSaving()) { <span class="material-icons text-[16px] animate-spin">autorenew</span> {{ 'USERS_ROLES.EDIT_BTN_SAVING' | translate }} }
              @else { {{ 'USERS_ROLES.EDIT_BTN_SAVE' | translate }} }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Invite User Modal -->
    @if (showInviteModal()) {
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showInviteModal.set(false)">
        <div class="bg-bg-card border border-border-subtle rounded-xl p-6 w-full max-w-md shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-text-primary">{{ 'USERS_ROLES.INVITE_MODAL_TITLE' | translate }}</h2>
            <button (click)="showInviteModal.set(false)" class="text-text-secondary hover:text-text-primary transition-colors">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.INVITE_LBL_NAME' | translate }}</label>
              <input type="text" [(ngModel)]="inviteForm.name" [placeholder]="'USERS_ROLES.INVITE_PLACEHOLDER_NAME' | translate"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.INVITE_LBL_EMAIL' | translate }}</label>
              <input type="email" [(ngModel)]="inviteForm.email" [placeholder]="'USERS_ROLES.INVITE_PLACEHOLDER_EMAIL' | translate"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.INVITE_LBL_ROLE' | translate }}</label>
              <select [(ngModel)]="inviteForm.role"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
                <option value="business-user">{{ 'USERS_ROLES.ROLE_BUSINESS_USER' | translate }}</option>
                <option value="data-steward">{{ 'USERS_ROLES.ROLE_DATA_STEWARD' | translate }}</option>
                <option value="platform-admin">{{ 'USERS_ROLES.ROLE_PLATFORM_ADMIN' | translate }}</option>
                <option value="read-only">{{ 'USERS_ROLES.ROLE_READ_ONLY' | translate }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{{ 'USERS_ROLES.INVITE_LBL_PASSWORD' | translate }}</label>
              <input type="password" [(ngModel)]="inviteForm.password" [placeholder]="'USERS_ROLES.INVITE_PLACEHOLDER_PASSWORD' | translate"
                class="w-full bg-bg-input border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-indigo-500">
              <p class="text-xs text-text-secondary mt-1">{{ 'USERS_ROLES.INVITE_PASSWORD_NOTE' | translate }}</p>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button (click)="showInviteModal.set(false)" class="px-4 py-2 bg-transparent hover:bg-bg-hover text-text-primary rounded-md text-sm font-medium transition-colors border border-border-subtle">{{ 'USERS_ROLES.INVITE_BTN_CANCEL' | translate }}</button>
            <button (click)="sendInvite()" [disabled]="isInviting()"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-70">
              @if (isInviting()) { <span class="material-icons text-[16px] animate-spin">autorenew</span> {{ 'USERS_ROLES.INVITE_BTN_CREATING' | translate }} }
              @else { <span class="material-icons text-[16px]">person_add</span> {{ 'USERS_ROLES.INVITE_BTN_CREATE' | translate }} }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class UsersRolesComponent implements OnInit {
  dataService = inject(DataService);
  toastService = inject(ToastService);
  private api = inject(ApiService);

  editingUser = signal<any>(null);
  showInviteModal = signal(false);
  isLoading = signal(false);
  isSaving = signal(false);
  isInviting = signal(false);
  editForm = { name: '', email: '', role: '' };
  inviteForm = { name: '', email: '', role: 'business-user', password: '' };

  ngOnInit() { this.loadUsers(); }

  private loadUsers() {
    if (this.dataService.currentRole() !== 'Platform Admin') {
      this.isLoading.set(false);
      return; // not authorized — skip the API call entirely to avoid a 403
    }
    this.isLoading.set(true);
    this.api.getUsers().subscribe({
      next: (data) => {
        if (data.length) {
          this.dataService.users.set(data.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
            status: u.status,
          })));
        }
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  openInviteModal() {
    this.inviteForm = { name: '', email: '', role: 'business-user', password: '' };
    this.showInviteModal.set(true);
  }

  sendInvite() {
    if (!this.inviteForm.name.trim() || !this.inviteForm.email.trim()) {
      this.toastService.show('Please fill in all fields', 'error');
      return;
    }
    this.isInviting.set(true);
    const tempPassword = this.inviteForm.password || 'ChangeMe123!';
    this.api.createUser({
      name: this.inviteForm.name,
      email: this.inviteForm.email,
      role: this.inviteForm.role,
      password: tempPassword,
    }).subscribe({
      next: (created) => {
        this.isInviting.set(false);
        if (created) {
          this.dataService.users.update(u => [...u, {
            id: created.id,
            name: created.name,
            email: created.email,
            role: created.role,
            lastLogin: 'Never',
            status: 'invited',
          }]);
          this.showInviteModal.set(false);
          this.toastService.show(`Invitation sent to ${this.inviteForm.email}`, 'success');
        } else {
          this.toastService.show('Could not create user — email may already exist', 'error');
        }
      },
      error: () => {
        this.isInviting.set(false);
        this.toastService.show('Failed to create user', 'error');
      },
    });
  }

  editUser(user: any) {
    this.editForm = { name: user.name, email: user.email, role: user.role };
    this.editingUser.set(user);
  }

  closeEditModal() { this.editingUser.set(null); }

  saveUser() {
    const original = this.editingUser();
    if (!original) return;
    this.isSaving.set(true);
    this.api.updateUser(original.id, {
      name: this.editForm.name,
      email: this.editForm.email,
      role: this.editForm.role,
    }).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        if (updated === null) {
          // API failed but error interceptor didn't catch it (e.g. network)
          this.toastService.show('Update failed — please try again', 'error');
          return;
        }
        this.dataService.users.update(users => users.map(u => u.id === original.id
          ? { ...u, name: this.editForm.name, email: this.editForm.email, role: this.editForm.role }
          : u));
        this.editingUser.set(null);
        this.toastService.show(`${this.editForm.name} updated successfully`, 'success');
      },
      error: (err: any) => {
        this.isSaving.set(false);
        if (err?.status === 403) {
          this.toastService.show('Permission denied — only Platform Admins can edit users', 'error');
        } else {
          this.toastService.show('Update failed', 'error');
        }
      },
    });
  }

  toggleUserStatus(user: any) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    this.api.updateUser(user.id, { status: newStatus }).subscribe({
      next: (result) => {
        if (result === null) {
          this.toastService.show('Status update failed — please try again', 'error');
          return;
        }
        this.dataService.users.update(users => users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
        this.toastService.show(`${user.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`, newStatus === 'active' ? 'success' : 'info');
      },
      error: (err: any) => {
        if (err?.status === 403) {
          this.toastService.show('Permission denied — only Platform Admins can manage users', 'error');
        } else {
          this.toastService.show('Status update failed', 'error');
        }
      },
    });
  }
}

