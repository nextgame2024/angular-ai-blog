import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { StudentOperationsService } from '../student-operations.service';
import { ManagerService } from '../../services/manager.service';
import { StudentOperationsStudentsPageComponent } from './student-operations-students.page';

describe('StudentOperationsStudentsPageComponent', () => {
  let fixture: ComponentFixture<StudentOperationsStudentsPageComponent>;
  const api = {
    workspace: jasmine.createSpy().and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    })),
    students: jasmine.createSpy().and.returnValue(of({
      students: [], page: 1, limit: 20, total: 0,
    })),
    dashboard: jasmine.createSpy().and.returnValue(of({
      workspace: {},
      summary: { totalStudents: 0, activeStudents: 0, newApplications: 0, actionRequired: 0, onHold: 0 },
    })),
    xeroStatus: jasmine.createSpy().and.returnValue(of({ configured: true, connections: [] })),
    xeroStudentCandidates: jasmine.createSpy().and.returnValue(of({
      candidates: [], page: 1, limit: 20, total: 0,
    })),
    xeroStudentSyncStatus: jasmine.createSpy().and.returnValue(of({
      configured: false, organisationRole: null, lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null, latestRun: null,
    })),
    refreshXeroStudents: jasmine.createSpy(),
    beginXeroAuthorization: jasmine.createSpy().and.returnValue(of({ authorizationUrl: 'https://login.xero.test' })),
    advisors: jasmine.createSpy().and.returnValue(of({ advisorIdentityUserIds: [] })),
    student: jasmine.createSpy(),
    createStudent: jasmine.createSpy(),
    updateStudent: jasmine.createSpy(),
  };
  const managerApi = {
    listUsers: jasmine.createSpy().and.returnValue(of({
      items: [], page: 1, limit: 100, total: 0,
    })),
  };

  beforeEach(async () => {
    api.workspace.calls.reset();
    api.students.calls.reset();
    api.advisors.calls.reset();
    api.dashboard.calls.reset();
    api.xeroStatus.calls.reset();
    api.xeroStudentCandidates.calls.reset();
    api.xeroStudentSyncStatus.calls.reset();
    api.refreshXeroStudents.calls.reset();
    api.createStudent.calls.reset();
    managerApi.listUsers.calls.reset();
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'operations', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.students.and.returnValue(of({ students: [], page: 1, limit: 20, total: 0 }));
    api.dashboard.and.returnValue(of({
      workspace: {},
      summary: { totalStudents: 0, activeStudents: 0, newApplications: 0, actionRequired: 0, onHold: 0 },
    }));
    api.xeroStatus.and.returnValue(of({ configured: true, connections: [] }));
    api.xeroStudentCandidates.and.returnValue(of({ candidates: [], page: 1, limit: 20, total: 0 }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: false, organisationRole: null, lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null, latestRun: null,
    }));
    await TestBed.configureTestingModule({
      imports: [StudentOperationsStudentsPageComponent],
      providers: [
        provideRouter([]),
        { provide: StudentOperationsService, useValue: api },
        { provide: ManagerService, useValue: managerApi },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StudentOperationsStudentsPageComponent);
  });

  it('renders the production empty state with a create action for operations', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No students found');
    expect(text).toContain('excludes restricted identity documents');
    expect(text).toContain('Create');
    expect(text).not.toContain('synthetic');
  });

  it('keeps advisors read-only by hiding student write actions', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'advisor', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.btn.primary')).toBeNull();
  });

  it('highlights invalid required fields and shows the standard validation toast', () => {
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    fixture.componentInstance.saveStudent();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[formControlName="studentReference"]')).toHaveClass('ng-invalid');
    expect(fixture.nativeElement.querySelector('input[formControlName="studentReference"]')).toHaveClass('ng-touched');
    expect(fixture.nativeElement.querySelector('.form-toast.error')?.textContent).toContain(
      'Please complete the required student fields',
    );
    expect(api.createStudent).not.toHaveBeenCalled();
  });

  it('submits a validated student create with an idempotency key', () => {
    api.createStudent.and.returnValue(of({ studentId: 'student-1' }));
    fixture.detectChanges();
    fixture.componentInstance.openCreate();
    fixture.detectChanges();
    fixture.componentInstance.studentForm.patchValue({
      studentReference: 'STU-001', legalName: 'Synthetic Student',
      email: 'student@example.invalid', currentStage: 'new_application', status: 'active',
    });
    fixture.componentInstance.saveStudent();
    expect(api.createStudent).toHaveBeenCalledWith(
      jasmine.objectContaining({ studentReference: 'STU-001', legalName: 'Synthetic Student' }),
      jasmine.any(String),
    );
  });

  it('links an accepted Xero candidate after the student is created', () => {
    const connectionId = '44444444-4444-4444-8444-444444444444';
    const contactId = '55555555-5555-4555-8555-555555555555';
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId, tenantId: 'xero-tenant', tenantName: 'Agency Trust',
        tenantType: 'ORGANISATION', tenantShortCode: null, status: 'active',
        healthStatus: 'healthy', lastTestedAt: null, lastErrorCode: null,
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.createStudent.and.returnValue(of({ studentId: 'student-1' }));
    fixture.detectChanges();
    fixture.componentInstance.reviewXeroCandidate({
      xeroContactId: contactId, legalName: 'Candidate Student', email: 'candidate@example.invalid',
      suggestedStudentReference: 'STU-XERO', invoiceCount: 1, latestInvoiceNumber: 'INV-1',
      latestInvoiceDate: '2026-10-01', nextPaymentDate: null, nextPaymentAmount: null,
      totalInvoiced: 100, totalPaid: 100, amountDue: 0, currencyCode: 'AUD', paymentStatus: 'paid',
    });
    fixture.componentInstance.saveStudent();

    expect(api.createStudent).toHaveBeenCalledWith(
      jasmine.objectContaining({
        xeroCandidateSource: { connectionId, contactId },
      }),
      jasmine.any(String),
    );
  });

  it('shows entitlement denial without exposing workspace data', () => {
    api.workspace.and.returnValue(throwError(() => ({ status: 403 })));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'This account does not have Student Operations workspace access.',
    );
    expect(fixture.componentInstance.students).toEqual([]);
  });

  it('keeps the page controls visible while loading only the register', () => {
    api.students.and.returnValue(new Subject());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Manage active and historical');
    expect(fixture.nativeElement.querySelector('.list-loader .loader-content')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.list-loader .loader-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('.screen-loader')).toBeNull();
  });

  it('allows the privacy notice to be dismissed', () => {
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.privacy-dismiss').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'This register excludes restricted identity documents',
    );
  });

  it('shows dashboard-style student metrics without fabricated trend percentages', () => {
    api.dashboard.and.returnValue(of({
      workspace: {},
      summary: { totalStudents: 12, activeStudents: 8, newApplications: 3, actionRequired: 2, onHold: 1 },
    }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Active students');
    expect(text).toContain('New applications');
    expect(text).toContain('Action required');
    expect(text).not.toContain('vs. previous month');
  });

  it('lets a Chief Executive review an invoice-derived contact before creating a student', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentCandidates.and.returnValue(of({
      page: 1, limit: 20, total: 1,
      candidates: [{
        xeroContactId: '44444444-4444-4444-8444-444444444444', legalName: 'Student One',
        email: 'student.one@example.invalid', suggestedStudentReference: 'STU-100', invoiceCount: 2,
        latestInvoiceNumber: 'TRUST-002', latestInvoiceDate: '2026-10-01', nextPaymentDate: '2026-10-20',
        nextPaymentAmount: 400, totalInvoiced: 1500, totalPaid: 1100, amountDue: 400,
        currencyCode: 'AUD', paymentStatus: 'due',
      }],
    }));
    fixture.detectChanges();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Students found in Xero invoices (1)');
    expect(fixture.nativeElement.textContent).toContain('Student One');

    fixture.nativeElement.querySelector('.candidate-row .btn.secondary').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.studentForm.value).toEqual(jasmine.objectContaining({
      studentReference: 'STU-100', legalName: 'Student One', email: 'student.one@example.invalid',
    }));
  });

  it('queues a background Xero refresh and keeps cached records visible', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        missingStudentDiscoveryScopes: [],
      }],
    }));
    api.refreshXeroStudents.and.returnValue(of({
      syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
      status: 'queued', contactCount: 0, invoiceCount: 0, candidateCount: 0,
      errorCode: null, createdAt: '2026-10-10T00:00:00Z', startedAt: null, completedAt: null,
    }));
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.xero-sync .btn').click();
    fixture.detectChanges();

    expect(api.refreshXeroStudents).toHaveBeenCalledWith('connection-1');
    expect(fixture.nativeElement.textContent).toContain('Waiting for the background worker');
    expect(fixture.nativeElement.textContent).toContain('No students found');
  });

  it('shows page-level Xero progress while preserving the student register', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust', lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null,
      latestRun: {
        syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
        status: 'processing', contactCount: 500, invoiceCount: 125, candidateCount: 0,
        errorCode: null, createdAt: '2026-10-10T00:00:00Z',
        startedAt: '2026-10-10T00:00:01Z', completedAt: null,
      },
    }));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('500 contacts and 125 invoices processed');
    expect(fixture.nativeElement.textContent).toContain('No students found');
  });

  it('explains transient Xero failures and the scheduled retry', () => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust', lastSuccessfulSyncAt: null,
      lastErrorCode: 'xero_unavailable', nextScheduledSyncAt: '2026-10-10T01:33:34Z',
      latestRun: {
        syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
        status: 'failed', contactCount: 1000, invoiceCount: 0, candidateCount: 0,
        errorCode: 'xero_unavailable', createdAt: '2026-10-10T01:18:17Z',
        startedAt: '2026-10-10T01:18:18Z', completedAt: '2026-10-10T01:18:34Z',
      },
    }));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Xero is temporarily unavailable');
    expect(fixture.nativeElement.textContent).toContain('automatic retry is scheduled');
    expect(fixture.nativeElement.textContent).toContain('Existing student information remains available');
  });

  it('backs off status polling while a Xero refresh remains active', fakeAsync(() => {
    api.workspace.and.returnValue(of({
      packId: 'student-operations', version: '0.1.0', tenantId: 'tenant-1',
      role: 'chief_executive', authorizationRevision: 1, workspaceRoutes: ['students'],
    }));
    api.xeroStatus.and.returnValue(of({
      configured: true,
      connections: [{
        connectionId: 'connection-1', tenantName: 'Example TRUST', status: 'active',
        organisationRole: 'trust', missingStudentDiscoveryScopes: [],
      }],
    }));
    api.xeroStudentSyncStatus.and.returnValue(of({
      configured: true, organisationRole: 'trust', lastSuccessfulSyncAt: null,
      lastErrorCode: null, nextScheduledSyncAt: null,
      latestRun: {
        syncRunId: 'run-1', connectionId: 'connection-1', mode: 'initial', triggerType: 'manual',
        status: 'processing', contactCount: 0, invoiceCount: 0, candidateCount: 0,
        errorCode: null, createdAt: '2026-10-10T00:00:00Z',
        startedAt: '2026-10-10T00:00:01Z', completedAt: null,
      },
    }));
    fixture.detectChanges();
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(1);

    tick(2000);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(2);
    tick(2000);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(3);
    tick(3999);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(3);
    tick(1);
    expect(api.xeroStudentSyncStatus).toHaveBeenCalledTimes(4);

    fixture.destroy();
  }));
});
