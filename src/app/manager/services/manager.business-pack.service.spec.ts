import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ManagerService } from './manager.service';

describe('ManagerService business-pack role administration', () => {
  let service: ManagerService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      ManagerService, provideHttpClient(), provideHttpClientTesting(),
    ] });
    service = TestBed.inject(ManagerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('updates a named role rather than an enabled boolean', () => {
    service.setBusinessPackAssignment({
      companyId: 'company-1', userId: 'user-1',
      packId: 'open-for-australia', roleKey: 'advisor',
    }).subscribe();
    const request = http.expectOne((candidate) =>
      candidate.url.endsWith('/bm/business-pack-entitlements/user-1'),
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.assignment).toEqual({
      companyId: 'company-1', packId: 'open-for-australia', roleKey: 'advisor',
    });
    expect(request.request.body.assignment.enabled).toBeUndefined();
    request.flush({ assignment: null });
  });
});
