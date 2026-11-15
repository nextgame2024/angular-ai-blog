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
import { ManagerSelectComponent } from '../components/shared/manager-select/manager-select.component';
import { FormBlock } from './lead-forms.service';
import { SlotState } from '../components/schedule/leads/lead-scheduling.service';
export interface FormAppointment {
  startsAt: string;
  calendarRevision: number;
}
@Component({
  selector: 'app-lead-form-calendar',
  imports: [FormsModule, ManagerCalendarComponent, ManagerSelectComponent],
  template: `
    <h3>Choose an appointment</h3>
    <p class="muted">Times shown in {{ block.calendar?.timezone }}.</p>
    <app-manager-calendar
      [value]="day"
      [min]="today"
      (valueChange)="day = $event; load()"
      [disabled]="disabled"
    />
    @if (!token) {
      <p class="muted">
        Preview only. The published form shows bookable times after checking
        Scheduling.
      </p>
    }
    @if (loading) {
      <p role="status">Loading available times…</p>
    }
    @if (error) {
      <p role="alert">{{ error }}</p>
      <button class="btn" type="button" (click)="load()" [disabled]="disabled">
        Retry times
      </button>
    }
    @if (!loading && !error) {
      <label>Available time</label
      ><app-manager-select
        [ngModel]="selected"
        (ngModelChange)="choose($event)"
        [options]="options"
        [disabled]="disabled"
        ariaLabel="Available appointment time"
        placeholder="Select a time"
      />
      @if (!options.length) {
        <p class="muted">No available times for this day.</p>
      }
    }
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
      app-manager-select {
        display: block;
        margin: 0.5rem 0 1rem;
      }
      app-manager-calendar {
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
          label: h.start + ' – ' + h.end + ' (configured hours)',
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
