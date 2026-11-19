import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
export interface SignupSettings {
  available: boolean;
  appId?: string;
  configId?: string;
  graphVersion?: string;
  connection: { state: string; phoneNumber: string | null } | null;
}
export interface SignupAttempt { signupId: string; nonce: string }
interface MetaSdk {
  init(options: { appId: string; version: string; cookie: boolean; xfbml: boolean }): void;
  login(callback: (response: { authResponse?: { code?: string } }) => void, options: object): void;
}
declare global { interface Window { FB?: MetaSdk } }
@Injectable({ providedIn: 'root' })
export class WhatsAppSignupService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bm/lead-assistant/whatsapp-signup`;
  private sdkPromise?: Promise<void>;
  settings() { return this.http.get<SignupSettings>(this.base); }
  start() { return this.http.post<SignupAttempt>(`${this.base}/start`, {}); }
  exchange(attempt: SignupAttempt, code: string) { return this.http.post(`${this.base}/exchange`, { ...attempt, code }); }
  complete(attempt: SignupAttempt, businessAccountId: string) {
    return this.http.post<{ state: string; phoneNumber: string; activationPending: boolean }>(`${this.base}/complete`, {
      ...attempt, businessAccountId, event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
    });
  }
  prepare(settings: SignupSettings): Promise<void> {
    if (!settings.appId || !settings.graphVersion) return Promise.reject(new Error('WhatsApp setup is incomplete.'));
    this.sdkPromise ??= new Promise<void>((resolve, reject) => {
      if (window.FB) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      const timer = window.setTimeout(() => { script.remove(); reject(new Error('Meta could not be loaded. Try again.')); }, 15000);
      script.onload = () => { clearTimeout(timer); window.FB ? resolve() : reject(new Error('Meta could not be loaded.')); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Meta could not be loaded. Try again.')); };
      document.head.appendChild(script);
    }).catch(error => { this.sdkPromise = undefined; throw error; });
    return this.sdkPromise.then(() => window.FB!.init({ appId: settings.appId!, version: settings.graphVersion!, cookie: false, xfbml: false }));
  }
  // Must be invoked synchronously from an explicit click after preparation to
  // preserve browser popup permission. Codes are never stored or logged.
  launch(settings: SignupSettings, callback: (code?: string) => void) {
    if (!window.FB || !settings.configId) throw new Error('Prepare the connection and try again.');
    window.FB.login(response => callback(response.authResponse?.code), {
      config_id: settings.configId, response_type: 'code', override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
    });
  }
}

// Accept only Meta's exact origins and the expected coexistence completion.
// IDs remain untrusted until the backend verifies membership and phone status.
export function signupEvent(event: MessageEvent): { businessAccountId: string } | 'cancelled' | null {
  if (!['https://www.facebook.com', 'https://web.facebook.com', 'https://facebook.com'].includes(event.origin)) return null;
  let value: unknown = event.data;
  if (typeof value === 'string') {
    if (value.length > 16384) return null;
    try { value = JSON.parse(value); } catch { return null; }
  }
  const data = value as { type?: string; event?: string; data?: { waba_id?: string } } | null;
  if (data?.type !== 'WA_EMBEDDED_SIGNUP') return null;
  if (['CANCEL', 'ERROR'].includes(data.event ?? '')) return 'cancelled';
  if (data.event !== 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' || !/^\d{5,30}$/.test(data.data?.waba_id ?? '')) return null;
  return { businessAccountId: data.data!.waba_id! };
}
