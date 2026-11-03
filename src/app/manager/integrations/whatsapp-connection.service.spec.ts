import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { WhatsAppConnectionService } from './whatsapp-connection.service';
import { environment } from 'src/environments/environment';
describe('WhatsApp company integration API', () => {
  let api: WhatsAppConnectionService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(WhatsAppConnectionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads the signed-in company projection without a browser tenant claim', () => {
    api.load().subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/bm/lead-assistant/channel`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });
  it('sends only the allowlisted profile, expected version and receiving choice', () => {
    api.save('pilot_test', 4, false).subscribe();
    const req = http.expectOne(
      `${environment.apiUrl}/bm/lead-assistant/channel`,
    );
    expect(req.request.body).toEqual({
      profileId: 'pilot_test',
      expectedRevision: 4,
      enabled: false,
    });
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });
});
