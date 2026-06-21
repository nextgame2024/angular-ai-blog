// src/app/shared/services/theme.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type Mode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'sophiaAi.theme';
  private readonly legacyStorageKey = 'theme';

  private _mode$ = new BehaviorSubject<Mode>(this.initMode());
  mode$ = this._mode$.asObservable();

  constructor() {
    this.apply(this._mode$.value);
  }

  toggle(): void {
    const next: Mode = this._mode$.value === 'dark' ? 'light' : 'dark';
    this.setMode(next);
  }

  setMode(mode: Mode): void {
    if (mode !== this._mode$.value) {
      this._mode$.next(mode);
      this.apply(mode);
    }
    localStorage.setItem(this.storageKey, mode);
    localStorage.setItem(this.legacyStorageKey, mode);
  }

  private initMode(): Mode {
    const saved = localStorage.getItem(this.storageKey) as Mode | null;
    if (saved === 'dark' || saved === 'light') return saved;

    return 'dark';
  }

  private apply(mode: Mode): void {
    const root = document.documentElement; // <html>
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
  }
}
