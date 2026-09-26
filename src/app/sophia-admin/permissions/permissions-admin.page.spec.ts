import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SophiaAdminService } from '../sophia-admin.service';
import { PermissionsAdminPage } from './permissions-admin.page';

describe('PermissionsAdminPage', () => {
  let fixture: ComponentFixture<PermissionsAdminPage>;

  beforeEach(async () => {
    const admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', ['context', 'permissionRegistry', 'listMembers']);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', identityUserId: 'auditor', role: 'read_only_auditor', permissions: ['permissions.read'] } }));
    admin.permissionRegistry.and.returnValue(of({
      roles: [{ role: 'read_only_auditor', permissions: ['organisation.read', 'permissions.read'] }],
      permissions: ['platform.support.access', 'organisation.read', 'permissions.read'],
      mfaRequiredPermissions: ['platform.support.access'], platformPermissions: ['platform.support.access'],
      customRolesSupported: false, permissionElevationOverridesSupported: false,
    }));
    admin.listMembers.and.returnValue(of({ members: [{
      membership_id: 'member-1', identity_user_id: 'auditor', role_key: 'read_only_auditor', status: 'active',
      authorization_revision: 1, effective_permissions: ['organisation.read', 'permissions.read'],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }] }));
    await TestBed.configureTestingModule({
      imports: [PermissionsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }],
    }).compileComponents();
    fixture = TestBed.createComponent(PermissionsAdminPage);
    fixture.detectChanges();
  });

  it('keeps platform authority separate and shows server-computed effective grants', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Not assignable by tenant roles');
    expect(element.textContent).toContain('platform.support.access');
    expect(element.textContent).toContain('2 effective grants');
    expect(fixture.componentInstance.tenantPermissions()).not.toContain('platform.support.access');
  });
});
