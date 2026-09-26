import { Route } from '@angular/router';
import {
  sophiaAdminGuard,
  sophiaAdminPermissionGuard,
} from './sophia-admin.guard';
import { SophiaAdminService } from './sophia-admin.service';

export const SOPHIA_ADMIN_ROUTES: Route[] = [
  {
    path: '',
    canActivate: [sophiaAdminGuard],
    providers: [SophiaAdminService],
    loadComponent: () => import('./shell/sophia-admin-shell.component').then(
      (m) => m.SophiaAdminShellComponent,
    ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () => import('./overview/sophia-admin-overview.page').then(
          (m) => m.SophiaAdminOverviewPage,
        ),
        data: { title: 'Sophia Admin' },
      },
      {
        path: 'organisations',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./organisations/organisations-admin.page').then(
          (m) => m.OrganisationsAdminPage,
        ),
        data: { title: 'Sophia organisation', permission: 'organisation.read' },
      },
      {
        path: 'users',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./users/users-admin.page').then((m) => m.UsersAdminPage),
        data: { title: 'Sophia users', permission: 'users.read' },
      },
      {
        path: 'permissions',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./permissions/permissions-admin.page').then(
          (m) => m.PermissionsAdminPage,
        ),
        data: { title: 'Sophia permissions', permission: 'permissions.read' },
      },
      {
        path: 'agents',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./agents/agents-admin.page').then((m) => m.AgentsAdminPage),
        data: { title: 'Sophia agents', permission: 'agents.read' },
      },
      {
        path: 'agent-versions',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./agent-versions/agent-versions-admin.page').then(
          (m) => m.AgentVersionsAdminPage,
        ),
        data: { title: 'Sophia agent versions', permission: 'agent_versions.read' },
      },
      {
        path: 'instructions',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./instructions/instructions-admin.page').then(
          (m) => m.InstructionsAdminPage,
        ),
        data: { title: 'Sophia instructions', permission: 'instructions.read' },
      },
      {
        path: 'knowledge',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./knowledge/knowledge-admin.page').then((m) => m.KnowledgeAdminPage),
        data: { title: 'Sophia knowledge', permission: 'knowledge.read' },
      },
      {
        path: 'tools',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./tools/tools-admin.page').then((m) => m.ToolsAdminPage),
        data: { title: 'Sophia tools', permission: 'tools.read' },
      },
      {
        path: 'connectors',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./connectors/connectors-admin.page').then((m) => m.ConnectorsAdminPage),
        data: { title: 'Sophia connectors', permission: 'connectors.read' },
      },
      {
        path: 'workflows',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./workflows/workflows-admin.page').then((m) => m.WorkflowsAdminPage),
        data: { title: 'Sophia workflows', permission: 'workflows.read' },
      },
      {
        path: 'escalations',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./escalations/escalations-admin.page').then((m) => m.EscalationsAdminPage),
        data: { title: 'Sophia escalations', permission: 'escalations.read' },
      },
      {
        path: 'conversations',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./conversations/conversations-admin.page').then((m) => m.ConversationsAdminPage),
        data: { title: 'Sophia conversations', permission: 'conversations.read_metadata' },
      },
      {
        path: 'evaluations',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./evaluations/evaluations-admin.page').then((m) => m.EvaluationsAdminPage),
        data: { title: 'Sophia evaluations', permission: 'evaluations.read' },
      },
      {
        path: 'analytics',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./analytics/analytics-admin.page').then((m) => m.AnalyticsAdminPage),
        data: { title: 'Sophia analytics', permission: 'analytics.read' },
      },
      {
        path: 'usage-billing',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./usage-billing/usage-billing-admin.page').then((m) => m.UsageBillingAdminPage),
        data: { title: 'Sophia usage and billing', permission: 'usage.read' },
      },
      {
        path: 'audit-logs',
        canActivate: [sophiaAdminPermissionGuard],
        loadComponent: () => import('./audit-logs/audit-logs-admin.page').then((m) => m.AuditLogsAdminPage),
        data: { title: 'Sophia audit logs', permission: 'audit.read' },
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./forbidden/sophia-admin-forbidden.page').then(
          (m) => m.SophiaAdminForbiddenPage,
        ),
        data: { title: 'Sophia Admin permission required' },
      },
      { path: '**', redirectTo: 'overview' },
    ],
  },
];
