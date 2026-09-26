import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SophiaAdminService } from '../sophia-admin.service';
import { ToolsAdminPage } from './tools-admin.page';

describe('ToolsAdminPage', () => {
  let fixture: ComponentFixture<ToolsAdminPage>;
  let component: ToolsAdminPage;
  let admin: jasmine.SpyObj<SophiaAdminService>;

  beforeEach(async () => {
    admin = jasmine.createSpyObj<SophiaAdminService>('SophiaAdminService', [
      'context', 'toolRegistry', 'capabilityAuthoringDependencies', 'connectorBindings',
      'testToolContract', 'putCapabilityBinding',
    ]);
    admin.context.and.returnValue(of({ principal: {
      tenantId: 'tenant-1', identityUserId: 'user-1', role: 'configuration_editor',
      permissions: ['tools.read', 'tools.bind', 'tools.test'],
    } }));
    admin.toolRegistry.and.returnValue(of({
      catalogVersion: 'neutral-v1',
      packs: [{ packId: 'optional-pack', version: '1.0.0', connectorKeys: ['approved-connector'], capabilities: ['catalog'], operations: ['catalog.search'] }],
      operations: [{ operationId: 'catalog.search', port: 'CatalogPort', sideEffectClass: 'read', confirmationPolicy: 'none', contractVersion: 'capability-contract-v1' }],
      tools: [{ toolId: 'catalog.search', version: '1.0.0', description: 'Search an approved catalog.',
        inputSchema: { type: 'object', additionalProperties: false, properties: { query: { type: 'string' } } },
        requiredCapability: 'catalog', requiredScopes: ['catalog:read'], riskClass: 'low', sideEffectClass: 'read',
        confirmationPolicy: 'none', timeoutMs: 8000, retryPolicy: 'safe-read', idempotencyPolicy: 'not-applicable' }],
    }));
    admin.capabilityAuthoringDependencies.and.returnValue(of({
      businessProfileVersions: [
        { businessProfileVersionId: 'draft-1', profileKey: 'neutral', displayName: 'Neutral service', version: 2, revision: 1, status: 'draft', editable: true },
        { businessProfileVersionId: 'published-1', profileKey: 'neutral', displayName: 'Neutral service', version: 1, revision: 1, status: 'published', editable: false },
      ], capabilityBindings: [{ capabilityBindingId: 'cap-1', businessProfileVersionId: 'draft-1', capabilityKey: 'catalog', connectorKey: 'approved-connector', connectorBindingId: 'connector-1', policyVersion: 'compiled:optional-pack@1.0.0', enabled: true, revision: 2 }],
    }));
    admin.connectorBindings.and.returnValue(of({ bindings: [{ connectorBindingId: 'connector-1', connectorKey: 'approved-connector', externalAccountId: 'account-1', allowedScopes: ['catalog:read'], status: 'active', revision: 1, healthStatus: 'healthy', credentialConfigured: true }] }));
    admin.testToolContract.and.returnValue(of({ operationId: 'catalog.search', mode: 'synthetic-contract-only', externalEffects: false, policyDecision: 'allowed', sideEffectClass: 'read', note: 'No external call.' }));
    admin.putCapabilityBinding.and.returnValue(of({ capabilityBindingId: 'cap-1', businessProfileVersionId: 'draft-1', capabilityKey: 'catalog', connectorKey: 'approved-connector', connectorBindingId: 'connector-1', policyVersion: 'compiled:optional-pack@1.0.0', enabled: true, revision: 3 }));
    await TestBed.configureTestingModule({ imports: [ToolsAdminPage], providers: [{ provide: SophiaAdminService, useValue: admin }] }).compileComponents();
    fixture = TestBed.createComponent(ToolsAdminPage); component = fixture.componentInstance; fixture.detectChanges();
  });

  it('shows compiled policy/schema metadata and runs only the synthetic no-effects test', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('catalog.search'); expect(text).toContain('additionalProperties');
    component.runSandbox('catalog.search'); fixture.detectChanges();
    expect(admin.testToolContract).toHaveBeenCalledWith('tenant-1', 'catalog.search');
    expect(fixture.nativeElement.textContent).toContain('External effects: false');
  });

  it('binds an active compatible connector only to a draft profile and blocks published edits', () => {
    component.saveBinding();
    expect(admin.putCapabilityBinding).toHaveBeenCalledWith('tenant-1', 'draft-1', 'catalog', {
      connectorBindingId: 'connector-1', enabled: true, expectedRevision: 2,
    });
    component.profileVersionId.setValue('published-1'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Published profile versions are immutable');
    expect((fixture.nativeElement.querySelector('.primary') as HTMLButtonElement).disabled).toBeTrue();
  });
});
