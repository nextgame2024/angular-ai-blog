import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable, forkJoin, of } from 'rxjs';
import { adminErrorMessage } from '../shared/admin-operation.utils';
import { SophiaAdminService } from '../sophia-admin.service';
import type { AnalyticsDashboard, AnalyticsExportJob, AnalyticsPoint, SophiaAdminPrincipal } from '../sophia-admin.types';

@Component({
  selector: 'app-analytics-admin-page', standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './analytics-admin.page.html', styleUrls: ['../shared/admin-authoring.css', './analytics-admin.page.css'],
})
export class AnalyticsAdminPage implements OnInit {
  private readonly admin = inject(SophiaAdminService); private readonly destroyRef = inject(DestroyRef);
  readonly principal = signal<SophiaAdminPrincipal | null>(null); readonly dashboard = signal<AnalyticsDashboard | null>(null);
  readonly exports = signal<AnalyticsExportJob[]>([]); readonly loading = signal(true); readonly busy = signal(false);
  readonly error = signal(''); readonly notice = signal('');
  readonly filters = new FormGroup({
    from: new FormControl('', { nonNullable: true }), to: new FormControl('', { nonNullable: true }),
    agentId: new FormControl('', { nonNullable: true }), agentReleaseId: new FormControl('', { nonNullable: true }),
    channel: new FormControl('', { nonNullable: true }),
  });
  readonly daily = computed(() => dailyTotals(this.dashboard()?.series ?? []));
  readonly visibleSeries = computed(() => (this.dashboard()?.series ?? []).slice(0, 250));

  ngOnInit(): void {
    this.admin.context().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ principal }) => { this.principal.set(principal); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  refresh(): void {
    const tenant = this.principal()?.tenantId; if (!tenant) return; this.loading.set(true);
    forkJoin({
      dashboard: this.admin.analytics(tenant, this.filterValues()),
      exports: this.can('analytics.export') ? this.admin.analyticsExports(tenant) : of({ exports: [] }),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.dashboard.set(result.dashboard); this.exports.set(result.exports.exports);
        this.loading.set(false); this.busy.set(false); }, error: (error) => this.fail(error),
    });
  }
  applyFilters(): void { this.refresh(); }
  clearFilters(): void {
    this.filters.reset({ from: '', to: '', agentId: '', agentReleaseId: '', channel: '' }); this.refresh();
  }
  total(metricKey: string): number {
    return (this.dashboard()?.series ?? []).reduce((sum, point) => sum + (point.metrics[metricKey] ?? 0), 0);
  }
  ratio(metricKey: string, denominatorMetricKey?: string): string | null {
    if (!denominatorMetricKey) return null; const denominator = this.total(denominatorMetricKey);
    return denominator ? `${((this.total(metricKey) / denominator) * 100).toFixed(1)}% of ${denominatorMetricKey}` : 'No denominator evidence';
  }
  createExport(): void {
    if (this.busy() || !this.can('analytics.export')) return;
    this.mutate(this.admin.createAnalyticsExport(this.tenant(), this.filterValues(), 1000), 'Bounded analytics snapshot created.');
  }
  download(job: AnalyticsExportJob): void {
    if (this.busy() || job.status !== 'ready') return; this.start();
    this.admin.downloadAnalyticsExport(this.tenant(), job.analytics_export_job_id)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => {
          const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
          anchor.href = url; anchor.download = `sophia-analytics-${job.analytics_export_job_id}.json`;
          anchor.click(); URL.revokeObjectURL(url);
          this.notice.set(`Analytics export downloaded with SHA-256 ${result.digest}.`); this.busy.set(false); this.refresh();
        }, error: (error) => this.fail(error),
      });
  }
  can(permission: string): boolean { return this.principal()?.permissions.includes(permission) ?? false; }
  private filterValues(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.filters.getRawValue())) if (value.trim()) {
      result[key] = key === 'from' || key === 'to' ? new Date(value).toISOString() : value.trim();
    }
    return result;
  }
  private mutate(request: Observable<unknown>, notice: string): void {
    this.start(); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notice.set(notice); this.refresh(); }, error: (error) => this.fail(error),
    });
  }
  private start(): void { this.busy.set(true); this.error.set(''); this.notice.set(''); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error, 'Analytics request failed.')); this.loading.set(false); this.busy.set(false); }
  private tenant(): string { const tenant = this.principal()?.tenantId; if (!tenant) throw new Error('Tenant context unavailable.'); return tenant; }
}

function dailyTotals(series: AnalyticsPoint[]): AnalyticsPoint[] {
  const days = new Map<string, AnalyticsPoint>();
  for (const point of series) {
    const day = days.get(point.bucketDate) ?? { bucketDate: point.bucketDate, agentId: null, agentReleaseId: null,
      channel: 'unknown' as const, metrics: {} };
    for (const [key, value] of Object.entries(point.metrics)) day.metrics[key] = (day.metrics[key] ?? 0) + value;
    days.set(point.bucketDate, day);
  }
  return [...days.values()].sort((a, b) => a.bucketDate.localeCompare(b.bucketDate));
}
