import * as FileSystem from 'expo-file-system/legacy';

import { ApiError } from './api';
import { INVOICE_API_URL } from './config';

// Client for the Petty Cash Invoice API: upload a bill, and it reads the
// fields (Textract), picks a category with AI and checks for duplicates.
// Flow: POST /invoices/upload-url → PUT the file to S3 → poll GET /invoices/{id}.

export type InvoiceStatus = 'UPLOAD_PENDING' | 'PROCESSING' | 'COMPLETED' | 'DUPLICATE' | 'FAILED' | 'CONFIRMED';

export type InvoiceContentType = 'image/jpeg' | 'image/png' | 'application/pdf';

// The nine categories the AI picks from; PUT accepts only these exact names.
export type InvoiceCategory =
  | 'Electronics'
  | 'Logistics & Courier'
  | 'Food & Beverages'
  | 'Office Supplies'
  | 'Travel & Transport'
  | 'Repairs & Maintenance'
  | 'Utilities & Telecom'
  | 'Accommodation'
  | 'Miscellaneous';

export type InvoiceLineItem = {
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
};

export type InvoiceFields = {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  vendorName: string | null;
  vendorTaxId: string | null;
  currency: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  paymentMethod: string | null;
  lineItems: InvoiceLineItem[] | null;
  notes: string | null;
};

export type Invoice = {
  invoiceId: string;
  status: InvoiceStatus;
  fileName?: string;
  contentType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  processedAt?: string;
  fileUrl?: string;
  extracted?: Partial<InvoiceFields>;
  category?: InvoiceCategory;
  categoryConfidence?: number;
  categoryReason?: string;
  needsReview?: boolean;
  missingFields?: string[];
  possibleDuplicateOf?: string;
  duplicateOf?: string;
  duplicateReason?: 'SAME_FILE' | 'SAME_VENDOR_AND_INVOICE_NUMBER';
  error?: string;
};

// A row in GET /invoices: the key fields flattened.
export type InvoiceSummary = {
  invoiceId: string;
  status: InvoiceStatus;
  fileName?: string;
  uploadedAt?: string;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  category?: InvoiceCategory | null;
  needsReview?: boolean;
  duplicateOf?: string | null;
  possibleDuplicateOf?: string | null;
};

export const INVOICE_FINAL_STATUSES: InvoiceStatus[] = ['COMPLETED', 'DUPLICATE', 'FAILED', 'CONFIRMED'];

const REQUEST_TIMEOUT_MS = 30000;

export const invoiceApiEnabled = Boolean(INVOICE_API_URL);

async function call<T>(path: string, init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<T> {
  if (!INVOICE_API_URL) throw new ApiError(0, 'Bill reading is not set up.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${INVOICE_API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { Accept: 'application/json', ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, controller.signal.aborted ? 'Reading the bill took too long.' : 'Could not reach the bill reader. Check your internet.');
  } finally {
    clearTimeout(timeout);
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Some responses have an empty body.
  }
  if (!response.ok) {
    const message = (parsed as { error?: string } | null)?.error ?? `Bill reader error (${response.status}).`;
    throw new ApiError(response.status, message, parsed);
  }
  return parsed as T;
}

export const invoiceApi = {
  requestUpload: (input: { fileName: string; contentType: InvoiceContentType; uploadedBy: string }) =>
    call<{ invoiceId: string; uploadUrl: string; headers: Record<string, string>; expiresIn: number }>(
      '/invoices/upload-url',
      { method: 'POST', body: input },
    ),

  get: (invoiceId: string) => call<Invoice>(`/invoices/${invoiceId}`),

  // Newest upload first; pass the previous page's nextToken for more.
  list: (query: { uploadedBy: string; limit?: number; nextToken?: string | null }) => {
    const params = new URLSearchParams({ uploadedBy: query.uploadedBy, limit: String(query.limit ?? 20) });
    if (query.nextToken) params.set('nextToken', query.nextToken);
    return call<{ items: InvoiceSummary[]; count: number; nextToken: string | null }>(`/invoices?${params}`);
  },

  update: (
    invoiceId: string,
    input: { fields?: Partial<InvoiceFields>; category?: InvoiceCategory; confirm?: boolean; updatedBy: string },
  ) => call<Invoice>(`/invoices/${invoiceId}`, { method: 'PUT', body: input }),

  reprocess: (invoiceId: string) =>
    call<{ invoiceId: string; status: InvoiceStatus; message: string }>(`/invoices/${invoiceId}/reprocess`, {
      method: 'POST',
    }),
};

// Sends the file's bytes straight to S3. Content-Type is part of the upload
// URL's signature, so it must be exactly the one sent to requestUpload. React
// Native's fetch with a Blob body can change it on Android (e.g. adding
// "; charset=utf-8"), which S3 rejects with SignatureDoesNotMatch, so the file
// is sent natively with exactly the given headers instead.
export async function uploadInvoiceFile(uploadUrl: string, fileUri: string, contentType: InvoiceContentType) {
  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    });
  } catch {
    throw new ApiError(0, 'Could not send the bill. Check your internet.');
  }
  if (result.status < 200 || result.status >= 300) {
    // S3 explains failures in an XML <Code>, e.g. AccessDenied or SignatureDoesNotMatch.
    const code = /<Code>([^<]+)<\/Code>/.exec(result.body ?? '')?.[1];
    throw new ApiError(
      result.status,
      code === 'AccessDenied' || /expired/i.test(result.body ?? '')
        ? 'The upload link expired. Please try again.'
        : `Could not send the bill${code ? ` (${code})` : ''}. Please try again.`,
    );
  }
}
