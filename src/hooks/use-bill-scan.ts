import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/lib/api';
import {
  type Invoice,
  type InvoiceContentType,
  INVOICE_FINAL_STATUSES,
  invoiceApi,
  uploadInvoiceFile,
} from '@/lib/invoices';

// A bill picked on the phone: a photo (camera or gallery) or a PDF.
export type BillFile = {
  uri: string;
  kind: 'image' | 'pdf';
  name: string;
  width?: number;
  height?: number;
};

export type BillScan =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'reading' }
  | { state: 'done'; invoice: Invoice }
  | { state: 'duplicate'; invoice: Invoice }
  | { state: 'failed'; message: string };

const POLL_EVERY_MS = 4000;
// Rarely an invoice gets stuck in PROCESSING; stop and offer a retry instead.
const GIVE_UP_AFTER_MS = 2 * 60 * 1000;
// Phone photos are large; ~2000px on the long side keeps them well under
// Textract's limits (about 1 MB as JPEG) while staying sharp enough to read.
const MAX_SIDE = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Photos are always sent as JPEG: it shrinks them and also converts iPhone
// HEIC photos, which the API rejects.
async function prepare(bill: BillFile): Promise<{ uri: string; fileName: string; contentType: InvoiceContentType }> {
  if (bill.kind === 'pdf') return { uri: bill.uri, fileName: bill.name, contentType: 'application/pdf' };

  const context = ImageManipulator.manipulate(bill.uri);
  const longest = Math.max(bill.width ?? 0, bill.height ?? 0);
  if (longest > MAX_SIDE) {
    context.resize((bill.width ?? 0) >= (bill.height ?? 0) ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  const base = bill.name.replace(/\.[^.]+$/, '') || 'bill';
  return { uri: saved.uri, fileName: `${base}.jpg`, contentType: 'image/jpeg' };
}

function toScan(invoice: Invoice): BillScan {
  if (invoice.status === 'DUPLICATE') return { state: 'duplicate', invoice };
  if (invoice.status === 'FAILED') {
    return { state: 'failed', message: invoice.error ? `We could not read this bill (${invoice.error}).` : 'We could not read this bill.' };
  }
  return { state: 'done', invoice };
}

// Uploads a bill to the Invoice API and waits for it to be read.
export function useBillScan(userId: string) {
  const [scan, setScan] = useState<BillScan>({ state: 'idle' });
  // Each run gets a number; a newer run (or reset/unmount) makes older ones stop.
  const runRef = useRef(0);
  // The bill is null for an invoice resumed by id (nothing to upload again).
  const lastRef = useRef<{ bill: BillFile | null; invoiceId?: string; failedOnServer: boolean } | null>(null);

  useEffect(
    () => () => {
      runRef.current += 1;
    },
    [],
  );

  // Each step resolves with the final result, or null when a newer run took over.
  const finish = useCallback((run: number, result: BillScan): BillScan | null => {
    if (runRef.current !== run) return null;
    setScan(result);
    return result;
  }, []);

  const poll = useCallback(async (run: number, invoiceId: string): Promise<BillScan | null> => {
    const startedAt = Date.now();
    while (runRef.current === run) {
      await wait(POLL_EVERY_MS);
      if (runRef.current !== run) return null;
      try {
        const invoice = await invoiceApi.get(invoiceId);
        if (runRef.current !== run) return null;
        if (INVOICE_FINAL_STATUSES.includes(invoice.status)) {
          if (lastRef.current) lastRef.current.failedOnServer = invoice.status === 'FAILED';
          return finish(run, toScan(invoice));
        }
      } catch {
        // A single failed poll (e.g. weak signal) is not fatal; keep trying.
      }
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        if (lastRef.current) lastRef.current.failedOnServer = false;
        return finish(run, { state: 'failed', message: 'Reading the bill is taking too long.' });
      }
    }
    return null;
  }, [finish]);

  const start = useCallback(
    async (bill: BillFile): Promise<BillScan | null> => {
      const run = ++runRef.current;
      lastRef.current = { bill, failedOnServer: false };
      setScan({ state: 'sending' });
      try {
        const file = await prepare(bill);
        const upload = await invoiceApi.requestUpload({
          fileName: file.fileName,
          contentType: file.contentType,
          uploadedBy: userId,
        });
        if (runRef.current !== run) return null;
        lastRef.current.invoiceId = upload.invoiceId;
        await uploadInvoiceFile(upload.uploadUrl, file.uri, file.contentType);
        if (runRef.current !== run) return null;
        setScan({ state: 'reading' });
        return await poll(run, upload.invoiceId);
      } catch (err) {
        return finish(run, { state: 'failed', message: errorMessage(err) });
      }
    },
    [finish, poll, userId],
  );

  // Picks up an invoice uploaded earlier (e.g. opened from My bills), waiting
  // for it if it is still being read.
  const resume = useCallback(
    async (invoiceId: string): Promise<BillScan | null> => {
      const run = ++runRef.current;
      setScan({ state: 'reading' });
      try {
        const invoice = await invoiceApi.get(invoiceId);
        lastRef.current = { bill: null, invoiceId, failedOnServer: invoice.status === 'FAILED' };
        if (INVOICE_FINAL_STATUSES.includes(invoice.status)) return finish(run, toScan(invoice));
        return await poll(run, invoiceId);
      } catch (err) {
        return finish(run, { state: 'failed', message: errorMessage(err) });
      }
    },
    [finish, poll],
  );

  // A bill the server failed to read is re-run there; anything else (no
  // signal, timed out) is uploaded again from the start.
  const retry = useCallback(async (): Promise<BillScan | null> => {
    const last = lastRef.current;
    if (!last) return null;
    if (!last.failedOnServer || !last.invoiceId) {
      if (last.bill) return start(last.bill);
      if (last.invoiceId) return resume(last.invoiceId);
      return null;
    }
    const run = ++runRef.current;
    const invoiceId = last.invoiceId;
    setScan({ state: 'reading' });
    try {
      await invoiceApi.reprocess(invoiceId);
      return await poll(run, invoiceId);
    } catch (err) {
      return finish(run, { state: 'failed', message: errorMessage(err) });
    }
  }, [finish, poll, resume, start]);

  const reset = useCallback(() => {
    runRef.current += 1;
    lastRef.current = null;
    setScan({ state: 'idle' });
  }, []);

  return { scan, start, resume, retry, reset };
}
