import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrimeIconsService {
  private loaded = false;

  ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;

    const existing = document.getElementById('prime-icons');
    if (existing) return;

    const link = document.createElement('link');
    link.id = 'prime-icons';
    link.rel = 'stylesheet';
    link.href = 'assets/primeicons/primeicons.css';
    document.head.appendChild(link);
  }
}
