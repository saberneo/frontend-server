import { Injectable, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { environment } from '../environments/environment';

export interface RealtimeEvent {
  type: string;
  payload: any;
}

/** Token emitted during an AI streaming response. */
export interface AiTokenEvent {
  token: string;
  requestId: string;
}

/** Emitted when an AI response stream completes. */
export interface AiDoneEvent {
  requestId: string;
  reply: string;
  reasoning_trace?: Array<{ step: string; content: string }>;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Emitted when the RHMA agent completes a reasoning step. */
export interface AiReasoningStepEvent {
  requestId: string;
  step: string;
  content: string;
  index: number;
}

/**
 * Connects to the BFF socket.io server at /events namespace.
 * Exposes:
 *   events$              — all platform real-time events (sync, approvals, alerts)
 *   aiTokens$            — streaming AI response tokens (M2 RHMA → BFF → client)
 *   aiDone$              — AI response completed events
 *   aiReasoningSteps$    — individual RHMA reasoning steps
 *   askViaSocket(msg)    — emit an ai:chat request and return a request ID
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private socket: any = null;

  private _events$ = new Subject<RealtimeEvent>();
  private _aiTokens$ = new Subject<AiTokenEvent>();
  private _aiDone$ = new Subject<AiDoneEvent>();
  private _aiReasoningSteps$ = new Subject<AiReasoningStepEvent>();

  /** Stream of all platform real-time events from the BFF. */
  readonly events$ = this._events$.asObservable();

  /** Stream of individual AI response tokens (M2 → BFF → client). */
  readonly aiTokens$ = this._aiTokens$.asObservable();

  /** Emits once per completed AI response. */
  readonly aiDone$ = this._aiDone$.asObservable();

  /** Emits for each RHMA reasoning step. */
  readonly aiReasoningSteps$ = this._aiReasoningSteps$.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.connect();
    }
  }

  private connect(): void {
    import('socket.io-client').then(({ io }) => {
      const serverUrl = environment.apiUrl.replace('/api/v1', '');
      this.socket = io(`${serverUrl}/events`, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      });

      // Platform events
      const platformEvents = [
        'sync:started',
        'sync:completed',
        'approval:new',
        'alert',
        'connect',
        'disconnect',
      ];
      platformEvents.forEach(type => {
        this.socket.on(type, (payload: any) => {
          this._events$.next({ type, payload });
        });
      });

      // AI streaming events (M2 RHMA → BFF → Angular)
      this.socket.on('ai:token', (payload: AiTokenEvent) => {
        this._aiTokens$.next(payload);
      });

      this.socket.on('ai:done', (payload: AiDoneEvent) => {
        this._aiDone$.next(payload);
      });

      this.socket.on('ai:reasoning_step', (payload: AiReasoningStepEvent) => {
        this._aiReasoningSteps$.next(payload);
      });

      // ai:error — forward as a platform alert
      this.socket.on('ai:error', (payload: any) => {
        this._events$.next({ type: 'ai:error', payload });
      });

      this.socket.on('connect_error', (err: any) => {
        if (!environment.production) {
          console.debug('[RealtimeService] connect error:', err?.message);
        }
      });
    }).catch(() => {
      // socket.io-client not available (SSR build without polyfills)
    });
  }

  /**
   * Emit an AI chat request over WebSocket.
   * The BFF will forward the request to the M2 RHMA agent and stream back
   * ai:token + ai:done events.
   *
   * @returns A unique requestId to correlate incoming token/done events.
   */
  askViaSocket(message: string, tenantId?: string): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (this.socket?.connected) {
      this.socket.emit('ai:chat', { message, requestId, tenantId });
    }
    return requestId;
  }

  /** Manually reconnect (e.g. after login). */
  reconnect(): void {
    if (this.socket) {
      this.socket.connect();
    }
  }

  ngOnDestroy(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    this._events$.complete();
    this._aiTokens$.complete();
    this._aiDone$.complete();
    this._aiReasoningSteps$.complete();
  }
}
