import { ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { ApiService, NexusAiReasoningStep } from './api.service';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from '../environments/environment';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  isTyping?: boolean;
  isStreaming?: boolean;
  reasoning_trace?: NexusAiReasoningStep[];
  traceExpanded?: boolean;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

@Component({
  selector: 'app-ask-nexus',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @reference "../styles.css";
    .trace-chip { @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400; }
    .step-dot  { @apply w-1.5 h-1.5 rounded-full shrink-0; }
  `],
  template: `
    <div class="h-full flex flex-col">
      <!-- Header -->
      <div class="p-6 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-main">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">{{ 'ASK_NEXUS.TITLE' | translate }}</h1>
          <p class="text-sm text-text-secondary mt-1">{{ 'ASK_NEXUS.SUBTITLE' | translate }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-text-secondary font-mono bg-bg-card border border-border-subtle px-2 py-1 rounded">{{ currentModel() }}</span>
          <div class="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-full text-xs font-medium">
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-500" [class.animate-pulse]="isLoading()"></div>
            {{ isLoading() ? ('ASK_NEXUS.THINKING' | translate) : ('ASK_NEXUS.AI_CONNECTED' | translate) }}
          </div>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        <!-- Chat Area -->
        <div class="flex-1 flex flex-col bg-bg-main relative">
          <div class="flex-1 overflow-y-auto p-6 space-y-6" #scrollContainer>

            <!-- Welcome message -->
            <div class="flex gap-4 max-w-3xl">
              <div class="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-sm shrink-0">N</div>
              <div class="bg-bg-card border border-border-subtle rounded-2xl rounded-tl-sm p-4 text-sm text-text-primary shadow-sm">
                {{ 'ASK_NEXUS.WELCOME_MSG' | translate }} {{ dataService.currentUser().name.split(' ')[0] }}{{ 'ASK_NEXUS.WELCOME_TEXT' | translate }}
              </div>
            </div>

            @for (msg of messages(); track $index) {
              @if (msg.role === 'user') {
                <!-- User bubble -->
                <div class="flex gap-4 max-w-3xl ml-auto justify-end">
                  <div class="bg-emerald-700 text-white rounded-2xl rounded-tr-sm p-4 text-sm shadow-sm">{{ msg.text }}</div>
                  <div class="w-8 h-8 rounded-full bg-bg-hover border border-border-subtle flex items-center justify-center text-text-primary font-medium text-xs shrink-0">
                    {{ dataService.currentUser().initials }}
                  </div>
                </div>
              } @else {
                <!-- AI bubble -->
                <div class="flex gap-4 max-w-3xl">
                  <div class="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-sm shrink-0">N</div>
                  <div class="flex flex-col gap-2 flex-1">

                    @if (msg.isTyping) {
                      <!-- Typing animation -->
                      <div class="bg-bg-card border border-border-subtle rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text-secondary shadow-sm flex items-center gap-2">
                      {{ 'ASK_NEXUS.TYPING_LABEL' | translate }}
                        <div class="flex gap-1">
                          <div class="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style="animation-delay:0ms"></div>
                          <div class="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style="animation-delay:150ms"></div>
                          <div class="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce" style="animation-delay:300ms"></div>
                        </div>
                      </div>
                    } @else {

                      <!-- Reasoning trace (collapsible) -->
                      @if (msg.reasoning_trace && msg.reasoning_trace.length > 0) {
                        <div class="rounded-xl border border-border-subtle bg-bg-sidebar overflow-hidden text-xs">
                          <button
                            (click)="toggleTrace(msg)"
                            class="w-full flex items-center justify-between px-3 py-2 hover:bg-bg-hover transition-colors text-text-secondary font-medium">
                            <div class="flex items-center gap-2">
                              <span class="material-icons text-[14px] text-emerald-500">psychology</span>
                              <span>{{ 'ASK_NEXUS.REASONING_TRACE' | translate }}</span>
                              <span class="trace-chip">{{ msg.reasoning_trace.length }} {{ 'ASK_NEXUS.REASONING_STEPS' | translate }}</span>
                              @if (msg.model && msg.model !== 'demo' && !msg.model.startsWith('demo')) {
                                <span class="trace-chip">{{ msg.model }}</span>
                              }
                              @if (msg.usage?.total_tokens) {
                                <span class="trace-chip">{{ msg.usage!.total_tokens }} {{ 'ASK_NEXUS.REASONING_TOKENS' | translate }}</span>
                              }
                            </div>
                            <span class="material-icons text-[14px] transition-transform duration-200" [class.rotate-180]="msg.traceExpanded">expand_more</span>
                          </button>
                          @if (msg.traceExpanded) {
                            <div class="px-3 pb-3 space-y-2 border-t border-border-subtle pt-2">
                              @for (step of msg.reasoning_trace; track $index) {
                                <div class="flex gap-2 items-start">
                                  <div class="step-dot mt-1.5"
                                    [class.bg-emerald-500]="step.status === 'completed'"
                                    [class.bg-amber-400]="step.status === 'running'"
                                    [class.bg-border-subtle]="step.status === 'pending'">
                                  </div>
                                  <div>
                                    <span class="font-semibold text-text-primary">{{ step.step }}</span>
                                    <span class="text-text-secondary ml-1">— {{ step.detail }}</span>
                                  </div>
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }

                      <!-- Response bubble -->
                      <div class="bg-bg-card border border-border-subtle rounded-2xl rounded-tl-sm p-4 text-sm text-text-primary shadow-sm whitespace-pre-wrap"
                        [class.border-l-2]="msg.isStreaming"
                        [class.border-l-emerald-500]="msg.isStreaming">
                        <span [innerHTML]="formatMarkdown(msg.text)"></span>
                        @if (msg.isStreaming) {
                          <span class="inline-block w-0.5 h-3.5 bg-emerald-500 animate-pulse ml-0.5 align-middle"></span>
                        }
                      </div>
                    }

                  </div>
                </div>
              }
            }

          </div>

          <!-- Input bar -->
          <div class="p-6 bg-bg-main border-t border-border-subtle">
            <div class="max-w-4xl mx-auto relative">
              <input type="text" [(ngModel)]="currentInput" (keyup.enter)="sendMessage()"
                [placeholder]="'ASK_NEXUS.INPUT_PLACEHOLDER' | translate"
                [disabled]="isLoading()"
                class="w-full bg-bg-card border border-border-subtle rounded-xl py-4 pl-4 pr-28 text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-colors disabled:opacity-60">
              <button (click)="sendMessage()" [disabled]="!currentInput.trim() || isLoading()"
                class="absolute right-2 top-2 bottom-2 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                @if (isLoading()) {
                  <span class="material-icons text-[16px] animate-spin">refresh</span>
                } @else {
                  {{ 'ASK_NEXUS.BTN_SEND' | translate }} <span class="material-icons text-[16px]">arrow_forward</span>
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="w-80 border-l border-border-subtle bg-bg-sidebar p-6 overflow-y-auto shrink-0 hidden lg:block">
          <h3 class="text-sm font-semibold text-text-primary mb-4">{{ 'ASK_NEXUS.SIDEBAR_TITLE_SUGGESTIONS' | translate }}</h3>
          <div class="space-y-2 mb-8">
            @for (q of suggestions; track q) {
              <button (click)="sendSuggested(q)"
                class="w-full text-left p-3 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-hover text-sm text-text-secondary transition-colors">
                {{ q }}
              </button>
            }
          </div>

          <h3 class="text-sm font-semibold text-text-primary mb-4">{{ 'ASK_NEXUS.SIDEBAR_TITLE_SESSION' | translate }}</h3>
          <div class="bg-bg-card rounded-lg border border-border-subtle p-4 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ 'ASK_NEXUS.SESSION_SOURCES' | translate }}</span>
              <span class="font-medium text-text-primary">{{ dataService.connectors().length }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ 'ASK_NEXUS.SESSION_QUESTIONS' | translate }}</span>
              <span class="font-medium text-text-primary">{{ questionCount() }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ 'ASK_NEXUS.SESSION_TOKENS' | translate }}</span>
              <span class="font-medium text-text-primary">{{ totalTokens() }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-text-secondary">{{ 'ASK_NEXUS.SESSION_AVG_RESPONSE' | translate }}</span>
              <span class="font-medium text-text-primary">{{ avgResponseTime() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AskNexusComponent implements AfterViewChecked, OnInit {
  dataService = inject(DataService);
  private api = inject(ApiService);
  private zone = inject(NgZone);

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  messages = signal<ChatMessage[]>([]);
  currentInput = '';
  isLoading = signal(false);
  questionCount = signal(0);
  currentModel = signal('gpt-4o');
  totalTokens = signal(0);
  private totalResponseMs = signal(0);

  suggestions = [
    'Which products have low stock right now?',
    'Show overdue invoices this month',
    'Revenue trend past 6 months',
    'Open service tickets by priority',
    'Employees hired this quarter',
    'Compare Q1 vs Q4 sales by region',
  ];

  avgResponseTime = () => {
    const count = this.questionCount();
    if (count === 0) return '—';
    return `${(this.totalResponseMs() / count / 1000).toFixed(1)}s avg`;
  };

  ngOnInit() {
    if (!this.dataService.connectors().length) {
      this.dataService.loadConnectors();
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (_) {}
  }

  toggleTrace(msg: ChatMessage) {
    msg.traceExpanded = !msg.traceExpanded;
    this.messages.update(m => [...m]);
  }

  sendSuggested(text: string) {
    this.currentInput = text;
    this.sendMessage();
  }

  /** Convert basic Markdown to safe HTML (bold, italic, bullets, code). */
  formatMarkdown(text: string): string {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')                 // escape
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')                                   // **bold**
      .replace(/\*(.+?)\*/g, '<em>$1</em>')                                               // *italic*
      .replace(/`([^`]+)`/g, '<code class="bg-bg-hover rounded px-1 font-mono text-xs">$1</code>') // `code`
      .replace(/^#{1,3} (.+)$/gm, '<span class="font-semibold text-text-primary">$1</span>') // # heading
      .replace(/^[-•] (.+)$/gm, '<li class="ml-3 list-disc">$1</li>')                     // - bullets
      .replace(/\n/g, '<br>');                                                             // newlines
    return html;
  }

  sendMessage() {
    if (!this.currentInput.trim() || this.isLoading()) return;

    const userText = this.currentInput.trim();
    this.currentInput = '';
    const startTime = Date.now();

    this.isLoading.set(true);
    this.messages.update(m => [
      ...m,
      { role: 'user', text: userText },
      { role: 'ai', text: '', isTyping: true },
    ]);

    this._sendStreaming(userText, startTime);
  }

  private _sendStreaming(userText: string, startTime: number) {
    const chatUrl = `${environment.apiUrl}/ai/chat`;

    // Replace typing indicator with streaming bubble
    const initAiBubble = (trace: NexusAiReasoningStep[]) => {
      this.messages.update(m => {
        const updated = [...m];
        updated[updated.length - 1] = {
          role: 'ai', text: '', isStreaming: true, isTyping: false,
          reasoning_trace: trace, traceExpanded: false,
          model: this.currentModel(),
        };
        return updated;
      });
    };

    const appendToken = (token: string) => {
      this.messages.update(m => {
        const updated = [...m];
        const last = updated[updated.length - 1];
        if (last.role === 'ai') {
          updated[updated.length - 1] = { ...last, text: last.text + token };
        }
        return updated;
      });
    };

    const finalise = (usage?: any) => {
      const elapsed = Date.now() - startTime;
      this.totalResponseMs.update(t => t + elapsed);
      this.questionCount.update(n => n + 1);
      if (usage?.total_tokens) this.totalTokens.update(t => t + (usage.total_tokens ?? 0));
      this.messages.update(m => {
        const updated = [...m];
        const last = updated[updated.length - 1];
        if (last.role === 'ai') {
          updated[updated.length - 1] = { ...last, isStreaming: false, usage };
        }
        return updated;
      });
      this.isLoading.set(false);
    };

    const fallback = () => {
      this.api.askNexus(userText).subscribe(res => {
        this.zone.run(() => {
          initAiBubble(res.reasoning_trace ?? []);
          appendToken(res.reply);
          this.currentModel.set(res.model ?? 'gpt-5.4');
          finalise(res.usage);
        });
      });
    };

    if (typeof ReadableStream === 'undefined' || typeof fetch === 'undefined') {
      fallback();
      return;
    }

    fetch(chatUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, stream: true }),
    }).then(response => {
      if (!response.ok || !response.body) { fallback(); return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let traceInitialised = false;
      let lastUsage: any = undefined;

      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            this.zone.run(() => finalise(lastUsage));
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const event = JSON.parse(raw);
              this.zone.run(() => {
                if (event.type === 'trace') {
                  initAiBubble(event.trace ?? []);
                  traceInitialised = true;
                } else if (event.type === 'token') {
                  if (!traceInitialised) { initAiBubble([]); traceInitialised = true; }
                  appendToken(event.token);
                } else if (event.type === 'done') {
                  finalise(lastUsage);
                } else if (event.type === 'error') {
                  fallback();
                }
              });
            } catch (_) {}
          }
          read();
        }).catch(() => {
          this.zone.run(() => fallback());
        });
      };
      read();
    }).catch(() => {
      this.zone.run(() => fallback());
    });
  }
}
