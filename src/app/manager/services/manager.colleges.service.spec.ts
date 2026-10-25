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
});
