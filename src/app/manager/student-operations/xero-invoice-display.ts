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
