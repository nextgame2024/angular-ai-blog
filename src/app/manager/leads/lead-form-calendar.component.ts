import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  DestroyRef,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ManagerCalendarComponent } from '../components/shared/manager-calendar/manager-calendar.component';
import { FormBlock } from './lead-forms.service';
import { SlotState } from '../components/schedule/leads/lead-scheduling.service';
export interface FormAppointment {
  startsAt: string;
  calendarRevision: number;
}
@Component({
  selector: 'app-lead-form-calendar',
  imports: [FormsModule, ManagerCalendarComponent],
  template: `
    <h3>Choose an appointment</h3>
    <p class="muted">Times shown in {{ block.calendar?.timezone }}.</p>
    <app-manager-calendar
      [value]="day"
      [min]="today"
      (valueChange)="day = $event; load()"
      [disabled]="disabled"
    >
      <section
        class="calendar-times"
        aria-label="Available appointment times"
        [attr.aria-busy]="loading"
      >
        <h4>Available times — {{ day }}</h4>
        @if (!token) {
          <p class="muted">
            Preview only. Availability is confirmed on the published form.
          </p>
        }
        @if (loading) {
          <p role="status">Loading available times…</p>
        }
        @if (error) {
          <p role="alert">{{ error }}</p>
          <button
            class="btn"
            type="button"
            (click)="load()"
            [disabled]="disabled"
          >
            Retry times
          </button>
        }
        @if (!loading && !error) {
          <div class="time-grid">
            @for (option of options; track option.value) {
              <button
                type="button"
                class="btn time-slot"
                [class.primary]="selected === option.value"
                [attr.aria-pressed]="selected === option.value"
                [disabled]="disabled"
                (click)="choose(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
          @if (!options.length) {
            <p class="muted">No available times for this day.</p>
          }
        }
      </section>
    </app-manager-calendar>
  `,
  styleUrls: ['./lead-workspace.page.css'],
  styles: [
    `
      :host {
        display: block;
        margin: 1rem 0;
      }
      h3 {
        font-size: 1rem;
        font-weight: 700;
      }
      .calendar-times {
        margin-top: 1rem;
        border-top: 1px solid #d6e2f3;
        padding-top: 1rem;
      }
      .time-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.5rem;
      }
      .time-slot {
        color: #008f7b;
        background: #fff;
        border-color: #0aa78f;
        white-space: normal;
        min-height: 44px;
      }
      .time-slot.primary {
        background: #0aa78f;
        color: white;
      }
      :host-context(html.dark) .time-slot {
        background: #182438;
        color: #70e0cb;
      }
      :host-context(html.dark) .time-slot.primary {
        background: #0a927e;
        color: white;
      }
      :host-context(html.dark) .calendar-times {
        border-color: #34465f;
      }
      app-manager-calendar {
        max-width: none;
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class LeadFormCalendarComponent implements OnChanges {
  @Input({ required: true }) block!: FormBlock;
  @Input() token = '';
  @Input() formVersion = 0;
  @Input() disabled = false;
  @Output() selectionChange = new EventEmitter<FormAppointment | null>();
  private http = inject(HttpClient);
  private destroy = inject(DestroyRef);
  private request?: Subscription;
  day = '';
  today = '';
  loading = false;
  error = '';
  selected = '';
  options: { value: string; label: string }[] = [];
  private revision = 0;
  ngOnChanges(changes: import('@angular/core').SimpleChanges) {
    if (!changes['block'] && !changes['token'] && !changes['formVersion'])
      return;
    const c = this.block.calendar;
    if (!c) return;
    try {
      this.today = new Intl.DateTimeFormat('en-CA', {
        timeZone: c.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      this.error = 'Select a valid timezone.';
      return;
    }
    this.day ||= this.today;
    this.load();
  }
  private label(instant: string) {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: this.block.calendar!.timezone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(instant));
  }
  choose(value: string) {
    if (
      this.disabled ||
      this.loading ||
      !this.options.some((o) => o.value === value)
    )
      return;
    this.selected = value;
    this.selectionChange.emit(
      value && this.token
        ? { startsAt: value, calendarRevision: this.revision }
        : null,
    );
  }
  load() {
    this.request?.unsubscribe();
    this.error = '';
    this.selected = '';
    this.selectionChange.emit(null);
    this.options = [];
    this.loading = false;
    const c = this.block.calendar;
    if (!c) return;
    if (!this.token) {
      const weekday = new Date(this.day + 'T12:00:00Z').getUTCDay();
      this.options = c.weeklyHours
        .filter((h) => h.day === weekday)
        .map((h) => ({
          value: h.start,
          label: h.start + ' – ' + h.end,
        }));
      return;
    }
    this.loading = true;
    this.request = this.http
      .get<SlotState>(
        `${environment.apiUrl}/public/forms/${this.token}/calendars/${this.block.id}/availability`,
        {
          params: {
            date: this.day,
            timezone: c.timezone,
            formVersion: this.formVersion,
          },
        },
      )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (s) => {
          this.loading = false;
          this.revision = s.calendarRevision;
          this.options = s.slots.map((t) => ({
            value: t.startsAt,
            label: this.label(t.startsAt),
          }));
        },
        error: (e) => {
          this.loading = false;
          this.error =
            typeof e?.error?.error === 'string'
              ? e.error.error
              : 'Could not load available times. Try again.';
        },
      });
  }
}
