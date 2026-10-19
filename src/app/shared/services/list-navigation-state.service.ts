import { Injectable, inject } from '@angular/core';
import { PersistanceService } from './persistance.service';

/** Navigation state only: no fetched records, cleared when the login changes. */
@Injectable({ providedIn: 'root' })
export class ListNavigationStateService {
  private readonly persistence = inject(PersistanceService);
  private identity: string | null = null;
  private readonly states = new Map<string, unknown>();

  read<T>(key: string): T | undefined {
    this.checkIdentity();
    const value = this.states.get(key);
    return value === undefined ? undefined : structuredClone(value) as T;
  }

  save<T>(key: string, value: T): void {
    this.checkIdentity();
    if (!this.states.has(key) && this.states.size >= 100) this.states.delete(this.states.keys().next().value!);
    this.states.set(key, structuredClone(value));
  }

  private checkIdentity(): void {
    const identity = this.persistence.get<string>('accessToken') ?? this.persistence.get<string>('token');
    if (identity !== this.identity) {
      this.states.clear();
      this.identity = identity;
    }
  }
}
