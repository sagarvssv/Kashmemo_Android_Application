import { useApi } from '@/hooks/use-api';
import { ApiError } from '@/lib/api';
import { advanceApi, ticketApi } from '@/lib/endpoints';
import type { MyAdvanceBill, Ticket } from '@/lib/types';

// A scanned bill is claimed exactly once, in one of two ways:
//  - on its own, when the employee paid with their own money
//    (POST /api/emp/tickets/from-invoice makes a receipt ticket), or
//  - against an advance whose cash they collected
//    (POST /api/emp/advances/:ticketId/bills adds it to that advance).

// The backend answers 409 with the ticket that already holds a receipt.
function existingTicketId(err: unknown) {
  return err instanceof ApiError && err.status === 409
    ? (err.body as { details?: { ticketId?: string } } | null)?.details?.ticketId
    : undefined;
}

// Resolves with the receipt ticket's id, also when it was submitted before.
export async function submitBillForApproval(invoiceId: string): Promise<string> {
  try {
    const { data } = await ticketApi.fromInvoice(invoiceId);
    return data.id;
  } catch (err) {
    const existingId = existingTicketId(err);
    if (existingId) return existingId;
    throw err;
  }
}

// Adds the bill to an advance; resolves with the advance's ticket id (or the
// ticket already holding this receipt).
export async function addBillToAdvance(advanceId: string, invoiceId: string): Promise<string> {
  try {
    await advanceApi.addBill(advanceId, invoiceId);
    return advanceId;
  } catch (err) {
    const existingId = existingTicketId(err);
    if (existingId) return existingId;
    throw err;
  }
}

// Enough of the user's own tickets to find the ones made from their bills.
const LOOKUP_LIMIT = 100;

// Where each of the user's scanned bills went, keyed by invoiceId: the
// receipt ticket made from it, or the advance it was added to.
export function useBillTickets() {
  const tickets = useApi(() => ticketApi.mine({ limit: LOOKUP_LIMIT }), []);
  const advanceBills = useApi(() => advanceApi.myBills().then((r) => r.data), []);
  const byInvoice = new Map<string, Ticket>();
  for (const ticket of tickets.data?.data ?? []) {
    if (ticket.invoiceId) byInvoice.set(ticket.invoiceId, ticket);
  }
  const onAdvance = new Map<string, MyAdvanceBill>();
  for (const bill of advanceBills.data ?? []) onAdvance.set(bill.invoiceId, bill);

  const reload = async () => {
    await Promise.all([tickets.reload(), advanceBills.reload()]);
  };
  const refresh = async () => {
    await Promise.all([tickets.refresh(), advanceBills.refresh()]);
  };
  return {
    byInvoice,
    onAdvance,
    isLoading: tickets.isLoading || advanceBills.isLoading,
    reload,
    refresh,
  };
}
