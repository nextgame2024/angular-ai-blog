import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PersistanceService } from '../../shared/services/persistance.service';
import { OpenForAustraliaService } from './open-for-australia.service';

describe('OpenForAustraliaService', () => {
  let service: OpenForAustraliaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      OpenForAustraliaService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PersistanceService, useValue: { get: () => 'business-manager-token' } },
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
