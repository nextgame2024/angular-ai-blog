import { Injectable } from '@angular/core';

type RuntimeConfig = {
  googleMapsApiKey?: string;
};

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private scriptLoading?: Promise<void>;
  private configLoading?: Promise<RuntimeConfig>;
  private cachedConfig?: RuntimeConfig;

  async load(): Promise<void> {
    // already loaded
    if ((window as any).google?.maps) return;

    // reuse in-flight script load
    if (this.scriptLoading) return this.scriptLoading;

    this.scriptLoading = (async () => {
      const cfg = await this.getRuntimeConfig();
      const key = (cfg.googleMapsApiKey || '').trim();

      if (!key) {
        throw new Error(
          'Missing googleMapsApiKey in assets/runtime-config.json'
        );
      }

      await this.loadGoogleMapsScript(key);
    })();

    return this.scriptLoading;
  }

  private async getRuntimeConfig(): Promise<RuntimeConfig> {
    if (this.cachedConfig) return this.cachedConfig;
    if (this.configLoading) return this.configLoading;

    this.configLoading = fetch('/assets/runtime-config.json', {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load runtime-config.json (${res.status})`);
        }
        return (await res.json()) as RuntimeConfig;
      })
      .then((cfg) => {
        this.cachedConfig = cfg;
        return cfg;
      });

    return this.configLoading;
  }

  private loadGoogleMapsScript(key: string): Promise<void> {
    // if another code path loaded it between awaits
    if ((window as any).google?.maps) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-google-maps="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Google Maps failed to load')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.setAttribute('data-google-maps', '1');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        key
      )}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    });
  }
}
