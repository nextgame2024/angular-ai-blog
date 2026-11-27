export const XERO_INVOICE_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Awaiting approval' },
  { value: 'AUTHORISED', label: 'Awaiting payment' },
  { value: 'PAID', label: 'Paid' },
] as const;

export function xeroInvoiceStatusLabel(value: string): string {
  return XERO_INVOICE_STATUS_OPTIONS.find(option => option.value === value.toUpperCase())?.label
    ?? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export const XERO_PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

export const RECEIPT_EXCEPTION_LABELS = {
  voided: 'Invoice voided in Xero',
  deleted: 'Invoice deleted in Xero',
  not_current: 'Invoice missing from the current import',
};
