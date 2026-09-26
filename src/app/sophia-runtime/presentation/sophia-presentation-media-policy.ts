import { inject, Injectable } from '@angular/core';
import { SOPHIA_PRESENTATION_MEDIA_HOSTS } from './sophia-tool-presentation.types';

@Injectable()
export class SophiaPresentationMediaPolicy {
  private readonly allowedHosts = new Set(
    inject(SOPHIA_PRESENTATION_MEDIA_HOSTS).map((host) => host.toLowerCase()),
  );

  allow(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 2_048) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      return this.allowedHosts.has(url.hostname.toLowerCase())
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
}
