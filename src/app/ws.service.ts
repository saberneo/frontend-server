import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToastService } from './toast.service';
import { environment } from '../environments/environment';

export interface NexusEvent {
  type: 'sync:started' | 'sync:completed' | 'approval:new' | 'alert';
  payload: any;
}

/**
 * #1 WebSocket real-time service.
 * Connects to the NestJS /events namespace via socket.io-client.
 * Exposes reactive signals so components can read the live state.
 */
@Injectable({ providedIn: 'root' })
export class WsService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);

  private socket: any = null;

  readonly lastEvent = signal<NexusEvent | null>(null);
  readonly unreadCount = signal(0);
  readonly connected = signal(false);

  connect() {
    if (!isPlatformBrowser(this.platformId) || this.socket) return;

    // Lazy-load socket.io-client so it never runs during SSR
    import('socket.io-client').then(({ io }) => {
      const wsBase = environment.apiUrl.replace('/api/v1', '');
      this.socket = io(`${wsBase}/events`, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => this.connected.set(true));
      this.socket.on('disconnect', () => this.connected.set(false));

      this.socket.on('sync:started', (payload: any) => {
        const ev: NexusEvent = { type: 'sync:started', payload };
        this.lastEvent.set(ev);
        this.toastService.show(`Sync started: ${payload?.connectorName ?? 'connector'}`, 'info');
      });

      this.socket.on('sync:completed', (payload: any) => {
        const ev: NexusEvent = { type: 'sync:completed', payload };
        this.lastEvent.set(ev);
        this.unreadCount.update(n => n + 1);
        this.toastService.show(`Sync completed: ${payload?.connectorName ?? 'connector'}`, 'success');
      });

      this.socket.on('approval:new', (payload: any) => {
        const ev: NexusEvent = { type: 'approval:new', payload };
        this.lastEvent.set(ev);
        this.unreadCount.update(n => n + 1);
        this.toastService.show(`New approval request: ${payload?.title ?? 'item'}`, 'info');
      });

      this.socket.on('alert', (payload: any) => {
        const ev: NexusEvent = { type: 'alert', payload };
        this.lastEvent.set(ev);
        this.unreadCount.update(n => n + 1);
        this.toastService.show(`Alert: ${payload?.message ?? 'system alert'}`, 'error');
      });
    });
  }

  clearUnread() {
    this.unreadCount.set(0);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
