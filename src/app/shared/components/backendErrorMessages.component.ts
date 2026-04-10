
import { Component, computed, input } from '@angular/core';
import { BackendErrorsInterface } from '../types/backendErrors.interface';

/* PrimeNG */
import { MessageModule } from 'primeng/message';

type PrimeMessage = {
  severity?: 'success' | 'info' | 'warn' | 'error';
  summary?: string;
  detail?: string;
};

@Component({
    selector: 'mc-backend-error-messages',
    templateUrl: './backendErrorMessages.component.html',
    imports: [MessageModule]
})
export class BackendErrorMessages {
  readonly backendErrors$$ = input<BackendErrorsInterface | null>(null, {
    alias: 'backendErrors',
  });

  /** Messages consumed by <p-message> list */
  readonly errorItems$$ = computed<PrimeMessage[]>(() => {
    const errs = this.backendErrors$$() ?? {};
    return Object.entries(errs).map(([field, msgs]) => {
      const summary = this.humanize(field);
      const detail = Array.isArray(msgs) ? msgs.join(' ') : String(msgs ?? '');
      return { severity: 'error', summary, detail };
    });
  });

  private humanize(key: string): string {
    if (!key) return '';
    // e.g. "email" -> "Email", "confirm_password" -> "Confirm password"
    return key.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
}
