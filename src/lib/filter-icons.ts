import type { Ionicons } from '@expo/vector-icons';

import type { TicketStatus } from './types';

type IconName = keyof typeof Ionicons.glyphMap;

// Icons for the filter chips on bill and people lists.

// "All" chips: every status, or every department.
export const ALL_ICON: IconName = 'apps-outline';
export const ALL_DEPARTMENTS_ICON: IconName = 'grid-outline';

// One per bill status, the same as the matching notification icons.
export const STATUS_ICONS: Record<TicketStatus, IconName> = {
  PENDING: 'hourglass-outline',
  PARTIALLY_APPROVED: 'git-pull-request-outline',
  APPROVED: 'checkmark-circle-outline',
  REJECTED: 'close-circle-outline',
  DISBURSED: 'cash-outline',
  SETTLEMENT_PENDING: 'swap-horizontal-outline',
  SETTLED: 'checkmark-done-circle-outline',
};

// A bill scanned but not yet sent for approval.
export const NOT_SENT_ICON: IconName = 'paper-plane-outline';

// Departments are free-text names, so pick an icon by matching whole words
// against common department vocabulary (same list as the iOS app). The first
// matching category wins, so the more specific ones come first.
const DEPARTMENT_CATEGORIES: { keywords: string[]; icon: IconName }[] = [
  { keywords: ['finance', 'financial', 'account', 'accounts', 'accounting', 'treasury', 'payroll', 'audit', 'tax', 'billing'], icon: 'wallet-outline' },
  { keywords: ['sales', 'sale', 'business development', 'bd', 'revenue', 'commercial'], icon: 'trending-up-outline' },
  { keywords: ['marketing', 'brand', 'branding', 'pr', 'communication', 'communications', 'media', 'advertising', 'digital marketing'], icon: 'megaphone-outline' },
  { keywords: ['hr', 'human', 'people', 'talent', 'recruitment', 'recruiting', 'hiring'], icon: 'people-outline' },
  { keywords: ['training', 'learning', 'l&d', 'education'], icon: 'school-outline' },
  { keywords: ['it', 'tech', 'technology', 'engineering', 'development', 'developer', 'software', 'devops', 'infra', 'infrastructure'], icon: 'code-slash-outline' },
  { keywords: ['data', 'analytics', 'bi', 'insights'], icon: 'analytics-outline' },
  { keywords: ['product', 'products'], icon: 'cube-outline' },
  { keywords: ['design', 'creative', 'ux', 'ui'], icon: 'color-palette-outline' },
  { keywords: ['operations', 'operation', 'ops'], icon: 'settings-outline' },
  { keywords: ['logistics', 'supply', 'warehouse', 'shipping', 'dispatch', 'inventory', 'store', 'stores'], icon: 'archive-outline' },
  { keywords: ['procurement', 'purchase', 'purchasing', 'vendor', 'vendors'], icon: 'cart-outline' },
  { keywords: ['production', 'manufacturing', 'factory', 'plant'], icon: 'construct-outline' },
  { keywords: ['maintenance', 'facilities', 'facility', 'housekeeping'], icon: 'hammer-outline' },
  { keywords: ['transport', 'fleet', 'travel'], icon: 'car-outline' },
  { keywords: ['support', 'service', 'services', 'customer', 'care', 'helpdesk', 'success'], icon: 'headset-outline' },
  { keywords: ['legal', 'compliance', 'risk'], icon: 'shield-checkmark-outline' },
  { keywords: ['security'], icon: 'lock-closed-outline' },
  { keywords: ['quality', 'qa', 'qc'], icon: 'ribbon-outline' },
  { keywords: ['research', 'r&d', 'rnd', 'lab', 'labs'], icon: 'flask-outline' },
  { keywords: ['medical', 'health', 'clinic', 'pharmacy'], icon: 'medkit-outline' },
  { keywords: ['events', 'event'], icon: 'calendar-outline' },
  { keywords: ['admin', 'administration', 'management', 'executive', 'general', 'office', 'ceo'], icon: 'briefcase-outline' },
];

export function departmentIcon(name: string): IconName {
  const text = ` ${name.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim()} `;
  const match = DEPARTMENT_CATEGORIES.find(({ keywords }) => keywords.some((keyword) => text.includes(` ${keyword} `)));
  return match?.icon ?? 'business-outline';
}
