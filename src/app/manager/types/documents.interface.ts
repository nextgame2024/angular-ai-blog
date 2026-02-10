export interface BmDocument {
  documentId: string;
  companyId: string;
  userId: string;
  clientId: string;
  clientName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  type: 'quote' | 'invoice';
  docNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  materialTotal?: number | null;
  laborTotal?: number | null;
  subtotal?: number | null;
  gst?: number | null;
  totalAmount?: number | null;
  pdfUrl?: string | null;
  pdfKey?: string | null;
  invoiceStatus?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PagedDocumentsResult {
  documents: BmDocument[];
  page: number;
  limit: number;
  total: number;
}
