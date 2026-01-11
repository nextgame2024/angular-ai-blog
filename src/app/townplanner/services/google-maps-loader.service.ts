import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

type RuntimeConfig = {
  googleMapsApiKey?: string;
};

declare global {
  interface Window {
    google?: any;
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Public: load Google Maps JS once.
   */
  load(): Promise<void> {
    // If already loaded (e.g., index.html has a script tag), just resolve.
    if (window.google?.maps) return Promise.resolve();

    if (!this.loadPromise) {
      this.loadPromise = this.loadInternal();
    }
    return this.loadPromise;
  }

  private async loadInternal(): Promise<void> {
    // If loaded between calls
    if (window.google?.maps) return;

    const apiKey = await this.resolveApiKey();

    await this.injectScript(apiKey);
    await this.waitForGoogleMaps();
  }

  /**
   * Resolve key in a safe order:
   *  1) runtime-config.json (generated at build/dev time)
   *  2) environment.googleMapsApiKey (optional fallback)
   */
  private async resolveApiKey(): Promise<string> {
    // 1) runtime-config.json in /assets (best for Amplify + local)
    try {
      const headers = new HttpHeaders({
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      });

      // Cache-buster to avoid stale CDN/service-worker caching issues
      const params = new HttpParams().set('v', String(Date.now()));

      const cfg = await firstValueFrom(
        this.http.get<RuntimeConfig>('assets/runtime-config.json', {
          headers,
          params,
        })
      );

      const keyFromRuntime = (cfg?.googleMapsApiKey || '').trim();
      if (keyFromRuntime) return keyFromRuntime;
    } catch {
      // If 404 or parsing error, ignore and fallback
    }

    // 2) optional fallback (if you decide to put a dev key in env files)
    const keyFromEnv = ((environment as any).googleMapsApiKey || '').trim();
    if (keyFromEnv) return keyFromEnv;

    throw new Error(
      'Google Maps API key not found. Ensure assets/runtime-config.json exists and contains googleMapsApiKey.'
    );
  }

  private injectScript(apiKey: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // If already injected by another caller
      const existing = document.getElementById(
        'google-maps-js'
      ) as HTMLScriptElement | null;
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-js';
      script.async = true;
      script.defer = true;

      // Include places (you likely need it for address search/autocomplete)
      script.src =
        'https://maps.googleapis.com/maps/api/js' +
        `?key=${encodeURIComponent(apiKey)}` +
        '&libraries=places';

      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            'Failed to load Google Maps script. Check API key / restrictions.'
          )
        );

      document.body.appendChild(script);
    });
  }

  private waitForGoogleMaps(timeoutMs = 15000): Promise<void> {
    const started = Date.now();

    return new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (window.google?.maps) {
          resolve();
          return;
        }

        if (Date.now() - started > timeoutMs) {
          reject(new Error('Google Maps did not initialize in time.'));
          return;
        }

        setTimeout(tick, 50);
      };

      tick();
    });
  }
}
