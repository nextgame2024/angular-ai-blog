import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';
import {
  ManagerSelectComponent,
  ManagerSelectOption,
} from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { PageJumpComponent } from '../../shared/components/page-jump/page-jump.component';
import { LeadAssistantSettingsPage } from './lead-assistant-settings.page';
import {
  LeadContext,
  LeadConversation,
  LeadDetail,
  LeadEvent,
  LeadInput,
  LeadRow,
  LeadStage,
  LeadWorkspaceService,
} from './lead-workspace.service';
@Component({
  selector: 'app-lead-workspace',
  imports: [
    CommonModule,
    A11yModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ManagerSelectComponent,
    ManagerToastComponent,
    ManagerListLoaderComponent,
    PageJumpComponent,
    LeadAssistantSettingsPage,
  ],
  templateUrl: './lead-workspace.page.html',
  styleUrls: ['./lead-workspace.page.css'],
})
export class LeadWorkspacePage implements OnInit {
  private readonly api = inject(LeadWorkspaceService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild(LeadAssistantSettingsPage)
  settingsPage?: LeadAssistantSettingsPage;
  private activityGeneration = 0;
  private readonly listRequests = new Subject<void>();
  private readonly detailRequests = new Subject<string | null>();
  private afterDiscard: (() => void) | null = null;
  context: LeadContext | null = null;
  contextLoading = false;
  contextError = '';
  view: 'inbox' | 'leads' | 'settings' = 'inbox';
  rows: LeadRow[] = [];
  total = 0;
  page = 1;
  limit = 25;
  sort: 'name' | 'updated' | 'stage' = 'updated';
  direction: 'asc' | 'desc' = 'desc';
  listLoading = false;
  listError = '';
  selected: LeadConversation | null = null;
  selectedId: string | null = null;
  detailLoading = false;
  detailError = '';
  olderLoading = false;
  olderView = false;
  saving = false;
  editor: 'create' | 'edit' | null = null;
  createKey = '';
  noteKey = '';
  invalidFields = new Set<string>();
  toast = '';
  tone: 'success' | 'error' = 'success';
  readonly search = this.fb.nonNullable.control('');
  readonly stageFilter = this.fb.nonNullable.control('');
  readonly ownerFilter = this.fb.nonNullable.control('');
  readonly assignmentFilter = this.fb.nonNullable.control('');
  readonly pageSize = this.fb.nonNullable.control('25');
  readonly note = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(4000),
  ]);
  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.email, Validators.maxLength(320)]],
    phone: ['', [Validators.maxLength(40)]],
    language: ['es'],
    interest: ['', [Validators.maxLength(500)]],
    location: ['', [Validators.maxLength(160)]],
    timeframe: ['', [Validators.maxLength(160)]],
    stage: ['new'],
    stageReason: ['', [Validators.maxLength(1000)]],
    assignedTo: [''],
  });
  readonly stages: ManagerSelectOption[] = [
    { value: 'new', label: 'New' },
    { value: 'qualifying', label: 'Qualifying' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'closed', label: 'Closed' },
  ];
  readonly stageOptions: ManagerSelectOption[] = [
    { value: '', label: 'All stages' },
    ...this.stages,
  ];
  readonly conversationSortOptions: ManagerSelectOption[] = [
    { value: 'updated', label: 'Latest activity' },
    { value: 'name', label: 'Name' },
  ];
  readonly ownershipOptions: ManagerSelectOption[] = [
    { value: '', label: 'All ownership' },
    { value: 'human_requested', label: 'Human requested' },
    { value: 'human', label: 'Human handling' },
    { value: 'paused', label: 'Paused' },
    { value: 'bot', label: 'Sophia handling' },
  ];
  readonly pageSizes: ManagerSelectOption[] = [25, 50, 100].map((n) => ({
    value: String(n),
    label: `${n} per page`,
  }));
  readonly languageLabels: Record<string, string> = {
    es: 'Spanish',
    en: 'English',
    pt: 'Portuguese',
  };
  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }
  get assignmentOptions(): ManagerSelectOption[] {
    return [
      { value: '', label: 'All advisors' },
      ...(this.context?.staff ?? []).map((u) => ({
        value: u.id,
        label: u.name,
      })),
    ];
  }
  get advisorOptions(): ManagerSelectOption[] {
    const options = (this.context?.staff ?? []).map((u) => ({
      value: u.id,
      label: u.name,
    }));
    const current = this.form.controls.assignedTo.value;
    if (current && !options.some((o) => o.value === current))
      options.push({
        value: current,
        label: 'Unavailable advisor — select another',
      });
    return [{ value: '', label: 'Unassigned' }, ...options];
  }
  get languageOptions(): ManagerSelectOption[] {
    const values = [...(this.context?.languages ?? ['es'])];
    const current = this.form.controls.language.value;
    if (!values.includes(current)) values.push(current);
    return values.map((value) => ({
      value,
      label: this.languageLabels[value] ?? value,
    }));
  }
  get hasUnsaved() {
    return (
      !!this.settingsPage?.form.dirty ||
      !!(this.editor && this.form.dirty) ||
      !!this.note.value.trim()
    );
  }
  get confirmingDiscard() {
    return !!this.afterDiscard;
  }
  ngOnInit(): void {
    this.listRequests
      .pipe(
        switchMap(() => {
          this.listLoading = true;
          this.listError = '';
          return this.api
            .list({
              page: this.page,
              limit: this.limit,
              q: this.search.value.trim(),
              stage: this.stageFilter.value,
              ownership: this.ownerFilter.value,
              sort: this.sort,
              direction: this.direction,
              assignedTo: this.assignmentFilter.value,
            })
            .pipe(
              catchError((e) => {
                this.listError = this.message(e);
                this.notify(this.listError, 'error');
                return of(null);
              }),
              finalize(() => (this.listLoading = false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (!result) return;
        this.rows = result.items;
        this.total = result.total;
        if (this.page > this.totalPages) {
          this.page = this.totalPages;
          this.listRequests.next();
        }
      });
    this.detailRequests
      .pipe(
        switchMap((id) => {
          this.selected = null;
          this.detailError = '';
          this.detailLoading = !!id;
          if (!id) return of(null);
          return this.api.detail(id).pipe(
            catchError((e) => {
              this.detailError = this.message(e);
              this.notify(this.detailError, 'error');
              return of(null);
            }),
            finalize(() => (this.detailLoading = false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        if (value) this.applyDetail(value);
      });
    this.search.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.refreshList(true));
    for (const control of [
      this.stageFilter,
      this.ownerFilter,
      this.assignmentFilter,
    ])
      control.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refreshList(true));
    this.pageSize.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.limit = Number(v);
        this.refreshList(true);
      });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const view = params.get('view');
        this.view = view === 'leads' || view === 'settings' ? view : 'inbox';
        if (this.context) {
          if (this.view === 'settings' && !this.context.canManageSettings)
            this.view = 'inbox';
          if (this.view !== 'settings') this.refreshList();
        }
      });
    this.loadContext();
  }
  loadContext(): void {
    if (this.contextLoading) return;
    this.contextLoading = true;
    this.contextError = '';
    this.api
      .context()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.context = value;
          this.contextLoading = false;
          if (this.view === 'settings' && !value.canManageSettings)
            this.view = 'inbox';
          if (this.view !== 'settings') this.refreshList();
        },
        error: (e) => {
          this.contextLoading = false;
          this.contextError = this.message(e);
          this.context = null;
          this.selected = null;
          this.rows = [];
          this.notify(this.contextError, 'error');
        },
      });
  }
  changeView(view: 'inbox' | 'leads' | 'settings'): void {
    if (this.saving || view === this.view) return;
    this.guard(() => {
      this.editor = null;
      this.note.reset('');
      const previous = this.view;
      this.view = view;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { view },
        queryParamsHandling: 'merge',
      });
      if (previous === 'settings') this.loadContext();
    });
  }
  refreshList(reset = false): void {
    if (!this.context || this.contextLoading || this.view === 'settings')
      return;
    if (reset) this.page = 1;
    this.listRequests.next();
  }
  goPage(page: number): void {
    if (this.listLoading || page < 1 || page > this.totalPages) return;
    this.page = page;
    this.refreshList();
  }
  sortThreads(sort: 'name' | 'updated'): void {
    this.sort = sort;
    this.direction = sort === 'name' ? 'asc' : 'desc';
    this.refreshList(true);
  }
  sortBy(sort: 'name' | 'updated' | 'stage'): void {
    this.direction =
      this.sort === sort && this.direction === 'asc' ? 'desc' : 'asc';
    this.sort = sort;
    this.refreshList(true);
  }
  sortAria(sort: string): 'ascending' | 'descending' | 'none' {
    return this.sort === sort
      ? this.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
  }
  openLead(row: LeadRow): void {
    if (this.saving) return;
    this.guard(() => {
      this.editor = null;
      this.note.reset('');
      this.noteKey = '';
      this.selectedId = row.leadId;
      this.olderView = false;
      this.detailRequests.next(row.leadId);
    });
  }
  closeLead(): void {
    if (this.saving) return;
    this.guard(() => {
      this.editor = null;
      this.note.reset('');
      this.noteKey = '';
      this.selectedId = null;
      this.detailRequests.next(null);
    });
  }
  reloadLead(): void {
    if (!this.selectedId || this.saving) return;
    const id = this.selectedId;
    this.guard(() => {
      this.editor = null;
      this.note.reset('');
      this.olderView = false;
      this.detailRequests.next(id);
    });
  }
  newLead(): void {
    if (!this.context?.canCreate || this.saving) return;
    this.guard(() => {
      this.note.reset('');
      this.editor = 'create';
      this.createKey = crypto.randomUUID();
      this.invalidFields.clear();
      this.form.enable({ emitEvent: false });
      this.form.reset({
        displayName: '',
        email: '',
        phone: '',
        language: this.context!.defaultLanguage,
        interest: '',
        location: '',
        timeframe: '',
        stage: 'new',
        stageReason: '',
        assignedTo: this.context!.defaultAssigneeId ?? '',
      });
      if (!this.context!.canManageLeads)
        this.form.controls.assignedTo.disable({ emitEvent: false });
    });
  }
  editLead(): void {
    if (!this.selected || this.saving) return;
    this.editor = 'edit';
    this.invalidFields.clear();
    this.form.enable({ emitEvent: false });
    const l = this.selected.lead;
    this.form.reset({
      displayName: l.displayName,
      email: l.email,
      phone: l.phone,
      language: l.language,
      interest: l.interest,
      location: l.location,
      timeframe: l.timeframe,
      stage: l.stage,
      stageReason: l.stageReason,
      assignedTo: l.assignedTo ?? '',
    });
    if (!this.context?.canManageLeads)
      this.form.controls.assignedTo.disable({ emitEvent: false });
  }
  closeEditor(): void {
    if (this.saving) return;
    if (this.form.dirty) this.guard(() => (this.editor = null));
    else this.editor = null;
  }
  saveLead(): void {
    if (!this.editor || !this.context || this.saving) return;
    this.invalidFields.clear();
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (
      this.form.invalid ||
      !v.displayName.trim() ||
      (['qualified', 'closed'].includes(v.stage) && !v.stageReason.trim())
    ) {
      if (!v.stageReason.trim() && ['qualified', 'closed'].includes(v.stage))
        this.invalidFields.add('stageReason');
      if (!v.displayName.trim()) this.invalidFields.add('displayName');
      this.notify('Complete the highlighted fields.', 'error');
      return;
    }
    const lead = {
      ...v,
      stage: v.stage as LeadStage,
      assignedTo: v.assignedTo || null,
    };
    const mode = this.editor;
    const request =
      mode === 'create'
        ? this.api.create(this.createKey, lead)
        : this.api.update(this.selectedId!, this.selected!.lead.version, lead);
    this.saving = true;
    this.form.disable({ emitEvent: false });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.saving = false;
        this.editor = null;
        this.form.markAsPristine();
        this.applyDetail(value);
        this.refreshList();
        this.notify(mode === 'create' ? 'Lead created.' : 'Lead updated.');
      },
      error: (e) => {
        this.saving = false;
        this.form.enable({ emitEvent: false });
        if (!this.context?.canManageLeads)
          this.form.controls.assignedTo.disable({ emitEvent: false });
        this.invalidFields = new Set(this.fields(e));
        this.notify(this.message(e), 'error');
      },
    });
  }
  addNote(): void {
    if (!this.selected || this.saving) return;
    this.note.markAsTouched();
    if (this.note.invalid) {
      this.notify('Enter an internal note of up to 4,000 characters.', 'error');
      return;
    }
    this.noteKey ||= crypto.randomUUID();
    this.saving = true;
    this.note.disable({ emitEvent: false });
    this.api
      .note(this.selectedId!, this.noteKey, this.note.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.saving = false;
          this.note.enable({ emitEvent: false });
          this.note.reset('');
          this.noteKey = '';
          this.applyDetail(value);
          this.refreshList();
          this.notify('Internal note added.');
        },
        error: (e) => {
          this.saving = false;
          this.note.enable({ emitEvent: false });
          this.notify(this.message(e), 'error');
        },
      });
  }
  ownership(ownership: 'human' | 'paused'): void {
    if (!this.selected || this.saving) return;
    this.saving = true;
    this.api
      .ownership(
        this.selectedId!,
        this.selected.lead.ownershipVersion,
        ownership,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.saving = false;
          this.applyDetail(value);
          this.refreshList();
          this.notify(
            ownership === 'human'
              ? 'You are handling this conversation.'
              : 'Conversation paused.',
          );
        },
        error: (e) => {
          this.saving = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  olderEvents(): void {
    if (!this.selected?.hasOlder || this.olderLoading) return;
    const generation = this.activityGeneration;
    const id = this.selectedId!,
      before = this.selected.events[0]?.id;
    if (!before) return;
    this.olderLoading = true;
    this.api
      .events(id, before)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => {
          this.olderLoading = false;
          if (
            this.selectedId !== id ||
            !this.selected ||
            this.activityGeneration !== generation
          )
            return;
          this.selected = { ...this.selected, ...value };
          this.olderView = true;
        },
        error: (e) => {
          this.olderLoading = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  staffName(id: string | null): string {
    return id
      ? (this.context?.staff.find((u) => u.id === id)?.name ??
          'Previous team member')
      : 'Unassigned';
  }
  stageLabel(stage: string): string {
    return this.stages.find((s) => s.value === stage)?.label ?? stage;
  }
  ownershipLabel(value: string): string {
    return (
      (
        {
          paused: 'Paused',
          human: 'Human handling',
          human_requested: 'Human requested',
          bot: 'Sophia handling',
        } as Record<string, string>
      )[value] ?? value
    );
  }
  eventLabel(kind: string): string {
    return (
      (
        {
          note: 'Internal note',
          lead_created: 'Lead created',
          lead_updated: 'Lead updated',
          assignment_changed: 'Assignment changed',
          ownership_changed: 'Conversation ownership changed',
          inbound_message: 'Customer message',
          outbound_message: 'Outbound message',
        } as Record<string, string>
      )[kind] ?? 'Activity'
    );
  }
  eventSummary(event: LeadEvent): string {
    if (event.kind === 'lead_created') return 'Manually entered enquiry.';
    if (event.kind === 'assignment_changed')
      return 'Advisor assignment changed; the conversation was paused.';
    if (event.kind === 'ownership_changed')
      return (
        'Ownership: ' +
        this.ownershipLabel(String(event.metadata['ownership'] ?? ''))
      );
    if (event.kind === 'lead_updated') {
      const labels: Record<string, string> = {
        displayName: 'name',
        email: 'email',
        phone: 'phone',
        language: 'language',
        interest: 'interest',
        location: 'location',
        timeframe: 'timeframe',
        stage: 'stage',
        stageReason: 'stage reason',
        assignedTo: 'advisor',
      };
      const fields = event.metadata['changedFields'];
      return Array.isArray(fields) && fields.length
        ? 'Updated: ' +
            fields
              .filter((v): v is string => typeof v === 'string' && !!labels[v])
              .map((v) => labels[v])
              .join(', ')
        : 'Lead details reviewed.';
    }
    return '';
  }
  invalid(field: string): boolean {
    const c = this.form.get(field);
    return this.invalidFields.has(field) || !!(c?.touched && c.invalid);
  }
  private applyDetail(value: LeadConversation): void {
    this.activityGeneration++;
    this.selected = value;
    this.selectedId = value.lead.leadId;
    this.olderView = false;
  }
  private guard(action: () => void): void {
    if (this.hasUnsaved) {
      this.afterDiscard = action;
      return;
    }
    action();
  }
  discard(): void {
    const action = this.afterDiscard;
    this.afterDiscard = null;
    this.editor = null;
    this.form.markAsPristine();
    this.note.reset('');
    this.noteKey = '';
    action?.();
  }
  keepEditing(): void {
    this.afterDiscard = null;
  }
  @HostListener('document:keydown.escape') escape(): void {
    if (this.confirmingDiscard) {
      this.keepEditing();
      return;
    }
    if (this.editor) this.closeEditor();
  }
  private fields(e: unknown): string[] {
    const value = (e as { error?: { fields?: unknown } })?.error?.fields;
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string')
      : [];
  }
  private message(e: unknown): string {
    const v = (e as { error?: { error?: unknown } })?.error?.error;
    return typeof v === 'string'
      ? v
      : 'The request could not be completed. Try again.';
  }
  notify(message: string, tone: 'success' | 'error' = 'success'): void {
    this.toast = message;
    this.tone = tone;
  }
}
