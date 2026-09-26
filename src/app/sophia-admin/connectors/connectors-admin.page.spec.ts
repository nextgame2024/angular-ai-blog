import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { ConnectorsAdminPage } from './connectors-admin.page';

describe('ConnectorsAdminPage', () => {
  let fixture: ComponentFixture<ConnectorsAdminPage>;
  let component: ConnectorsAdminPage;
  let admin: jasmine.SpyObj<SophiaAdminService>;
  const registration = { connectorKey: 'approved-connector', displayName: 'Approved connector',
    authMode: 'runtime-scoped-token' as const, accountBindingMode: 'tenant-external-company' as const,
    allowedScopes: ['catalog:read', 'booking:write'], supportsCredentialRotation: false as const };

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'connectorRegistry', 'connectorBindings', 'connectConnector', 'testConnector',
      'reconnectConnector', 'disconnectConnector',
    ]);
    admin.context.and.returnValue(of({ principal: { tenantId: 'tenant-1', externalCompanyId: 'company-1',
      identityUserId: 'user-1', role: 'configuration_editor', permissions: ['connectors.read', 'connectors.manage', 'connectors.test'] } }));
    admin.connectorRegistry.and.returnValue(of({ connectors: [registration] }));
    admin.connectorBindings.and.returnValue(of({ bindings: [] }));
    const binding = { connectorBindingId: 'binding-1', connectorKey: 'approved-connector', externalAccountId: 'company-1',
      allowedScopes: ['catalog:read'], status: 'active' as const, revision: 1, healthStatus: 'healthy' as const, credentialConfigured: true };
    admin.connectConnector.and.returnValue(of(binding)); admin.testConnector.and.returnValue(of(binding));
    admin.reconnectConnector.and.returnValue(of(binding)); admin.disconnectConnector.and.returnValue(of({ ...binding, status: 'disconnecting', unresolvedCommandCount: 1, reconciliationRequired: true }));
    await TestBed.configureTestingModule({ imports: [ConnectorsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(ConnectorsAdminPage); component = fixture.componentInstance; fixture.detectChanges();
  });

  it('uses the authenticated tenant account and selected approved scopes without accepting secrets', () => {
    component.requestedScopes.setValue(['catalog:read']); component.connect();
    expect(admin.connectConnector).toHaveBeenCalledWith('tenant-1', {
      connectorKey: 'approved-connector', externalAccountId: 'company-1', requestedScopes: ['catalog:read'],
    });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[type="password"]')).toBeNull();
    expect(element.textContent).toContain('Secret values cannot be entered, viewed, exported, or rotated');
    expect(element.textContent).not.toContain('runtime://');
  });
});
