import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
} from '@angular/core';
@Component({
  selector: 'app-manager-calendar',
  template: `
    <div class="calendar-controls">
      <button
        type="button"
        class="btn"
        (click)="move(-1)"
        [disabled]="disabled"
        aria-label="Previous month"
      >
        ‹</button
      ><strong aria-live="polite">{{ monthLabel }}</strong
      ><button
        type="button"
        class="btn"
        (click)="move(1)"
        [disabled]="disabled"
        aria-label="Next month"
      >
        ›
      </button>
    </div>
    <div class="calendar-grid">
      @for (day of weekdays; track day) {
        <span class="weekday">{{ day }}</span>
      }
      @for (day of days; track day.date) {
        <button
          type="button"
          class="day"
          [class.outside]="!day.current"
          [class.selected]="day.date === value"
          [disabled]="disabled || (!!min && day.date < min)"
          [attr.aria-label]="day.date"
          [attr.aria-pressed]="day.date === value"
          (click)="valueChange.emit(day.date)"
        >
          {{ day.number }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 600px;
        min-width: 0;
        border: 1px solid #d6e2f3;
        border-radius: 10px;
        padding: 0.75rem;
        background: #fff;
        color: #17233a;
      }
      .calendar-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }
      .calendar-controls strong {
        font-size: 0.9rem;
      }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 3px;
      }
      .weekday {
        text-align: center;
        font-size: 0.7rem;
        color: #607496;
        padding: 0.35rem 0;
      }
      button {
        font: inherit;
        cursor: pointer;
        border: 1px solid #d6e2f3;
        background: #fff;
        color: inherit;
        border-radius: 6px;
        min-height: 44px;
      }
      .btn {
        min-width: 44px;
      }
      .day {
        font-size: 0.85rem;
      }
      .day.outside {
        opacity: 0.45;
      }
      .day.selected {
        background: #0aa78f;
        color: white;
        border-color: #0aa78f;
      }
      .day:disabled {
        opacity: 0.3;
        cursor: default;
      }
      button:focus-visible {
        outline: 3px solid #8cb6ff;
        outline-offset: 1px;
      }
      :host-context(html.dark) {
        background: #182438;
        color: #e6eefb;
        border-color: #34465f;
      }
      :host-context(html.dark) button {
        background: #152135;
        border-color: #49617e;
        color: #e6eefb;
      }
      :host-context(html.dark) .day.selected {
        background: #0a927e;
      }
      :host-context(html.dark) .weekday {
        color: #b0c1da;
      }
    `,
  ],
})
export class ManagerCalendarComponent implements OnChanges {
  @Input() value = '';
  @Input() min = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  private month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  monthLabel = '';
  days: { date: string; number: number; current: boolean }[] = [];
  ngOnChanges() {
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.value))
      this.month = new Date(this.value + 'T12:00:00');
    this.render();
  }
  move(delta: number) {
    this.month = new Date(
      this.month.getFullYear(),
      this.month.getMonth() + delta,
      1,
    );
    this.render();
  }
  private render() {
    this.monthLabel = this.month.toLocaleDateString('en-AU', {
      month: 'long',
      year: 'numeric',
    });
    const first = new Date(this.month.getFullYear(), this.month.getMonth(), 1);
    this.days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(
        first.getFullYear(),
        first.getMonth(),
        1 - first.getDay() + i,
      );
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        number: d.getDate(),
        current: d.getMonth() === first.getMonth(),
      };
    });
  }
}
