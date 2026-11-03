import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { LeadWorkspacePage } from './lead-workspace.page';
import {
  LeadContext,
  LeadConversation,
  LeadRow,
  LeadWorkspaceService,
} from './lead-workspace.service';
import { LeadAssistantSettingsService } from './lead-assistant-settings.service';
const actor = '33333333-3333-4333-8333-333333333333';
const context = (): LeadContext => ({
  actorId: actor,
  canManageSettings: true,
  canManageLeads: true,
  canCreate: true,
  settingsPublished: true,
  defaultLanguage: 'es',
  languages: ['es', 'en'],
  defaultAssigneeId: actor,
  staff: [{ id: actor, name: 'Example advisor' }],
  transportReady: false,
});
const detail = (id = 'lead-1'): LeadConversation => ({
  lead: {
    leadId: id,
    displayName: 'Example lead',
    email: 'hello@example.test',
    phone: '',
    language: 'es',
    interest: 'Example service',
    location: '',
    timeframe: '',
    stage: 'new',
    stageReason: '',
    assignedTo: actor,
    version: 1,
    source: 'manual',
    createdAt: '2026-11-03T00:00:00Z',
    updatedAt: '2026-11-03T00:00:00Z',
    conversationId: 'conversation',
    ownership: 'paused',
    humanOwner: null,
    ownershipVersion: 1,
  },
  events: [
    {
      id: '1',
      kind: 'lead_created',
      body: '',
      actorId: actor,
      metadata: {},
      createdAt: '2026-11-03T00:00:00Z',
    },
  ],
  hasOlder: false,
});
describe('Leads and team inbox', () => {
  let fixture: ComponentFixture<LeadWorkspacePage>,
    page: LeadWorkspacePage,
    api: jasmine.SpyObj<LeadWorkspaceService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('LeadWorkspaceService', [
      'context',
      'list',
      'detail',
      'create',
      'update',
      'note',
      'ownership',
      'events',
    ]);
    api.context.and.returnValue(of(context()));
    api.list.and.returnValue(
      of({ items: [detail().lead], total: 1, page: 1, limit: 25 }),
    );
    api.detail.and.callFake((id) => of(detail(id)));
    await TestBed.configureTestingModule({
      imports: [LeadWorkspacePage],
      providers: [
        provideRouter([]),
        { provide: LeadWorkspaceService, useValue: api },
        {
          provide: LeadAssistantSettingsService,
          useValue: {
            load: () =>
              of({
                revision: 0,
                configuration: {
                  businessName: '',
                  contactName: '',
                  supportContact: '',
                  enquiryOwnerId: null,
                  contentOwnerId: null,
                  fallbackOwnerId: null,
                  advisorIds: [],
                  timezone: 'Australia/Brisbane',
                  coverage: [],
                  closedDates: [],
                  afterHoursMessage: '',
                  greeting: '',
                  defaultLanguage: 'es',
                  languages: ['es'],
                },
                published: null,
                canManage: true,
                staff: [],
              }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadWorkspacePage);
    page = fixture.componentInstance;
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    fixture.destroy();
  });
  it('loads one context and one page, with useful chrome during the initial wait', () => {
    const pending = new Subject<LeadContext>();
    api.context.and.returnValue(pending);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Leads & Conversations',
    );
    expect(
      fixture.nativeElement.querySelector('app-manager-list-loader'),
    ).not.toBeNull();
    pending.next(context());
    pending.complete();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Example lead');
  });
  it('hides Settings from advisors and uses the published language/assignee defaults', () => {
    api.context.and.returnValue(
      of({ ...context(), canManageSettings: false, canManageLeads: false }),
    );
    fixture.detectChanges();
    expect(
      [...fixture.nativeElement.querySelectorAll('.tabs button')].some(
        (b: any) => b.textContent.includes('Settings'),
      ),
    ).toBeFalse();
    page.newLead();
    expect(page.form.controls.assignedTo.disabled).toBeTrue();
    expect(page.form.getRawValue().assignedTo).toBe(actor);
    expect(page.form.controls.language.value).toBe('es');
  });
  it('uses server pagination and stable sorting instead of sorting a partial client list', () => {
    api.list.and.returnValue(
      of({ items: [detail().lead], total: 60, page: 1, limit: 25 }),
    );
    fixture.detectChanges();
    page.goPage(2);
    expect(api.list.calls.mostRecent().args[0].page).toBe(2);
    page.sortBy('name');
    expect(api.list.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ page: 1, sort: 'name', direction: 'asc' }),
    );
  });
  it('cancels superseded list searches and stops requests when destroyed', fakeAsync(() => {
    fixture.detectChanges();
    const first = new Subject<any>();
    api.list.and.returnValues(
      first,
      of({ items: [], total: 0, page: 1, limit: 25 }),
    );
    page.search.setValue('old');
    tick(260);
    page.search.setValue('new');
    tick(260);
    first.next({ items: [detail().lead], total: 1, page: 1, limit: 25 });
    expect(page.rows).toHaveSize(0);
    const count = api.list.calls.count();
    page.search.setValue('last');
    fixture.destroy();
    tick(300);
    expect(api.list.calls.count()).toBe(count);
  }));
  it('does not let a late detail response show the previously selected lead', () => {
    fixture.detectChanges();
    const first = new Subject<LeadConversation>();
    api.detail.and.returnValues(first, of(detail('lead-2')));
    page.openLead(detail().lead);
    page.openLead(detail('lead-2').lead);
    first.next(detail());
    expect(page.selected?.lead.leadId).toBe('lead-2');
  });
  it('retains create edits and its idempotency key after a failed save, then refreshes once', () => {
    fixture.detectChanges();
    page.newLead();
    page.form.controls.displayName.setValue('New enquiry');
    const key = page.createKey;
    api.create.and.returnValue(
      throwError(() => ({ error: { error: 'Retry the same submission.' } })),
    );
    page.saveLead();
    expect(page.form.controls.displayName.value).toBe('New enquiry');
    expect(page.createKey).toBe(key);
    api.create.and.returnValue(of(detail()));
    page.saveLead();
    expect(api.create.calls.allArgs().map((args) => args[0])).toEqual([
      key,
      key,
    ]);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(page.editor).toBeNull();
  });
  it('requires a reason for qualification and highlights stale/server validation failures', () => {
    fixture.detectChanges();
    page.openLead(detail().lead);
    page.editLead();
    page.form.controls.stage.setValue('qualified');
    page.saveLead();
    expect(api.update).not.toHaveBeenCalled();
    expect(page.invalid('stageReason')).toBeTrue();
    page.form.controls.stageReason.setValue('Confirmed interest.');
    api.update.and.returnValue(
      throwError(() => ({
        error: { error: 'Reload the lead.', fields: ['assignedTo'] },
      })),
    );
    page.saveLead();
    expect(page.invalid('assignedTo')).toBeTrue();
    expect(page.editor).toBe('edit');
  });
  it('protects unsaved notes when moving to another lead', () => {
    fixture.detectChanges();
    page.openLead(detail().lead);
    page.note.setValue('Do not lose this note');
    page.openLead(detail('lead-2').lead);
    expect(page.confirmingDiscard).toBeTrue();
    expect(page.selectedId).toBe('lead-1');
    page.keepEditing();
    expect(page.note.value).toContain('Do not lose');
    page.openLead(detail('lead-2').lead);
    page.discard();
    expect(page.selectedId).toBe('lead-2');
    expect(page.note.value).toBe('');
  });
  it('keeps notes explicitly internal, escapes their body and retains failed note submissions', () => {
    fixture.detectChanges();
    page.openLead(detail().lead);
    page.note.setValue('Internal only');
    api.note.and.returnValue(
      throwError(() => ({ error: { error: 'Try again' } })),
    );
    page.addNote();
    const key = page.noteKey;
    expect(page.note.value).toBe('Internal only');
    const result = detail();
    result.events.push({
      id: '2',
      kind: 'note',
      body: '<img src=x onerror=alert(1)>',
      actorId: actor,
      metadata: {},
      createdAt: '2026-11-03T00:00:00Z',
    });
    api.note.and.returnValue(of(result));
    page.addNote();
    fixture.detectChanges();
    expect(api.note.calls.allArgs().map((a) => a[1])).toEqual([key, key]);
    expect(fixture.nativeElement.querySelector('.timeline img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img src=x');
    expect(page.note.value).toBe('');
  });
  it('keeps newer activity when an older page arrives after an ownership change', () => {
    fixture.detectChanges();
    const initial = { ...detail(), hasOlder: true };
    api.detail.and.returnValue(of(initial));
    page.openLead(initial.lead);
    const old = new Subject<any>();
    api.events.and.returnValue(old);
    page.olderEvents();
    const fresh = detail();
    fresh.lead.ownership = 'human';
    fresh.lead.humanOwner = actor;
    fresh.lead.ownershipVersion = 2;
    api.ownership.and.returnValue(of(fresh));
    page.ownership('human');
    old.next({ events: [], hasOlder: false });
    expect(page.selected?.lead.ownership).toBe('human');
    expect(page.selected?.events.length).toBe(1);
  });
  it('does not allow edits or display cached leads after initial access is denied', () => {
    api.context.and.returnValue(
      throwError(() => ({ error: { error: 'Access denied' } })),
    );
    fixture.detectChanges();
    expect(api.list).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.workspace')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Access denied');
  });
  for (const dark of [false, true])
    it(`fits the viewport and keeps the lead form usable in ${dark ? 'dark' : 'light'} mode`, async () => {
      document.documentElement.classList.toggle('dark', dark);
      fixture.detectChanges();
      page.view = 'leads';
      fixture.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const shell = root.querySelector('.lead-shell') as HTMLElement;
      expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth + 2);
      page.newLead();
      fixture.detectChanges();
      const modal = root.querySelector('.lead-modal') as HTMLElement;
      expect(modal.getBoundingClientRect().width).toBeLessThanOrEqual(
        window.innerWidth,
      );
      expect(
        (
          root.querySelector('#lead-name') as HTMLElement
        ).getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual(40);
    });
});
