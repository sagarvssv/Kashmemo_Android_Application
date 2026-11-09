import type { TicketStatus, UserRole } from './types';

// Mirrors the role checks in the backend controllers so the UI only offers
// actions the server will accept. The server remains the source of truth.

const ORG_ADMIN_ROLES: UserRole[] = ['CEO', 'HR', 'FINANCE_MANAGER'];

export const can = {
  viewOrgTickets: (role: UserRole) => ORG_ADMIN_ROLES.includes(role),
  viewDepartmentTickets: (role: UserRole) => role === 'MANAGER',
  viewDashboardSummary: (role: UserRole) => role === 'CEO' || role === 'HR',
  viewPendingTickets: (role: UserRole) => role === 'CEO' || role === 'FINANCE_MANAGER',
  viewPeople: (role: UserRole) => role !== 'EMPLOYEE',
  // Employees get My claims as its own tab; other roles already have six tabs,
  // so they open it from Home or More instead.
  billsTab: (role: UserRole) => role === 'EMPLOYEE',
  // The CEO heads the organisation and doesn't claim money, so has no wallet.
  viewWallet: (role: UserRole) => role !== 'CEO',
  // Advances (advance.service.ts in the backend): bills are reviewed by a
  // Manager (own departments), the Finance Manager or the CEO; only the
  // Finance Manager settles; FM, CEO and HR see the outstanding list.
  reviewAdvanceBills: (role: UserRole) => role === 'MANAGER' || role === 'FINANCE_MANAGER' || role === 'CEO',
  settleAdvance: (role: UserRole) => role === 'FINANCE_MANAGER',
  viewOutstandingAdvances: (role: UserRole) => role === 'FINANCE_MANAGER' || role === 'CEO' || role === 'HR',
  viewDepartments: (role: UserRole) => ORG_ADMIN_ROLES.includes(role),
  addEmployee: (role: UserRole) => role !== 'EMPLOYEE',
  uploadCsv: (role: UserRole) => ORG_ADMIN_ROLES.includes(role),
  changeRole: (role: UserRole) => role === 'CEO',
  deleteEmployeeOrgWide: (role: UserRole) => role === 'CEO' || role === 'HR',
  manageOwnDepartmentEmployees: (role: UserRole) => role === 'MANAGER',
  allocateBudget: (role: UserRole) => role === 'CEO' || role === 'FINANCE_MANAGER',
  disburse: (role: UserRole) => ORG_ADMIN_ROLES.includes(role),
  manageManagers: (role: UserRole) => role === 'CEO',
  viewDisbursedReport: (role: UserRole) => role === 'CEO',
  viewDailyReport: (role: UserRole) => role === 'CEO' || role === 'FINANCE_MANAGER',
  viewReports: (role: UserRole) => role === 'CEO' || role === 'FINANCE_MANAGER',
};

// Same table as getAllowedApproverRoles() in the backend.
export function approverRolesFor(raiserRole: UserRole): UserRole[] {
  if (raiserRole === 'FINANCE_MANAGER') return ['CEO'];
  if (raiserRole === 'MANAGER') return ['FINANCE_MANAGER'];
  return ['MANAGER', 'CEO', 'HR', 'FINANCE_MANAGER'];
}

// Bills (receipt tickets): any one of these approves, with no dual sign-off
// (approveReceiptTicket in the backend). Rejecting follows the normal table.
const RECEIPT_APPROVER_ROLES: UserRole[] = ['MANAGER', 'FINANCE_MANAGER', 'CEO'];

export function canActOnTicket(params: {
  myRole: UserRole;
  myId: string;
  raisedBy: string;
  raiserRole: UserRole | undefined;
  status: TicketStatus;
  source?: 'MANUAL' | 'RECEIPT';
}) {
  const { myRole, myId, raisedBy, raiserRole, status, source } = params;
  if (myId === raisedBy) return { approve: false, reject: false };
  if (source === 'RECEIPT') {
    if (status !== 'PENDING') return { approve: false, reject: false };
    return {
      approve: RECEIPT_APPROVER_ROLES.includes(myRole),
      reject: approverRolesFor(raiserRole ?? 'EMPLOYEE').includes(myRole),
    };
  }
  if (status !== 'PENDING' && status !== 'PARTIALLY_APPROVED') return { approve: false, reject: false };
  const allowed = approverRolesFor(raiserRole ?? 'EMPLOYEE').includes(myRole);
  // HR may reject but the approval service only accepts Manager, CEO and Finance.
  return { approve: allowed && myRole !== 'HR', reject: allowed };
}
