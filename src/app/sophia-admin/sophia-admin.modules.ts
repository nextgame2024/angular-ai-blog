import type { AdminPermission } from './sophia-admin.types';

export interface SophiaAdminModuleDefinition {
  id: `ADM-${string}`;
  label: string;
  description: string;
  route: string;
  permission: AdminPermission;
  available: boolean;
  deliveryTask: string;
}

export const SOPHIA_ADMIN_MODULES: readonly SophiaAdminModuleDefinition[] = [
  module('ADM-01', 'Organisations', 'Organisation settings and lifecycle.', 'organisations', 'organisation.read', true, 'P4-A02'),
  module('ADM-02', 'Users', 'Memberships and invitations.', 'users', 'users.read', true, 'P4-A02'),
  module('ADM-03', 'Agents', 'Agent identity and lifecycle.', 'agents', 'agents.read', true, 'P4-A03'),
  module('ADM-04', 'Agent versions', 'Immutable releases and publication history.', 'agent-versions', 'agent_versions.read', true, 'P4-A03'),
  module('ADM-05', 'Instructions', 'Versioned agent instructions.', 'instructions', 'instructions.read', true, 'P4-A03'),
  module('ADM-06', 'Knowledge', 'Approved knowledge sources and publication.', 'knowledge', 'knowledge.read', true, 'P3-A01b1'),
  module('ADM-07', 'Tools', 'Approved capability and tool catalog.', 'tools', 'tools.read', true, 'P4-A04'),
  module('ADM-08', 'Connectors', 'Tenant connector bindings and health.', 'connectors', 'connectors.read', true, 'P4-A04'),
  module('ADM-09', 'Workflows', 'Versioned workflow templates and runs.', 'workflows', 'workflows.read', true, 'P4-A05'),
  module('ADM-10', 'Permissions', 'Role matrix and effective grants.', 'permissions', 'permissions.read', true, 'P4-A02'),
  module('ADM-11', 'Escalations', 'Policies and operations inbox.', 'escalations', 'escalations.read', true, 'P4-A05'),
  module('ADM-12', 'Conversations', 'Permissioned conversation operations.', 'conversations', 'conversations.read_metadata', true, 'P6-A01'),
  module('ADM-13', 'Evaluations', 'Datasets, runs and release evidence.', 'evaluations', 'evaluations.read', true, 'P6-A02'),
  module('ADM-14', 'Analytics', 'Defined outcomes and operational metrics.', 'analytics', 'analytics.read', true, 'P6-A03'),
  module('ADM-15', 'Audit logs', 'Security and configuration audit trail.', 'audit-logs', 'audit.read', true, 'P6-A04'),
  module('ADM-16', 'Usage / Billing', 'Measured usage and no-charge commercial readiness.', 'usage-billing', 'usage.read', true, 'P6-A05A'),
] as const;

function module(
  id: SophiaAdminModuleDefinition['id'],
  label: string,
  description: string,
  route: string,
  permission: AdminPermission,
  available: boolean,
  deliveryTask: string,
): SophiaAdminModuleDefinition {
  return { id, label, description, route, permission, available, deliveryTask };
}
