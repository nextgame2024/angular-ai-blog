import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, forkJoin, of } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AuditEvent, AuditExportJob, AuditRetentionStatus, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-audit-logs-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './audit-logs-admin.page.html', styleUrls: ['../shared/admin-authoring.css'],
})
export class AuditLogsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly events = signal<AuditEvent[]>([]);
  readonly exports = signal<AuditExportJob[]>([]); readonly retention = signal<AuditRetentionStatus | null>(null);
  readonly selected = signal<AuditEvent | null>(null); readonly hasMore = signal(false);
  readonly nextCursor = signal<{ before: string; beforeId: string } | null>(null);
  readonly loading = signal(true); readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly filters = new FormGroup({
    eventType: new FormControl('', { nonNullable: true }), outcome: new FormControl('', { nonNullable: true }),
    identityUserId: new FormControl('', { nonNullable: true }), resourceType: new FormControl('', { nonNullable: true }),
    correlationId: new FormControl('', { nonNullable: true }), from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  refresh(cursor?: { before: string; beforeId: string }): void {
    const tenant = this.principal()?.tenantId; if (!tenant) return; this.loading.set(true);
    const filters = this.filterValues();
    forkJoin({
      events: this.admin.auditEvents(tenant, { ...filters, limit: 50, ...cursor }),
      retention: this.admin.auditRetention(tenant),
      exports: this.can('audit.export') ? this.admin.auditExports(tenant) : of({ exports: [] }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.events.set(cursor ? [...this.events(), ...result.events.events] : result.events.events);
        this.hasMore.set(result.events.hasMore); this.nextCursor.set(result.events.nextCursor ?? null);
        this.retention.set(result.retention); this.exports.set(result.exports.exports); this.loading.set(false); this.busy.set(false);
      }, error: (error) => this.fail(error),
    });
  }
  applyFilters(): void { this.selected.set(null); this.refresh(); }
  clearFilters(): void { this.filters.reset({ eventType: '', outcome: '', identityUserId: '', resourceType: '', correlationId: '', from: '', to: '' }); this.applyFilters(); }
  show(event: AuditEvent): void {
    if (this.busy()) return; this.busy.set(true);
    this.admin.auditEvent(this.tenant(), event.audit_event_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => { this.selected.set(detail); this.busy.set(false); }, error: (error) => this.fail(error),
    });
  }
  createExport(): void {
    if (this.busy() || !this.can('audit.export')) return;
    this.mutate(this.admin.createAuditExport(this.tenant(), this.filterValues(), 1000), 'Bounded audit export manifest created.');
  }
  download(job: AuditExportJob): void {
    if (this.busy() || job.status !== 'ready') return; this.busy.set(true);
    this.admin.downloadAuditExport(this.tenant(), job.audit_export_job_id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
        anchor.href = url; anchor.download = `sophia-audit-${job.audit_export_job_id}.json`; anchor.click(); URL.revokeObjectURL(url);
        this.notice.set(`Audit export downloaded with SHA-256 ${result.digest}.`); this.busy.set(false); this.refresh();
      }, error: (error) => this.fail(error),
    });
  }
  json(value: unknown): string { return JSON.stringify(value, null, 2); }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  private filterValues(): Record<string, string> {
    const raw = this.filters.getRawValue(); const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) if (value.trim()) result[key] = key === 'from' || key === 'to' ? new Date(value).toISOString() : value.trim();
    return result;
  }
  private mutate(request: Observable<unknown>, notice: string): void {
    this.busy.set(true); this.error.set(''); this.notice.set(''); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notice.set(notice); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Audit request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const tenant = this.principal()?.tenantId; if (!tenant) throw new Error('Tenant context unavailable.'); return tenant; }
}
