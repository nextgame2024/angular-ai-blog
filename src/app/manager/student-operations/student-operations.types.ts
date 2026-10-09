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
}

export interface StudentOperationsDashboard {
  workspace: StudentOperationsWorkspace;
  summary: {
    totalStudents: number;
    activeStudents: number;
    actionRequired: number;
    onHold: number;
  };
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
