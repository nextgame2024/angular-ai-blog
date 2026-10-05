export type OpenForAustraliaRole = 'chief_executive' | 'operations' | 'advisor';

export interface OpenForAustraliaWorkspace {
  packId: 'open-for-australia';
  version: string;
  tenantId: string;
  role: OpenForAustraliaRole;
  authorizationRevision: number;
  workspaceRoutes: string[];
}

export interface OpenForAustraliaStudentSummary {
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

export interface OpenForAustraliaStudentList {
  students: OpenForAustraliaStudentSummary[];
  page: number;
  limit: number;
  total: number;
}
