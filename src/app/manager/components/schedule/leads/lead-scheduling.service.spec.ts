import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { LeadSchedulingService } from './lead-scheduling.service';
describe('Lead Scheduling API', () => {
  let api: LeadSchedulingService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LeadSchedulingService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the existing Scheduling API with bounded list filters', () => {
    api
      .list({
        start: '2026-11-01',
        end: '2026-11-30',
        timezone: 'Australia/Brisbane',
        page: 2,
        limit: 25,
      })
      .subscribe();
    const r = http.expectOne((q) =>
      q.url.endsWith('/bm/schedule/leads/appointments'),
    );
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.get('limit')).toBe('25');
    r.flush({ items: [], total: 0, page: 2, limit: 25 });
  });
  it('preserves explicit confirmation and retry identity for rescheduling', () => {
    api
      .mutate('reschedule', 'appointment', {
        requestKey: 'stable',
        expectedVersion: 3,
      })
      .subscribe();
    const r = http.expectOne((q) =>
      q.url.endsWith('/appointments/appointment/reschedule'),
    );
    expect(r.request.method).toBe('POST');
    expect(r.request.body.requestKey).toBe('stable');
    r.flush({ appointment: { id: 'appointment' } });
  });
});
