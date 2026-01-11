import { Injectable } from '@angular/core';
import { runtimeEnv } from '../../../environments/runtime-env';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadingPromise: Promise<void> | null = null;

  load(): Promise<void> {
    // Already loaded
    if ((window as any).google?.maps) return Promise.resolve();

    // Already in-flight
    if (this.loadingPromise) return this.loadingPromise;

    const key = (runtimeEnv.googleMapsApiKey || '').trim();
    if (!key) {
      return Promise.reject(
        new Error(
          'Google Maps API key is missing. Set GOOGLE_MAPS_API_KEY in Amplify env vars (build time) or in your shell before running locally.'
        )
      );
    }

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      const scriptId = 'google-maps-js';

      const existing = document.getElementById(
        scriptId
      ) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load Google Maps script'))
        );
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        key
      )}&libraries=places`;

      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load Google Maps script'));

      document.body.appendChild(script);
    });

    return this.loadingPromise;
  }
}
