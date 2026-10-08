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

export interface StudentOperationsDashboard {
  workspace: StudentOperationsWorkspace;
  summary: {
    totalStudents: number;
    activeStudents: number;
    actionRequired: number;
    onHold: number;
  };
}
