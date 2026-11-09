import { LOCALE } from './config';
import { DEFAULT_CURRENCY, findCurrency } from './currencies';
import type { Money, TicketStatus, UserRole } from './types';

export function toAmount(value: Money | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(code: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(code);
  if (!formatter) {
    // Each currency keeps its own decimals (0 for JPY, 3 for KWD), so no fixed maximum.
    formatter = new Intl.NumberFormat(findCurrency(code)?.locale ?? LOCALE, {
      style: 'currency',
      currency: code,
    });
    currencyFormatters.set(code, formatter);
  }
  return formatter;
}

// Screens should use `useFormatMoney()` so amounts follow the currency picked in Profile.
export function formatMoney(value: Money | null | undefined, currency: string = DEFAULT_CURRENCY): string {
  return currencyFormatter(currency).format(toAmount(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelative(value: string): string {
  const diffSeconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (diffSeconds < 60) return 'just now';
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  CEO: 'CEO',
  MANAGER: 'Manager',
  HR: 'HR',
  EMPLOYEE: 'Employee',
  FINANCE_MANAGER: 'Finance Manager',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  PENDING: 'Pending',
  PARTIALLY_APPROVED: 'Partially approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISBURSED: 'Disbursed',
  SETTLEMENT_PENDING: 'Waiting to close',
  SETTLED: 'Closed',
};

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
