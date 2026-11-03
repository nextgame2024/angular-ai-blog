import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { LeadReplyComponent } from './lead-reply.component';
import {
  LeadWorkspaceService,
  LeadConversation,
} from './lead-workspace.service';
const data = (): LeadConversation => ({
  lead: {
    leadId: 'lead',
    ownershipVersion: 1,
    ownership: 'human',
    humanOwner: 'actor',
  } as any,
  events: [],
  hasOlder: false,
  reply: {
    canSend: true,
    blockedReason: null,
    windowEndsAt: null,
    optedOut: false,
    jobs: [],
    messages: [],
  },
});
describe('Customer WhatsApp reply composer', () => {
  let fixture: ComponentFixture<LeadReplyComponent>,
    page: LeadReplyComponent,
    api: jasmine.SpyObj<LeadWorkspaceService>;
  beforeEach(async () => {
    api = jasmine.createSpyObj('LeadWorkspaceService', [
      'reply',
      'draft',
      'detail',
      'ownership',
    ]);
    api.reply.and.returnValue(of(data()));
    api.draft.and.returnValue(of(data()));
    api.detail.and.returnValue(of(data()));
    await TestBed.configureTestingModule({
      imports: [LeadReplyComponent],
      providers: [{ provide: LeadWorkspaceService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(LeadReplyComponent);
    page = fixture.componentInstance;
    fixture.componentRef.setInput('conversation', data());
    fixture.componentRef.setInput('actorId', 'actor');
    fixture.detectChanges();
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    fixture.destroy();
  });
  it('queues a customer reply once and retains its retry identity and body after failure', () => {
    page.body.setValue('Hello');
    api.reply.and.returnValue(
      throwError(() => ({ error: { error: 'Try again' } })),
    );
    page.send();
    const key = api.reply.calls.mostRecent().args[1];
    expect(page.body.value).toBe('Hello');
    expect(page.hasUnsaved).toBeTrue();
    api.reply.and.returnValue(of(data()));
    page.send();
    expect(api.reply.calls.mostRecent().args[1]).toBe(key);
    expect(page.body.value).toBe('');
    expect(page.notice).toContain('queued');
  });
  it('keeps internal notes separate and never sends a draft automatically', () => {
    page.draft();
    expect(api.draft).toHaveBeenCalledWith('lead', 1);
    expect(api.reply).not.toHaveBeenCalled();
    page.useDraft('Approved answer');
    expect(page.body.value).toBe('Approved answer');
    page.useDraft('Replacement');
    expect(page.body.value).toBe('Approved answer');
    expect(fixture.nativeElement.textContent).toContain(
      'visible to the customer',
    );
  });
  it('does not submit a blocked reply or double-submit while busy', () => {
    page.conversation.reply!.canSend = false;
    page.body.setValue('Hello');
    page.send();
    expect(api.reply).not.toHaveBeenCalled();
    page.conversation.reply!.canSend = true;
    const pending = new Subject<LeadConversation>();
    api.reply.and.returnValue(pending);
    page.send();
    page.send();
    expect(api.reply).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(pending.observed).toBeFalse();
  });
  it('polls only pending work and tears down timers when the thread changes', fakeAsync(() => {
    const d = data();
    d.reply!.messages = [
      {
        id: 'm',
        state: 'queued',
        safeCode: null,
        createdAt: '2026-11-03T00:00:00Z',
      },
    ];
    fixture.componentRef.setInput('conversation', d);
    fixture.detectChanges();
    tick(5000);
    expect(api.detail).toHaveBeenCalledTimes(1);
    const next = data();
    next.lead.leadId = 'next';
    fixture.componentRef.setInput('conversation', next);
    fixture.detectChanges();
    tick(20000);
    expect(api.detail).toHaveBeenCalledTimes(1);
  }));
  it('escapes draft content and distinguishes uncertain delivery', () => {
    const d = data();
    d.reply!.jobs = [
      {
        id: 'j',
        state: 'ready',
        answer: '<img src=x onerror=alert(1)>',
        sources: ['source'],
        createdAt: '',
      },
    ];
    d.reply!.messages = [
      {
        id: 'm',
        state: 'unknown',
        safeCode: null,
        createdAt: '2026-11-03T00:00:00Z',
      },
    ];
    fixture.componentRef.setInput('conversation', d);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Delivery uncertain');
    expect(fixture.nativeElement.textContent).toContain(
      'Check the conversation',
    );
  });
  it('fits the current viewport with shared touch-sized actions in both themes', () => {
    for (const dark of [false, true]) {
      document.documentElement.classList.toggle('dark', dark);
      fixture.detectChanges();
      const box = fixture.nativeElement.querySelector('section');
      expect(box.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      expect(getComputedStyle(box).backgroundColor).toBe(
        dark ? 'rgb(23, 32, 51)' : 'rgb(248, 251, 255)',
      );
      expect(
        getComputedStyle(fixture.nativeElement.querySelector('button'))
          .minHeight,
      ).toBe('44px');
    }
  });
  it('requires an explicit eligible resume action', () => {
    api.ownership.and.returnValue(of(data()));
    page.resume();
    expect(api.ownership).not.toHaveBeenCalled();
    page.conversation.reply!.canResume = true;
    page.resume();
    expect(api.ownership).toHaveBeenCalledWith('lead', 1, 'bot');
  });
});
