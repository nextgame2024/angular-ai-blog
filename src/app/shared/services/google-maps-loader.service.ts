import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loading?: Promise<void>;

  load(): Promise<void> {
    // already available
    if ((window as any).google?.maps) return Promise.resolve();

    // reuse in-flight load
    if (this.loading) return this.loading;

    const key = environment.googleMapsApiKey;
    if (!key)
      return Promise.reject(new Error('Missing environment.googleMapsApiKey'));

    this.loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        key
      )}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load Google Maps script'));
      document.head.appendChild(script);
    });

    return this.loading;
  }
}
