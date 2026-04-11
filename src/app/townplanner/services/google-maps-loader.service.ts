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
  private apiKeyPromise: Promise<string> | null = null;
  private apiKey: string | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Public: load Google Maps JS once.
   */
  load(): Promise<void> {
    // If already loaded (e.g., index.html has a script tag), just resolve.
    if (window.google?.maps) return Promise.resolve();

    if (!this.loadPromise) {
      this.loadPromise = this.loadInternal().catch((err) => {
        this.loadPromise = null;
        throw err;
      });
    }
    return this.loadPromise;
  }

  /**
   * Public: retrieve the resolved Google Maps API key (cached).
   * Useful for building Street View Static preview URLs on the client.
   */
  getApiKey(): Promise<string> {
    if (this.apiKey) return Promise.resolve(this.apiKey);

    if (!this.apiKeyPromise) {
      this.apiKeyPromise = this.resolveApiKey()
        .then((k) => {
          this.apiKey = k;
          return k;
        })
        .catch((err) => {
          this.apiKeyPromise = null;
          throw err;
        });
    }

    return this.apiKeyPromise;
  }

  private async loadInternal(): Promise<void> {
    // If loaded between calls
    if (window.google?.maps) {
      this.ensureImportLibraryFallback();
      return;
    }

    const apiKey = await this.getApiKey();

    await this.injectScript(apiKey);
    await this.waitForGoogleMaps();
    this.ensureImportLibraryFallback();
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
      if (this.isValidGoogleMapsKey(keyFromRuntime)) return keyFromRuntime;
    } catch {
      // If 404 or parsing error, ignore and fallback
    }

    // 2) optional fallback (if you decide to put a dev key in env files)
    const keyFromEnv = ((environment as any).googleMapsApiKey || '').trim();
    if (this.isValidGoogleMapsKey(keyFromEnv)) return keyFromEnv;

    throw new Error(
      'Google Maps API key not found. Ensure assets/runtime-config.json exists and contains googleMapsApiKey.'
    );
  }

  private isValidGoogleMapsKey(value: string | null | undefined): boolean {
    const key = String(value || '').trim();
    if (!key) return false;
    if (key === '__GOOGLE_MAPS_API_KEY__') return false;
    if (key.toLowerCase() === 'dummy') return false;
    return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
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
        '&v=weekly' +
        '&loading=async' +
        '&libraries=places,marker';

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
        if (
          window.google?.maps
          && typeof (window.google.maps as any).Map === 'function'
        ) {
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

  private ensureImportLibraryFallback(): void {
    const maps = window.google?.maps as
      | {
          Geocoder?: unknown;
          marker?: unknown;
          places?: unknown;
          [key: string]: unknown;
          importLibrary?: (libraryName: string) => Promise<unknown>;
        }
      | undefined;
    if (!maps || typeof maps.importLibrary === 'function') return;

    maps.importLibrary = async (libraryName: string): Promise<unknown> => {
      switch (libraryName) {
        case 'core':
          await this.waitForMapsField(() => !!maps['MVCObject']);
          return { MVCObject: maps['MVCObject'] };
        case 'maps':
          await this.waitForMapsField(() => typeof maps['Map'] === 'function');
          return { Map: maps['Map'] };
        case 'marker':
          await this.waitForMapsField(
            () => !!maps.marker && typeof (maps.marker as any).AdvancedMarkerElement === 'function',
          );
          return maps.marker || {};
        case 'places':
          await this.waitForMapsField(() => !!maps.places);
          return maps.places || {};
        case 'geocoding':
          await this.waitForMapsField(() => typeof maps.Geocoder === 'function');
          return { Geocoder: maps.Geocoder };
        default:
          await this.waitForMapsField(() => Boolean((maps as any)[libraryName]));
          return (maps as any)[libraryName] || {};
      }
    };
  }

  private waitForMapsField(
    predicate: () => boolean,
    timeoutMs = 5000,
  ): Promise<void> {
    if (predicate()) return Promise.resolve();

    const started = Date.now();
    return new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (predicate()) {
          resolve();
          return;
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Google Maps library did not initialize in time.'));
          return;
        }
        setTimeout(tick, 25);
      };
      tick();
    });
  }
}
