import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  LeadAssistantSettingsService,
  AssistantSettings,
} from './lead-assistant-settings.service';
describe('Assistant Settings HTTP contract', () => {
  let api: LeadAssistantSettingsService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LeadAssistantSettingsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('saves with revision and server-resolved identity', () => {
    api.save(3, { businessName: 'Draft' } as AssistantSettings).subscribe();
    const req = http.expectOne((r) =>
      r.url.endsWith('/bm/lead-assistant/settings'),
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      expectedRevision: 3,
      configuration: { businessName: 'Draft' },
    });
    req.flush({});
  });
  it('publishes independently of draft saving', () => {
    api.publish(4).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/settings/publish'));
    expect(req.request.body).toEqual({ expectedRevision: 4 });
    req.flush({});
  });
});
