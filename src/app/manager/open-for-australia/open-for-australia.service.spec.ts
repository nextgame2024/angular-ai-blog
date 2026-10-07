import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PersistanceService } from '../../shared/services/persistance.service';
import { OpenForAustraliaService } from './open-for-australia.service';

describe('OpenForAustraliaService', () => {
  let service: OpenForAustraliaService;
  let http: HttpTestingController;
  let credential: string | null;

  beforeEach(() => {
    credential = 'business-manager-token';
    TestBed.configureTestingModule({ providers: [
      OpenForAustraliaService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PersistanceService, useValue: { get: () => credential } },
    ] });
    service = TestBed.inject(OpenForAustraliaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('discovers the identity-bound workspace with an explicit credential', () => {
    service.workspace().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/open-for-australia/v1/workspace',
    ));
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({ packId: 'open-for-australia' });
  });

  it('loads dashboard context and metrics with one request', () => {
    service.dashboard().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/open-for-australia/v1/workspace/dashboard',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token business-manager-token');
    request.flush({
      workspace: { packId: 'open-for-australia' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
  });

  it('reuses the last dashboard response without another request', () => {
    const dashboard = {
      workspace: { packId: 'open-for-australia' },
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
      workspace: { packId: 'open-for-australia' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });

    service.dashboard({ refresh: true }).subscribe();
    const refresh = http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(refresh.request.method).toBe('GET');
    refresh.flush({
      workspace: { packId: 'open-for-australia' },
      summary: { totalStudents: 2, activeStudents: 2, actionRequired: 0, onHold: 0 },
    });
  });

  it('does not reuse dashboard values after the credential changes', () => {
    service.dashboard().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard')).flush({
      workspace: { packId: 'open-for-australia' },
      summary: { totalStudents: 1, activeStudents: 1, actionRequired: 0, onHold: 0 },
    });

    credential = 'another-user-token';
    service.dashboard().subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/workspace/dashboard'));
    expect(request.request.headers.get('Authorization')).toBe('Token another-user-token');
    request.flush({
      workspace: { packId: 'open-for-australia' },
      summary: { totalStudents: 0, activeStudents: 0, actionRequired: 0, onHold: 0 },
    });
  });

  it('sends bounded student-list filters without a browser-selected tenant', () => {
    service.students({ page: 2, limit: 20, q: 'student', status: 'active' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/business-packs/open-for-australia/v1/workspace/students',
    ));
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.params.get('q')).toBe('student');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.url).not.toContain('/tenants/');
    request.flush({ students: [], page: 2, limit: 20, total: 0 });
  });
});
