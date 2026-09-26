import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SophiaAdminService } from '../sophia-admin.service';
import type { SophiaAdminPermissionRegistry } from '../sophia-admin.types';
import { UsersAdminPage } from './users-admin.page';

const registry: SophiaAdminPermissionRegistry = {
  roles: [{ role: 'organisation_owner', permissions: ['users.roles.assign'] }, { role: 'configuration_editor', permissions: [] }],
  permissions: ['users.roles.assign'], mfaRequiredPermissions: ['users.roles.assign'],
  platformPermissions: ['platform.support.access'], customRolesSupported: false,
  permissionElevationOverridesSupported: false,
};

describe('UsersAdminPage', () => {
  let fixture: ComponentFixture<UsersAdminPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'listMembers', 'listInvitations', 'permissionRegistry',
      'issueInvitation', 'updateMember', 'revokeInvitation',
    ]);
    admin.context.and.returnValue(of({ principal: {
      tenantId: 'tenant-1', identityUserId: 'owner', membershipId: 'owner-membership', role: 'organisation_owner',
      permissions: ['users.read', 'users.invite', 'users.manage', 'users.roles.assign'],
    } }));
    admin.listMembers.and.returnValue(of({ members: [{
      membership_id: 'owner-membership', identity_user_id: 'owner', role_key: 'organisation_owner', status: 'active',
      authorization_revision: 1, effective_permissions: ['users.read', 'users.roles.assign'],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }, {
      membership_id: 'member-2', identity_user_id: 'editor', role_key: 'configuration_editor', status: 'active',
      authorization_revision: 2, effective_permissions: ['organisation.read'],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }] }));
    admin.listInvitations.and.returnValue(of({ invitations: [] }));
    admin.permissionRegistry.and.returnValue(of(registry));
    await TestBed.configureTestingModule({
      imports: [UsersAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }],
    }).compileComponents();
    fixture = TestBed.createComponent(UsersAdminPage);
    fixture.detectChanges();
  });

  it('renders server-derived grants and fails closed for privileged changes without MFA evidence', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('server-blocked');
    expect(element.textContent).toContain('organisation.read');
    expect(fixture.componentInstance.canMutateMemberships).toBeFalse();
    expect((element.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(admin.issueInvitation).not.toHaveBeenCalled();
  });

  it('submits a valid dry-run invitation only when recent MFA evidence is present', () => {
    fixture.componentInstance.principal.update((principal) => ({
      ...principal!, mfaVerifiedAt: new Date().toISOString(),
    }));
    admin.issueInvitation.and.returnValue(of({
      invitationId: 'invite-1', revision: 1, expiresAt: '2026-09-26T00:00:00Z',
      delivery: { mode: 'dry-run', token: 'one-time-token' },
    }));
    fixture.componentInstance.inviteForm.setValue({
      email: 'Person@Example.com', role: 'configuration_editor', expiresInHours: 24,
    });

    fixture.componentInstance.issueInvitation();

    expect(admin.issueInvitation).toHaveBeenCalledWith('tenant-1', {
      email: 'person@example.com', role: 'configuration_editor', expiresInHours: 24,
    });
    expect(fixture.componentInstance.receipt()?.delivery.token).toBe('one-time-token');
  });
});
