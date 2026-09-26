import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PersistanceService } from '../shared/services/persistance.service';
import type {
  AgentAuthoringDependencies,
  AuditEvent,
  AuditExportJob,
  AuditRetentionStatus,
  AdminOnboardingReadiness,
  AgentDetail,
  AgentDraftConfiguration,
  AgentDraftDiff,
  AgentRelease,
  AgentSummary,
  AnalyticsDashboard,
  AnalyticsExportJob,
  CommercialWorkspace,
  CapabilityAuthoringDependencies,
  CapabilityBinding,
  ConnectorBinding,
  ConnectorRegistration,
  ConversationContent,
  ConversationDetail,
  ConversationExportJob,
  ConversationSummary,
  EscalationCase,
  EscalationChannel,
  EscalationDestination,
  EscalationPolicy,
  EscalationPolicyConfiguration,
  EvaluationCase,
  EvaluationWorkspace,
  InstructionRevision,
  InstructionSet,
  KnowledgeBinding,
  KnowledgeFileIntake,
  KnowledgeFileReadiness,
  KnowledgeRevisionDetail,
  KnowledgeSource,
  SophiaAdminContext,
  SophiaAdminInvitation,
  SophiaAdminInvitationReceipt,
  SophiaAdminMember,
  SophiaAdminOrganisation,
  SophiaAdminPermissionRegistry,
  SophiaAdminRole,
  ToolRegistry,
  UsageWorkspace,
  UsageLimitsWorkspace,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowTemplate,
  PublicationCheck,
} from './sophia-admin.types';

@Injectable()
export class SophiaAdminService {
  private readonly http = inject(HttpClient);
  private readonly persistence = inject(PersistanceService);
  private readonly adminBase = environment.sophiaRuntimeApiUrl
    .replace(/\/+$/, '')
    .replace(/\/runtime$/, '/admin/v1');
  private contextRequest?: Observable<SophiaAdminContext>;
  private contextCredential: string | null = null;

  context(force = false): Observable<SophiaAdminContext> {
    const credential = this.credential();
    if (force || credential !== this.contextCredential) {
      this.contextRequest = undefined;
      this.contextCredential = credential;
    }
    return this.contextRequest ??= this.http.get<SophiaAdminContext>(
      `${this.adminBase}/context`, { headers: this.headers() },
    ).pipe(shareReplay({ bufferSize: 1, refCount: false }));
  }

  clearContext(): void {
    this.contextRequest = undefined;
    this.contextCredential = null;
  }

  onboardingReadiness(tenantId: string) {
    return this.http.get<AdminOnboardingReadiness>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/onboarding-readiness`,
      { headers: this.headers() },
    );
  }

  getOrganisation(tenantId: string) {
    return this.http.get<SophiaAdminOrganisation>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/organisation`,
      { headers: this.headers() },
    );
  }

  updateOrganisation(tenantId: string, input: {
    expectedRevision: number;
    name?: string;
    timezone?: string;
    defaultLocale?: string;
    branding?: { displayName?: string; primaryColour?: string };
  }) {
    return this.http.patch<SophiaAdminOrganisation>(
      `${this.organisationBase(tenantId)}`, input, { headers: this.headers() },
    );
  }

  suspendOrganisation(tenantId: string, expectedRevision: number, reason: string) {
    return this.http.post<SophiaAdminOrganisation>(
      `${this.organisationBase(tenantId)}/suspend`,
      { expectedRevision, reason }, { headers: this.headers() },
    );
  }

  resumeOrganisation(tenantId: string, expectedRevision: number) {
    return this.http.post<SophiaAdminOrganisation>(
      `${this.organisationBase(tenantId)}/resume`,
      { expectedRevision }, { headers: this.headers() },
    );
  }

  listMembers(tenantId: string) {
    return this.http.get<{ members: SophiaAdminMember[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/members`,
      { headers: this.headers() },
    );
  }

  updateMember(tenantId: string, membershipId: string, input: {
    expectedRevision: number;
    role?: SophiaAdminRole;
    status?: SophiaAdminMember['status'];
  }) {
    return this.http.patch<SophiaAdminMember>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(membershipId)}`,
      input, { headers: this.headers() },
    );
  }

  listInvitations(tenantId: string) {
    return this.http.get<{ invitations: SophiaAdminInvitation[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/invitations`,
      { headers: this.headers() },
    );
  }

  issueInvitation(tenantId: string, input: {
    email: string;
    role: SophiaAdminRole;
    expiresInHours: number;
  }) {
    return this.http.post<SophiaAdminInvitationReceipt>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/invitations`,
      { ...input, deliveryMode: 'dry-run' }, { headers: this.headers() },
    );
  }

  revokeInvitation(tenantId: string, invitationId: string, expectedRevision: number) {
    return this.http.post<{ invitation_id: string; status: string; revision: number }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      { expectedRevision }, { headers: this.headers() },
    );
  }

  permissionRegistry(tenantId: string) {
    return this.http.get<SophiaAdminPermissionRegistry>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/permissions`,
      { headers: this.headers() },
    );
  }

  listAgents(tenantId: string) {
    return this.http.get<{ agents: AgentSummary[] }>(`${this.agentBase(tenantId)}`, { headers: this.headers() });
  }

  agentDependencies(tenantId: string) {
    return this.http.get<AgentAuthoringDependencies>(
      `${this.agentBase(tenantId)}/authoring-dependencies`, { headers: this.headers() },
    );
  }

  getAgent(tenantId: string, agentId: string) {
    return this.http.get<AgentDetail>(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}`, { headers: this.headers() },
    );
  }

  createAgent(tenantId: string, agentKey: string, configuration: AgentDraftConfiguration) {
    return this.http.post<{ agentId: string; agentKey: string; status: string; draftRevision: number }>(
      this.agentBase(tenantId), { agentKey, configuration }, { headers: this.headers() },
    );
  }

  updateAgentDraft(tenantId: string, agentId: string, expectedRevision: number, configuration: AgentDraftConfiguration) {
    return this.http.patch<{ agentId: string; revision: number; configuration: AgentDraftConfiguration }>(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/draft`,
      { expectedRevision, configuration }, { headers: this.headers() },
    );
  }

  validateAgent(tenantId: string, agentId: string) {
    return this.http.post<{ revision: number; checks: PublicationCheck[] }>(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/validate`, {}, { headers: this.headers() },
    );
  }

  previewAgent(tenantId: string, agentId: string, variables: Record<string, string | number | boolean>) {
    return this.http.post<{
      mode: 'deterministic-composition-only'; externalEffects: false; meteredSessionCreated: false;
      draftRevision: number; platformSafetyPolicyVersion: string;
      instruction: { content: string; tone?: string | null; greeting?: string | null };
      checks: PublicationCheck[];
    }>(`${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/preview`, { variables }, { headers: this.headers() });
  }

  agentDiff(tenantId: string, agentId: string) {
    return this.http.get<AgentDraftDiff>(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/diff`, { headers: this.headers() },
    );
  }

  agentReleases(tenantId: string, agentId: string) {
    return this.http.get<{ agentId: string; releases: AgentRelease[] }>(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/releases`, { headers: this.headers() },
    );
  }

  publishAgent(tenantId: string, agentId: string, expectedRevision: number, releaseNotes?: string) {
    return this.http.post(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/publish`,
      { expectedRevision, ...(releaseNotes?.trim() ? { releaseNotes: releaseNotes.trim() } : {}) },
      { headers: this.headers() },
    );
  }

  rollbackAgent(tenantId: string, agentId: string, releaseId: string) {
    return this.http.post(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/releases/${encodeURIComponent(releaseId)}/rollback`,
      {}, { headers: this.headers() },
    );
  }

  revokeAgentRelease(tenantId: string, agentId: string, releaseId: string, reason: string) {
    return this.http.post(
      `${this.agentBase(tenantId)}/${encodeURIComponent(agentId)}/releases/${encodeURIComponent(releaseId)}/revoke`,
      { reason }, { headers: this.headers() },
    );
  }

  listInstructionSets(tenantId: string) {
    return this.http.get<{ instructionSets: InstructionSet[]; platformSafetyPolicyVersion: string }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/instructions`, { headers: this.headers() },
    );
  }

  createInstructionSet(tenantId: string, instructionKey: string) {
    return this.http.post<{ instructionSetId: string; instructionKey: string }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/instructions`,
      { instructionKey }, { headers: this.headers() },
    );
  }

  createInstructionRevision(tenantId: string, instructionSetId: string, input: {
    content: string; tone?: string; greeting?: string;
    variableSchema: InstructionRevision['variableSchema'];
  }) {
    return this.http.post<{ instruction_revision_id: string; revision: number; status: 'draft' }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/instructions/${encodeURIComponent(instructionSetId)}/revisions`,
      input, { headers: this.headers() },
    );
  }

  approveInstructionRevision(tenantId: string, revisionId: string) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/instructions/revisions/${encodeURIComponent(revisionId)}/approve`,
      {}, { headers: this.headers() },
    );
  }

  listSources(tenantId: string) {
    return this.http.get<{ sources: KnowledgeSource[] }>(
      `${this.tenantBase(tenantId)}/sources`, { headers: this.headers() },
    );
  }

  listBindings(tenantId: string) {
    return this.http.get<{ bindings: KnowledgeBinding[] }>(
      `${this.tenantBase(tenantId)}/bindings`, { headers: this.headers() },
    );
  }

  fileReadiness(tenantId: string) {
    return this.http.get<KnowledgeFileReadiness>(
      `${this.tenantBase(tenantId)}/files/readiness`, { headers: this.headers() },
    );
  }

  listFileIntakes(tenantId: string) {
    return this.http.get<{ intakes: KnowledgeFileIntake[] }>(
      `${this.tenantBase(tenantId)}/files`, { headers: this.headers() },
    );
  }

  initiateFile(tenantId: string, sourceId: string, input: {
    filename: string;
    mediaType: 'text/plain' | 'text/markdown';
    contentLength: number;
    checksumSha256Base64: string;
    idempotencyKey: string;
  }) {
    return this.http.post<{
      knowledgeFileIntakeId: string;
      status: string;
      uploadUrl: string;
      expiresIn: number;
      requiredHeaders: Record<string, string>;
    }>(`${this.tenantBase(tenantId)}/sources/${encodeURIComponent(sourceId)}/files/initiate`, input, { headers: this.headers() });
  }

  async uploadPrivateObject(uploadUrl: string, requiredHeaders: Record<string, string>, file: File): Promise<void> {
    const response = await fetch(uploadUrl, { method: 'PUT', headers: requiredHeaders, body: file, credentials: 'omit' });
    if (!response.ok) throw new Error(`Private knowledge upload failed (${response.status}).`);
  }

  completeFile(tenantId: string, intakeId: string) {
    return this.http.post<{ knowledgeFileIntakeId: string; status: string }>(
      `${this.tenantBase(tenantId)}/files/${encodeURIComponent(intakeId)}/complete`, {}, { headers: this.headers() },
    );
  }

  getRevision(tenantId: string, revisionId: string) {
    return this.http.get<{ revision: KnowledgeRevisionDetail }>(
      `${this.tenantBase(tenantId)}/revisions/${encodeURIComponent(revisionId)}`,
      { headers: this.headers() },
    );
  }

  createManagedTextSource(tenantId: string, input: { sourceKey: string; title: string }) {
    return this.http.post<{ knowledgeSourceId: string }>(
      `${this.tenantBase(tenantId)}/sources`,
      { ...input, sourceType: 'managed_text' },
      { headers: this.headers() },
    );
  }

  createManagedTextRevision(tenantId: string, sourceId: string, input: { mediaType: 'text/plain' | 'text/markdown'; contentText: string }) {
    return this.http.post<{ knowledge_revision_id: string; revision: number }>(
      `${this.tenantBase(tenantId)}/sources/${encodeURIComponent(sourceId)}/revisions`,
      { sourceType: 'managed_text', ...input },
      { headers: this.headers() },
    );
  }

  ingest(tenantId: string, revisionId: string, idempotencyKey: string) {
    return this.http.post(
      `${this.tenantBase(tenantId)}/revisions/${encodeURIComponent(revisionId)}/ingest`,
      { idempotencyKey }, { headers: this.headers() },
    );
  }

  approve(tenantId: string, revisionId: string) {
    return this.http.post(
      `${this.tenantBase(tenantId)}/revisions/${encodeURIComponent(revisionId)}/approve`,
      {}, { headers: this.headers() },
    );
  }

  publish(tenantId: string, revisionId: string, capabilityBindingIds: string[]) {
    return this.http.post(
      `${this.tenantBase(tenantId)}/revisions/${encodeURIComponent(revisionId)}/publish`,
      { capabilityBindingIds }, { headers: this.headers() },
    );
  }

  retire(tenantId: string, sourceId: string) {
    return this.http.post(
      `${this.tenantBase(tenantId)}/sources/${encodeURIComponent(sourceId)}/retire`,
      {}, { headers: this.headers() },
    );
  }

  preview(tenantId: string, input: { snapshotId: string; capabilityBindingId: string; query: string; limit?: number }) {
    return this.http.post<{ items: Array<{ title: string; excerpt: string; sources: Array<{ sourceRef: string }> }> }>(
      `${this.tenantBase(tenantId)}/preview`, input, { headers: this.headers() },
    );
  }

  toolRegistry(tenantId: string) {
    return this.http.get<ToolRegistry>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/tool-registry`, { headers: this.headers() },
    );
  }

  capabilityAuthoringDependencies(tenantId: string) {
    return this.http.get<CapabilityAuthoringDependencies>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/capability-authoring-dependencies`,
      { headers: this.headers() },
    );
  }

  testToolContract(tenantId: string, operationId: string) {
    return this.http.post<{
      operationId: string; mode: 'synthetic-contract-only'; externalEffects: false;
      policyDecision: 'allowed' | 'review-required'; sideEffectClass: string; note: string;
    }>(`${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/tool-registry/${encodeURIComponent(operationId)}/sandbox`,
      {}, { headers: this.headers() });
  }

  putCapabilityBinding(tenantId: string, profileVersionId: string, capabilityKey: string, input: {
    connectorBindingId: string; enabled: boolean; expectedRevision?: number | null;
  }) {
    return this.http.put<CapabilityBinding>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/business-profile-versions/${encodeURIComponent(profileVersionId)}/capability-bindings/${encodeURIComponent(capabilityKey)}`,
      input, { headers: this.headers() },
    );
  }

  connectorRegistry(tenantId: string) {
    return this.http.get<{ connectors: ConnectorRegistration[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/connector-registry`, { headers: this.headers() },
    );
  }

  connectorBindings(tenantId: string) {
    return this.http.get<{ bindings: ConnectorBinding[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/connectors`, { headers: this.headers() },
    );
  }

  connectConnector(tenantId: string, input: { connectorKey: string; externalAccountId: string; requestedScopes: string[] }) {
    return this.http.post<ConnectorBinding>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/connectors`, input, { headers: this.headers() },
    );
  }

  testConnector(tenantId: string, bindingId: string) {
    return this.http.post<ConnectorBinding>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/connectors/${encodeURIComponent(bindingId)}/test`,
      {}, { headers: this.headers() },
    );
  }

  reconnectConnector(tenantId: string, bindingId: string, expectedRevision: number) {
    return this.http.post<ConnectorBinding>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/connectors/${encodeURIComponent(bindingId)}/reconnect`,
      { expectedRevision }, { headers: this.headers() },
    );
  }

  disconnectConnector(tenantId: string, bindingId: string, expectedRevision: number) {
    return this.http.post<ConnectorBinding>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/connectors/${encodeURIComponent(bindingId)}/disconnect`,
      { expectedRevision }, { headers: this.headers() },
    );
  }

  workflowTemplates(tenantId: string) {
    return this.http.get<{ templates: WorkflowTemplate[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflow-templates`, { headers: this.headers() },
    );
  }

  workflows(tenantId: string) {
    return this.http.get<{ workflows: WorkflowDefinition[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflows`, { headers: this.headers() },
    );
  }

  createWorkflow(tenantId: string, input: { workflowKey: string; templateKey: string; configuration: Record<string, unknown> }) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflows`, input, { headers: this.headers() },
    );
  }

  createWorkflowVersion(tenantId: string, definitionId: string, configuration: Record<string, unknown>) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflows/${encodeURIComponent(definitionId)}/versions`,
      { configuration }, { headers: this.headers() },
    );
  }

  publishWorkflowVersion(tenantId: string, versionId: string) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflow-versions/${encodeURIComponent(versionId)}/publish`,
      {}, { headers: this.headers() },
    );
  }

  workflowRuns(tenantId: string) {
    return this.http.get<{ runs: WorkflowRun[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflow-runs`, { headers: this.headers() },
    );
  }

  workflowStatus(tenantId: string, runId: string) {
    return this.http.get<WorkflowRun & { authoritativeStatus: Record<string, unknown> }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflow-runs/${encodeURIComponent(runId)}/status`,
      { headers: this.headers() },
    );
  }

  retryWorkflow(tenantId: string, runId: string, idempotencyKey: string) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/workflow-runs/${encodeURIComponent(runId)}/retry`,
      { idempotencyKey }, { headers: this.headers() },
    );
  }

  escalationChannels(tenantId: string) {
    return this.http.get<{ channels: EscalationChannel[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-channels`, { headers: this.headers() },
    );
  }

  escalationDestinations(tenantId: string) {
    return this.http.get<{ destinations: EscalationDestination[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-destinations`, { headers: this.headers() },
    );
  }

  createEscalationDestination(tenantId: string, input: { destinationKey: string; displayName: string; channel: EscalationChannel['channel'] }) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-destinations`, input, { headers: this.headers() },
    );
  }

  escalationPolicies(tenantId: string) {
    return this.http.get<{ policies: EscalationPolicy[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-policies`, { headers: this.headers() },
    );
  }

  createEscalationPolicy(tenantId: string, policyKey: string, configuration: EscalationPolicyConfiguration) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-policies`,
      { policyKey, configuration }, { headers: this.headers() },
    );
  }

  createEscalationPolicyVersion(tenantId: string, policyId: string, configuration: EscalationPolicyConfiguration) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-policies/${encodeURIComponent(policyId)}/versions`,
      { configuration }, { headers: this.headers() },
    );
  }

  publishEscalationPolicy(tenantId: string, versionId: string) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-policy-versions/${encodeURIComponent(versionId)}/publish`,
      {}, { headers: this.headers() },
    );
  }

  escalationCases(tenantId: string) {
    return this.http.get<{ cases: EscalationCase[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-cases`, { headers: this.headers() },
    );
  }

  escalationCase(tenantId: string, caseId: string) {
    return this.http.get<EscalationCase>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-cases/${encodeURIComponent(caseId)}`,
      { headers: this.headers() },
    );
  }

  assignEscalationCase(tenantId: string, caseId: string, assignedToIdentity: string, expectedRevision: number) {
    return this.http.post<EscalationCase>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-cases/${encodeURIComponent(caseId)}/assign`,
      { assignedToIdentity, expectedRevision }, { headers: this.headers() },
    );
  }

  startEscalationCase(tenantId: string, caseId: string, expectedRevision: number) {
    return this.http.post<EscalationCase>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-cases/${encodeURIComponent(caseId)}/start`,
      { expectedRevision }, { headers: this.headers() },
    );
  }

  resolveEscalationCase(tenantId: string, caseId: string, expectedRevision: number, resolutionCode: string, resolutionNote: string) {
    return this.http.post<EscalationCase>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/escalation-cases/${encodeURIComponent(caseId)}/resolve`,
      { expectedRevision, resolutionCode, resolutionNote }, { headers: this.headers() },
    );
  }

  evaluations(tenantId: string) {
    return this.http.get<EvaluationWorkspace>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/evaluations`, { headers: this.headers() },
    );
  }

  createEvaluationDataset(tenantId: string, input: { datasetKey: string; displayName: string }) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/evaluations/datasets`, input, { headers: this.headers() },
    );
  }

  createEvaluationVersion(tenantId: string, datasetId: string, cases: EvaluationCase[]) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/evaluations/datasets/${encodeURIComponent(datasetId)}/versions`,
      { cases }, { headers: this.headers() },
    );
  }

  approveEvaluationVersion(tenantId: string, versionId: string) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/evaluations/versions/${encodeURIComponent(versionId)}/approve`,
      {}, { headers: this.headers() },
    );
  }

  bindEvaluationRequirement(tenantId: string, agentId: string, datasetVersionId: string, requiredForPublication: boolean) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/evaluations/requirements`,
      { agentId, datasetVersionId, requiredForPublication }, { headers: this.headers() },
    );
  }

  runEvaluation(tenantId: string, agentId: string, datasetVersionId: string, target: { type: 'draft' } | { type: 'release'; releaseId: string }) {
    return this.http.post(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/evaluations/runs`,
      { agentId, datasetVersionId, target }, { headers: this.headers() },
    );
  }

  auditEvents(tenantId: string, filters: Record<string, string | number | undefined>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params = params.set(key, String(value));
    return this.http.get<{ events: AuditEvent[]; hasMore: boolean; nextCursor?: { before: string; beforeId: string } | null }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/audit/events`, { headers: this.headers(), params },
    );
  }

  conversations(tenantId: string, filters: Record<string, string | number | undefined>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params = params.set(key, String(value));
    return this.http.get<{ conversations: ConversationSummary[]; hasMore: boolean; nextCursor?: { before: string; beforeId: string } | null }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations`, { headers: this.headers(), params },
    );
  }

  conversation(tenantId: string, sessionId: string) {
    return this.http.get<ConversationDetail>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations/${encodeURIComponent(sessionId)}`,
      { headers: this.headers() },
    );
  }

  conversationContent(tenantId: string, sessionId: string) {
    return this.http.get<ConversationContent>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations/${encodeURIComponent(sessionId)}/content`,
      { headers: this.headers() },
    );
  }

  addConversationNote(tenantId: string, sessionId: string, note: string) {
    return this.http.post<{ conversationOperatorNoteId: string; sessionId: string; createdAt: string }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations/${encodeURIComponent(sessionId)}/notes`,
      { note }, { headers: this.headers() },
    );
  }

  conversationExports(tenantId: string) {
    return this.http.get<{ exports: ConversationExportJob[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations/exports/jobs`, { headers: this.headers() },
    );
  }

  createConversationExport(tenantId: string, sessionId: string, scope: 'metadata' | 'content', maxItems = 1000) {
    return this.http.post<{ conversation_export_job_id: string; status: 'ready'; export_scope: typeof scope; expires_at: string }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations/${encodeURIComponent(sessionId)}/exports`,
      { format: 'json', scope, maxItems }, { headers: this.headers() },
    );
  }

  downloadConversationExport(tenantId: string, exportId: string) {
    return this.http.get<{ format: 'json'; digestAlgorithm: 'sha256'; digest: string; document: Record<string, unknown> }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/conversations/exports/jobs/${encodeURIComponent(exportId)}`,
      { headers: this.headers() },
    );
  }

  analytics(tenantId: string, filters: Record<string, string | undefined>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value) params = params.set(key, value);
    return this.http.get<AnalyticsDashboard>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/analytics`, { headers: this.headers(), params },
    );
  }

  analyticsExports(tenantId: string) {
    return this.http.get<{ exports: AnalyticsExportJob[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/analytics/exports/jobs`, { headers: this.headers() },
    );
  }

  createAnalyticsExport(tenantId: string, filters: Record<string, string>, maxPoints = 1000) {
    return this.http.post<{ analytics_export_job_id: string; status: 'ready'; point_count: number; expires_at: string }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/analytics/exports`,
      { format: 'json', filters, maxPoints }, { headers: this.headers() },
    );
  }

  downloadAnalyticsExport(tenantId: string, exportId: string) {
    return this.http.get<{ format: 'json'; digestAlgorithm: 'sha256'; digest: string; document: Record<string, unknown> }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/analytics/exports/jobs/${encodeURIComponent(exportId)}`,
      { headers: this.headers() },
    );
  }

  usageWorkspace(tenantId: string) {
    return this.http.get<UsageWorkspace>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/usage`, { headers: this.headers() },
    );
  }

  commercialWorkspace(tenantId: string) {
    return this.http.get<CommercialWorkspace>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/commercial`, { headers: this.headers() },
    );
  }

  usageLimits(tenantId: string) {
    return this.http.get<UsageLimitsWorkspace>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/limits`, { headers: this.headers() },
    );
  }

  updateUsageLimits(tenantId: string, input: {
    expectedRevision: number; maxConcurrentSessions: number | null; maxToolCallsPerMinute: number | null;
    providerCostAlert: { thresholdMicrounits: string; currency: string } | null;
  }) {
    return this.http.put<UsageLimitsWorkspace>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/limits`, input, { headers: this.headers() },
    );
  }

  createBillingCheckout(tenantId: string, input: { requestId: string; planVersionId: string }) {
    return this.http.post<{ url: string; expiresAt: string | null; environment: 'sandbox'; liveCharge: false }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/checkout`, input, { headers: this.headers() },
    );
  }

  createBillingPortal(tenantId: string, input: { requestId: string }) {
    return this.http.post<{ url: string; expiresAt: string | null; environment: 'sandbox'; liveCharge: false }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/portal`, input, { headers: this.headers() },
    );
  }

  reconcileBilling(tenantId: string, input: { requestId: string }) {
    return this.http.post<{ status: 'reconciled' | 'incomplete'; observedAt: string;
      subscriptionCount: number; invoiceCount: number; liveEntitlementMutation: false }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/usage-billing/reconcile`, input, { headers: this.headers() },
    );
  }

  auditEvent(tenantId: string, eventId: string) {
    return this.http.get<AuditEvent>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/audit/events/${encodeURIComponent(eventId)}`,
      { headers: this.headers() },
    );
  }

  auditRetention(tenantId: string) {
    return this.http.get<AuditRetentionStatus>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/audit/retention`, { headers: this.headers() },
    );
  }

  auditExports(tenantId: string) {
    return this.http.get<{ exports: AuditExportJob[] }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/audit/exports`, { headers: this.headers() },
    );
  }

  createAuditExport(tenantId: string, filters: Record<string, string>, maxRows: number) {
    return this.http.post<{ auditExportJobId: string; status: 'ready'; rowCount: number; asOf: string; expiresAt: string }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/audit/exports`,
      { format: 'json', filters, maxRows }, { headers: this.headers() },
    );
  }

  downloadAuditExport(tenantId: string, exportId: string) {
    return this.http.get<{ format: 'json'; digestAlgorithm: 'sha256'; digest: string; document: Record<string, unknown> }>(
      `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/audit/exports/${encodeURIComponent(exportId)}`,
      { headers: this.headers() },
    );
  }

  private tenantBase(tenantId: string): string {
    return `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/knowledge`;
  }

  private organisationBase(tenantId: string): string {
    return `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/organisation`;
  }

  private agentBase(tenantId: string): string {
    return `${this.adminBase}/tenants/${encodeURIComponent(tenantId)}/agents`;
  }

  private headers(): HttpHeaders {
    const token = this.credential();
    return token ? new HttpHeaders({ Authorization: `Token ${token}` }) : new HttpHeaders();
  }

  private credential(): string | null {
    return this.persistence.get<string>('accessToken')
      ?? this.persistence.get<string>('token');
  }
}
