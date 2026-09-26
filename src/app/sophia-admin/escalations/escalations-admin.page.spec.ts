import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { EscalationsAdminPage } from './escalations-admin.page';

describe('EscalationsAdminPage', () => {
  let fixture: ComponentFixture<EscalationsAdminPage>;
  let component: EscalationsAdminPage;
  let admin: jasmine.SpyObj<SophiaAdminService>;
  const caseItem = { escalationCaseId: 'case-1', escalationPolicyVersionId: 'policy-version-1', escalationDestinationId: 'destination-1',
    reasonCode: 'user_requested_human', summary: 'Customer requested an operator.', priority: 'normal', status: 'open' as const,
    deliveryStatus: 'queued', transferStatus: 'not_requested', revision: 1, createdAt: '2026-09-25T00:00:00Z', updatedAt: '2026-09-25T00:00:00Z' };

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'escalationChannels', 'escalationDestinations', 'escalationPolicies', 'escalationCases',
      'createEscalationDestination', 'createEscalationPolicy', 'createEscalationPolicyVersion',
      'publishEscalationPolicy', 'escalationCase', 'assignEscalationCase', 'startEscalationCase', 'resolveEscalationCase',
    ]);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'operator-1', role: 'operations_member', permissions: ['escalations.read', 'escalations.configure', 'escalations.assign', 'escalations.resolve'] } }));
    admin.escalationChannels.and.returnValue(of({ channels: [
      { channel: 'operations_inbox', availability: 'supported', semantics: 'case_queued' },
      { channel: 'callback', availability: 'unsupported', semantics: 'callback_requested', reason: 'No executable adapter.' },
      { channel: 'live_transfer', availability: 'unsupported', semantics: 'live_connected', reason: 'No verified transfer.' },
    ] }));
    admin.escalationDestinations.and.returnValue(of({ destinations: [{ escalationDestinationId: 'destination-1', destinationKey: 'ops', displayName: 'Operations inbox', channel: 'operations_inbox', availability: 'supported', status: 'active', revision: 1 }] }));
    admin.escalationPolicies.and.returnValue(of({ policies: [] })); admin.escalationCases.and.returnValue(of({ cases: [caseItem] }));
    admin.escalationCase.and.returnValue(of({ ...caseItem, events: [{ escalation_case_event_id: 'event-1', event_type: 'created', status: 'open', delivery_status: 'queued', transfer_status: 'not_requested', metadata: {}, created_at: '2026-09-25T00:00:00Z' }] }));
    admin.createEscalationDestination.and.returnValue(of({})); admin.createEscalationPolicy.and.returnValue(of({}));
    admin.createEscalationPolicyVersion.and.returnValue(of({})); admin.publishEscalationPolicy.and.returnValue(of({}));
    admin.assignEscalationCase.and.returnValue(of({ ...caseItem, status: 'assigned', revision: 2 }));
    admin.startEscalationCase.and.returnValue(of({ ...caseItem, status: 'in_progress', revision: 2 }));
    admin.resolveEscalationCase.and.returnValue(of({ ...caseItem, status: 'resolved', revision: 2 }));
    await TestBed.configureTestingModule({ imports: [EscalationsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(EscalationsAdminPage); component = fixture.componentInstance; fixture.detectChanges();
  });

  it('keeps unsupported callback and live transfer visible but unavailable for destination creation', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('callback'); expect(text).toContain('unsupported'); expect(text).toContain('not a callback');
    const options = [...fixture.nativeElement.querySelectorAll('select[formControlName="channel"] option')]
      .map((option: Element) => option.textContent?.trim());
    expect(options).toEqual(['operations_inbox']);
  });

  it('renders case, delivery and transfer states independently and preserves event evidence', () => {
    component.selectCase(caseItem); fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Delivery: queued'); expect(text).toContain('Transfer: not_requested');
    expect(text).toContain('delivery queued · transfer not_requested');
    component.assignToMe(caseItem);
    expect(admin.assignEscalationCase).toHaveBeenCalledWith('tenant-1', 'case-1', 'operator-1', 1);
  });
});
