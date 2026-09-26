import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { ConversationsAdminPage } from './conversations-admin.page';

describe('ConversationsAdminPage', () => {
  let fixture: ComponentFixture<ConversationsAdminPage>; let admin: jasmine.SpyObj<SophiaAdminService>;
  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'conversations', 'conversationExports', 'conversation', 'conversationContent',
      'addConversationNote', 'createConversationExport', 'downloadConversationExport',
    ]);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'operator-1',
      role: 'operations_member', permissions: ['conversations.read_metadata', 'conversations.annotate'] } }));
    admin.conversations.and.returnValue(of({ conversations: [{
      session_id: 'session-1', status: 'closed', runtime_api_version: 'v2', channel: 'voice', outcome: 'completed',
      tool_call_count: 1, started_at: '2026-09-25T00:00:00Z', escalation_status: null,
    }], hasMore: false }));
    admin.conversationExports.and.returnValue(of({ exports: [] }));
    await TestBed.configureTestingModule({ imports: [ConversationsAdminPage],
      providers: [{ provide: SophiaAdminService, useValue: admin }, provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(ConversationsAdminPage); fixture.detectChanges();
  });

  it('shows metadata without implying that content, exports or audio playback are granted', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('1 loaded conversations'); expect(text).toContain('voice');
    expect(text).not.toContain('Create metadata export'); expect(text).not.toContain('Load permitted content');
    expect(admin.conversationExports).not.toHaveBeenCalled();
  });

  it('renders untrusted timeline values as text after selecting a conversation', () => {
    admin.conversation.and.returnValue(of({
      session: { session_id: 'session-1', status: 'closed', runtime_api_version: 'v2', channel: 'voice', outcome: 'completed', started_at: '2026-09-25T00:00:00Z' },
      timeline: [{ id: 'event-1', kind: '<img src=x onerror=alert(1)>', occurredAt: '2026-09-25T00:01:00Z' }],
      escalations: [], contentAccess: { requiredPermission: 'conversations.read_content', recentMfaRequired: true },
      transcript: { status: 'unavailable_not_recorded' }, audio: { status: 'unavailable_not_recorded' },
    }));
    fixture.componentInstance.inspect(fixture.componentInstance.conversations()[0]); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('<img src=x onerror=alert(1)>');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No playback or reconstructed transcript is available');
  });
});
