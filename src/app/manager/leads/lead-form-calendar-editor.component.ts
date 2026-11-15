import {
  Component,
  DestroyRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { LeadSchedulingService } from '../components/schedule/leads/lead-scheduling.service';
import { FormCalendar } from './lead-forms.service';
export function validFormCalendar(c?: FormCalendar): boolean {
  if (!c?.advisorId || !c.weeklyHours.length || c.weeklyHours.length > 28)
    return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: c.timezone });
  } catch {
    return false;
  }
  const hours = [...c.weeklyHours].sort(
    (a, b) => a.day - b.day || a.start.localeCompare(b.start),
  );
  return hours.every(
    (h, i) =>
      Number.isInteger(h.day) &&
      h.day >= 0 &&
      h.day <= 6 &&
      /^([01]\d|2[0-3]):(00|15|30|45)$/.test(h.start) &&
      (/^([01]\d|2[0-3]):(00|15|30|45)$/.test(h.end) || h.end === '24:00') &&
      h.start < h.end &&
      (!i || hours[i - 1].day !== h.day || hours[i - 1].end <= h.start),
  );
}
@Component({
  selector: 'app-lead-form-calendar-editor',
  imports: [FormsModule, ManagerSelectComponent],
  template: `
    <div class="form-grid">
      <div>
        <label>Appointment advisor *</label
        ><app-manager-select
          [ngModel]="value.advisorId"
          (ngModelChange)="value.advisorId = $event; changed.emit()"
          [options]="advisors"
          [disabled]="disabled"
          ariaLabel="Calendar advisor"
          placeholder="Select advisor"
        />
      </div>
      <div>
        <label [attr.for]="id + '-timezone'">Availability timezone *</label
        ><input
          [id]="id + '-timezone'"
          [(ngModel)]="value.timezone"
          (ngModelChange)="changed.emit()"
          [disabled]="disabled"
          maxlength="100"
          placeholder="Australia/Brisbane"
        />
      </div>
    </div>
    @if (error) {
      <p role="alert" class="muted">{{ error }}</p>
      <button type="button" class="btn" (click)="load()" [disabled]="disabled">
        Retry advisors
      </button>
    }
    <p class="muted">
      Choose the days and hours offered by this form. Bookable times also
      respect the advisor’s availability, appointment duration, notice period
      and existing bookings in Scheduling.
    </p>
    @for (h of value.weeklyHours; track $index; let i = $index) {
      <div class="hours-row">
        <app-manager-select
          [ngModel]="'' + h.day"
          (ngModelChange)="h.day = +$event; changed.emit()"
          [options]="weekdays"
          [disabled]="disabled"
          ariaLabel="Available weekday"
        />
        <app-manager-select
          [(ngModel)]="h.start"
          (ngModelChange)="changed.emit()"
          [options]="times"
          [disabled]="disabled"
          ariaLabel="Available from"
        />
        <app-manager-select
          [(ngModel)]="h.end"
          (ngModelChange)="changed.emit()"
          [options]="endTimes"
          [disabled]="disabled"
          ariaLabel="Available until"
        />
        <button
          class="btn"
          type="button"
          (click)="value.weeklyHours.splice(i, 1); changed.emit()"
          [disabled]="disabled"
        >
          Remove hours
        </button>
      </div>
    }
    <button
      class="btn"
      type="button"
      (click)="
        value.weeklyHours.push({ day: 1, start: '09:00', end: '17:00' });
        changed.emit()
      "
      [disabled]="disabled || value.weeklyHours.length >= 28"
    >
      Add day / hours
    </button>
    @if (attempted && !valid()) {
      <p role="alert" class="muted">
        Select an advisor, a valid timezone and at least one time interval. End
        times must follow start times; intervals cannot overlap.
      </p>
    }
  `,
  styleUrls: ['./lead-workspace.page.css'],
  styles: [
    `
      .hours-row {
        display: grid;
        grid-template-columns: 1.2fr 1fr 1fr auto;
        gap: 0.5rem;
        margin: 1rem 0;
        align-items: center;
      }
      @media (max-width: 650px) {
        .hours-row {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class LeadFormCalendarEditorComponent implements OnInit {
  @Input({ required: true }) value!: FormCalendar;
  @Input() id = 'form-calendar';
  @Input() disabled = false;
  @Input() attempted = false;
  @Output() changed = new EventEmitter<void>();
  private api = inject(LeadSchedulingService);
  private destroy = inject(DestroyRef);
  advisors: { value: string; label: string }[] = [];
  error = '';
  weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ].map((label, day) => ({ value: String(day), label }));
  times = Array.from({ length: 96 }, (_, i) => ({
    value: `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
    label: `${Math.floor(i / 4) % 12 || 12}:${String((i % 4) * 15).padStart(2, '0')} ${i < 48 ? 'am' : 'pm'}`,
  }));
  endTimes = [
    ...this.times.slice(1),
    { value: '24:00', label: '12:00 am (midnight)' },
  ];
  ngOnInit() {
    this.load();
  }
  valid() {
    return validFormCalendar(this.value);
  }
  load() {
    this.error = '';
    this.api
      .context()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (c) => {
          this.advisors = c.advisors.map((a) => ({
            value: a.id,
            label: a.name,
          }));
          if (!this.advisors.length)
            this.error =
              'Add advisors to the published enquiry team in Leads settings first.';
        },
        error: () =>
          (this.error = 'Could not load scheduling advisors. Try again.'),
      });
  }
}
