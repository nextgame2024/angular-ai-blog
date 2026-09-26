import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SophiaAdminService } from '../sophia-admin.service';
import type { AdminOnboardingReadiness } from '../sophia-admin.types';
import { SophiaAdminOverviewPage } from './sophia-admin-overview.page';

const readiness: AdminOnboardingReadiness = {
  tenantId: 'tenant-1', generatedAt: '2026-09-25T00:00:00Z',
  scope: 'existing-authorised-tenant',
  foundationalProfileAuthoring: 'pre-provisioned-outside-current-admin-ui',
  activationReady: false, completeVisibility: true,
  steps: [{ key: 'foundational-profiles', label: 'Foundational profiles', status: 'not_configured',
    detail: '0 provider profile versions published.', moduleIds: ['ADM-03'] }],
  futureModules: [{ moduleId: 'ADM-12', status: 'planned', taskId: 'P6-A01' }],
};

describe('SophiaAdminOverviewPage', () => {
  let fixture: ComponentFixture<SophiaAdminOverviewPage>;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', ['context', 'onboardingReadiness']);
    admin.context.and.returnValue(of({ principal: {
      tenantId: 'tenant-1', identityUserId: 'operator-1', role: 'organisation_owner',
      permissions: ['organisation.read', 'agents.read'],
    } }));
    admin.onboardingReadiness.and.returnValue(of(readiness));
    await TestBed.configureTestingModule({
      imports: [SophiaAdminOverviewPage],
      providers: [provideRouter([]), { provide: SophiaAdminService, useValue: admin }],
    }).compileComponents();
    fixture = TestBed.createComponent(SophiaAdminOverviewPage);
    fixture.detectChanges();
  });

  it('uses the server-resolved tenant for the persisted integration gate', () => {
    expect(admin.onboardingReadiness).toHaveBeenCalledOnceWith('tenant-1');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Existing authorised tenant readiness');
    expect(text).toContain('Configuration incomplete');
    expect(text).toContain('Foundational profiles');
    expect(text).toContain('Not configured');
  });

  it('states the greenfield provisioning boundary and future module status', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('pre-provisioned outside the current Admin UI');
    expect(text).toContain('not a greenfield organisation-provisioning workflow');
    expect(text).toContain('P6-A01, P6-A03 and P6-A05');
    expect(text).not.toContain('Available now · ADM-06');
  });
});
