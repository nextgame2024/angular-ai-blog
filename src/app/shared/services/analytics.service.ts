import { Injectable, signal } from '@angular/core';
import { environment } from 'src/environments/environment';

type AnalyticsConsent = 'accepted' | 'rejected' | null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly consentKey = 'sophiaAi.analyticsConsent';
  private readonly clientIdKey = 'sophiaAi.analyticsClientId';
  private gaLoaded = false;
  private clarityLoaded = false;
  private initialized = false;

  readonly consent$$ = signal<AnalyticsConsent>(this.readConsent());

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (this.consent$$() === 'accepted') {
      this.loadAnalytics();
    }
  }

  accept(): void {
    this.setConsent('accepted');
    this.loadAnalytics();
  }

  reject(): void {
    this.setConsent('rejected');
  }

  canTrack(): boolean {
    return this.consent$$() === 'accepted';
  }

  trackEvent(name: string, params: Record<string, unknown> = {}): void {
    if (!this.canTrack()) return;

    window.gtag?.('event', name, params);
    window.clarity?.('event', name);
  }

  getAnalyticsPayload(): {
    analyticsConsent: 'granted' | 'denied';
    gaClientId: string | null;
  } {
    if (!this.canTrack()) {
      return { analyticsConsent: 'denied', gaClientId: null };
    }

    return {
      analyticsConsent: 'granted',
      gaClientId: this.getGaClientId(),
    };
  }

  private setConsent(value: Exclude<AnalyticsConsent, null>): void {
    this.consent$$.set(value);
    try {
      localStorage.setItem(this.consentKey, value);
    } catch {
      // Ignore storage failures. Tracking remains controlled by the in-memory signal.
    }
  }

  private readConsent(): AnalyticsConsent {
    try {
      const value = localStorage.getItem(this.consentKey);
      return value === 'accepted' || value === 'rejected' ? value : null;
    } catch {
      return null;
    }
  }

  private loadAnalytics(): void {
    this.loadGoogleAnalytics();
    this.loadMicrosoftClarity();
  }

  private loadGoogleAnalytics(): void {
    const measurementId = environment.googleAnalyticsMeasurementId;
    if (!measurementId || this.gaLoaded) return;
    this.gaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
    window.gtag('js', new Date());
    window.gtag('config', measurementId);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId,
    )}`;
    document.head.appendChild(script);
  }

  private loadMicrosoftClarity(): void {
    const projectId = environment.microsoftClarityProjectId;
    if (!projectId || this.clarityLoaded) return;
    this.clarityLoaded = true;

    window.clarity =
      window.clarity ||
      function clarity(...args: unknown[]) {
        (window.clarity as any).q = (window.clarity as any).q || [];
        (window.clarity as any).q.push(args);
      };
    window.clarity('consent');

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
    document.head.appendChild(script);
  }

  private getGaClientId(): string {
    const cookieClientId = this.readGaCookieClientId();
    if (cookieClientId) return cookieClientId;

    try {
      const existing = localStorage.getItem(this.clientIdKey);
      if (existing) return existing;
      const generated = `${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`;
      localStorage.setItem(this.clientIdKey, generated);
      return generated;
    } catch {
      return `${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`;
    }
  }

  private readGaCookieClientId(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/);
    return match?.[1] || null;
  }
}
