import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ManagerCollegesService } from './manager.colleges.service';

describe('ManagerCollegesService', () => {
  let service: ManagerCollegesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ManagerCollegesService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ManagerCollegesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('creates or reuses an offer college without a browser company identifier',()=>{
    service.createFromOffer({college_name:'Example College',abn:'12345678901'}).subscribe();const request=http.expectOne(r=>r.url.endsWith('/bm/colleges/from-offer'));expect(request.request.method).toBe('POST');expect(request.request.body).toEqual({college:{college_name:'Example College',abn:'12345678901'}});request.flush({college:{collegeId:'college'}});
  });

  it('searches the college directory independently of clients', () => {
    service.list('ATI', 2).subscribe((result) => expect(result.total).toBe(1));
    const request = http.expectOne((candidate) => candidate.url.endsWith('/bm/colleges'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('ATI');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ colleges: [], total: 1, page: 2, limit: 20 });
  });

  it('saves contacts under their college', () => {
    service.createContact('college-1', { name: 'Registrar' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/bm/colleges/college-1/contacts'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ contact: { name: 'Registrar' } });
    request.flush({ contact: {} });
  });

  it('archives a commission with its revision and no client company identifier',()=>{
    service.archiveCommission('college-1',{ruleId:'rule-1',updatedAt:'2026-11-08T00:00:00Z'} as any).subscribe();
    const request=http.expectOne(r=>r.url.endsWith('/bm/colleges/college-1/commissions/rule-1'));
    expect(request.request.method).toBe('DELETE');expect(request.request.body).toEqual({rule:{expected_updated_at:'2026-11-08T00:00:00Z'}});request.flush(null);
  });

  it('loads one college course page with server-side filters', () => {
    service.courses('college-1', 'English', 'active', 2, 50, 'code', 'desc').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/bm/colleges/college-1/courses'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('English');
    expect(request.request.params.get('status')).toBe('active');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.get('sort')).toBe('code');
    request.flush({ courses: [], total: 0, page: 2, limit: 50 });
  });
});
