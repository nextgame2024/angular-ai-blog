export type StudentOperationsRole = 'chief_executive' | 'operations' | 'advisor';

export interface StudentOperationsWorkspace {
  packId: 'student-operations';
  version: string;
  tenantId: string;
  role: StudentOperationsRole;
  authorizationRevision: number;
  workspaceRoutes: string[];
}

export interface StudentOperationsStudentSummary {
  studentId: string;
  studentReference: string;
  legalName: string;
  preferredName: string | null;
  email: string;
  currentStage: string;
  status: string;
  collegeName: string | null;
  advisorAssigned: boolean;
  maskedFields: string[];
}

export interface StudentOperationsStudentList {
  students: StudentOperationsStudentSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface StudentOperationsStudentDetail extends StudentOperationsStudentSummary {
  advisorIdentityUserId: string | null;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  idempotentReplay?: boolean;
}

export interface StudentOperationsStudentWrite {
  studentReference: string;
  legalName: string;
  preferredName: string | null;
  email: string;
  currentStage: string;
  status: string;
  advisorIdentityUserId: string | null;
  collegeName: string | null;
  xeroCandidateSource?: { connectionId: string; contactId: string };
}

export interface StudentOperationsDashboard {
  workspace: StudentOperationsWorkspace;
  summary: {
    totalStudents: number;
    activeStudents: number;
    newApplications: number;
    actionRequired: number;
    onHold: number;
  };
}

export type StudentRegisterStatus = StudentCaseStatus | 'not_started';
export type StudentRegisterSort = 'name' | 'studentId' | 'advisor' | 'college' | 'date' | 'stage' | 'nextPayment' | 'status';

export interface StudentRegisterQuery {
  page: number;
  limit: number;
  q?: string;
  status?: StudentRegisterStatus;
  advisorId?: string;
  collegeId?: string;
  advisorName?: string;
  collegeName?: string;
  from?: string;
  to?: string;
  attentionThisWeek?: boolean;
  sortBy?: StudentRegisterSort;
  sortDir?: 'asc' | 'desc';
}

export interface StudentRegisterRow {
  userId: string;
  studentProfileId: string | null;
  studentReference: string;
  legalName: string;
  email: string;
  recordDate: string;
  caseId: string | null;
  caseReference: string | null;
  currentStage: string | null;
  advisorUserId: string | null;
  advisorName: string | null;
  collegeId: string | null;
  collegeName: string | null;
  status: StudentRegisterStatus;
  attentionReason: string | null;
  caseCount: number;
  cases: Array<{
    caseId: string;
    caseReference: string;
    lifecycleStatus: string;
    openedOn: string;
  }>;
  nextPayment: {
    caseId: string;
    dueOn: string;
    amount?: string;
    currency?: string;
  } | null;
}

export interface StudentRegisterResult {
  students: StudentRegisterRow[];
  page: number;
  limit: number;
  total: number;
  summary: {
    total: number;
    activeStudents: number;
    newApplications: number;
    actionRequired: number;
    noVigente: number;
    attentionThisWeek: number;
    lastUpdated: string | null;
    trend: { available: boolean; reason?: string };
  };
  options: {
    advisors: Array<{ userId: string | null; name: string }>;
    colleges: Array<{ collegeId: string | null; name: string }>;
  };
}

export type StudentCaseStatus = 'pre_sale' | 'on_hold' | 'in_progress' | 'payment_overdue' | 'collections' | 'payment_done' | 'closed' | 'cancelled';

export interface StudentCaseDetail {
  caseId: string;
  caseNumber: string;
  userId: string;
  studentId: string;
  studentReference: string;
  studentName: string | null;
  studentEmail: string | null;
  studentPhone: string | null;
  studentMobile: string | null;
  title: string | null;
  courseName: string | null;
  advisorName: string | null;
  status: StudentCaseStatus;
  currentStage: string;
  openedOn: string | null;
  createdAt: string;
  updatedAt: string;
  recordVersion: number;
  advisors: Array<{ userId: string; name: string | null; isPrimary: boolean }>;
  colleges: Array<{ collegeId: string; name: string; isPrimary: boolean }>;
}

export interface StudentCaseEditOptions {
  advisors: Array<{ userId: string; name: string }>;
  colleges: Array<{ collegeId: string; name: string }>;
}

export interface StudentCaseWorkflowOptions {
  statuses: string[];
  stages: string[];
  allowedStatuses: Record<string, string[]>;
}

export interface StudentCaseList {
  cases: Array<{ caseId: string; caseNumber: string; status: StudentCaseStatus; currentStage: string }>;
  page: number;
  limit: number;
  total: number;
}

export interface StudentCaseInvoices {
  invoices: Array<{
    invoiceId: string; invoiceNumber: string | null; type: string; status: string;
    date: string | null; dueDate: string | null; reference?: string | null;
    paymentTrack?: string | null; currency?: string | null;
    total?: string | null; amountPaid?: string | null; amountDue?: string | null;
  }>;
  page: number;
  limit: number;
  total: number;
}

export interface StudentCaseDocuments {
  documents: Array<{
    documentId: string; fileName: string; mimeType: string; sizeBytes: number;
    sourceKind: string; lastSeenAt: string;
  }>;
  discovery: Array<{ status: string; errorCode: string | null; count: number }>;
  discoveryRequested: boolean;
  page: number;
  limit: number;
  total: number;
}

export interface StudentCaseActivity {
  activity: Array<{ activityId: string; eventType: string; summary: string; createdAt: string }>;
  page: number;
  limit: number;
}

export interface XeroConnectionSummary {
  connectionId: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
  tenantShortCode: string | null;
  status: string;
  healthStatus: string;
  lastTestedAt: string | null;
  lastErrorCode: string | null;
  organisationRole: 'trust' | 'operating' | 'unassigned' | null;
  missingStudentDiscoveryScopes: string[];
  missingAttachmentScopes?: string[];
}

export interface XeroStudentCandidate {
  xeroContactId: string;
  legalName: string;
  email: string | null;
  suggestedStudentReference: string | null;
  invoiceCount: number;
  latestInvoiceNumber: string | null;
  latestInvoiceDate: string | null;
  latestInvoiceReference: string | null;
  concept: string | null;
  advisorName: string | null;
  collegeName: string | null;
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
  totalInvoiced: number;
  totalPaid: number;
  amountDue: number;
  currencyCode: string | null;
  paymentStatus: 'paid' | 'due' | 'overdue';
}

export interface XeroStudentCandidateResult {
  candidates: XeroStudentCandidate[];
  page: number;
  limit: number;
  total: number;
}

export type XeroStudentInvoiceSort = 'invoiceNumber' | 'reference' | 'student' | 'date'
  | 'dueDate' | 'paid' | 'due' | 'status' | 'sent' | 'advisor' | 'paymentTrack';

export interface XeroStudentInvoice {
  xeroInvoiceId: string;
  xeroContactId: string;
  documentType?: 'invoice' | 'credit_note' | 'prepayment' | 'overpayment';
  invoiceNumber: string | null;
  reference: string | null;
  studentName: string;
  studentEmail: string | null;
  suggestedStudentReference: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  status: string;
  currencyCode: string | null;
  total: number;
  amountPaid: number;
  amountDue: number;
  sentToContact: boolean;
  concept: string | null;
  advisorName: string | null;
  collegeName: string | null;
  paymentTrack: string | null;
  reviewStatus: 'pending' | 'accepted' | 'ignored';
  studentId: string | null;
}

export interface XeroStudentInvoiceLineItem {
  lineItemId: string | null;
  itemCode: string | null;
  description: string | null;
  quantity: number | null;
  unitAmount: number | null;
  discountRate: number | null;
  accountCode: string | null;
  taxType: string | null;
  taxAmount: number | null;
  lineAmount: number | null;
  tracking: Array<{ name: string; option: string }>;
}

export interface XeroStudentInvoiceDetail extends XeroStudentInvoice {
  lineItems: XeroStudentInvoiceLineItem[];
}

export interface XeroStudentInvoiceResult {
  invoices: XeroStudentInvoice[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  invoiceTotal?: number;
  creditNoteTotal?: number;
  prepaymentTotal?: number;
  overpaymentTotal?: number;
  statusTotals?: {
    draft: number;
    awaitingApproval: number;
    awaitingPayment: number;
    paid: number;
  };
}

export interface XeroStudentSyncRun {
  syncRunId: string;
  connectionId: string;
  mode: 'initial' | 'incremental' | 'reconciliation';
  triggerType: 'manual' | 'schedule' | 'webhook' | 'connection';
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  contactCount: number;
  invoiceCount: number;
  candidateCount: number;
  errorCode: string | null;
  providerStatus?: number | null;
  providerCorrelationId?: string | null;
  retryAfterSeconds?: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface XeroStudentSyncStatus {
  configured: boolean;
  organisationRole: 'trust' | 'operating' | 'unassigned' | null;
  lastSuccessfulSyncAt: string | null;
  lastFullSyncAt?: string | null;
  lastErrorCode: string | null;
  nextScheduledSyncAt: string | null;
  latestRun: XeroStudentSyncRun | null;
}

export interface XeroConnectionStatus {
  provider: 'xero';
  configured: boolean;
  mode: 'read_only';
  requestedScopes: string[];
  connections: XeroConnectionSummary[];
}

export interface XeroConnectionTest {
  connectionId: string;
  verifiedAt: string;
  organisation: {
    organisationId: string;
    name: string;
    legalName: string | null;
    organisationType: string | null;
    shortCode: string | null;
    baseCurrency: string | null;
    countryCode: string | null;
    isDemoCompany: boolean;
  };
  bankAccounts: Array<{
    accountId: string;
    code: string | null;
    name: string;
    status: string | null;
    bankAccountType: string | null;
  }>;
}
