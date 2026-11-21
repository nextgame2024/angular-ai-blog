import { Component, DestroyRef, OnInit, inject, EventEmitter, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { WhatsAppSignupService, SignupSettings, SignupAttempt, signupEvent } from './whatsapp-signup.service';

@Component({
  selector: 'app-whatsapp-signup',
  imports: [ManagerToastComponent],
  template: `
    @if (settings?.available) {
      <div class="signup">
        <strong>Connect your business number</strong>
        @if (settings?.connection?.state === 'ready') {
          <p>{{ settings?.connection?.phoneNumber }} is connected. Use Refresh below to load the new number, then configure Sophia replies after testing the connection.</p>
        } @else if (settings?.connection?.state === 'activating' || settings?.connection?.state === 'syncing') {
          <p>Connecting {{ settings?.connection?.phoneNumber }} and synchronizing the data you chose to share. Keep WhatsApp Business open on your phone.</p>
        } @else if (settings?.connection?.state === 'attention') {
          <p>The connection needs administrator attention. Please keep WhatsApp Business available while we check its activation. Your mobile app can still be used.</p>
        } @else if (settings?.connection?.state === 'disconnected') {
          <p>The business number was disconnected from Meta. Use Prepare connection to authorize it again.</p>
        } @else if (settings?.connection?.state === 'verified') {
          <p>Meta authorization verified for {{ settings?.connection?.phoneNumber }}. Activation and message synchronization are still pending.</p>
        } @else {
          <p>Authorize your existing WhatsApp Business app number through Meta. You can keep using the mobile app.</p>
        }
        @if (settings?.connection && settings?.connection?.state !== 'failed' && settings?.connection?.state !== 'started' && settings?.connection?.state !== 'disconnected') {
          <button class="btn" type="button" [disabled]="busy" (click)="checkStatus()">Check connection</button>
        } @else {
        <button class="btn" type="button" [disabled]="busy" (click)="attempt ? connect() : prepare()">
          {{ busy ? 'Connecting…' : attempt ? 'Continue with Meta' : 'Prepare connection' }}
        </button>
        }
        @if (attempt && !busy) { <p>Continue with Meta to select and authorize your existing business number.</p> }
      </div>
    }
    @if (settings && !settings.available) { <p>Business-number connection is not available for this company yet. Your existing receiving connection is unchanged.</p> }
    @if (notice) { <app-manager-toast [message]="notice" [tone]="tone" (closed)="notice = ''" /> }
  `,
  styles: `
    .signup { padding: 14px 0; border-bottom: 1px solid #dbe6f3; }
    p { font-size: 13px; line-height: 1.5; margin: 6px 0 12px; overflow-wrap: anywhere; }
    .btn { border: 1px solid #c7d8ee; border-radius: 8px; background: #fff; color: #315fff; padding: 10px 14px; min-height: 44px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn:focus-visible { outline: 2px solid #315fff; outline-offset: 3px; }
    :host-context(html.dark) .signup { border-color: #334155; }
    :host-context(html.dark) .btn { background: #1e293b; border-color: #475569; color: #a5b4fc; }
    @media(max-width:640px) { .btn { max-width:100%; white-space:normal; } }
  `,
})
export class WhatsAppSignupComponent implements OnInit {
  private readonly api = inject(WhatsAppSignupService);
  private readonly destroyRef = inject(DestroyRef);
  @Output() connectionReady = new EventEmitter<void>();
  settings: SignupSettings | null = null;
  attempt: SignupAttempt | null = null;
  busy = false;
  notice = '';
  tone: 'success' | 'error' = 'success';
  private authorized = false;
  private accountId = '';
  private completing = false;
  private cleanup?: () => void;
  private destroyed = false;
  constructor() { this.destroyRef.onDestroy(() => { this.destroyed = true; this.cleanup?.(); this.attempt = null; }); }
  ngOnInit() {
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => this.settings = settings,
      error: error => { if (![403,404].includes(error.status)) this.fail('WhatsApp onboarding settings could not be loaded. Refresh and try again.'); },
    });
  }
  checkStatus() {
    if(this.busy) return;
    this.busy=true;
    this.api.settings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:settings=>{this.settings=settings;this.busy=false;if(settings.connection?.state==='ready')this.connectionReady.emit();},error:()=>this.fail('Connection status could not be loaded. Try again.')});
  }
  prepare() {
    if (this.busy || !this.settings?.available) return;
    this.busy = true;
    this.api.prepare(this.settings).then(() => {
      if (this.destroyed) return;
      this.api.start().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: attempt => { this.attempt = attempt; this.busy = false; },
        error: () => this.fail('The connection could not be prepared. Try again.'),
      });
    }).catch(() => { if (!this.destroyed) this.fail('Meta could not be loaded. Try again.'); });
  }
  connect() {
    if (this.busy || !this.attempt || !this.settings) return;
    this.busy = true; this.authorized = false; this.accountId = ''; this.completing = false;
    const attempt = this.attempt;
    let exchanging = false;
    const listener = (event: MessageEvent) => {
      const result = signupEvent(event);
      if (result === 'cancelled') this.fail('Meta authorization was cancelled or could not be completed. Prepare the connection again.');
      else if (result) { this.accountId = result.businessAccountId; this.finish(); }
    };
    window.addEventListener('message', listener);
    const timeout = window.setTimeout(() => this.fail('Meta authorization timed out. Prepare the connection again.'), 120000);
    this.cleanup = () => { window.removeEventListener('message', listener); clearTimeout(timeout); };
    try {
      this.api.launch(this.settings, code => {
        if (this.destroyed || !this.busy || this.attempt !== attempt || exchanging) return;
        if (!code) { this.fail('Meta authorization was not completed. Prepare the connection again.'); return; }
        // Exchange immediately: Meta's code expires quickly. The completion
        // event may arrive before or after this callback.
        exchanging = true;
        this.api.exchange(attempt, code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => { if (this.attempt === attempt) { this.authorized = true; this.finish(); } },
          error: () => { if (this.attempt === attempt) this.fail('Meta authorization could not be verified. Prepare the connection again.'); },
        });
      });
    } catch { this.fail('The Meta window could not be opened. Prepare the connection again.'); }
  }
  private finish() {
    if (!this.authorized || !this.accountId || !this.attempt || this.completing) return;
    this.completing = true;
    this.api.complete(this.attempt, this.accountId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.cleanup?.(); this.attempt = null; this.busy = false;
        if (this.settings) this.settings = { ...this.settings, connection: { state: result.state, phoneNumber: result.phoneNumber } };
        this.tone = 'success'; this.notice = result.state==='activating' ? 'Meta authorization completed. Connecting your number and synchronizing your shared data.' : 'Meta authorization verified. Number activation is pending.';
      },
      error: () => this.fail('Meta has not verified the expected business number. Prepare the connection again.'),
    });
  }
  private fail(message: string) {
    this.cleanup?.(); this.attempt = null; this.busy = false;
    this.tone = 'error'; this.notice = message;
  }
}
