import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type {
  ConversationContent, ConversationDetail, ConversationExportJob, ConversationSummary, SophiaAdminPrincipal,
} from '../sophia-admin.types';

@Component({
  selector: 'app-conversations-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './conversations-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class ConversationsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly conversations = signal<ConversationSummary[]>([]);
  readonly selected = signal<ConversationDetail | null>(null); readonly content = signal<ConversationContent | null>(null);
  readonly exports = signal<ConversationExportJob[]>([]); readonly hasMore = signal(false);
  readonly nextCursor = signal<{ before: string; beforeId: string } | null>(null);
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly filters = new FormGroup({
    from: new FormControl('', { nonNullable: true }), to: new FormControl('', { nonNullable: true }),
    agentId: new FormControl('', { nonNullable: true }), agentReleaseId: new FormControl('', { nonNullable: true }),
    channel: new FormControl('', { nonNullable: true }), outcome: new FormControl('', { nonNullable: true }),
    escalationStatus: new FormControl('', { nonNullable: true }),
  });
  readonly noteForm = new FormGroup({
    note: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(4000)] }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
  }

  refresh(cursor?: { before: string; beforeId: string }): void {
    const tenant = this.principal()?.tenantId; if (!tenant) return; this.loading.set(true);
    forkJoin({
      conversations: this.admin.conversations(tenant, { ...this.filterValues(), limit: 50, ...cursor }),
      exports: this.can('conversations.export') ? this.admin.conversationExports(tenant) : of({ exports: [] }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.conversations.set(cursor ? [...this.conversations(), ...result.conversations.conversations]
          : result.conversations.conversations);
        this.hasMore.set(result.conversations.hasMore); this.nextCursor.set(result.conversations.nextCursor ?? null);
        this.exports.set(result.exports.exports); this.loading.set(false); this.busy.set(false);
      }, error: (error) => this.fail(error),
    });
  }

  applyFilters(): void { this.selected.set(null); this.content.set(null); this.refresh(); }
  clearFilters(): void {
    this.filters.reset({ from: '', to: '', agentId: '', agentReleaseId: '', channel: '', outcome: '', escalationStatus: '' });
    this.applyFilters();
  }
  inspect(item: ConversationSummary): void {
    if (this.busy()) return; this.start(); this.content.set(null);
    this.admin.conversation(this.tenant(), item.session_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => { this.selected.set(detail); this.busy.set(false); }, error: (error) => this.fail(error),
    });
  }
  loadContent(): void {
    const sessionId = this.selected()?.session.session_id;
    if (!sessionId || !this.can('conversations.read_content') || this.busy()) return; this.start();
    this.admin.conversationContent(this.tenant(), sessionId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (content) => { this.content.set(content); this.busy.set(false); }, error: (error) => this.fail(error),
    });
  }
  addNote(): void {
    const sessionId = this.selected()?.session.session_id;
    if (!sessionId || !this.can('conversations.annotate') || this.noteForm.invalid || this.busy()) {
      this.noteForm.markAllAsTouched(); return;
    }
    const note = this.noteForm.controls.note.value.trim(); if (!note) return;
    this.mutate(this.admin.addConversationNote(this.tenant(), sessionId, note), 'Operator note recorded.');
    this.noteForm.reset({ note: '' });
  }
  createExport(scope: 'metadata' | 'content'): void {
    const sessionId = this.selected()?.session.session_id;
    if (!sessionId || !this.can('conversations.export') || (scope === 'content' && !this.can('conversations.read_content'))) return;
    this.mutate(this.admin.createConversationExport(this.tenant(), sessionId, scope), `${scope} export manifest created.`);
  }
  download(job: ConversationExportJob): void {
    if (this.busy() || job.status !== 'ready' || (job.export_scope === 'content' && !this.can('conversations.read_content'))) return;
    this.start(); this.admin.downloadConversationExport(this.tenant(), job.conversation_export_job_id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
          anchor.href = url; anchor.download = `sophia-conversation-${job.conversation_export_job_id}.json`;
          anchor.click(); URL.revokeObjectURL(url);
          this.notice.set(`Conversation export downloaded with SHA-256 ${result.digest}.`); this.busy.set(false); this.refresh();
        }, error: (error) => this.fail(error),
      });
  }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  json(value: unknown): string { return JSON.stringify(value, null, 2); }
  private filterValues(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.filters.getRawValue())) if (value.trim()) {
      result[key] = key === 'from' || key === 'to' ? new Date(value).toISOString() : value.trim();
    }
    return result;
  }
  private mutate(request: Observable<unknown>, notice: string): void {
    if (this.busy()) return; this.start(); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notice.set(notice); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  private start(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Conversation request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const tenant = this.principal()?.tenantId; if (!tenant) throw new Error('Tenant context unavailable.'); return tenant; }
}
