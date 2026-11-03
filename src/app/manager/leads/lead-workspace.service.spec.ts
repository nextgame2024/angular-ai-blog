import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LeadInput, LeadWorkspaceService } from './lead-workspace.service';
describe('Lead workspace HTTP contract', () => {
  let api: LeadWorkspaceService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LeadWorkspaceService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sends paging/sorting to the server without tenant or role claims', () => {
    api
      .list({
        page: 2,
        limit: 25,
        q: 'Example',
        stage: 'new',
        ownership: 'paused',
        sort: 'name',
        direction: 'asc',
        assignedTo: '',
      })
      .subscribe();
    const r = http.expectOne((req) => req.url.endsWith('/leads'));
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.has('customerId')).toBeFalse();
    r.flush({ items: [], total: 0, page: 2, limit: 25 });
  });
  it('keeps internal notes separate from any outbound message endpoint', () => {
    api.note('lead', 'note-key', 'Internal only').subscribe();
    const r = http.expectOne((req) => req.url.endsWith('/leads/lead/notes'));
    expect(r.request.body).toEqual({
      requestKey: 'note-key',
      body: 'Internal only',
    });
    r.flush({});
  });
  it('includes versions for edits and conversation ownership', () => {
    api.update('lead', 3, {} as LeadInput).subscribe();
    http.expectOne((req) => req.url.endsWith('/leads/lead')).flush({});
    api.ownership('lead', 4, 'human').subscribe();
    const r = http.expectOne((req) => req.url.endsWith('/ownership'));
    expect(r.request.body).toEqual({ expectedVersion: 4, ownership: 'human' });
    r.flush({});
  });
});
