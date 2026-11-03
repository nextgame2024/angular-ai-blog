import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import {
  Subscription,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError,
  Subject,
  takeUntil,
} from 'rxjs';
import {
  ManagerSelectComponent,
  ManagerSelectOption,
} from '../../shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../../shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../../shared/manager-list-loader/manager-list-loader.component';
import { PageJumpComponent } from '../../../../shared/components/page-jump/page-jump.component';
import { LeadWorkspaceService } from '../../../leads/lead-workspace.service';
import {
  LeadAppointment,
  LeadSchedulingService,
  SchedulingContext,
  SlotState,
} from './lead-scheduling.service';
function day(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
@Component({
  selector: 'app-lead-scheduling',
  imports: [
    CommonModule,
    A11yModule,
    ReactiveFormsModule,
    RouterModule,
    ManagerSelectComponent,
    ManagerToastComponent,
    ManagerListLoaderComponent,
    PageJumpComponent,
  ],
  templateUrl: './lead-scheduling.page.html',
  styleUrls: [
    '../../../leads/lead-workspace.page.css',
    './lead-scheduling.page.css',
  ],
})
export class LeadSchedulingPage implements OnInit {
  private readonly api = inject(LeadSchedulingService);
  private readonly leads = inject(LeadWorkspaceService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;
  private slotRequest?: Subscription;
  private calendarRequest?: Subscription;
  private mutation?: Subscription;
  private key = '';
  private signature = '';
  private readonly leadQueries = new Subject<string>();
  private readonly modalClosed = new Subject<void>();
  private readonly timeLabels = new Map<string, string>();
  context: SchedulingContext | null = null;
  contextLoading = false;
  loadError = '';
  loading = false;
  saving = false;
  rows: LeadAppointment[] = [];
  total = 0;
  page = 1;
  sort = 'startsAt';
  direction = 'asc';
  mode: 'book' | 'reschedule' | 'availability' | null = null;
  editing: LeadAppointment | null = null;
  cancelTarget: LeadAppointment | null = null;
  calendarLoading = false;
  calendarRevision = 0;
  canEditCalendar = false;
  slotsLoading = false;
  slotState: SlotState | null = null;
  slotOptions: ManagerSelectOption[] = [];
  leadOptions: ManagerSelectOption[] = [];
  leadSearching = false;
  toast = '';
  tone: 'success' | 'error' = 'success';
  invalidFields = new Set<string>();
  rangeInvalidFields = new Set<string>();
  readonly range = this.fb.nonNullable.group({
    start: [day()],
    end: [day(new Date(Date.now() + 30 * 86400000))],
    timezone: [
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Brisbane',
    ],
    advisorId: [''],
    status: [''],
    limit: ['25'],
  });
  readonly booking = this.fb.nonNullable.group({
    leadId: ['', Validators.required],
    advisorId: ['', Validators.required],
    date: [day(), Validators.required],
    timezone: [this.range.controls.timezone.value, Validators.required],
    slot: ['', Validators.required],
    description: ['', Validators.maxLength(1000)],
  });
  readonly search = this.fb.nonNullable.control('');
  readonly closedDate = this.fb.nonNullable.control('');
  readonly calendarForm = this.fb.nonNullable.group({
    advisorId: ['', Validators.required],
    timezone: ['Australia/Brisbane', Validators.required],
    slotMinutes: ['30', [Validators.required]],
    leadTimeMinutes: [
      60,
      [Validators.required, Validators.min(0), Validators.max(10080)],
    ],
    bookingWindowDays: [
      30,
      [Validators.required, Validators.min(1), Validators.max(180)],
    ],
    weeklyHours: this.fb.array<ReturnType<LeadSchedulingPage['window']>>([]),
  });
  closedDates: string[] = [];
  readonly sizes = [25, 50, 100].map((n) => ({
    value: String(n),
    label: `${n} per page`,
  }));
  readonly statuses = [
    { value: '', label: 'All statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];
  readonly durations = [15, 30, 45, 60].map((n) => ({
    value: String(n),
    label: `${n} minutes`,
  }));
  readonly weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ].map((label, value) => ({ label, value: String(value) }));
  readonly times = Array.from({ length: 96 }, (_, n) => ({
    value: `${String(Math.floor(n / 4)).padStart(2, '0')}:${String((n % 4) * 15).padStart(2, '0')}`,
    label: `${String(Math.floor(n / 4)).padStart(2, '0')}:${String((n % 4) * 15).padStart(2, '0')}`,
  }));
  readonly endTimes = [
    ...this.times.slice(1),
    { value: '24:00', label: '24:00' },
  ];
  advisorOptions: ManagerSelectOption[] = [];
  filterAdvisors: ManagerSelectOption[] = [];
  get totalPages() {
    return Math.max(
      1,
      Math.ceil(this.total / Number(this.range.controls.limit.value)),
    );
  }
  get hours() {
    return this.calendarForm.controls.weeklyHours;
  }
  ngOnInit() {
    this.destroyRef.onDestroy(() => {
      this.listRequest?.unsubscribe();
      this.slotRequest?.unsubscribe();
      this.calendarRequest?.unsubscribe();
      this.mutation?.unsubscribe();
    });
    this.leadQueries
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          this.leadSearching = true;
          return this.leads
            .list({
              page: 1,
              limit: 25,
              q,
              stage: '',
              ownership: '',
              sort: 'name',
              direction: 'asc',
              assignedTo: '',
            })
            .pipe(
              catchError(() => {
                this.notify('Unable to search leads. Try again.', 'error');
                return of(null);
              }),
              takeUntil(this.modalClosed),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.leadSearching = false;
        if (result) {
          const chosen = this.leadOptions.find(
            (o) => o.value === this.booking.controls.leadId.value,
          );
          this.leadOptions = [
            ...new Map(
              [
                ...(chosen ? [chosen] : []),
                ...result.items
                  .filter((l) => l.stage !== 'closed')
                  .map((l) => ({ value: l.leadId, label: l.displayName })),
              ].map((o) => [o.value, o]),
            ).values(),
          ];
        }
      });
    this.search.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.leadQueries.next(q.trim()));
    for (const field of ['advisorId', 'date'] as const)
      this.booking.controls[field].valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.clearSlots();
          this.loadSlots();
        });
    this.booking.controls.timezone.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearSlots());
    this.booking.controls.timezone.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadSlots());
    this.calendarForm.controls.advisorId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (this.mode === 'availability') this.loadCalendar(id);
      });
    this.range.controls.limit.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh(true));
    this.loadContext();
  }
  loadContext() {
    this.contextLoading = true;
    this.loadError = '';
    this.api
      .context()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.context = c;
          this.contextLoading = false;
          this.advisorOptions = c.advisors.map((a) => ({
            value: a.id,
            label: a.name,
          }));
          this.filterAdvisors = [
            { value: '', label: 'All advisors' },
            ...this.advisorOptions,
          ];
          this.refresh();
          if (this.route.snapshot.queryParamMap.get('leadId'))
            this.openBooking();
        },
        error: (e) => {
          this.contextLoading = false;
          this.loadError = this.errorText(e);
        },
      });
  }
  refresh(reset = false) {
    if (!this.context) return;
    if (this.range.invalid) {
      this.range.markAllAsTouched();
      this.notify('Select valid dates and a display timezone.', 'error');
      return;
    }
    this.rangeInvalidFields.clear();
    if (reset) this.page = 1;
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = '';
    this.listRequest = this.api
      .list({
        ...this.range.getRawValue(),
        page: this.page,
        limit: Number(this.range.controls.limit.value),
        sort: this.sort,
        direction: this.direction,
      })
      .subscribe({
        next: (d) => {
          this.timeLabels.clear();
          this.rows = d.items;
          this.total = d.total;
          this.page = d.page;
          this.loading = false;
          if (this.page > this.totalPages) {
            this.page = this.totalPages;
            this.refresh();
          }
        },
        error: (e) => {
          this.loading = false;
          this.rangeInvalidFields = new Set(e.error?.fields ?? []);
          this.loadError = this.errorText(e);
          this.notify(this.loadError, 'error');
        },
      });
  }
  goPage(n: number) {
    if (!this.loading && n >= 1 && n <= this.totalPages) {
      this.page = n;
      this.refresh();
    }
  }
  sortBy(key: string) {
    this.direction =
      this.sort === key && this.direction === 'asc' ? 'desc' : 'asc';
    this.sort = key;
    this.refresh(true);
  }
  sortAria(key: string) {
    return this.sort === key
      ? this.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
  }
  advisorName(id: string) {
    return (
      this.context?.advisors.find((a) => a.id === id)?.name ??
      'Unavailable advisor'
    );
  }
  format(instant: string, timezone = this.range.controls.timezone.value) {
    const key = instant + ':' + timezone;
    const cached = this.timeLabels.get(key);
    if (cached) return cached;
    try {
      const label = new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'shortOffset',
      }).format(new Date(instant));
      if (this.timeLabels.size >= 512) this.timeLabels.clear();
      this.timeLabels.set(key, label);
      return label;
    } catch {
      return 'Select a valid timezone';
    }
  }
  canChange(a: LeadAppointment) {
    return a.status === 'confirmed' && Date.parse(a.startsAt) > Date.now();
  }
  openBooking(a: LeadAppointment | null = null) {
    this.mode = a ? 'reschedule' : 'book';
    this.editing = a;
    this.key = '';
    this.signature = '';
    this.invalidFields.clear();
    this.slotOptions = [];
    this.slotState = null;
    this.search.reset('', { emitEvent: false });
    this.booking.reset(
      {
        leadId: a?.leadId ?? '',
        advisorId: a?.advisorId ?? this.context?.advisors[0]?.id ?? '',
        date: a
          ? new Intl.DateTimeFormat('en-CA', {
              timeZone: a.timezone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date(a.startsAt))
          : day(),
        timezone: a?.timezone ?? this.range.controls.timezone.value,
        slot: '',
        description: a?.description ?? '',
      },
      { emitEvent: false },
    );
    if (a) this.leadOptions = [{ value: a.leadId, label: a.leadName }];
    else {
      this.leadOptions = [];
      const leadId = this.route.snapshot.queryParamMap.get('leadId');
      if (leadId)
        this.api
          .lead(leadId)
          .pipe(
            takeUntil(this.modalClosed),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe({
            next: (d) => {
              if (this.mode === 'book') {
                this.leadOptions = [
                  { value: d.lead.leadId, label: d.lead.displayName },
                ];
                if (d.lead.stage === 'closed') {
                  this.notify(
                    'Reopen this lead before booking an appointment.',
                    'error',
                  );
                  return;
                }
                this.booking.controls.leadId.setValue(d.lead.leadId);
                if (
                  d.lead.assignedTo &&
                  this.context?.advisors.some((x) => x.id === d.lead.assignedTo)
                )
                  this.booking.controls.advisorId.setValue(d.lead.assignedTo, {
                    emitEvent: false,
                  });
                this.loadSlots();
              }
            },
            error: (e) => this.notify(this.errorText(e), 'error'),
          });
      if (leadId) return;
      this.leadQueries.next('');
    }
    this.loadSlots();
  }
  private clearSlots() {
    this.slotRequest?.unsubscribe();
    this.booking.controls.slot.reset('');
    this.slotState = null;
    this.slotOptions = [];
    this.slotsLoading = false;
  }
  loadSlots() {
    if (!['book', 'reschedule'].includes(this.mode ?? '')) return;
    const b = this.booking.getRawValue();
    if (!b.advisorId || !b.date || !b.timezone) return;
    this.slotRequest?.unsubscribe();
    this.slotsLoading = true;
    this.slotState = null;
    this.slotOptions = [];
    this.slotRequest = this.api
      .slots({
        advisorId: b.advisorId,
        date: b.date,
        timezone: b.timezone,
        ...(this.editing ? { excludeId: this.editing.id } : {}),
      })
      .subscribe({
        next: (d) => {
          this.slotsLoading = false;
          this.slotState = d;
          this.slotOptions = d.slots.map((s) => ({
            value: s.startsAt,
            label: this.format(s.startsAt, b.timezone),
          }));
        },
        error: (e) => {
          this.slotsLoading = false;
          this.notify(this.errorText(e), 'error');
        },
      });
  }
  saveBooking() {
    if (this.saving) return;
    this.booking.markAllAsTouched();
    if (
      this.booking.invalid ||
      !this.slotState ||
      !this.slotOptions.some(
        (o) => o.value === this.booking.controls.slot.value,
      )
    ) {
      this.notify('Select a lead, advisor, date and available time.', 'error');
      return;
    }
    const b = this.booking.getRawValue(),
      body = {
        leadId: b.leadId,
        advisorId: b.advisorId,
        startsAt: b.slot,
        timezone: b.timezone,
        description: b.description,
        calendarRevision: this.slotState.calendarRevision,
        ...(this.editing ? { expectedVersion: this.editing.version } : {}),
      };
    this.saving = true;
    const signature = JSON.stringify(body);
    if (signature !== this.signature) {
      this.signature = signature;
      this.key = crypto.randomUUID();
    }
    this.mutation = this.api
      .mutate(this.editing ? 'reschedule' : 'book', this.editing?.id ?? null, {
        ...body,
        requestKey: this.key,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          const changed = !!this.editing;
          this.close();
          this.notify(
            changed ? 'Appointment rescheduled.' : 'Appointment booked.',
          );
          this.refresh();
        },
        error: (e) => {
          this.saving = false;
          this.invalidFields = new Set(e.error?.fields ?? []);
          this.notify(this.errorText(e), 'error');
          if (this.invalidFields.has('slot')) {
            this.booking.controls.slot.reset('');
            this.loadSlots();
          }
        },
      });
  }
  openCancel(a: LeadAppointment) {
    this.cancelTarget = a;
    this.key = crypto.randomUUID();
  }
  cancel() {
    const a = this.cancelTarget;
    if (!a || this.saving) return;
    this.saving = true;
    this.mutation = this.api
      .mutate('cancel', a.id, {
        leadId: a.leadId,
        expectedVersion: a.version,
        requestKey: this.key,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.cancelTarget = null;
          this.notify('Appointment cancelled.');
          this.refresh();
        },
        error: (e) => {
          this.saving = false;
          this.notify(this.errorText(e), 'error');
        },
      });
  }
  openAvailability() {
    this.mode = 'availability';
    this.editing = null;
    this.invalidFields.clear();
    const id =
      this.context?.advisors.find((a) => a.id === this.context?.actorId)?.id ??
      this.context?.advisors[0]?.id ??
      '';
    this.calendarForm.controls.advisorId.setValue(id, { emitEvent: false });
    this.loadCalendar(id);
  }
  loadCalendar(id: string) {
    this.calendarRequest?.unsubscribe();
    this.calendarLoading = true;
    this.canEditCalendar = false;
    this.hours.clear();
    this.closedDates = [];
    if (!id) {
      this.calendarLoading = false;
      return;
    }
    this.calendarRequest = this.api.calendar(id).subscribe({
      next: (d) => {
        this.calendarLoading = false;
        this.canEditCalendar = d.canEdit;
        this.calendarRevision = d.calendar?.revision ?? 0;
        const c = d.calendar;
        this.calendarForm.patchValue(
          {
            timezone:
              c?.timezone ?? this.context?.timezone ?? 'Australia/Brisbane',
            slotMinutes: String(c?.slotMinutes ?? 30),
            leadTimeMinutes: c?.leadTimeMinutes ?? 60,
            bookingWindowDays: c?.bookingWindowDays ?? 30,
          },
          { emitEvent: false },
        );
        for (const w of c?.weeklyHours ?? []) this.hours.push(this.window(w));
        this.closedDates = c?.closedDates ?? [];
      },
      error: (e) => {
        this.calendarLoading = false;
        this.notify(this.errorText(e), 'error');
      },
    });
  }
  window(w = { day: 1, start: '09:00', end: '17:00' }) {
    return this.fb.nonNullable.group({
      day: [String(w.day)],
      start: [w.start, Validators.required],
      end: [w.end, Validators.required],
    });
  }
  addWindow() {
    if (this.hours.length < 28) this.hours.push(this.window());
  }
  removeClosedDate(d: string) {
    this.closedDates = this.closedDates.filter((x) => x !== d);
  }
  addClosedDate() {
    const d = this.closedDate.value;
    if (d && !this.closedDates.includes(d) && this.closedDates.length < 100) {
      this.closedDates = [...this.closedDates, d].sort();
      this.closedDate.reset('');
    }
  }
  saveAvailability() {
    if (this.saving || !this.canEditCalendar) return;
    this.calendarForm.markAllAsTouched();
    if (this.calendarForm.invalid) {
      this.notify('Complete the availability fields.', 'error');
      return;
    }
    this.saving = true;
    const b = this.calendarForm.getRawValue();
    this.mutation = this.api
      .saveCalendar(b.advisorId, {
        ...b,
        slotMinutes: Number(b.slotMinutes),
        weeklyHours: b.weeklyHours.map((w) => ({ ...w, day: Number(w.day) })),
        closedDates: this.closedDates,
        expectedRevision: this.calendarRevision,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.close();
          this.notify('Advisor availability saved.');
        },
        error: (e) => {
          this.saving = false;
          this.invalidFields = new Set(e.error?.fields ?? []);
          this.notify(this.errorText(e), 'error');
        },
      });
  }
  close() {
    if (this.saving) return;
    this.modalClosed.next();
    this.leadSearching = false;
    this.slotRequest?.unsubscribe();
    this.calendarRequest?.unsubscribe();
    this.mode = null;
    this.slotState = null;
    this.slotsLoading = false;
    this.calendarLoading = false;
    this.invalidFields.clear();
  }
  @HostListener('document:keydown.escape') escape() {
    if (this.saving) return;
    if (this.cancelTarget) this.cancelTarget = null;
    else this.close();
  }
  private errorText(e: any) {
    return (
      e?.error?.error ||
      'The scheduling request could not be completed. Try again.'
    );
  }
  private notify(message: string, tone: 'success' | 'error' = 'success') {
    this.toast = message;
    this.tone = tone;
  }
}
