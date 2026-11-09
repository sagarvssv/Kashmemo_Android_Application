import type { TicketStatus, UserRole } from '@/lib/types';

// Colours come from the signed-in user's role (see ThemeProvider in
// context/theme.tsx). Each role's palette mirrors that role's web dashboard.
// Components read them with useColors() / useTheme() or createStyles(), never
// at module level, so they update when the role changes.

export type Palette = {
  primary: string;
  primaryDark: string;
  // Light tint of the primary colour for selected rows and icon backgrounds.
  primarySoft: string;
  accentTeal: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBackground: string;
  border: string;
  borderLight: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
};

export type Theme = {
  name: 'default' | 'finance' | 'manager' | 'employee';
  colors: Palette;
  statusColors: Record<TicketStatus, { background: string; text: string }>;
  // Solid fills for ticket-status charts. Each set was checked as a palette
  // (lightness band, chroma, contrast on its card surface, colour-blind
  // separation) in this order: pending, partial, approved, disbursed, rejected.
  statusChartColors: Record<TicketStatus, string>;
  // Budget charts: what was allocated vs what was spent.
  chartColors: { allocated: string; spent: string };
};

// CEO and HR: the original KashMemo green.
const defaultTheme: Theme = {
  name: 'default',
  colors: {
    primary: '#0e4b14',
    primaryDark: '#1E2875',
    primarySoft: '#e4efe3',
    accentTeal: '#2d4943',
    background: '#e4efe3',
    surface: '#ffffff',
    textPrimary: '#212922',
    textSecondary: '#153e91',
    textMuted: '#5b6b5d',
    inputBackground: '#fffcfc',
    border: '#123528',
    borderLight: '#cfdccd',
    success: '#02170a',
    danger: '#EF4444',
    warning: '#B45309',
    info: '#1D4ED8',
  },
  statusColors: {
    PENDING: { background: '#FEF3C7', text: '#92400E' },
    PARTIALLY_APPROVED: { background: '#DBEAFE', text: '#1E40AF' },
    APPROVED: { background: '#DCFCE7', text: '#166534' },
    REJECTED: { background: '#FEE2E2', text: '#991B1B' },
    DISBURSED: { background: '#E0E7FF', text: '#3730A3' },
    SETTLEMENT_PENDING: { background: '#FFEDD5', text: '#9A3412' },
    SETTLED: { background: '#dff4f8', text: '#0b5566' },
  },
  statusChartColors: {
    PENDING: '#D97706',
    PARTIALLY_APPROVED: '#2563EB',
    APPROVED: '#16A34A',
    DISBURSED: '#7C3AED',
    REJECTED: '#DC2626',
    SETTLEMENT_PENDING: '#EA580C',
    SETTLED: '#0891B2',
  },
  chartColors: { allocated: '#2d4943', spent: '#D97706' },
};

// Finance Manager: Kashmemo_Finance_Manager_Dashboard (indigo brand on warm
// putty neutrals, terracotta/teal for allocated vs spent).
const financeTheme: Theme = {
  name: 'finance',
  colors: {
    primary: '#534ab7',
    primaryDark: '#3c3489',
    primarySoft: '#eeedfe',
    accentTeal: '#534ab7',
    background: '#eeece4',
    surface: '#fafaf8',
    textPrimary: '#1a1a1a',
    textSecondary: '#5f5e5a',
    textMuted: '#888780',
    inputBackground: '#ffffff',
    border: '#cfcbbd',
    borderLight: '#e5e2d8',
    success: '#1d9e75',
    danger: '#c23b3b',
    warning: '#b8790f',
    info: '#185a94',
  },
  statusColors: {
    PENDING: { background: '#faeeda', text: '#633806' },
    PARTIALLY_APPROVED: { background: '#e6f1fb', text: '#0c447c' },
    APPROVED: { background: '#eaf3de', text: '#27500a' },
    DISBURSED: { background: '#e1f5ee', text: '#085041' },
    REJECTED: { background: '#fcebeb', text: '#791f1f' },
    SETTLEMENT_PENDING: { background: '#fbeee6', text: '#7a3410' },
    SETTLED: { background: '#dff4f8', text: '#0b5566' },
  },
  statusChartColors: {
    PENDING: '#b8790f',
    PARTIALLY_APPROVED: '#0284c7',
    APPROVED: '#5c9a2e',
    DISBURSED: '#534ab7',
    REJECTED: '#c23b3b',
    SETTLEMENT_PENDING: '#d85a30',
    SETTLED: '#0891B2',
  },
  chartColors: { allocated: '#d85a30', spent: '#1d9e75' },
};

// Manager: KashMemo_Manager_Dashboard (sapphire brand, slate neutrals, brass
// accent). Its web chart colours were too dark/grey to tell apart, so the
// status fills use nearby, more saturated steps.
const managerTheme: Theme = {
  name: 'manager',
  colors: {
    primary: '#22405f',
    primaryDark: '#1a2f47',
    primarySoft: '#dde8ee',
    accentTeal: '#2b4a62',
    background: '#eef3f6',
    surface: '#ffffff',
    textPrimary: '#16191b',
    textSecondary: '#4c545a',
    textMuted: '#626b71',
    inputBackground: '#ffffff',
    border: '#b1b8bd',
    borderLight: '#d7dbde',
    success: '#2e7d4f',
    danger: '#9a3b3b',
    warning: '#b57d1e',
    info: '#2670b3',
  },
  statusColors: {
    PENDING: { background: '#fbf0dc', text: '#7a5a0e' },
    PARTIALLY_APPROVED: { background: '#eef0fb', text: '#4a3aa7' },
    APPROVED: { background: '#e6f6e6', text: '#1d6b2f' },
    DISBURSED: { background: '#eef3f6', text: '#2b4a62' },
    REJECTED: { background: '#f6e9e9', text: '#9a3b3b' },
    SETTLEMENT_PENDING: { background: '#fbefe3', text: '#8a4a12' },
    SETTLED: { background: '#dff4f8', text: '#0b5566' },
  },
  statusChartColors: {
    PENDING: '#b57d1e',
    PARTIALLY_APPROVED: '#4a3aa7',
    APPROVED: '#2e9a4e',
    DISBURSED: '#2670b3',
    REJECTED: '#b94a4a',
    SETTLEMENT_PENDING: '#c2692a',
    SETTLED: '#0891B2',
  },
  chartColors: { allocated: '#2670b3', spent: '#b57d1e' },
};

// Employee: a calm, trustworthy blue on a light background, chosen for
// readability first. Every text/background pair meets WCAG AA (4.5:1 or more;
// body text is 15:1) and status badges use dark text on pale fills, so it
// stays clear for people who read slowly or have weaker eyesight.
const employeeTheme: Theme = {
  name: 'employee',
  colors: {
    primary: '#1d5fa8',
    primaryDark: '#164a85',
    primarySoft: '#e3eefa',
    accentTeal: '#1d5fa8',
    background: '#f2f5f9',
    surface: '#ffffff',
    textPrimary: '#16202c',
    textSecondary: '#3b4859',
    textMuted: '#5b6878',
    inputBackground: '#ffffff',
    border: '#9fb0c3',
    borderLight: '#d9e2ec',
    success: '#1e7d46',
    danger: '#c62828',
    warning: '#a85c00',
    info: '#1d5fa8',
  },
  statusColors: {
    PENDING: { background: '#fdf0d5', text: '#7a4100' },
    PARTIALLY_APPROVED: { background: '#e3eefa', text: '#0d47a1' },
    APPROVED: { background: '#e3f4e5', text: '#1b5e20' },
    DISBURSED: { background: '#ede7f8', text: '#4a2a8f' },
    REJECTED: { background: '#fde8e8', text: '#9b1c1c' },
    SETTLEMENT_PENDING: { background: '#fdeee2', text: '#8a3b06' },
    SETTLED: { background: '#dff4f8', text: '#0b5566' },
  },
  statusChartColors: {
    PENDING: '#D97706',
    PARTIALLY_APPROVED: '#2563EB',
    APPROVED: '#16A34A',
    DISBURSED: '#7C3AED',
    REJECTED: '#DC2626',
    SETTLEMENT_PENDING: '#EA580C',
    SETTLED: '#0891B2',
  },
  chartColors: { allocated: '#1d5fa8', spent: '#d97706' },
};

export const themes = { default: defaultTheme, finance: financeTheme, manager: managerTheme, employee: employeeTheme };

export function themeForRole(role: UserRole | null | undefined): Theme {
  if (role === 'FINANCE_MANAGER') return financeTheme;
  if (role === 'MANAGER') return managerTheme;
  if (role === 'EMPLOYEE') return employeeTheme;
  return defaultTheme;
}

export const spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  eight: 32,
};

export const radius = {
  small: 8,
  medium: 12,
  large: 16,
};
