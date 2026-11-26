import { LeadFormCalendarComponent } from './lead-form-calendar.component';
import {
  LeadFormCalendarEditorComponent,
  validFormCalendar,
} from './lead-form-calendar-editor.component';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import {
  Component,
  DestroyRef,
  HostListener,
  Input,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import {
  ManagerSelectComponent,
  ManagerSelectOption,
} from '../components/shared/manager-select/manager-select.component';
import { ManagerToastComponent } from '../components/shared/manager-toast/manager-toast.component';
import { ManagerListLoaderComponent } from '../components/shared/manager-list-loader/manager-list-loader.component';
import { ManagerRichTextEditorComponent } from '../components/shared/manager-rich-text-editor/manager-rich-text-editor.component';
import { PageJumpComponent } from '../../shared/components/page-jump/page-jump.component';
import {
  BlockKind,
  FormBlock,
  FormRow,
  FormType,
  LeadForm,
  LeadFormsService,
} from './lead-forms.service';
@Component({
  selector: 'app-lead-forms',
  imports: [
    CommonModule,
    A11yModule,
    FormsModule,
    ManagerSelectComponent,
    ManagerToastComponent,
    ManagerListLoaderComponent,
    ManagerRichTextEditorComponent,
    PageJumpComponent,
    LeadFormCalendarEditorComponent,
    LeadFormCalendarComponent,
  ],
  templateUrl: './lead-forms.component.html',
  styleUrls: ['./lead-workspace.page.css', './lead-forms.component.css'],
})
export class LeadFormsComponent implements OnInit {
  @Input() canManage = false;
  private api = inject(LeadFormsService);
  private destroyRef = inject(DestroyRef);
  private requests = new Subject<void>();
  private searches = new Subject<void>();
  rows: FormRow[] = [];
  types: FormType[] = [];
  typeOptions: ManagerSelectOption[] = [];
  filterOptions: ManagerSelectOption[] = [];
  loading = false;
  busy = false;
  error = '';
  typesReady = false;
  page = 1;
  limit = 25;
  total = 0;
  q = '';
  typeId = '';
  sort = 'updated';
  direction = 'desc';
  editor: LeadForm | null = null;
  dirty = false;
  preview = false;
  attempted = false;
  typesOpen = false;
  typeName = '';
  typeAttempted = false;
  confirmation: { message: string; action: () => void } | null = null;
  publicUrl = '';
  toast = '';
  tone: 'success' | 'error' = 'success';
  readonly pageSizes = [25, 50, 100].map((n) => ({
    value: String(n),
    label: `${n} per page`,
  }));
  readonly blockButtons: { kind: BlockKind; label: string }[] = [
    { kind: 'title', label: 'Add title' },
    { kind: 'subtitle', label: 'Add subtitle' },
    { kind: 'question', label: 'Add question' },
    { kind: 'description', label: 'Add description' },
    { kind: 'list', label: 'Add list' },
    { kind: 'input', label: 'Add input' },
    { kind: 'checkboxes', label: 'Add checkboxes' },
    { kind: 'calendar', label: 'Add calendar' },
  ];
  readonly answerTypes: ManagerSelectOption[] = [
    { value: 'input', label: 'Input' },
    { value: 'richtext', label: 'Description (rich text)' },
    { value: 'list', label: 'List (dropdown)' },
    { value: 'checkboxes', label: 'Checkboxes' },
  ];
  // Keep the existing storage contract while editing question/answer pairs as one unit.
  get blockGroups() {
    const blocks = this.editor?.blocks ?? [];
    const groups: {
      block: FormBlock;
      index: number;
      answer: FormBlock | null;
    }[] = [];
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      const answer =
        block.kind === 'question' && this.isAnswer(blocks[index + 1])
          ? blocks[index + 1]
          : null;
      groups.push({ block, index, answer });
      if (answer) index++;
    }
    return groups;
  }
  private isAnswer(block?: FormBlock) {
    return (
      !!block &&
      ['input', 'list', 'checkboxes', 'richtext'].includes(block.kind)
    );
  }
  canAdd(kind: BlockKind) {
    return (
      !this.busy &&
      !!this.editor &&
      (kind !== 'calendar' ||
        !this.editor.blocks.some((b) => b.kind === 'calendar')) &&
      this.editor.blocks.length + (kind === 'question' ? 2 : 1) <= 100
    );
  }
  changeAnswer(index: number, kind: string) {
    if (
      this.busy ||
      !this.editor ||
      this.editor.blocks[index]?.kind !== 'question' ||
      !['input', 'list', 'checkboxes', 'richtext'].includes(kind)
    )
      return;
    let answer = this.editor.blocks[index + 1];
    if (!this.isAnswer(answer)) {
      if (this.editor.blocks.length >= 100) return;
      answer = {
        id: crypto.randomUUID(),
        kind: 'input',
        text: '',
        required: false,
        options: [],
      };
      this.editor.blocks.splice(index + 1, 0, answer);
    }
    answer.kind = kind as BlockKind;
    answer.options = ['input', 'richtext'].includes(kind)
      ? []
      : answer.options.length
        ? answer.options
        : [''];
    this.dirty = true;
  }
  get totalPages() {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }
  get hasUnsaved() {
    return this.dirty || !!this.typeName.trim();
  }
  ngOnInit() {
    this.requests
      .pipe(
        switchMap(() => {
          this.loading = true;
          this.error = '';
          return this.api
            .list({
              page: this.page,
              limit: this.limit,
              q: this.q.trim(),
              typeId: this.typeId,
              sort: this.sort,
              direction: this.direction,
            })
            .pipe(
              catchError((e) => {
                this.error = this.message(e);
                this.notify(this.error, 'error');
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading = false;
        if (result) {
          this.rows = result.items;
          this.total = result.total;
          if (this.page > this.totalPages) {
            this.page = this.totalPages;
            this.refresh();
          }
        }
      });
    this.searches
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh(true));
    this.loadTypes();
    this.refresh();
  }
  loadTypes() {
    this.api
      .types()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.types = r.items;
          this.typesReady = true;
          this.typeOptions = r.items.map((t) => ({
            value: t.id,
            label: t.name,
          }));
          this.filterOptions = [
            { value: '', label: 'All types' },
            ...this.typeOptions,
          ];
        },
        error: (e) => {
          this.typesReady = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  refresh(reset = false) {
    if (reset) this.page = 1;
    this.requests.next();
  }
  search() {
    this.searches.next();
  }
  goPage(page: number) {
    if (!this.loading && page >= 1 && page <= this.totalPages) {
      this.page = page;
      this.refresh();
    }
  }
  sortBy(key: string) {
    this.direction =
      this.sort === key && this.direction === 'asc' ? 'desc' : 'asc';
    this.sort = key;
    this.refresh(true);
  }
  sortAria(key: string): 'ascending' | 'descending' | 'none' {
    return this.sort !== key
      ? 'none'
      : this.direction === 'asc'
        ? 'ascending'
        : 'descending';
  }
  create() {
    if (!this.canManage || this.busy) return;
    this.publicUrl = '';
    this.editor = {
      id: crypto.randomUUID(),
      name: '',
      typeId: '',
      blocks: [],
      version: 0,
    };
    this.dirty = false;
    this.preview = false;
    this.attempted = false;
  }
  open(row: FormRow, preview = false) {
    if (this.busy) return;
    this.busy = true;
    this.api
      .detail(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.editor = r;
          this.publicUrl = '';
          this.api
            .publication(r.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (p) =>
                (this.publicUrl = p.token
                  ? p.friendlyUrl || window.location.origin + '/forms/' + p.token
                  : ''),
              error: () => {},
            });
          this.preview = preview || !this.canManage;
          this.dirty = false;
          this.attempted = false;
          this.busy = false;
        },
        error: (e) => {
          this.busy = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  publicationUrl(row: FormRow) {
    return row.publicationToken
      ? row.friendlyUrl || window.location.origin + '/forms/' + row.publicationToken
      : '';
  }
  async copyFriendlyUrl(row: FormRow) {
    if (!row.publicationToken || !row.friendlyUrl) return;
    try {
      await navigator.clipboard.writeText(row.friendlyUrl);
      this.notify('Friendly URL copied.');
    } catch {
      this.notify('Could not copy the link. Select the URL and copy it manually.', 'error');
    }
  }
  publishRow(row: FormRow) {
    if (this.busy || !this.canManage) return;
    this.busy = true;
    this.api
      .publish(row)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.busy = false;
          row.publicationToken = p.token;
          row.publishedVersion = row.version;
          this.notify('Form published. Use the website icon to open it.');
          this.refresh();
        },
        error: (e) => {
          this.busy = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  unpublishRow(row: FormRow) {
    if (this.busy || !this.canManage) return;
    this.confirmation = {
      message:
        'Unpublish “' +
        row.name +
        '”? Its public link will stop accepting responses.',
      action: () => {
        this.busy = true;
        this.api
          .unpublish(row.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.busy = false;
              row.publicationToken = null;
              row.friendlyUrl = null;
              row.publishedVersion = null;
              this.notify('Form unpublished.');
            },
            error: (e) => {
              this.busy = false;
              this.notify(this.message(e), 'error');
            },
          });
      },
    };
  }
  publish() {
    if (
      !this.editor ||
      this.busy ||
      this.dirty ||
      !this.canManage ||
      !this.editor.version
    )
      return;
    this.busy = true;
    this.api
      .publish(this.editor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.busy = false;
          this.publicUrl = p.friendlyUrl || window.location.origin + '/forms/' + p.token;
          this.notify('Form published. Share the public link.');
        },
        error: (e) => {
          this.busy = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  unpublish() {
    if (!this.editor || this.busy) return;
    this.busy = true;
    this.api
      .unpublish(this.editor.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy = false;
          this.publicUrl = '';
          this.notify('Public form unpublished.');
        },
        error: (e) => {
          this.busy = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  reset() {
    this.editor = null;
    this.publicUrl = '';
    this.dirty = false;
    this.typeName = '';
    this.typesOpen = false;
  }
  closeEditor() {
    if (this.busy) return;
    if (this.dirty)
      this.confirmation = {
        message: 'Discard unsaved form changes?',
        action: () => this.reset(),
      };
    else this.editor = null;
  }
  add(kind: BlockKind) {
    if (!this.editor || !this.canAdd(kind)) return;
    this.editor.blocks.push({
      id: crypto.randomUUID(),
      kind,
      text: '',
      required: false,
      options: ['list', 'checkboxes'].includes(kind) ? [''] : [],
      ...(kind === 'calendar'
        ? {
            calendar: {
              advisorId: '',
              timezone: 'Australia/Brisbane',
              weeklyHours: [{ day: 1, start: '08:00', end: '17:00' }],
            },
          }
        : {}),
    });
    if (kind === 'question')
      this.changeAnswer(this.editor.blocks.length - 1, 'input');
    this.dirty = true;
  }
  move(index: number, delta: number) {
    if (this.busy || !this.editor) return;
    const groups = this.blockGroups;
    const current = groups.findIndex((group) => group.index === index);
    const target = current + delta;
    if (current < 0 || target < 0 || target >= groups.length) return;
    [groups[current], groups[target]] = [groups[target], groups[current]];
    this.editor.blocks = groups.flatMap((group) =>
      group.answer ? [group.block, group.answer] : [group.block],
    );
    this.dirty = true;
  }
  remove(index: number) {
    if (this.busy) return;
    const group = this.blockGroups.find((group) => group.index === index);
    if (!group) return;
    this.editor?.blocks.splice(index, group.answer ? 2 : 1);
    this.dirty = true;
  }
  blockInvalid(b: FormBlock, index: number) {
    if (!this.attempted) return false;
    if (b.kind === 'calendar') return !validFormCalendar(b.calendar);
    if (
      b.kind === 'question' &&
      !['input', 'list', 'checkboxes', 'richtext'].includes(
        this.editor?.blocks[index + 1]?.kind ?? '',
      )
    )
      return true;
    if (['list', 'checkboxes'].includes(b.kind))
      return (
        !b.options.length ||
        b.options.some((x) => !x.trim()) ||
        new Set(b.options.map((x) => x.trim().toLowerCase())).size !==
          b.options.length
      );
    return (
      !['input', 'richtext'].includes(b.kind) &&
      !b.text
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
    );
  }
  validEmails() {
    const emails = (this.editor?.emails || '').split(',').map((e) => e.trim());
    return (
      emails.length <= 10 &&
      emails.every(
        (e) => e.length <= 254 && /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(e),
      )
    );
  }
  save() {
    if (!this.editor || this.busy || !this.canManage) return;
    this.attempted = true;
    if (
      !this.editor.name.trim() ||
      !this.editor.typeId ||
      !this.validEmails() ||
      !this.editor.blocks.length ||
      this.editor.blocks.some((b, i) => this.blockInvalid(b, i))
    ) {
      this.preview = false;
      this.notify(
        'Complete the highlighted fields and add distinct options for each list or checkbox answer.',
        'error',
      );
      return;
    }
    this.busy = true;
    this.api
      .save(this.editor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy = false;
          this.reset();
          this.refresh();
          this.loadTypes();
          this.notify('Form saved.');
        },
        error: (e) => {
          this.busy = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  delete(row: FormRow) {
    this.confirmation = {
      message: `Delete “${row.name}”? This cannot be undone.`,
      action: () => {
        this.busy = true;
        this.api
          .delete(row)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.busy = false;
              this.refresh();
              this.loadTypes();
              this.notify('Form deleted.');
            },
            error: (e) => {
              this.busy = false;
              this.notify(this.message(e), 'error');
            },
          });
      },
    };
  }
  createType() {
    this.typeAttempted = true;
    if (!this.typeName.trim() || this.busy) return;
    this.busy = true;
    this.api
      .createType(this.typeName.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy = false;
          this.typeName = '';
          this.typeAttempted = false;
          this.loadTypes();
          this.notify('Type created.');
        },
        error: (e) => {
          this.busy = false;
          this.notify(this.message(e), 'error');
        },
      });
  }
  deleteType(type: FormType) {
    this.confirmation = {
      message: `Delete the “${type.name}” type?`,
      action: () => {
        this.busy = true;
        this.api
          .deleteType(type.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.busy = false;
              if (this.typeId === type.id) {
                this.typeId = '';
                this.refresh(true);
              }
              if (this.editor?.typeId === type.id) {
                this.editor.typeId = '';
                this.dirty = true;
              }
              this.loadTypes();
              this.notify('Type deleted.');
            },
            error: (e) => {
              this.busy = false;
              this.notify(this.message(e), 'error');
            },
          });
      },
    };
  }
  closeTypes() {
    if (this.busy) return;
    if (this.typeName.trim())
      this.confirmation = {
        message: 'Discard the unsaved type name?',
        action: () => {
          this.typeName = '';
          this.typesOpen = false;
        },
      };
    else this.typesOpen = false;
  }
  confirm() {
    const c = this.confirmation;
    this.confirmation = null;
    c?.action();
  }
  options(b: FormBlock) {
    return b.options.map((label, i) => ({ label, value: String(i) }));
  }
  question(index: number) {
    const previous = this.editor?.blocks[index - 1];
    return previous?.kind === 'question' ? previous : null;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(
    e: BeforeUnloadEvent,
  ) {
    if (this.hasUnsaved) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
  @HostListener('document:keydown.escape') escape() {
    if (this.confirmation) this.confirmation = null;
    else if (this.typesOpen) this.closeTypes();
    else if (this.editor) this.closeEditor();
  }
  notify(message: string, tone: 'success' | 'error' = 'success') {
    this.toast = message;
    this.tone = tone;
  }
  private message(e: unknown) {
    const v = (e as { error?: { error?: unknown } })?.error?.error;
    return typeof v === 'string'
      ? v
      : 'The request could not be completed. Try again.';
  }
}
