import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PersistanceService } from '../../shared/services/persistance.service';
import { StudentOperationsService } from './student-operations.service';

describe('StudentOperationsService', () => {
  let service: StudentOperationsService;
  let http: HttpTestingController;
  let credential: string | null;

  beforeEach(() => {
    credential = 'business-manager-token';
    TestBed.configureTestingModule({ providers: [
      StudentOperationsService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PersistanceService, useValue: { get: () => credential } },
    ] });
    service = TestBed.inject(StudentOperationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('discovers the identity-bound workspace with an explicit credential', () => {
    service.workspace().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace',
    ));
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({ packId: 'student-operations' });
  });

  it('loads dashboard context and metrics with one request', () => {
    service.dashboard().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace/dashboard',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
  });

  it('reuses the last dashboard response without another request', () => {
    const dashboard = {
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 4, activeStudents: 3, actionRequired: 1, onHold: 0 },
    };
    const responses: unknown[] = [];

    service.dashboard().subscribe((response) => responses.push(response));
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush(dashboard);

    service.dashboard().subscribe((response) => responses.push(response));
    http.expectNone((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(responses).toEqual([dashboard, dashboard]);
  });

  it('refreshes explicitly and replaces the cached dashboard', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });

    service.dashboard({ refresh: true }).subscribe();
    const refresh = http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(refresh.request.method).toBe('GET');
    refresh.flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 2, activeStudents: 2, actionRequired: 0, onHold: 0 },
    });
  });

  it('does not reuse dashboard values after the credential changes', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });

    credential = 'another-user-token';
    service.dashboard().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(request.request.headers.get('Authorization')).toBe('Token another-user-token');
    request.flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
  });

  it('sends bounded student-list filters without a browser-selected tenant', () => {
    service.students({ page: 2, limit: 20, q: 'student', status: 'active' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/student-operations/v1/workspace/students',
    ));
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('q')).toBe('student');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.url).not.toContain('/tenants/');
    request.flush({ students: [], page: 2, limit: 20, total: 0 });
  });

  it('creates a student with idempotency and invalidates the dashboard cache', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
    service.createStudent({
      studentReference: 'STU-001', legalName: 'Synthetic Student', preferredName: null,
      email: 'student@example.invalid', currentStage: 'new_application', status: 'active',
      advisorIdentityUserId: null, collegeName: null,
    }, 'create-student-001').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/students'));
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('create-student-001');
    request.flush({ studentId: 'student-1' });

    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'student-operations' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });
  });

  it('updates a student with its record version and idempotency key', () => {
    service.updateStudent('student-1', {
      studentReference: 'STU-001', legalName: 'Synthetic Student', preferredName: null,
      email: 'student@example.invalid', currentStage: 'new_application', status: 'active',
      advisorIdentityUserId: null, collegeName: null, recordVersion: 3,
    }, 'update-student-001').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/students/student-1'));
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.recordVersion).toBe(3);
    expect(request.request.headers.get('Idempotency-Key')).toBe('update-student-001');
    request.flush({ studentId: 'student-1', recordVersion: 4 });
  });

  it('loads the current agency Xero connection status', () => {
    service.xeroStatus().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({ configured: true, connections: [] });
  });

  it('starts Xero authorization without accepting a browser-selected agency', () => {
    service.beginXeroAuthorization().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/authorization',
    ));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.url).not.toContain('/tenants/');
    request.flush({ authorizationUrl: 'https://login.xero.com/example', expiresInSeconds: 600 });
  });

  it('tests a connected Xero organisation using an encoded connection id', () => {
    service.testXeroConnection('connection/id').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/test',
    ));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ organisation: { name: 'Agency Trust' }, bankAccounts: [] });
  });

  it('pages stored invoice-derived candidates without calling Xero from the browser', () => {
    service.xeroStudentCandidates('connection/id', {
      page: 2, limit: 20, q: 'student', sort: 'invoiceDate', direction: 'desc',
    }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-candidates',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('q')).toBe('student');
    expect(request.request.params.get('sort')).toBe('invoiceDate');
    expect(request.request.params.get('direction')).toBe('desc');
    request.flush({ candidates: [], page: 2, limit: 20, total: 0 });
  });

  it('queues and reads durable Xero student synchronization', () => {
    service.refreshXeroStudents('connection/id').subscribe();
    const refresh = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-sync',
    ));
    expect(refresh.request.method).toBe('POST');
    refresh.flush({ syncRunId: 'run-1', status: 'queued' });

    service.xeroStudentSyncStatus('connection/id').subscribe();
    const status = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-sync',
    ));
    expect(status.request.method).toBe('GET');
    status.flush({ configured: true, latestRun: { syncRunId: 'run-1', status: 'queued' } });
  });

  it('assigns an explicit TRUST organisation for student synchronization', () => {
    service.configureXeroTrust('connection/id').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/workspace/integrations/xero/connections/connection%2Fid/student-role/trust',
    ));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ connectionId: 'connection/id', organisationRole: 'trust' });
  });

});
