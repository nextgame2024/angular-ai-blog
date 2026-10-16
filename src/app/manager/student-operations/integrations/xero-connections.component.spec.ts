import { XeroConnectionsComponent } from './xero-connections.component';
import type { XeroConnectionStatus } from '../student-operations.types';

describe('XeroConnectionsComponent scope warning', () => {
  function withScopes(missingAttachmentScopes: string[]): XeroConnectionsComponent {
    const component = Object.create(XeroConnectionsComponent.prototype) as XeroConnectionsComponent;
    component.status = {
      provider: 'xero',
      configured: true,
      mode: 'read_only',
      requestedScopes: ['accounting.attachments.read'],
      connections: [{
        connectionId: 'connection-1',
        tenantId: 'xero-tenant-1',
        tenantName: 'TRUST',
        tenantType: 'ORGANISATION',
        tenantShortCode: null,
        status: 'active',
        healthStatus: 'healthy',
        lastTestedAt: null,
        lastErrorCode: null,
        organisationRole: 'trust',
        missingStudentDiscoveryScopes: [],
        missingAttachmentScopes,
      }],
    } satisfies XeroConnectionStatus;
    return component;
  }

  it('asks for reconnection when only attachment access is missing', () => {
    expect(withScopes(['accounting.attachments.read']).needsScopeUpgrade).toBeTrue();
  });

  it('does not ask for reconnection when attachment access is granted', () => {
    expect(withScopes([]).needsScopeUpgrade).toBeFalse();
  });
});
