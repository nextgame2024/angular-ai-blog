// src/app/shared/services/theme.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type Mode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'theme';
  private readonly lightHref = 'assets/themes/lara-light-teal.css';
  private readonly darkHref = 'assets/themes/lara-dark-teal.css';

  private _mode$ = new BehaviorSubject<Mode>(this.initMode());
  mode$ = this._mode$.asObservable();

  constructor() {
    this.apply(this._mode$.value); // will be 'light' first time
  }

  toggle(): void {
    const next: Mode = this._mode$.value === 'dark' ? 'light' : 'dark';
    this.setMode(next);
  }

  setMode(mode: Mode): void {
    if (mode !== this._mode$.value) {
      this._mode$.next(mode);
      this.apply(mode);
      localStorage.setItem(this.storageKey, mode);
    }
  }

  private initMode(): Mode {
    const saved = localStorage.getItem(this.storageKey) as Mode | null;
    // Default to light; only use saved preference if present
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  }

  private apply(mode: Mode): void {
    const root = document.documentElement; // <html>
    root.classList.toggle('dark', mode === 'dark');

    const link = document.getElementById(
      'prime-theme'
    ) as HTMLLinkElement | null;
    if (link) link.href = mode === 'dark' ? this.darkHref : this.lightHref;
  }
}
