export type AdminPermission =
  | 'knowledge.read'
  | 'knowledge.edit'
  | 'knowledge.ingest'
  | 'knowledge.publish'
  | 'knowledge.retire'
  | string;

export interface SophiaAdminPrincipal {
  apiVersion?: string;
  tenantId: string;
  identityUserId: string;
  membershipId?: string;
  externalCompanyId?: string;
  role: string;
  permissions: AdminPermission[];
  authorizationRevision?: number;
  mfaVerifiedAt?: string;
}

export interface SophiaAdminContext {
  principal: SophiaAdminPrincipal;
}

export interface AdminOnboardingReadinessStep {
  key: string;
  label: string;
  status: 'ready' | 'not_configured' | 'restricted' | 'awaiting_runtime_evidence';
  detail: string;
  moduleIds: string[];
}

export interface AdminOnboardingReadiness {
  tenantId: string;
  generatedAt: string;
  scope: 'existing-authorised-tenant';
  foundationalProfileAuthoring: 'pre-provisioned-outside-current-admin-ui';
  activationReady: boolean | null;
  completeVisibility: boolean;
  steps: AdminOnboardingReadinessStep[];
  futureModules: Array<{
    moduleId: string;
    status: 'planned';
    taskId: string;
  }>;
}

export interface SophiaAdminOrganisation {
  customer_id: string;
  name: string;
  external_company_id?: string;
  status: 'active' | 'inactive';
  metadata: {
    timezone?: string;
    defaultLocale?: string;
    branding?: { displayName?: string; primaryColour?: string };
  };
  settings_revision: number;
  admission_suspended_at?: string | null;
  suspension_reason?: string | null;
}

export type SophiaAdminRole =
  | 'organisation_owner'
  | 'configuration_editor'
  | 'release_publisher'
  | 'operations_member'
  | 'billing_administrator'
  | 'read_only_auditor';

export interface SophiaAdminMember {
  membership_id: string;
  identity_user_id: string;
  role_key: SophiaAdminRole;
  status: 'active' | 'suspended' | 'revoked';
  authorization_revision: number;
  effective_permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface SophiaAdminInvitation {
  invitation_id: string;
  recipient_email: string;
  role_key: SophiaAdminRole;
  status: 'pending' | 'redeemed' | 'revoked' | 'expired';
  revision: number;
  expires_at: string;
  redeemed_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SophiaAdminRoleDefinition {
  role: SophiaAdminRole;
  permissions: string[];
}

export interface SophiaAdminPermissionRegistry {
  roles: SophiaAdminRoleDefinition[];
  permissions: string[];
  mfaRequiredPermissions: string[];
  platformPermissions: string[];
  customRolesSupported: false;
  permissionElevationOverridesSupported: false;
}

export interface SophiaAdminInvitationReceipt {
  invitationId: string;
  revision: number;
  expiresAt: string;
  delivery: { mode: 'dry-run'; token: string };
}

export interface AgentDraftConfiguration {
  displayName: string;
  defaultLocale: string;
  allowedLocales: string[];
  instructionRevisionId: string;
  businessProfileVersionId: string;
  experienceProfileVersionIds: string[];
  capabilityBindingIds: string[];
  knowledgeRevisionIds: string[];
  workflowVersionIds: string[];
  escalationPolicyVersionId?: string;
}

export interface AgentSummary {
  agent_id: string;
  agent_key: string;
  status: 'draft' | 'enabled' | 'disabled' | 'archived';
  active_release_id?: string | null;
  draft_revision: number;
  created_at: string;
  updated_at: string;
}

export interface AgentDetail extends AgentSummary {
  configuration: AgentDraftConfiguration;
  updated_by_identity: string;
}

export interface ProviderCapabilitySummary {
  providerId: string;
  adapterKey: string;
  capabilities: string[];
  supportedModes: string[];
  supportedInputModalities: string[];
  supportedOutputModalities: string[];
  languages: string[];
  interruptionCapabilities: string[];
  transports: string[];
  limitations: {
    reasoningIsReplaceable: boolean;
    maxSessionDuration: number | null;
    toolCatalogUpdateSupport: string;
    concurrencyLimits: { perTenant?: number; global?: number } | null;
    healthFailClosed: boolean;
  };
}

export interface AgentAuthoringDependencies {
  businessProfiles: Array<{ businessProfileVersionId: string; profileKey: string; displayName: string; version: number; packRegistrationKey?: string | null }>;
  experienceProfiles: Array<{ experienceProfileVersionId: string; experienceKey: string; displayName: string; businessProfileVersionId: string; version: number; pipelineMode: string; providers: ProviderCapabilitySummary[] }>;
  instructionRevisions: Array<{ instructionRevisionId: string; instructionKey: string; revision: number; status: string; createdByIdentity: string; approvedAt?: string }>;
  capabilityBindings: Array<{ capabilityBindingId: string; businessProfileVersionId: string; capabilityKey: string; connectorKey: string; enabled: boolean }>;
  knowledgeRevisions: Array<{ knowledgeRevisionId: string; sourceKey: string; title: string; revision: number }>;
  workflowVersions: Array<{ workflowVersionId: string; workflowKey: string; version: number; templateKey: string; templateVersion: string }>;
  escalationPolicyVersions: Array<{ escalationPolicyVersionId: string; policyKey: string; version: number }>;
  restrictedSections: string[];
}

export interface PublicationCheck {
  checkId: string;
  status: 'passed' | 'failed' | 'blocked';
  message: string;
}

export interface AgentDraftDiff {
  agentId: string;
  draftRevision: number;
  activeReleaseId?: string | null;
  activeReleaseNumber?: number | null;
  changes: Array<{ field: keyof AgentDraftConfiguration; publishedValue: unknown; draftValue: unknown }>;
}

export interface AgentRelease {
  agent_release_id: string;
  release_number: number;
  source_draft_revision: number;
  manifest: { configuration?: AgentDraftConfiguration; workflowBindings?: unknown[] };
  manifest_digest: string;
  platform_safety_policy_version: string;
  release_notes?: string | null;
  published_by_identity: string;
  published_at: string;
  active: boolean;
  revocation_reason?: string | null;
  revoked_at?: string | null;
}

export interface InstructionRevision {
  instructionRevisionId: string;
  revision: number;
  status: 'draft' | 'approved';
  content: string;
  tone?: string | null;
  greeting?: string | null;
  variableSchema: { type: 'object'; properties: Record<string, { type: 'string' | 'number' | 'boolean'; description?: string }>; additionalProperties: false };
  createdByIdentity: string;
  approvedAt?: string | null;
  createdAt: string;
}

export interface InstructionSet {
  instruction_set_id: string;
  instruction_key: string;
  created_at: string;
  revisions: InstructionRevision[];
}

export interface KnowledgeRevisionSummary {
  knowledgeRevisionId: string;
  revision: number;
  status: 'draft' | 'approved' | 'published' | 'retired';
  ingestionStatus: 'pending' | 'ready' | 'failed' | 'quarantined';
  mediaType?: string | null;
  connectorObjectRef?: string | null;
  contentSha256?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  knowledgeSnapshotId?: string | null;
  snapshotStatus?: 'published' | 'retired' | null;
  capabilityBindingIds?: string[];
  createdAt: string;
  approvedAt?: string | null;
  publishedAt?: string | null;
}

export interface KnowledgeSource {
  knowledge_source_id: string;
  source_key: string;
  title: string;
  source_type: 'managed_text' | 'connector_reference';
  status: 'active' | 'retired';
  created_at: string;
  retired_at?: string | null;
  revisions: KnowledgeRevisionSummary[];
}

export interface KnowledgeBinding {
  capability_binding_id: string;
  connector_key: string;
  business_profile_version_id: string;
  business_profile_version: number;
  profile_key: string;
  display_name: string;
}

export interface KnowledgeRevisionDetail {
  knowledge_revision_id: string;
  knowledge_source_id: string;
  source_key: string;
  title: string;
  source_type: string;
  source_status: string;
  revision: number;
  status: string;
  ingestion_status: string;
  media_type?: string | null;
  content_text?: string | null;
  connector_object_ref?: string | null;
  content_sha256?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
}

export interface KnowledgeFileReadiness {
  enabled: boolean;
  acceptedMediaTypes: Array<'text/plain' | 'text/markdown'>;
  maxUploadBytes: number;
  parserIsolation: 'worker_thread';
  storage: { ready: boolean; reason?: string };
  scanner: { ready: boolean; reason?: string };
}

export interface KnowledgeFileIntake {
  knowledge_file_intake_id: string;
  knowledge_source_id: string;
  knowledge_revision_id?: string | null;
  original_filename: string;
  media_type: string;
  declared_bytes: number;
  status: 'awaiting_upload' | 'queued' | 'processing' | 'succeeded' | 'quarantined' | 'failed';
  attempt_count: number;
  scan_engine?: string | null;
  parser_version?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface ToolCatalogEntry {
  toolId: string;
  version: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredCapability: string;
  requiredScopes: string[];
  riskClass: 'low' | 'medium' | 'high';
  sideEffectClass: string;
  confirmationPolicy: 'none' | 'explicit-user-review';
  timeoutMs: number;
  retryPolicy: string;
  idempotencyPolicy: string;
}

export interface ToolRegistry {
  catalogVersion: string;
  packs: Array<{
    packId: string;
    version: string;
    connectorKeys: string[];
    capabilities: string[];
    operations: string[];
  }>;
  tools: ToolCatalogEntry[];
  operations: Array<{
    operationId: string;
    port: string;
    sideEffectClass: string;
    confirmationPolicy: string;
    contractVersion: string;
  }>;
}

export interface BusinessProfileCapabilityVersion {
  businessProfileVersionId: string;
  profileKey: string;
  displayName: string;
  version: number;
  revision: number;
  status: 'draft' | 'published' | 'retired';
  packRegistrationKey?: string | null;
  editable: boolean;
}

export interface CapabilityBinding {
  capabilityBindingId: string;
  businessProfileVersionId: string;
  capabilityKey: string;
  connectorKey: string;
  connectorBindingId?: string | null;
  policyVersion: string;
  enabled: boolean;
  revision: number;
}

export interface CapabilityAuthoringDependencies {
  businessProfileVersions: BusinessProfileCapabilityVersion[];
  capabilityBindings: CapabilityBinding[];
}

export interface ConnectorRegistration {
  connectorKey: string;
  displayName: string;
  authMode: 'runtime-scoped-token';
  accountBindingMode: 'tenant-external-company' | 'connector-verified';
  allowedScopes: string[];
  supportsCredentialRotation: false;
  manifest?: { version?: string; operations?: Array<Record<string, unknown>> };
}

export interface ConnectorBinding {
  connectorBindingId: string;
  connectorKey: string;
  externalAccountId: string;
  allowedScopes: string[];
  status: 'active' | 'disconnecting' | 'revoked';
  revision: number;
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  healthCheckedAt?: string | null;
  lastErrorCode?: string | null;
  credentialConfigured: boolean;
  unresolvedCommandCount?: number;
  reconciliationRequired?: boolean;
}

export interface WorkflowTemplate {
  templateKey: string;
  version: string;
  displayName: string;
  description: string;
  ownerKey: string;
  connectorKey: string;
  configurationSchema: Record<string, unknown>;
  requiredAuthorization: string[];
  statusOperationId: string;
  retry: { support: 'unsupported' | 'owner-idempotent' };
}

export interface WorkflowVersion {
  workflowVersionId: string;
  version: number;
  status: 'draft' | 'published' | 'retired';
  templateVersion: string;
  configuration: Record<string, unknown>;
  requiredAuthorization: string[];
  publishedAt?: string | null;
  createdAt?: string;
}

export interface WorkflowDefinition {
  workflow_definition_id: string;
  workflow_key: string;
  template_key: string;
  created_at: string;
  versions: WorkflowVersion[];
}

export interface WorkflowRun {
  workflowRunId: string;
  workflowVersionId: string;
  capabilityBindingId: string;
  ownerKey: string;
  externalRunRef: string;
  status: string;
  statusAt?: string | null;
  templateKey: string;
  connectorKey: string;
}

export interface EscalationChannel {
  channel: 'operations_inbox' | 'callback' | 'notification' | 'live_transfer';
  availability: 'supported' | 'unsupported';
  semantics: string;
  reason?: string;
}

export interface EscalationDestination {
  escalationDestinationId: string;
  destinationKey: string;
  displayName: string;
  channel: EscalationChannel['channel'];
  connectorBindingId?: string | null;
  availability: 'supported' | 'unsupported';
  status: 'active' | 'inactive';
  revision: number;
}

export interface EscalationPolicyConfiguration {
  defaultDestinationId: string;
  rules: Array<{ ruleKey: string; reasonCodes: string[]; destinationId: string; priority: string; responseTargetMinutes: number }>;
  contextFields: Array<'reason' | 'summary' | 'contactPreference'>;
}

export interface EscalationPolicyVersion {
  escalationPolicyVersionId: string;
  version: number;
  status: 'draft' | 'published';
  configuration: EscalationPolicyConfiguration;
  publishedAt?: string | null;
  createdAt?: string;
}

export interface EscalationPolicy {
  escalation_policy_id: string;
  policy_key: string;
  created_at: string;
  versions: EscalationPolicyVersion[];
}

export interface EscalationCase {
  escalationCaseId: string;
  escalationPolicyVersionId: string;
  escalationDestinationId: string;
  sourceSessionId?: string | null;
  reasonCode: string;
  summary: string;
  contactPreference?: string | null;
  priority: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved';
  deliveryStatus: string;
  transferStatus: string;
  assignedToIdentity?: string | null;
  resolutionCode?: string | null;
  resolutionNote?: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  events?: Array<{
    escalation_case_event_id: string;
    event_type: string;
    status: string;
    delivery_status: string;
    transfer_status: string;
    actor_identity?: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface EvaluationCase {
  caseKey: string;
  publicationCheckId: string;
  expectedStatus: 'passed';
}

export interface EvaluationDatasetVersion {
  evaluationDatasetVersionId: string;
  version: number;
  status: 'draft' | 'approved' | 'retired';
  evaluatorKey: string;
  evaluatorVersion: number;
  evidenceMode: 'deterministic';
  cases: EvaluationCase[];
  approvedAt?: string | null;
  createdAt: string;
}

export interface EvaluationDataset {
  evaluation_dataset_id: string;
  dataset_key: string;
  display_name: string;
  created_at: string;
  versions: EvaluationDatasetVersion[];
}

export interface EvaluationResult {
  caseKey: string;
  publicationCheckId: string;
  expectedStatus: string;
  actualStatus: string;
  status: 'passed' | 'failed';
  message: string;
}

export interface EvaluationRun {
  evaluation_run_id: string;
  agent_id: string;
  agent_key: string;
  evaluation_dataset_version_id: string;
  dataset_key: string;
  version: number;
  target_type: 'draft' | 'release';
  target_draft_revision?: number | null;
  target_release_id?: string | null;
  evaluator_key: string;
  evaluator_version: number;
  evidence_mode: 'deterministic' | 'mocked-provider-contract' | 'live-provider';
  status: 'passed' | 'failed' | 'blocked';
  results: EvaluationResult[];
  external_effects: false;
  metered_session_created: false;
  completed_at: string;
}

export interface EvaluationWorkspace {
  registry: {
    evaluatorKey: string; evaluatorVersion: number; evidenceMode: 'deterministic';
    supportedPublicationChecks: string[]; externalEffects: false; meteredSessionCreated: false;
    liveProviderRuns: { available: false; reason: string };
  };
  datasets: EvaluationDataset[];
  requirements: Array<{
    agent_evaluation_requirement_id: string; agent_id: string; agent_key: string;
    evaluation_dataset_version_id: string; dataset_key: string; version: number; required_for_publication: boolean;
  }>;
  runs: EvaluationRun[];
  releases: Array<{
    agent_release_id: string; agent_id: string; agent_key: string; release_number: number;
    source_draft_revision: number; manifest_digest: string; published_at: string;
  }>;
}

export interface AuditEvent {
  audit_event_id: string;
  identity_user_id?: string | null;
  event_type: string;
  resource_type?: string | null;
  resource_id?: string | null;
  permission_key?: string | null;
  outcome: 'allowed' | 'denied' | 'failed';
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditExportJob {
  audit_export_job_id: string;
  format: 'json';
  status: 'ready' | 'expired';
  filters: Record<string, unknown>;
  as_of: string;
  max_rows: number;
  row_count: number;
  created_by_identity: string;
  created_at: string;
  expires_at: string;
  last_accessed_at?: string | null;
  access_count: number;
}

export interface AuditRetentionStatus {
  policyStatus: 'unavailable';
  deletionEnabled: false;
  legalHoldAutomation: 'unavailable';
  detail: string;
}

export interface ConversationSummary {
  session_id: string;
  status: string;
  runtime_api_version: 'v1' | 'v2';
  agent_release_id?: string | null;
  agent_id?: string | null;
  release_number?: number | null;
  agent_key?: string | null;
  channel: 'voice' | 'avatar' | 'unknown';
  outcome: 'in_progress' | 'completed' | 'failed';
  escalation_case_id?: string | null;
  escalation_status?: 'open' | 'assigned' | 'in_progress' | 'resolved' | null;
  tool_call_count?: number;
  started_at: string;
  ended_at?: string | null;
}

export interface ConversationTimelineItem {
  id: string;
  kind: string;
  occurredAt: string;
  [key: string]: unknown;
}

export interface ConversationDetail {
  session: ConversationSummary;
  timeline: ConversationTimelineItem[];
  escalations: Array<{
    escalation_case_id: string; reason_code: string; priority: string; status: string;
    delivery_status: string; transfer_status: string; assigned_to_identity?: string | null; created_at: string;
  }>;
  contentAccess: { requiredPermission: 'conversations.read_content'; recentMfaRequired: true };
  transcript: { status: 'unavailable_not_recorded' };
  audio: { status: 'unavailable_not_recorded' };
}

export interface ConversationContent {
  sessionId: string;
  operationalContent: {
    status: 'available' | 'partially_available' | 'unavailable_expired';
    items: ConversationTimelineItem[];
  };
  reviewContentStatus: 'available' | 'unavailable_expired';
  transcript: { status: 'unavailable_not_recorded' | 'unavailable_expired' | 'unavailable_no_retained_asset' };
  audio: { status: 'unavailable_not_recorded' | 'unavailable_expired' | 'unavailable_no_retained_asset' };
}

export interface ConversationExportJob {
  conversation_export_job_id: string;
  session_id: string;
  format: 'json';
  export_scope: 'metadata' | 'content';
  status: 'ready' | 'expired';
  as_of: string;
  max_items: number;
  initial_item_count: number;
  created_by_identity: string;
  created_at: string;
  expires_at: string;
  last_accessed_at?: string | null;
  access_count: number;
}

export interface AnalyticsMetricDefinition {
  metricKey: string;
  version: number;
  displayName: string;
  description: string;
  unit: 'count' | 'milliseconds';
  evidenceClass: 'operational_observation' | 'source_confirmed';
  denominatorMetricKey?: string;
  source: { kind: string; detail?: string; canonicalToolId?: string; outcomeClass?: 'success' };
}

export interface AnalyticsPoint {
  bucketDate: string;
  agentId: string | null;
  agentReleaseId: string | null;
  channel: 'voice' | 'avatar' | 'unknown';
  metrics: Record<string, number>;
}

export interface AnalyticsDashboard {
  tenantId: string;
  generatedAt: string;
  range: { from: string; to: string; timezone: string; timezoneSource: 'organisation' | 'fallback_utc' };
  filters: { agentId: string | null; agentReleaseId: string | null; channel: 'voice' | 'avatar' | 'unknown' | null };
  metricRegistry: AnalyticsMetricDefinition[];
  series: AnalyticsPoint[];
  freshness: { latestSourceEventAt: string | null; aggregation: 'on_demand' };
  coverage: { usageStatusCounts: Record<string, number>; unattributedSessionCount: number };
  providerCostEstimates: Array<{
    currency: string; costTableVersion: string; measurementStatus: string;
    estimatedMicrounits: string; customerCharge: false;
  }>;
  commercialPolicy: {
    status: 'not_configured'; customerCharges: false; currencyConversion: 'not_performed'; disclaimer: string;
  };
  warnings: string[];
}

export interface AnalyticsExportJob {
  analytics_export_job_id: string;
  format: 'json';
  status: 'ready' | 'expired';
  filters: Record<string, unknown>;
  as_of: string;
  max_points: number;
  point_count: number;
  metric_registry_digest: string;
  document_digest: string;
  created_by_identity: string;
  created_at: string;
  expires_at: string;
  last_accessed_at?: string | null;
  access_count: number;
}

export interface UsageWorkspace {
  tenantId: string;
  generatedAt: string;
  statusCounts: Record<string, number>;
  providers: Array<{ providerId: string; adapterKey: string; measurementStatus: string; eventCount: number }>;
  dimensionTotals: Array<{ dimension: string; measurementStatus: string; quantity: string }>;
  providerCostEstimates: Array<{
    currency: string; costTableVersion: string; measurementStatus: string;
    estimatedMicrounits: string; customerCharge: false;
  }>;
  commercialPolicy: { status: 'not_configured'; customerCharges: false };
  budgetAlert: { status: 'unavailable'; reason: string };
}

export interface CommercialWorkspace {
  tenantId: string;
  generatedAt: string;
  providerIntegration: {
    availability: 'disabled' | 'sandbox' | 'live'; providerKey: string | null;
    checkout: boolean; portal: boolean; signedWebhooks: boolean; reconciliation: boolean;
    missingConfiguration: string[]; detail: string;
  };
  assignment: null | {
    assignmentId: string; assignmentStatus: string; effectiveFrom: string; effectiveTo: string | null;
    planVersionId: string; planKey: string; version: number; displayName: string; planStatus: string;
    pricingStatus: string; currency: string | null; interval: string | null; baseChargeMinor: string | null;
    taxMode: string; overageRounding: string; entitlements: Record<string, unknown>; manifestDigest: string;
  };
  preview: {
    status: 'unavailable' | 'preview_only'; chargeExecution: false; reason?: string;
    currency?: string; interval?: string; period?: { from: string; to: string; boundary: 'calendar_utc' };
    evidenceStatus?: 'measured' | 'estimated_or_incomplete'; baseChargeMinor?: string;
    subtotalMinor?: string; taxMinor?: string | null; totalMinor?: string; taxMode?: string;
    lineItems?: Array<{
      dimension: string; quantity: string; includedQuantity: string; overageQuantity: string; amountMinor: string;
    }>;
    disclaimer?: string;
  };
  subscriptions: Array<{
    billing_subscription_reference_id?: string; provider_key?: string; external_subscription_ref: string;
    status?: string; current_period_start?: string | null; current_period_end?: string | null;
    observed_at?: string; revision?: number;
  }>;
  invoices: Array<{
    billing_invoice_reference_id?: string; provider_key?: string; external_invoice_ref: string;
    status?: string; currency?: string | null; amount_due_minor?: string | null; amount_paid_minor?: string | null;
    hosted_invoice_url?: string | null; due_at?: string | null; observed_at?: string; revision?: number;
  }>;
  providerCustomers: Array<{ providerKey: string; environment: 'sandbox' | 'live'; observedAt: string }>;
  recentWebhookEvents: Array<{
    external_event_ref: string; event_type: string; processing_status: 'received' | 'processed' | 'ignored' | 'failed';
    processing_detail?: string | null; occurred_at: string; processed_at?: string | null;
  }>;
  activeCheckoutIntent: null | {
    request_id: string; commercial_plan_version_id: string;
    status: 'allocating' | 'outcome_unknown' | 'created'; created_at: string; expires_at?: string | null;
  };
  authority: { tenantPlanMutation: 'unavailable'; detail: string };
  isolation: { existingPayments: 'excluded'; detail: string };
}

export interface UsageLimitsWorkspace {
  tenantId: string;
  generatedAt: string;
  limits: {
    platformHardCaps: { maxConcurrentSessions: number; maxToolCallsPerMinute: number };
    commercialCeilings: null | {
      planKey: string; version: number; maxConcurrentSessions: number | null; maxToolCallsPerMinute: number | null;
    };
    tenantGuardrails: null | {
      revision: number; maxConcurrentSessions: number | null; maxToolCallsPerMinute: number | null;
      providerCostAlertMicrounits: string | null; providerCostAlertCurrency: string | null;
    };
    effective: { maxConcurrentSessions: number; maxToolCallsPerMinute: number };
  };
  providerCostAlert: {
    status: 'not_configured' | 'no_evidence' | 'clear' | 'active';
    period?: { boundary: 'calendar_utc'; interval: 'month' };
    currency?: string; thresholdMicrounits?: string; estimatedMicrounits?: string;
    evidence?: Array<{ costTableVersion: string; measurementStatus: string; estimatedMicrounits: string }>;
    admissionEnforcement: false; customerCharge: false; detail: string;
  };
}
