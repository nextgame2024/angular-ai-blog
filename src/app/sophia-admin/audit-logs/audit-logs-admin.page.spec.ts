import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { AuditLogsAdminPage } from './audit-logs-admin.page';

describe('AuditLogsAdminPage', () => {
  let fixture: ComponentFixture<AuditLogsAdminPage>; let admin: jasmine.SpyObj<SophiaAdminService>;
  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', ['context', 'auditEvents', 'auditRetention', 'auditExports']);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'auditor', role: 'read_only_auditor', permissions: ['audit.read'] } }));
    admin.auditEvents.and.returnValue(of({ events: [{ audit_event_id: 'event-1', event_type: 'admin.request.failed', outcome: 'failed', correlation_id: 'correlation-1', metadata: { reason: 'safe' }, created_at: '2026-09-25T00:00:00Z' }], hasMore: false }));
    admin.auditRetention.and.returnValue(of({ policyStatus: 'unavailable', deletionEnabled: false, legalHoldAutomation: 'unavailable', detail: 'No approved policy.' }));
    admin.auditExports.and.returnValue(of({ exports: [] }));
    await TestBed.configureTestingModule({ imports: [AuditLogsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(AuditLogsAdminPage); fixture.detectChanges();
  });
  it('shows redacted evidence and an honest unavailable retention state without export access', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('admin.request.failed'); expect(text).toContain('Policy unavailable');
    expect(text).toContain('Automatic deletion: disabled'); expect(text).not.toContain('Create bounded JSON export');
  });
});
