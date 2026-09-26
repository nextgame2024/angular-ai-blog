import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { AnalyticsAdminPage } from './analytics-admin.page';

describe('AnalyticsAdminPage', () => {
  let fixture: ComponentFixture<AnalyticsAdminPage>; let admin: jasmine.SpyObj<SophiaAdminService>;
  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', ['context', 'analytics', 'analyticsExports']);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'owner', role: 'organisation_owner',
      permissions: ['analytics.read', 'analytics.export'] } }));
    admin.analytics.and.returnValue(of({
      tenantId: 'tenant-1', generatedAt: '2026-09-26T00:00:00Z',
      range: { from: '2026-09-01T00:00:00Z', to: '2026-09-27T00:00:00Z', timezone: 'UTC', timezoneSource: 'fallback_utc' },
      filters: { agentId: null, agentReleaseId: null, channel: null },
      metricRegistry: [
        { metricKey: 'conversations.started', version: 1, displayName: 'Conversations started', description: 'Canonical sessions.',
          unit: 'count', evidenceClass: 'operational_observation', source: { kind: 'canonical_runtime_record', detail: 'sessions.started_at' } },
        { metricKey: 'conversations.completed', version: 1, displayName: 'Conversations completed', description: 'Closed lifecycle, not conversion.',
          unit: 'count', evidenceClass: 'operational_observation', denominatorMetricKey: 'conversations.started',
          source: { kind: 'canonical_runtime_record', detail: 'sessions.status=closed' } },
      ],
      series: [{ bucketDate: '2026-09-25', agentId: null, agentReleaseId: null, channel: 'voice',
        metrics: { 'conversations.started': 4, 'conversations.completed': 3 } }],
      freshness: { latestSourceEventAt: '2026-09-25T12:00:00Z', aggregation: 'on_demand' },
      coverage: { usageStatusCounts: { estimated: 2 }, unattributedSessionCount: 1 }, providerCostEstimates: [],
      commercialPolicy: { status: 'not_configured', customerCharges: false, currencyConversion: 'not_performed',
        disclaimer: 'Not revenue, savings, customer charges, or causal impact.' },
      warnings: ['Organisation timezone is not configured; UTC was used.'],
    }));
    admin.analyticsExports.and.returnValue(of({ exports: [] }));
    await TestBed.configureTestingModule({ imports: [AnalyticsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(AnalyticsAdminPage); fixture.detectChanges();
  });

  it('shows definitions, denominators, fallback and non-commercial semantics', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Conversations started'); expect(text).toContain('4');
    expect(text).toContain('75.0% of conversations.started');
    expect(text).toContain('UTC was used'); expect(text).toContain('Not customer charges');
    expect(text).toContain('Create bounded JSON snapshot');
  });
});
