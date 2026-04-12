import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
} from 'rxjs/operators';

import { ManagerRichTextEditorComponent } from '../shared/manager-rich-text-editor/manager-rich-text-editor.component';
import {
  ManagerSelectComponent,
  type ManagerSelectOption,
} from '../shared/manager-select/manager-select.component';
import { ManagerProjectsService } from '../../services/manager.projects.service';
import { ManagerScheduleActions } from '../../store/schedule/manager.actions';
import {
  selectManagerDeleteConfirmSchedule,
  selectManagerEditingSchedule,
  selectManagerScheduleError,
  selectManagerScheduleDeleting,
  selectManagerScheduleLoading,
  selectManagerScheduleModalMode,
  selectManagerScheduleSaving,
  selectManagerScheduleSelectedDate,
  selectManagerScheduledItems,
  selectManagerScheduledItemsError,
  selectManagerScheduledItemsLoading,
  selectManagerSchedules,
} from '../../store/schedule/manager.selectors';
import type {
  BmSchedule,
  BmScheduledItem,
} from '../../types/schedule.interface';
import type { BmProject } from '../../types/projects.interface';

type CalendarDay = {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  schedules: BmSchedule[];
};

type AgendaGroup = {
  date: string;
  label: string;
  schedules: BmSchedule[];
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_STEP_MINUTES = 15;
const MINUTES_IN_DAY = 24 * 60;
const LATEST_END_OPTION_MINUTES = MINUTES_IN_DAY - SLOT_STEP_MINUTES;
const MONTH_OPTIONS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' },
];

function normalizeDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatIsoDate(date: Date): string {
  const normalized = normalizeDate(date);
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${normalized.getFullYear()}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const normalizedValue = String(value || '').slice(0, 10);
  const [yearRaw, monthRaw, dayRaw] = normalizedValue.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function endOfWeek(date: Date): Date {
  return addDays(date, 6 - date.getDay());
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatAgendaDate(dateIso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseIsoDate(dateIso));
}

function formatFieldDate(dateIso: string | null): string {
  if (!dateIso) {
    return '';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseIsoDate(dateIso));
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(minutes, MINUTES_IN_DAY));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function parseTimeToMinutes(value: string): number | null {
  const normalized = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    return null;
  }

  const [hoursRaw, minutesRaw] = normalized.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function stripRichText(value: string): string {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildScheduledItemDisplay(item: {
  scheduledItemLabel: string;
  scheduledItemSecondaryLabel?: string | null;
}): string {
  const label = item.scheduledItemLabel.trim();
  const secondaryLabel = String(item.scheduledItemSecondaryLabel || '').trim();
  return secondaryLabel ? `${label} / ${secondaryLabel}` : label;
}

function sortSchedules(items: BmSchedule[]): BmSchedule[] {
  return [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }

    return buildScheduledItemDisplay(left).localeCompare(
      buildScheduledItemDisplay(right),
    );
  });
}

function buildYearOptions(centerYear: number): number[] {
  return Array.from({ length: 11 }, (_, index) => centerYear + index);
}

function buildFreeIntervals(schedules: BmSchedule[]): Array<{
  start: number;
  end: number;
}> {
  const busyIntervals = sortSchedules(schedules)
    .map((schedule) => ({
      start: parseTimeToMinutes(schedule.startTime),
      end: parseTimeToMinutes(schedule.endTime),
    }))
    .filter(
      (interval): interval is { start: number; end: number } =>
        interval.start !== null &&
        interval.end !== null &&
        interval.start < interval.end,
    );

  const freeIntervals: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  busyIntervals.forEach((interval) => {
    if (interval.start > cursor) {
      freeIntervals.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  });

  if (cursor < MINUTES_IN_DAY) {
    freeIntervals.push({ start: cursor, end: MINUTES_IN_DAY });
  }

  return freeIntervals;
}

function buildAvailableStartTimes(schedules: BmSchedule[]): string[] {
  return buildFreeIntervals(schedules).flatMap((interval) => {
    const limit = Math.min(interval.end, LATEST_END_OPTION_MINUTES);
    const slots: string[] = [];

    for (
      let minutes = interval.start;
      minutes + SLOT_STEP_MINUTES <= limit;
      minutes += SLOT_STEP_MINUTES
    ) {
      slots.push(formatMinutes(minutes));
    }

    return slots;
  });
}

function buildAvailableEndTimes(
  schedules: BmSchedule[],
  startTime: string,
): string[] {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes === null) {
    return [];
  }

  const matchingInterval = buildFreeIntervals(schedules).find(
    (interval) => startMinutes >= interval.start && startMinutes < interval.end,
  );

  if (!matchingInterval) {
    return [];
  }

  const limit = Math.min(matchingInterval.end, LATEST_END_OPTION_MINUTES);
  const slots: string[] = [];

  for (
    let minutes = startMinutes + SLOT_STEP_MINUTES;
    minutes <= limit;
    minutes += SLOT_STEP_MINUTES
  ) {
    slots.push(formatMinutes(minutes));
  }

  return slots;
}

function isRangeAvailable(
  schedules: BmSchedule[],
  startTime: string,
  endTime: string,
): boolean {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    return false;
  }

  return schedules.every((schedule) => {
    const scheduledStart = parseTimeToMinutes(schedule.startTime);
    const scheduledEnd = parseTimeToMinutes(schedule.endTime);

    if (scheduledStart === null || scheduledEnd === null) {
      return true;
    }

    return !(scheduledStart < endMinutes && scheduledEnd > startMinutes);
  });
}

function groupSchedulesForMonth(
  viewDate: Date,
  schedules: BmSchedule[],
): AgendaGroup[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const groups = new Map<string, BmSchedule[]>();

  sortSchedules(schedules).forEach((schedule) => {
    const scheduleDate = parseIsoDate(schedule.date);
    if (
      scheduleDate.getFullYear() !== year ||
      scheduleDate.getMonth() !== month
    ) {
      return;
    }

    const existing = groups.get(schedule.date) ?? [];
    existing.push(schedule);
    groups.set(schedule.date, existing);
  });

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    label: formatAgendaDate(date),
    schedules: sortSchedules(items),
  }));
}

function buildScheduledItemFromProject(project: BmProject): BmScheduledItem {
  return {
    scheduledItemType: 'project',
    scheduledItemId: project.projectId,
    scheduledItemLabel: String(project.projectName || '').trim(),
    scheduledItemSecondaryLabel: String(project.clientName || '').trim() || null,
    projectId: project.projectId,
  };
}

@Component({
  selector: 'app-manager-schedule-page',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ManagerRichTextEditorComponent,
    ManagerSelectComponent,
  ],
  templateUrl: './manager-schedule.page.html',
  styleUrls: ['./manager-schedule.page.css'],
})
export class ManagerSchedulePageComponent {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly actions$ = inject(Actions);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectsService = inject(ManagerProjectsService);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private toastCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPatchedModalKey: string | null = null;
  private lastFormDateValue: string | null = null;
  private suppressDateChangeReaction = false;
  private suppressScheduledItemSearchReaction = false;

  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly monthOptions: ManagerSelectOption[] = MONTH_OPTIONS.map(
    ({ value, label }) => ({
      value: String(value),
      label,
    }),
  );
  readonly todayIso = formatIsoDate(new Date());

  readonly viewDate$$ = signal(startOfMonth(new Date()));
  readonly selectedDay$$ = signal(this.todayIso);
  readonly scheduledItemFocused$$ = signal(false);
  readonly toastMessage$$ = signal<string | null>(null);
  readonly toastClosing$$ = signal(false);
  readonly selectedScheduledItem$$ = signal<BmScheduledItem | null>(null);
  readonly isDateEditable$$ = signal(false);
  readonly projectScopeId$$ = signal<string | null>(null);
  readonly projectScopeItem$$ = signal<BmScheduledItem | null>(null);
  readonly projectScopeLoading$$ = signal(false);

  readonly scheduledItemSearchCtrl = this.fb.nonNullable.control('', {
    validators: [Validators.required],
  });

  readonly scheduleForm = this.fb.nonNullable.group({
    scheduled_item_id: ['', [Validators.required]],
    date: ['', [Validators.required]],
    start_time: ['', [Validators.required]],
    end_time: ['', [Validators.required]],
    description: ['', [Validators.required]],
  });

  readonly schedules$$ = toSignal(this.store.select(selectManagerSchedules), {
    initialValue: [] as BmSchedule[],
  });
  readonly loading$$ = toSignal(
    this.store.select(selectManagerScheduleLoading),
    { initialValue: false },
  );
  readonly error$$ = toSignal(this.store.select(selectManagerScheduleError), {
    initialValue: null,
  });
  readonly modalMode$$ = toSignal(
    this.store.select(selectManagerScheduleModalMode),
    { initialValue: null },
  );
  readonly selectedDate$$ = toSignal(
    this.store.select(selectManagerScheduleSelectedDate),
    { initialValue: null },
  );
  readonly editingSchedule$$ = toSignal(
    this.store.select(selectManagerEditingSchedule),
    { initialValue: null },
  );
  readonly saving$$ = toSignal(this.store.select(selectManagerScheduleSaving), {
    initialValue: false,
  });
  readonly deleting$$ = toSignal(
    this.store.select(selectManagerScheduleDeleting),
    { initialValue: false },
  );
  readonly deleteConfirmSchedule$$ = toSignal(
    this.store.select(selectManagerDeleteConfirmSchedule),
    { initialValue: null },
  );
  readonly scheduledItems$$ = toSignal(
    this.store.select(selectManagerScheduledItems),
    { initialValue: [] as BmScheduledItem[] },
  );
  readonly scheduledItemsLoading$$ = toSignal(
    this.store.select(selectManagerScheduledItemsLoading),
    { initialValue: false },
  );
  readonly scheduledItemsError$$ = toSignal(
    this.store.select(selectManagerScheduledItemsError),
    { initialValue: null },
  );
  readonly monthSelectValue$$ = computed(() =>
    String(this.viewDate$$().getMonth()),
  );
  readonly yearSelectValue$$ = computed(() =>
    String(this.viewDate$$().getFullYear()),
  );
  readonly isProjectScope$$ = computed(() => !!this.projectScopeId$$());
  readonly pageLoading$$ = computed(
    () => this.loading$$() || this.saving$$() || this.projectScopeLoading$$(),
  );
  readonly projectScopeDisplay$$ = computed(() => {
    const projectScopeItem = this.projectScopeItem$$();
    return projectScopeItem ? buildScheduledItemDisplay(projectScopeItem) : '';
  });
  readonly toolbarSubtext$$ = computed(() => {
    const projectScopeItem = this.projectScopeItem$$();
    if (projectScopeItem) {
      return `Manage bookings for ${buildScheduledItemDisplay(projectScopeItem)}.`;
    }

    return 'Book projects now, while keeping the manager ready for any scheduled job type later.';
  });

  readonly startTime$$ = toSignal(
    this.scheduleForm.controls.start_time.valueChanges.pipe(
      startWith(this.scheduleForm.controls.start_time.value),
    ),
    { initialValue: this.scheduleForm.controls.start_time.value },
  );
  readonly endTime$$ = toSignal(
    this.scheduleForm.controls.end_time.valueChanges.pipe(
      startWith(this.scheduleForm.controls.end_time.value),
    ),
    { initialValue: this.scheduleForm.controls.end_time.value },
  );
  readonly date$$ = toSignal(
    this.scheduleForm.controls.date.valueChanges.pipe(
      startWith(this.scheduleForm.controls.date.value),
    ),
    { initialValue: this.scheduleForm.controls.date.value },
  );

  readonly isModalOpen$$ = computed(() => this.modalMode$$() !== null);
  readonly modalDate$$ = computed(() => {
    if (this.isModalOpen$$()) {
      const dateValue = this.date$$();
      if (dateValue) {
        return dateValue;
      }

      if (this.modalMode$$() === 'edit') {
        return this.selectedDate$$() ?? this.selectedDay$$();
      }

      return null;
    }

    return this.selectedDate$$() ?? this.selectedDay$$();
  });
  readonly monthLabel$$ = computed(() => formatMonthYear(this.viewDate$$()));
  readonly monthBookingCount$$ = computed(() =>
    groupSchedulesForMonth(this.viewDate$$(), this.filteredSchedules$$()).reduce(
      (total, group) => total + group.schedules.length,
      0,
    ),
  );
  readonly yearOptions$$ = computed<ManagerSelectOption[]>(() =>
    buildYearOptions(this.viewDate$$().getFullYear()).map((year) => ({
      value: String(year),
      label: String(year),
    })),
  );

  readonly filteredSchedules$$ = computed(() => {
    const projectScopeId = this.projectScopeId$$();
    const schedules = this.schedules$$();

    if (!projectScopeId) {
      return schedules;
    }

    return schedules.filter(
      (schedule) =>
        schedule.projectId === projectScopeId
        || schedule.scheduledItemId === projectScopeId,
    );
  });

  readonly schedulesByDate$$ = computed(() => {
    const map = new Map<string, BmSchedule[]>();

    sortSchedules(this.filteredSchedules$$()).forEach((schedule) => {
      const existing = map.get(schedule.date) ?? [];
      existing.push(schedule);
      map.set(schedule.date, existing);
    });

    return map;
  });

  readonly calendarDays$$ = computed(() => {
    const viewDate = this.viewDate$$();
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const selectedDay = this.selectedDay$$();
    const schedulesByDate = this.schedulesByDate$$();
    const days: CalendarDay[] = [];

    for (
      let currentDay = gridStart;
      currentDay <= gridEnd;
      currentDay = addDays(currentDay, 1)
    ) {
      const date = formatIsoDate(currentDay);
      days.push({
        date,
        dayNumber: currentDay.getDate(),
        inCurrentMonth: currentDay.getMonth() === viewDate.getMonth(),
        isToday: date === this.todayIso,
        isSelected: date === selectedDay,
        schedules: schedulesByDate.get(date) ?? [],
      });
    }

    return days;
  });

  readonly calendarWeeks$$ = computed(() => {
    const calendarDays = this.calendarDays$$();
    const weeks: CalendarDay[][] = [];

    for (let index = 0; index < calendarDays.length; index += 7) {
      weeks.push(calendarDays.slice(index, index + 7));
    }

    return weeks;
  });

  readonly monthAgendaGroups$$ = computed(() =>
    groupSchedulesForMonth(this.viewDate$$(), this.filteredSchedules$$()),
  );

  readonly availabilitySchedules$$ = computed(() => {
    const modalDate = this.modalDate$$();
    if (!modalDate) {
      return [];
    }

    const editingScheduleId = this.editingSchedule$$()?.scheduleId ?? null;
    return (this.schedulesByDate$$().get(modalDate) ?? []).filter(
      (schedule) => schedule.scheduleId !== editingScheduleId,
    );
  });

  readonly availableStartTimes$$ = computed(() =>
    buildAvailableStartTimes(this.availabilitySchedules$$()),
  );

  readonly availableEndTimes$$ = computed(() =>
    buildAvailableEndTimes(this.availabilitySchedules$$(), this.startTime$$()),
  );
  readonly startTimeOptions$$ = computed<ManagerSelectOption[]>(() =>
    this.availableStartTimes$$().map((time) => ({
      value: time,
      label: time,
    })),
  );
  readonly endTimeOptions$$ = computed<ManagerSelectOption[]>(() =>
    this.availableEndTimes$$().map((time) => ({
      value: time,
      label: time,
    })),
  );

  readonly noAvailabilityForDate$$ = computed(
    () =>
      this.isModalOpen$$() &&
      !!this.modalDate$$() &&
      !this.availableStartTimes$$().length,
  );

  readonly showScheduledItemsMenu$$ = computed(() => {
    if (this.isProjectScope$$()) {
      return false;
    }

    if (!this.scheduledItemFocused$$()) {
      return false;
    }

    const query = this.scheduledItemSearchCtrl.value.trim();
    return (
      !!query ||
      this.scheduledItemsLoading$$() ||
      !!this.scheduledItemsError$$()
    );
  });

  private readonly loadRangeEffect = effect(() => {
    const monthStart = startOfMonth(this.viewDate$$());
    const monthEnd = endOfMonth(this.viewDate$$());
    const rangeStart = formatIsoDate(startOfWeek(monthStart));
    const rangeEnd = formatIsoDate(endOfWeek(monthEnd));

    this.store.dispatch(
      ManagerScheduleActions.loadScheduleRange({
        start: rangeStart,
        end: rangeEnd,
        projectId: this.projectScopeId$$(),
      }),
    );
  });

  private readonly modalSyncEffect = effect(() => {
    const modalMode = this.modalMode$$();
    const modalDate = this.selectedDate$$();
    const editingSchedule = this.editingSchedule$$();

    if (!modalMode) {
      if (this.lastPatchedModalKey !== null) {
        this.lastPatchedModalKey = null;
        this.resetFormState();
      }
      return;
    }

    if (modalMode === 'edit' && editingSchedule) {
      const patchKey = `edit:${editingSchedule.scheduleId}:${editingSchedule.updatedAt ?? editingSchedule.date}`;
      if (patchKey === this.lastPatchedModalKey) {
        return;
      }

      this.lastPatchedModalKey = patchKey;
      this.patchFormFromSchedule(editingSchedule);
      return;
    }

    if (modalMode === 'create' && modalDate) {
      const patchKey = `create:${modalDate}`;
      if (patchKey === this.lastPatchedModalKey) {
        return;
      }

      this.lastPatchedModalKey = patchKey;
      this.patchFormForCreate();
    }
  });

  private readonly availabilitySyncEffect = effect(() => {
    this.availableStartTimes$$();
    this.availableEndTimes$$();

    const currentStart = this.startTime$$();
    if (currentStart && !this.availableStartTimes$$().includes(currentStart)) {
      this.scheduleForm.controls.start_time.setValue('');
      this.scheduleForm.controls.end_time.setValue('');
      return;
    }

    const currentEnd = this.endTime$$();
    if (currentEnd && !this.availableEndTimes$$().includes(currentEnd)) {
      this.scheduleForm.controls.end_time.setValue('');
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearToastTimers();
    });

    this.route.queryParamMap
      .pipe(
        map((params) => String(params.get('project_id') || '').trim() || null),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((projectId) => {
        this.projectScopeId$$.set(projectId);
        void this.syncProjectScope(projectId);
      });

    this.scheduledItemSearchCtrl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        if (this.isProjectScope$$()) {
          return;
        }

        if (this.suppressScheduledItemSearchReaction) {
          return;
        }

        const query = value.trim();
        const selectedItem = this.selectedScheduledItem$$();
        const selectedDisplay = selectedItem
          ? buildScheduledItemDisplay(selectedItem)
          : '';

        if (
          selectedItem &&
          query.toLowerCase() !== selectedDisplay.toLowerCase()
        ) {
          this.scheduleForm.controls.scheduled_item_id.setValue('');
          this.selectedScheduledItem$$.set(null);
        }

        if (!query) {
          this.store.dispatch(ManagerScheduleActions.clearScheduledItems());
          return;
        }

        if (
          selectedItem &&
          query.toLowerCase() === selectedDisplay.toLowerCase()
        ) {
          this.store.dispatch(ManagerScheduleActions.clearScheduledItems());
          return;
        }

        this.store.dispatch(
          ManagerScheduleActions.searchScheduledItems({ query }),
        );
      });

    this.scheduleForm.controls.start_time.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((startTime) => {
        if (!startTime) {
          this.scheduleForm.controls.end_time.setValue('');
        }
      });

    this.scheduleForm.controls.date.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dateValue) => {
        if (this.suppressDateChangeReaction) {
          return;
        }

        const normalizedDate = String(dateValue || '').trim() || null;
        if (normalizedDate) {
          this.selectedDay$$.set(normalizedDate);
        }

        if (normalizedDate === this.lastFormDateValue) {
          return;
        }

        const hadPreviousDate = !!this.lastFormDateValue;
        this.lastFormDateValue = normalizedDate;

        if (!hadPreviousDate) {
          return;
        }

        if (
          this.scheduleForm.controls.start_time.value ||
          this.scheduleForm.controls.end_time.value
        ) {
          this.scheduleForm.controls.start_time.setValue('');
          this.scheduleForm.controls.end_time.setValue('');
        }
      });

    this.actions$
      .pipe(
        ofType(
          ManagerScheduleActions.loadScheduleRangeFailure,
          ManagerScheduleActions.saveScheduleFailure,
          ManagerScheduleActions.deleteScheduleFailure,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((action) => {
        this.showToast(action.error);
      });

    this.actions$
      .pipe(
        ofType(ManagerScheduleActions.deleteScheduleSuccess),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.showToast('Booking deleted successfully.');
      });

    this.actions$
      .pipe(
        ofType(ManagerScheduleActions.searchScheduledItemsFailure),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((action) => {
        this.showToast(action.error);
      });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.deleteConfirmSchedule$$()) {
      this.closeDeleteConfirm();
      return;
    }

    if (!this.isModalOpen$$()) {
      return;
    }

    this.closeModal();
  }

  trackByDay = (_: number, day: CalendarDay): string => day.date;

  trackBySchedule = (_: number, schedule: BmSchedule): string =>
    schedule.scheduleId;

  trackByMonth = (_: number, month: { value: string }): string => month.value;

  trackByYear = (_: number, year: { value: string }): string => year.value;

  trackByAgendaGroup = (_: number, group: AgendaGroup): string => group.date;

  trackByScheduledItem = (_: number, item: BmScheduledItem): string =>
    `${item.scheduledItemType}:${item.scheduledItemId}`;

  previousMonth(): void {
    this.setViewDate(addMonths(this.viewDate$$(), -1));
  }

  nextMonth(): void {
    this.setViewDate(addMonths(this.viewDate$$(), 1));
  }

  goToToday(): void {
    this.viewDate$$.set(startOfMonth(new Date()));
    this.selectedDay$$.set(this.todayIso);
  }

  openCreate(date: string, allowDateSelection = true): void {
    this.selectedDay$$.set(date);
    this.isDateEditable$$.set(allowDateSelection);
    this.store.dispatch(ManagerScheduleActions.openScheduleCreate({ date }));
  }

  openCreateFromSelectedDay(): void {
    this.openCreate(this.selectedDay$$(), true);
  }

  openEdit(schedule: BmSchedule, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedDay$$.set(schedule.date);
    this.isDateEditable$$.set(true);
    this.store.dispatch(
      ManagerScheduleActions.openScheduleEdit({
        scheduleId: schedule.scheduleId,
      }),
    );
  }

  closeModal(): void {
    this.store.dispatch(ManagerScheduleActions.closeScheduleModal());
  }

  openDeleteConfirm(schedule: BmSchedule, event?: MouseEvent): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.store.dispatch(
      ManagerScheduleActions.openScheduleDeleteConfirm({
        scheduleId: schedule.scheduleId,
      }),
    );
  }

  closeDeleteConfirm(): void {
    if (this.deleting$$()) {
      return;
    }

    this.store.dispatch(ManagerScheduleActions.closeScheduleDeleteConfirm());
  }

  confirmDeleteSchedule(): void {
    const schedule = this.deleteConfirmSchedule$$();
    if (!schedule?.scheduleId) {
      return;
    }

    this.store.dispatch(
      ManagerScheduleActions.deleteSchedule({
        scheduleId: schedule.scheduleId,
      }),
    );
  }

  finishProjectSchedule(): void {
    const projectId = this.projectScopeId$$();
    if (!projectId) {
      return;
    }

    void this.router.navigate(['/manager/projects'], {
      state: {
        projectScheduleReturn: {
          projectId,
          message: 'Project schedule updated successfully.',
        },
      },
    });
  }

  onDayKeydown(event: KeyboardEvent, date: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.openCreate(date, true);
  }

  onMonthChange(value: string | null): void {
    const month = Number(value);
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      return;
    }

    const currentView = this.viewDate$$();
    this.setViewDate(new Date(currentView.getFullYear(), month, 1));
  }

  onYearChange(value: string | null): void {
    const year = Number(value);
    if (!Number.isInteger(year)) {
      return;
    }

    const currentView = this.viewDate$$();
    this.setViewDate(new Date(year, currentView.getMonth(), 1));
  }

  onScheduledItemFocus(): void {
    if (this.isProjectScope$$()) {
      return;
    }

    this.scheduledItemFocused$$.set(true);
  }

  onScheduledItemBlur(): void {
    if (this.isProjectScope$$()) {
      return;
    }

    window.setTimeout(() => {
      this.scheduledItemFocused$$.set(false);
    }, 120);
  }

  selectScheduledItem(item: BmScheduledItem, event: MouseEvent): void {
    event.preventDefault();
    this.applyScheduledItem(item);
    this.scheduledItemFocused$$.set(false);
    this.store.dispatch(ManagerScheduleActions.clearScheduledItems());
  }

  saveSchedule(): void {
    const formDate = this.scheduleForm.controls.date.value;
    const scheduledItem =
      this.selectedScheduledItem$$() ?? this.projectScopeItem$$();
    const startTime = this.scheduleForm.controls.start_time.value;
    const endTime = this.scheduleForm.controls.end_time.value;
    const description = this.scheduleForm.controls.description.value;

    this.scheduleForm.markAllAsTouched();
    this.scheduledItemSearchCtrl.markAsTouched();

    if (!scheduledItem || !this.scheduleForm.controls.scheduled_item_id.value) {
      this.showToast('Select a scheduled item before saving.');
      return;
    }

    if (!formDate) {
      this.showToast('A schedule date is required.');
      return;
    }

    if (!startTime || !endTime || !stripRichText(description)) {
      this.showToast('Complete all required fields before saving.');
      return;
    }

    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (
      startMinutes === null ||
      endMinutes === null ||
      startMinutes >= endMinutes
    ) {
      this.showToast('Start time must be earlier than end time.');
      return;
    }

    if (!isRangeAvailable(this.availabilitySchedules$$(), startTime, endTime)) {
      this.showToast('The selected time is no longer available.');
      return;
    }

    this.store.dispatch(
      ManagerScheduleActions.saveSchedule({
        payload: {
          scheduled_item_type: scheduledItem.scheduledItemType,
          scheduled_item_id: scheduledItem.scheduledItemId,
          date: formDate,
          start_time: startTime,
          end_time: endTime,
          description,
        },
      }),
    );
  }

  getEventOverflow(day: CalendarDay): number {
    return Math.max(0, day.schedules.length - 3);
  }

  getScheduledItemDisplay(item: BmScheduledItem | BmSchedule): string {
    return buildScheduledItemDisplay(item);
  }

  getScheduleTimeRange(schedule: BmSchedule): string {
    return `${schedule.startTime} - ${schedule.endTime}`;
  }

  getFieldDate(dateIso: string | null): string {
    return formatFieldDate(dateIso);
  }

  getAgendaDateLabel(dateIso: string): string {
    return formatAgendaDate(dateIso);
  }

  getDeleteScheduleMessage(schedule: BmSchedule): string {
    return `Are you sure you want to permanently delete the booking for "${this.getScheduledItemDisplay(schedule)}" on ${this.getFieldDate(schedule.date)} from ${this.getScheduleTimeRange(schedule)}?`;
  }

  private setViewDate(nextDate: Date): void {
    const normalized = startOfMonth(nextDate);
    this.viewDate$$.set(normalized);

    const selectedDay = parseIsoDate(this.selectedDay$$());
    if (
      selectedDay.getFullYear() !== normalized.getFullYear() ||
      selectedDay.getMonth() !== normalized.getMonth()
    ) {
      this.selectedDay$$.set(formatIsoDate(normalized));
    }
  }

  private patchFormForCreate(): void {
    this.suppressDateChangeReaction = true;
    this.scheduleForm.reset({
      scheduled_item_id: '',
      date: this.selectedDate$$() ?? this.selectedDay$$(),
      start_time: '',
      end_time: '',
      description: '',
    });
    this.suppressDateChangeReaction = false;
    this.lastFormDateValue =
      this.scheduleForm.controls.date.value || this.selectedDay$$();
    const projectScopeItem = this.projectScopeItem$$();
    if (projectScopeItem) {
      this.applyScheduledItem(projectScopeItem);
    } else {
      this.selectedScheduledItem$$.set(null);
      this.setScheduledItemSearchValue('');
    }
    this.store.dispatch(ManagerScheduleActions.clearScheduledItems());
  }

  private patchFormFromSchedule(schedule: BmSchedule): void {
    this.suppressDateChangeReaction = true;
    this.scheduleForm.reset({
      scheduled_item_id: schedule.scheduledItemId,
      date: schedule.date,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      description: schedule.description ?? '',
    });
    this.suppressDateChangeReaction = false;
    this.lastFormDateValue = schedule.date;

    this.applyScheduledItem(
      {
        scheduledItemType: schedule.scheduledItemType,
        scheduledItemId: schedule.scheduledItemId,
        scheduledItemLabel: schedule.scheduledItemLabel,
        scheduledItemSecondaryLabel: schedule.scheduledItemSecondaryLabel,
        projectId: schedule.projectId,
      },
      false,
    );
    this.store.dispatch(ManagerScheduleActions.clearScheduledItems());
  }

  private resetFormState(): void {
    this.suppressDateChangeReaction = true;
    this.scheduleForm.reset({
      scheduled_item_id: '',
      date: '',
      start_time: '',
      end_time: '',
      description: '',
    });
    this.suppressDateChangeReaction = false;
    this.lastFormDateValue = null;
    this.selectedScheduledItem$$.set(null);
    this.setScheduledItemSearchValue('');
    this.scheduledItemFocused$$.set(false);
    this.isDateEditable$$.set(false);
  }

  private async syncProjectScope(projectId: string | null): Promise<void> {
    if (!projectId) {
      this.projectScopeLoading$$.set(false);
      this.projectScopeItem$$.set(null);

      if (this.modalMode$$() === 'create') {
        this.selectedScheduledItem$$.set(null);
        this.scheduleForm.controls.scheduled_item_id.setValue('');
        this.setScheduledItemSearchValue('');
      }
      return;
    }

    this.projectScopeLoading$$.set(true);

    try {
      const response = await firstValueFrom(
        this.projectsService.getProject(projectId),
      );
      const project = response?.project;
      if (!project?.projectId) {
        throw new Error('Project not found');
      }

      const projectScopeItem = buildScheduledItemFromProject(project);
      this.projectScopeItem$$.set(projectScopeItem);

      if (this.modalMode$$() === 'create') {
        this.applyScheduledItem(projectScopeItem);
      }
    } catch {
      this.projectScopeItem$$.set(null);
      this.showToast('Unable to load the selected project for scheduling.');
    } finally {
      this.projectScopeLoading$$.set(false);
    }
  }

  private applyScheduledItem(
    item: BmScheduledItem,
    clearSuggestions = true,
  ): void {
    this.selectedScheduledItem$$.set(item);
    this.scheduleForm.controls.scheduled_item_id.setValue(item.scheduledItemId);
    this.setScheduledItemSearchValue(buildScheduledItemDisplay(item));

    if (clearSuggestions) {
      this.store.dispatch(ManagerScheduleActions.clearScheduledItems());
    }
  }

  private setScheduledItemSearchValue(value: string): void {
    this.suppressScheduledItemSearchReaction = true;
    this.scheduledItemSearchCtrl.setValue(value, {
      emitEvent: false,
    });
    this.suppressScheduledItemSearchReaction = false;
  }

  private showToast(message: string): void {
    const nextMessage = String(message || '').trim();
    if (!nextMessage) {
      return;
    }

    this.clearToastTimers();
    this.toastClosing$$.set(false);
    this.toastMessage$$.set(nextMessage);

    this.toastTimer = setTimeout(() => {
      this.toastClosing$$.set(true);
      this.toastCloseTimer = setTimeout(() => {
        this.toastMessage$$.set(null);
        this.toastClosing$$.set(false);
      }, 220);
    }, 3200);
  }

  private clearToastTimers(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    if (this.toastCloseTimer) {
      clearTimeout(this.toastCloseTimer);
      this.toastCloseTimer = null;
    }
  }
}
