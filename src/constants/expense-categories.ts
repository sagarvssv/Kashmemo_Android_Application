import type { Ionicons } from '@expo/vector-icons';

import type { InvoiceCategory } from '@/lib/invoices';

// Picture buttons for expense types, shared by Raise a ticket and Upload a
// bill. They are the bill reader's own categories, so a read bill can pick one.
export const EXPENSE_CATEGORIES: { label: string; value: InvoiceCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Travel', value: 'Travel & Transport', icon: 'car-outline' },
  { label: 'Food', value: 'Food & Beverages', icon: 'restaurant-outline' },
  { label: 'Office', value: 'Office Supplies', icon: 'briefcase-outline' },
  { label: 'Repairs', value: 'Repairs & Maintenance', icon: 'construct-outline' },
  { label: 'Electronics', value: 'Electronics', icon: 'phone-portrait-outline' },
  { label: 'Courier', value: 'Logistics & Courier', icon: 'cube-outline' },
  { label: 'Phone & bills', value: 'Utilities & Telecom', icon: 'call-outline' },
  { label: 'Hotel', value: 'Accommodation', icon: 'bed-outline' },
  { label: 'Other', value: 'Miscellaneous', icon: 'ellipsis-horizontal-circle-outline' },
];

export function categoryLabel(value: string | null | undefined) {
  return EXPENSE_CATEGORIES.find((item) => item.value === value)?.label ?? value ?? '—';
}
