import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';

@Component({
  selector: 'app-manager-toast',
  standalone: true,
  template: `
    <div class="toast" [class.error]="tone === 'error'" [attr.role]="tone === 'error' ? 'alert' : 'status'">
      <span>{{ message }}</span>
      <button type="button" (click)="dismiss()" aria-label="Close notification" title="Close notification">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
  `,
  styleUrls: ['./manager-toast.component.css'],
})
export class ManagerToastComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) message = '';
  @Input() tone: 'success' | 'error' = 'success';
  @Output() closed = new EventEmitter<void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), 4000);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.closed.emit();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
