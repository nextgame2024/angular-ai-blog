import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SophiaAdminService } from '../sophia-admin.service';
import { OrganisationsAdminPage } from './organisations-admin.page';

describe('OrganisationsAdminPage', () => {
  let fixture: ComponentFixture<OrganisationsAdminPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'getOrganisation', 'updateOrganisation', 'suspendOrganisation', 'resumeOrganisation',
    ]);
    admin.context.and.returnValue(of({ principal: {
      tenantId: 'tenant-1', identityUserId: 'owner', membershipId: 'membership-1',
      role: 'organisation_owner', permissions: ['organisation.read', 'organisation.manage', 'organisation.suspend'],
    } }));
    admin.getOrganisation.and.returnValue(of({
      customer_id: 'tenant-1', name: 'Neutral Company', status: 'active', settings_revision: 4,
      metadata: { timezone: 'Australia/Brisbane', defaultLocale: 'en-AU', branding: { displayName: 'Neutral' } },
    }));
    await TestBed.configureTestingModule({
      imports: [OrganisationsAdminPage],
      providers: [{ provide: SophiaAdminService, useValue: admin }],
    }).compileComponents();
    fixture = TestBed.createComponent(OrganisationsAdminPage);
    fixture.detectChanges();
  });

  it('renders only the server-bound tenant and keeps MFA lifecycle actions unavailable without evidence', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.form.controls.name.value).toBe('Neutral Company');
    expect(element.textContent).toContain('cannot list, create, or switch');
    expect(element.textContent).toContain('Recent MFA evidence is required');
    expect((element.querySelector('.danger') as HTMLButtonElement).disabled).toBeTrue();
    expect(admin.suspendOrganisation).not.toHaveBeenCalled();
  });

  it('does not invent optional locale, timezone, or branding values on save', () => {
    admin.updateOrganisation.and.returnValue(of({
      customer_id: 'tenant-1', name: 'Neutral Company', status: 'active', settings_revision: 5, metadata: {},
    }));
    fixture.componentInstance.form.setValue({
      name: 'Neutral Company', displayName: '', primaryColour: '', timezone: '', defaultLocale: '',
    });

    fixture.componentInstance.save();

    expect(admin.updateOrganisation).toHaveBeenCalledWith('tenant-1', {
      expectedRevision: 4,
      name: 'Neutral Company',
    });
  });
});
