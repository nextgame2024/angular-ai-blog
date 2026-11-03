import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  Input,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
} from 'rxjs';
import {
  ManagerSelectComponent,
  ManagerSelectOption,
} from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import {
  AssistantSettings,
  LeadAssistantSettingsService,
  SettingsState,
  StaffOption,
} from './lead-assistant-settings.service';

@Component({
  selector: 'app-lead-assistant-settings',
  imports: [
    A11yModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ManagerSelectComponent,
    ManagerToastComponent,
    ManagerListLoaderComponent,
  ],
  templateUrl: './lead-assistant-settings.page.html',
  styleUrls: ['./lead-assistant-settings.page.css'],
})
export class LeadAssistantSettingsPage implements OnInit {
  @Input() embedded = false;
  private readonly api = inject(LeadAssistantSettingsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.maxLength(160)]],
    contactName: ['', [Validators.maxLength(160)]],
    supportContact: ['', [Validators.maxLength(320)]],
    enquiryOwnerId: [''],
    contentOwnerId: [''],
    fallbackOwnerId: [''],
    timezone: ['Australia/Brisbane'],
    afterHoursMessage: ['', [Validators.maxLength(1000)]],
    greeting: ['', [Validators.maxLength(2000)]],
    defaultLanguage: ['es'],
    appointmentBookingEnabled: [false],
    coverage: this.fb.array<
      ReturnType<LeadAssistantSettingsPage['windowForm']>
    >([]),
  });
  readonly teamSearch = this.fb.nonNullable.control('');
  readonly advisorChoice = this.fb.nonNullable.control('');
  readonly closedDate = this.fb.nonNullable.control('');
  readonly days: ManagerSelectOption[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ].map((label, i) => ({ value: String(i), label }));
  readonly languages: ManagerSelectOption[] = [
    { value: 'es', label: 'Spanish' },
    { value: 'en', label: 'English' },
    { value: 'pt', label: 'Portuguese' },
  ];
  state: SettingsState | null = null;
  loading = false;
  saving = false;
  loadError = '';
  confirmReload = false;
  toast = '';
  tone: 'success' | 'error' = 'success';
  staff: StaffOption[] = [];
  private knownStaff = new Map<string, StaffOption>();
  hasMoreStaff = false;
  staffSearching = false;
  advisorIds: string[] = [];
  closedDates: string[] = [];
  selectedLanguages = ['es'];
  invalidFields = new Set<string>();
  get coverage() {
    return this.form.controls.coverage;
  }
  get staffOptions(): ManagerSelectOption[] {
    const chosen = [
      this.form.controls.enquiryOwnerId.value,
      this.form.controls.contentOwnerId.value,
      this.form.controls.fallbackOwnerId.value,
      ...this.advisorIds,
    ];
    const items = new Map(this.staff.map((u) => [u.id, u]));
    chosen.filter(Boolean).forEach((id) =>
      items.set(
        id,
        this.knownStaff.get(id) ?? {
          id,
          name: 'Unavailable team member — select another',
        },
      ),
    );
    return [...items.values()].map((u) => ({ value: u.id, label: u.name }));
  }
  get defaultLanguageOptions() {
    return this.languages.filter((l) =>
      this.selectedLanguages.includes(l.value),
    );
  }
  ngOnInit(): void {
    this.load();
    this.teamSearch.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          this.staffSearching = true;
          return this.api.staff(q.trim()).pipe(
            catchError(() => {
              this.notify(
                'Team search could not complete. Try again.',
                'error',
              );
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.staffSearching = false;
        if (!result) return;
        this.staff = result.staff;
        this.hasMoreStaff = result.hasMore;
        result.staff.forEach((u) => this.knownStaff.set(u.id, u));
      });
  }
  reload(): void {
    if (this.form.dirty) {
      this.confirmReload = true;
      return;
    }
    this.load();
  }
  discardAndReload(): void {
    this.confirmReload = false;
    this.load();
  }
  @HostListener('document:keydown.escape') closeReload(): void {
    this.confirmReload = false;
  }
  load(): void {
    if (this.loading || this.saving) return;
    this.loading = true;
    this.setControlsDisabled(true);
    this.loadError = '';
    this.api
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.loading = false;
          this.setControlsDisabled(false);
          this.staff = state.staff ?? [];
          this.knownStaff = new Map(this.staff.map((u) => [u.id, u]));
          this.hasMoreStaff = state.hasMoreStaff ?? false;
          this.apply(state);
        },
        error: (e) => {
          this.loading = false;
          this.setControlsDisabled(false);
          this.loadError = this.errorMessage(e);
          this.notify(this.loadError, 'error');
        },
      });
  }
  private windowForm(day = '1', start = '09:00', end = '17:00') {
    return this.fb.nonNullable.group({
      day: [day],
      start: [start, Validators.required],
      end: [end, Validators.required],
    });
  }
  addWindow(): void {
    if (this.coverage.length >= 28) return;
    this.coverage.push(this.windowForm());
    this.form.markAsDirty();
  }
  removeWindow(i: number): void {
    this.coverage.removeAt(i);
    this.form.markAsDirty();
  }
  addAdvisor(): void {
    const id = this.advisorChoice.value;
    if (!id || this.advisorIds.includes(id) || this.advisorIds.length >= 50)
      return;
    this.advisorIds = [...this.advisorIds, id];
    this.advisorChoice.setValue('');
    this.form.markAsDirty();
  }
  removeAdvisor(id: string): void {
    this.advisorIds = this.advisorIds.filter((v) => v !== id);
    this.form.markAsDirty();
  }
  staffName(id: string): string {
    return this.knownStaff.get(id)?.name ?? 'Unavailable team member';
  }
  addClosedDate(): void {
    const value = this.closedDate.value;
    if (
      !value ||
      this.closedDates.includes(value) ||
      this.closedDates.length >= 100
    )
      return;
    this.closedDates = [...this.closedDates, value].sort();
    this.closedDate.setValue('');
    this.form.markAsDirty();
  }
  removeClosedDate(value: string): void {
    this.closedDates = this.closedDates.filter((v) => v !== value);
    this.form.markAsDirty();
  }
  toggleLanguage(value: string, checked: boolean): void {
    if (!checked && this.selectedLanguages.length === 1) {
      this.notify('Keep at least one language.', 'error');
      return;
    }
    this.selectedLanguages = checked
      ? [...new Set([...this.selectedLanguages, value])]
      : this.selectedLanguages.filter((v) => v !== value);
    if (
      !this.selectedLanguages.includes(this.form.controls.defaultLanguage.value)
    )
      this.form.controls.defaultLanguage.setValue(this.selectedLanguages[0]);
    this.form.markAsDirty();
  }
  configuration(): AssistantSettings {
    const v = this.form.getRawValue();
    return {
      ...v,
      enquiryOwnerId: v.enquiryOwnerId || null,
      contentOwnerId: v.contentOwnerId || null,
      fallbackOwnerId: v.fallbackOwnerId || null,
      coverage: v.coverage.map((w) => ({ ...w, day: Number(w.day) })),
      advisorIds: [...this.advisorIds],
      closedDates: [...this.closedDates],
      languages: [...this.selectedLanguages],
    };
  }
  save(): void {
    if (!this.state || this.saving) return;
    this.invalidFields.clear();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.notify('Check the highlighted fields before saving.', 'error');
      return;
    }
    this.saving = true;
    this.setControlsDisabled(true);
    this.api
      .save(this.state.revision, this.configuration())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.saving = false;
          this.setControlsDisabled(false);
          this.apply(state);
          this.notify('Draft saved.');
        },
        error: (e) => this.failed(e),
      });
  }
  publish(): void {
    if (!this.state || this.saving) return;
    if (this.form.dirty || !this.state.revision) {
      this.notify('Save the draft before publishing.', 'error');
      return;
    }
    this.form.markAllAsTouched();
    this.saving = true;
    this.setControlsDisabled(true);
    this.api
      .publish(this.state.revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.saving = false;
          this.setControlsDisabled(false);
          this.apply(state);
          this.notify('Settings published. WhatsApp setup is still pending.');
        },
        error: (e) => this.failed(e),
      });
  }
  invalid(name: string): boolean {
    const control = this.form.get(name);
    return (
      this.invalidFields.has(name) || !!(control?.touched && control.invalid)
    );
  }
  private apply(state: SettingsState): void {
    this.state = state;
    const c = state.configuration;
    const { coverage, advisorIds, closedDates, languages, ...rest } = c;
    this.coverage.clear();
    coverage.forEach((w) =>
      this.coverage.push(this.windowForm(String(w.day), w.start, w.end)),
    );
    this.form.patchValue({
      ...rest,
      enquiryOwnerId: c.enquiryOwnerId ?? '',
      contentOwnerId: c.contentOwnerId ?? '',
      fallbackOwnerId: c.fallbackOwnerId ?? '',
    });
    this.advisorIds = [...advisorIds];
    this.closedDates = [...closedDates];
    this.selectedLanguages = [...languages];
    this.invalidFields.clear();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
  private setControlsDisabled(disabled: boolean): void {
    for (const control of [
      this.form,
      this.advisorChoice,
      this.closedDate,
      this.teamSearch,
    ]) {
      if (disabled) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    }
  }
  private failed(e: unknown): void {
    this.saving = false;
    this.setControlsDisabled(false);
    const error = e as { error?: { fields?: unknown } };
    const fields = error.error?.fields;
    this.invalidFields = new Set(
      Array.isArray(fields)
        ? fields.filter((v): v is string => typeof v === 'string')
        : [],
    );
    this.notify(this.errorMessage(e), 'error');
  }
  private errorMessage(e: unknown): string {
    const value = (e as { error?: { error?: unknown } })?.error?.error;
    return typeof value === 'string'
      ? value
      : 'Settings could not be loaded or saved. Try again.';
  }
  notify(message: string, tone: 'success' | 'error' = 'success'): void {
    this.toast = message;
    this.tone = tone;
  }
}
