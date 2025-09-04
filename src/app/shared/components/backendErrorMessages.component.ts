import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { BackendErrorsInterface } from '../types/backendErrors.interface';

/* PrimeNG */
import { MessagesModule } from 'primeng/messages';

type PrimeMessage = {
  severity?: 'success' | 'info' | 'warn' | 'error';
  summary?: string;
  detail?: string;
};

@Component({
  selector: 'mc-backend-error-messages',
  templateUrl: './backendErrorMessages.component.html',
  standalone: true,
  imports: [CommonModule, MessagesModule],
})
export class BackendErrorMessages implements OnInit, OnChanges {
  @Input() backendErrors: BackendErrorsInterface | null = null;

  /** Messages consumed by <p-messages> */
  errorItems: PrimeMessage[] = [];

  ngOnInit(): void {
    this.buildMessages();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.buildMessages();
  }

  private buildMessages(): void {
    const errs = this.backendErrors || {};
    this.errorItems = Object.entries(errs).map(([field, msgs]) => {
      const summary = this.humanize(field);
      const detail = Array.isArray(msgs) ? msgs.join(' ') : String(msgs ?? '');
      return { severity: 'error', summary, detail };
    });
  }

  private humanize(key: string): string {
    if (!key) return '';
    // e.g. "email" -> "Email", "confirm_password" -> "Confirm password"
    return key.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
}
