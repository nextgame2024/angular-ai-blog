import type { StudentCaseStatus } from './student-operations.types';

export const IMPORTED_CASE_STAGE = { value: 'imported_pending_review', label: 'Imported — Pending Review' } as const;
export const CASE_WORKFLOW_STAGES = [
  { value: 'documents_requested', label: 'Documents Requested' },
  { value: 'checklist_complete', label: 'Verified Documents' },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'invoices_created', label: 'Invoices Created' },
  { value: 'payment_monitoring', label: 'Payment Monitoring' },
  { value: 'payments_complete', label: 'Payments Complete' },
] as const;

export const CASE_STATUS_LABELS: Record<StudentCaseStatus, string> = {
  pre_sale: 'Pre-sale',
  on_hold: 'On hold',
  in_progress: 'In progress',
  payment_overdue: 'Payment overdue',
  collections: 'In collections',
  payment_done: 'Payment complete',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export function caseStageLabel(stage: string): string {
  if (stage === IMPORTED_CASE_STAGE.value) return IMPORTED_CASE_STAGE.label;
  return CASE_WORKFLOW_STAGES.find(item => item.value === stage)?.label
    ?? stage.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
