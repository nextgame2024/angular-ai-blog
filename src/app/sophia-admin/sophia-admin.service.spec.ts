import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SophiaAdminService } from './sophia-admin.service';
import { PersistanceService } from '../shared/services/persistance.service';

describe('SophiaAdminService', () => {
  let service: SophiaAdminService;
  let http: HttpTestingController;
  let accessToken: string | null;

  beforeEach(() => {
    accessToken = 'admin-token';
    TestBed.configureTestingModule({
      providers: [SophiaAdminService, provideHttpClient(), provideHttpClientTesting(), {
        provide: PersistanceService,
        useValue: { get: (key: string) => key === 'accessToken' ? accessToken : null },
      }],
    });
    service = TestBed.inject(SophiaAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('derives the Admin API from the runtime origin and authenticates explicitly', () => {
    service.context().subscribe((response) => expect(response.principal.tenantId).toBe('tenant-1'));
    const request = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/context'));
    expect(request.request.headers.get('Authorization')).toBe('Token admin-token');
    request.flush({ principal: { tenantId: 'tenant-1', identityUserId: 'user-1', role: 'configuration_editor', permissions: ['knowledge.read'] } });
  });

  it('uses the server-resolved tenant for knowledge requests without arbitrary URLs', () => {
    service.listSources('11111111-1111-4111-8111-111111111111').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/11111111-1111-4111-8111-111111111111/knowledge/sources'));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token admin-token');
    request.flush({ sources: [] });
  });

  it('loads the persisted tenant onboarding readiness with the current credential', () => {
    service.onboardingReadiness('tenant/1').subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/onboarding-readiness',
    ));
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Token admin-token');
    request.flush({ tenantId: 'tenant/1', steps: [] });
  });

  it('targets tenant-bound membership and permission APIs with optimistic revisions', () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    service.updateMember(tenantId, 'member/1', {
      expectedRevision: 3,
      role: 'release_publisher',
    }).subscribe();
    const membership = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/11111111-1111-4111-8111-111111111111/members/member%2F1',
    ));
    expect(membership.request.method).toBe('PATCH');
    expect(membership.request.body).toEqual({ expectedRevision: 3, role: 'release_publisher' });
    membership.flush({ membership_id: 'member/1' });

    service.permissionRegistry(tenantId).subscribe();
    const permissions = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/11111111-1111-4111-8111-111111111111/permissions',
    ));
    expect(permissions.request.method).toBe('GET');
    permissions.flush({ roles: [], permissions: [], mfaRequiredPermissions: [], platformPermissions: [] });
  });

  it('always requests dry-run invitation delivery', () => {
    service.issueInvitation('tenant-1', {
      email: 'person@example.com', role: 'configuration_editor', expiresInHours: 24,
    }).subscribe();
    const request = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/invitations'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'person@example.com', role: 'configuration_editor', expiresInHours: 24, deliveryMode: 'dry-run',
    });
    request.flush({ invitationId: 'invite-1', revision: 1, expiresAt: new Date().toISOString(), delivery: { mode: 'dry-run', token: 'token' } });
  });

  it('uses tenant-scoped agent dependency and deterministic preview endpoints', () => {
    service.agentDependencies('tenant-1').subscribe();
    const dependencies = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant-1/agents/authoring-dependencies',
    ));
    expect(dependencies.request.method).toBe('GET');
    dependencies.flush({ businessProfiles: [], experienceProfiles: [], restrictedSections: [] });

    service.previewAgent('tenant-1', 'agent/1', { customerName: 'Taylor' }).subscribe();
    const preview = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant-1/agents/agent%2F1/preview',
    ));
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({ variables: { customerName: 'Taylor' } });
    preview.flush({ mode: 'deterministic-composition-only', externalEffects: false, meteredSessionCreated: false });
  });

  it('uses tenant-scoped tool and connector controls without a credential payload', () => {
    service.capabilityAuthoringDependencies('tenant-1').subscribe();
    const dependencies = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/capability-authoring-dependencies'));
    expect(dependencies.request.method).toBe('GET'); dependencies.flush({ businessProfileVersions: [], capabilityBindings: [] });

    service.putCapabilityBinding('tenant-1', 'profile/1', 'catalog', { connectorBindingId: 'binding-1', enabled: true }).subscribe();
    const binding = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/business-profile-versions/profile%2F1/capability-bindings/catalog'));
    expect(binding.request.method).toBe('PUT'); binding.flush({});

    service.connectConnector('tenant-1', { connectorKey: 'approved', externalAccountId: 'company-1', requestedScopes: ['catalog:read'] }).subscribe();
    const connector = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/connectors'));
    expect(connector.request.body).toEqual({ connectorKey: 'approved', externalAccountId: 'company-1', requestedScopes: ['catalog:read'] });
    expect(JSON.stringify(connector.request.body)).not.toContain('credential'); connector.flush({});
  });

  it('uses versioned workflow and optimistic escalation-case endpoints', () => {
    service.publishWorkflowVersion('tenant-1', 'version/1').subscribe();
    const workflow = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/workflow-versions/version%2F1/publish'));
    expect(workflow.request.method).toBe('POST'); workflow.flush({});

    service.assignEscalationCase('tenant-1', 'case/1', 'operator-1', 4).subscribe();
    const escalation = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/escalation-cases/case%2F1/assign'));
    expect(escalation.request.body).toEqual({ assignedToIdentity: 'operator-1', expectedRevision: 4 });
    escalation.flush({});
  });

  it('keeps conversation metadata, content, notes and exports on explicit tenant endpoints', () => {
    service.conversations('tenant-1', { channel: 'voice', limit: 50 }).subscribe();
    const list = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/conversations'));
    expect(list.request.params.get('channel')).toBe('voice'); list.flush({ conversations: [], hasMore: false });

    service.conversationContent('tenant-1', 'session/1').subscribe();
    const content = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/conversations/session%2F1/content'));
    expect(content.request.method).toBe('GET'); content.flush({ operationalContent: { status: 'available', items: [] } });

    service.addConversationNote('tenant-1', 'session/1', 'controlled note').subscribe();
    const note = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/conversations/session%2F1/notes'));
    expect(note.request.body).toEqual({ note: 'controlled note' }); note.flush({ conversationOperatorNoteId: 'note-1' });

    service.createConversationExport('tenant-1', 'session/1', 'metadata', 250).subscribe();
    const created = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/conversations/session%2F1/exports'));
    expect(created.request.body).toEqual({ format: 'json', scope: 'metadata', maxItems: 250 }); created.flush({ status: 'ready' });
  });

  it('uses tenant-scoped analytics filters and separate bounded export endpoints', () => {
    service.analytics('tenant-1', { channel: 'voice', from: '2026-09-01T00:00:00.000Z' }).subscribe();
    const dashboard = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/analytics'));
    expect(dashboard.request.params.get('channel')).toBe('voice'); dashboard.flush({ series: [], metricRegistry: [] });

    service.createAnalyticsExport('tenant-1', { channel: 'voice' }, 250).subscribe();
    const created = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/analytics/exports'));
    expect(created.request.body).toEqual({ format: 'json', filters: { channel: 'voice' }, maxPoints: 250 });
    created.flush({ status: 'ready' });

    service.downloadAnalyticsExport('tenant-1', 'export/1').subscribe();
    const download = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/tenants/tenant-1/analytics/exports/jobs/export%2F1'));
    expect(download.request.method).toBe('GET'); download.flush({ digest: 'abc', document: {} });
  });

  it('keeps tenant usage and commercial reads on separate permissioned endpoints', () => {
    service.usageWorkspace('tenant/1').subscribe();
    const usage = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/usage',
    ));
    expect(usage.request.method).toBe('GET'); usage.flush({ statusCounts: {}, dimensionTotals: [] });

    service.commercialWorkspace('tenant/1').subscribe();
    const commercial = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/commercial',
    ));
    expect(commercial.request.method).toBe('GET'); commercial.flush({ assignment: null, subscriptions: [], invoices: [] });

    service.usageLimits('tenant/1').subscribe();
    const limits = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/limits',
    ));
    expect(limits.request.method).toBe('GET'); limits.flush({ limits: {} });

    service.updateUsageLimits('tenant/1', { expectedRevision: 2, maxConcurrentSessions: 3,
      maxToolCallsPerMinute: 10, providerCostAlert: { thresholdMicrounits: '1000', currency: 'AUD' } }).subscribe();
    const update = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/limits',
    ));
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ expectedRevision: 2, maxConcurrentSessions: 3,
      maxToolCallsPerMinute: 10, providerCostAlert: { thresholdMicrounits: '1000', currency: 'AUD' } });
    update.flush({ limits: {} });
  });

  it('uses protected hosted billing and reconciliation endpoints', () => {
    service.createBillingCheckout('tenant/1', { requestId: 'request-1', planVersionId: 'plan-1' }).subscribe();
    let request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/checkout',
    ));
    expect(request.request.method).toBe('POST'); request.flush({});

    service.createBillingPortal('tenant/1', { requestId: 'request-2' }).subscribe();
    request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/portal',
    ));
    expect(request.request.method).toBe('POST'); request.flush({});

    service.reconcileBilling('tenant/1', { requestId: 'request-3' }).subscribe();
    request = http.expectOne((candidate) => candidate.url.endsWith(
      '/api/admin/v1/tenants/tenant%2F1/usage-billing/reconcile',
    ));
    expect(request.request.method).toBe('POST'); request.flush({});
  });

  it('invalidates the cached context when the login credential changes', () => {
    service.context().subscribe();
    http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/context'))
      .flush({ principal: { tenantId: 'tenant-1', permissions: [] } });

    accessToken = 'replacement-token';
    service.context().subscribe();
    const replacement = http.expectOne((candidate) => candidate.url.endsWith('/api/admin/v1/context'));
    expect(replacement.request.headers.get('Authorization')).toBe('Token replacement-token');
    replacement.flush({ principal: { tenantId: 'tenant-2', permissions: [] } });
  });

  it('does not add Business Manager credentials to a private presigned upload', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 200 }));
    const file = new File(['approved'], 'policy.txt', { type: 'text/plain' });
    await service.uploadPrivateObject('https://private-storage.example/upload', {
      'content-type': 'text/plain', 'x-amz-checksum-sha256': 'checksum',
    }, file);
    expect(fetchSpy).toHaveBeenCalledWith('https://private-storage.example/upload', jasmine.objectContaining({
      method: 'PUT', credentials: 'omit', headers: jasmine.objectContaining({ 'content-type': 'text/plain' }),
    }));
    const init = fetchSpy.calls.mostRecent().args[1] as RequestInit;
    expect(new Headers(init.headers).has('authorization')).toBeFalse();
  });
});
