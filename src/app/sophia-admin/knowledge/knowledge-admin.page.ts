import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, from, switchMap } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import type {
  KnowledgeBinding,
  KnowledgeFileIntake,
  KnowledgeFileReadiness,
  KnowledgeRevisionDetail,
  KnowledgeRevisionSummary,
  KnowledgeSource,
  SophiaAdminPrincipal,
} from '../sophia-admin.types';

@Component({
  selector: 'app-knowledge-admin-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './knowledge-admin.page.html',
  styleUrls: ['./knowledge-admin.page.css'],
})
export class KnowledgeAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService);
  private readonly destroyRef = inject(DestroyRef);
  readonly formatBytes = formatBytes;

  readonly principal = signal<SophiaAdminPrincipal | null>(null);
  readonly sources = signal<KnowledgeSource[]>([]);
  readonly bindings = signal<KnowledgeBinding[]>([]);
  readonly fileReadiness = signal<KnowledgeFileReadiness | null>(null);
  readonly fileIntakes = signal<KnowledgeFileIntake[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly reviewedRevision = signal<KnowledgeRevisionDetail | null>(null);
  readonly previewResults = signal<Array<{ title: string; excerpt: string; sources: Array<{ sourceRef: string }> }>>([]);
  readonly selectedSnapshot = signal<{ snapshotId: string; bindingId: string; label: string } | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly canEdit = computed(() => this.hasPermission('knowledge.edit'));
  readonly canIngest = computed(() => this.hasPermission('knowledge.ingest'));
  readonly canPublish = computed(() => this.hasPermission('knowledge.publish'));
  readonly canRetire = computed(() => this.hasPermission('knowledge.retire'));

  readonly sourceForm = new FormGroup({
    sourceKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120), Validators.pattern(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)],
    }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300)] }),
    mediaType: new FormControl<'text/plain' | 'text/markdown'>('text/plain', { nonNullable: true }),
    contentText: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(262_144)] }),
  });

  readonly publishForm = new FormGroup({
    capabilityBindingId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly previewForm = new FormGroup({
    query: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
  });

  readonly fileForm = new FormGroup({
    sourceId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => {
        this.principal.set(principal);
        this.refresh();
      },
      error: (error) => this.fail(error),
    });
  }

  refresh(): void {
    const tenantId = this.principal()?.tenantId;
    if (!tenantId) return;
    this.loading.set(true);
    forkJoin({
      sources: this.admin.listSources(tenantId),
      bindings: this.admin.listBindings(tenantId),
      readiness: this.admin.fileReadiness(tenantId),
      files: this.admin.listFileIntakes(tenantId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ sources, bindings, readiness, files }) => {
        this.sources.set(sources.sources);
        this.bindings.set(bindings.bindings);
        this.fileReadiness.set(readiness);
        this.fileIntakes.set(files.intakes);
        if (readiness.enabled) this.fileForm.controls.sourceId.enable({ emitEvent: false });
        else this.fileForm.controls.sourceId.disable({ emitEvent: false });
        if (!this.publishForm.controls.capabilityBindingId.value && bindings.bindings[0]) {
          this.publishForm.controls.capabilityBindingId.setValue(bindings.bindings[0].capability_binding_id);
        }
        this.loading.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  selectFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(file);
    this.error.set('');
  }

  uploadFile(): void {
    const tenantId = this.principal()?.tenantId;
    const readiness = this.fileReadiness();
    const file = this.selectedFile();
    const sourceId = this.fileForm.controls.sourceId.value;
    if (!tenantId || !readiness?.enabled || !file || !sourceId || this.busy()) {
      this.fileForm.markAllAsTouched();
      return;
    }
    const mediaType = file.name.toLowerCase().endsWith('.md') ? 'text/markdown' as const : 'text/plain' as const;
    if (file.size < 1 || file.size > readiness.maxUploadBytes || !/\.(?:txt|md)$/i.test(file.name)) {
      this.error.set(`Choose a .txt or .md file no larger than ${formatBytes(readiness.maxUploadBytes)}.`);
      return;
    }
    this.startAction();
    from(sha256Base64(file)).pipe(
      switchMap((checksumSha256Base64) => this.admin.initiateFile(tenantId, sourceId, {
        filename: file.name,
        mediaType,
        contentLength: file.size,
        checksumSha256Base64,
        idempotencyKey: actionId('knowledge-file'),
      })),
      switchMap((intake) => from(this.admin.uploadPrivateObject(intake.uploadUrl, intake.requiredHeaders, file))
        .pipe(switchMap(() => this.admin.completeFile(tenantId, intake.knowledgeFileIntakeId)))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.selectedFile.set(null);
        this.fileForm.reset({ sourceId: '' });
        this.finishAction('Private file uploaded and queued for scanning and isolated parsing.');
      },
      error: (error) => this.fail(error),
    });
  }

  createManagedText(): void {
    const tenantId = this.principal()?.tenantId;
    if (!tenantId || this.sourceForm.invalid || this.busy()) {
      this.sourceForm.markAllAsTouched();
      return;
    }
    this.startAction();
    const value = this.sourceForm.getRawValue();
    this.admin.createManagedTextSource(tenantId, { sourceKey: value.sourceKey.trim(), title: value.title.trim() }).pipe(
      switchMap((source) => this.admin.createManagedTextRevision(tenantId, source.knowledgeSourceId, {
        mediaType: value.mediaType,
        contentText: value.contentText,
      })),
      switchMap((revision) => this.admin.ingest(tenantId, revision.knowledge_revision_id, actionId('knowledge-ingest'))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.sourceForm.reset({ sourceKey: '', title: '', mediaType: 'text/plain', contentText: '' });
        this.finishAction('Managed text source created and ingested as a draft.');
      },
      error: (error) => this.fail(error),
    });
  }

  review(revisionId: string): void {
    const tenantId = this.principal()?.tenantId;
    if (!tenantId) return;
    this.startAction();
    this.admin.getRevision(tenantId, revisionId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ revision }) => {
        this.reviewedRevision.set(revision);
        this.busy.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  approve(revisionId: string): void {
    this.runMutation(this.admin.approve(this.requireTenant(), revisionId), 'Revision approved.');
  }

  publish(revisionId: string): void {
    const bindingId = this.publishForm.controls.capabilityBindingId.value;
    if (!bindingId) {
      this.error.set('Select a knowledge capability binding before publication.');
      return;
    }
    this.runMutation(this.admin.publish(this.requireTenant(), revisionId, [bindingId]), 'Revision published to a granted snapshot.');
  }

  retire(source: KnowledgeSource): void {
    if (!window.confirm(`Retire “${source.title}” and remove its snapshots from future retrieval?`)) return;
    this.runMutation(this.admin.retire(this.requireTenant(), source.knowledge_source_id), 'Knowledge source retired.');
  }

  choosePreview(source: KnowledgeSource, revision: KnowledgeRevisionSummary): void {
    const snapshotId = revision.knowledgeSnapshotId;
    const bindingId = revision.capabilityBindingIds?.[0];
    if (!snapshotId || !bindingId || revision.snapshotStatus !== 'published') return;
    this.selectedSnapshot.set({ snapshotId, bindingId, label: `${source.title} · revision ${revision.revision}` });
    this.previewResults.set([]);
    this.previewForm.controls.query.setValue('');
  }

  preview(): void {
    const selected = this.selectedSnapshot();
    if (!selected || this.previewForm.invalid) {
      this.previewForm.markAllAsTouched();
      return;
    }
    this.startAction();
    this.admin.preview(this.requireTenant(), {
      snapshotId: selected.snapshotId,
      capabilityBindingId: selected.bindingId,
      query: this.previewForm.controls.query.value,
      limit: 10,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items }) => {
        this.previewResults.set(items);
        this.busy.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  private runMutation(request: ReturnType<SophiaAdminService['approve']>, message: string): void {
    if (this.busy()) return;
    this.startAction();
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.finishAction(message),
      error: (error) => this.fail(error),
    });
  }

  private finishAction(message: string): void {
    this.busy.set(false);
    this.notice.set(message);
    this.refresh();
  }

  private startAction(): void {
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
  }

  private fail(error: unknown): void {
    const response = error as { error?: { message?: string | string[] }; message?: string };
    const message = response.error?.message;
    this.error.set(Array.isArray(message) ? message.join(' ') : message || response.message || 'The Sophia Admin request failed.');
    this.loading.set(false);
    this.busy.set(false);
  }

  private hasPermission(permission: string): boolean {
    return this.principal()?.permissions.includes(permission) ?? false;
  }

  private requireTenant(): string {
    const tenantId = this.principal()?.tenantId;
    if (!tenantId) throw new Error('Sophia Admin tenant context is unavailable.');
    return tenantId;
  }
}

function actionId(prefix: string): string {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

async function sha256Base64(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function formatBytes(bytes: number): string {
  return bytes >= 1_048_576 ? `${bytes / 1_048_576} MiB` : `${Math.round(bytes / 1024)} KiB`;
}
