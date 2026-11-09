import { request } from './api';
import type {
  Activity,
  AdvanceBill,
  AdvanceDetails,
  ApiEnvelope,
  AppNotification,
  BudgetStatus,
  CsvUploadResult,
  CursorPage,
  DailyReport,
  DashboardSummary,
  Department,
  DisbursedSummary,
  Employee,
  EmployeeDetails,
  IndustryType,
  LoginResult,
  ManagerDepartment,
  MyAdvanceBill,
  OrgBudget,
  OutstandingAdvance,
  Pagination,
  PendingAdvanceBill,
  Profile,
  Ticket,
  TicketStatus,
  UserRole,
  Wallet,
} from './types';

type CursorQuery = { cursor?: string; limit?: number };
type MonthQuery = { month?: number; year?: number };

// ─── Auth & account (/api/org) ───

export const authApi = {
  signup: (input: {
    companyName: string;
    ownerName: string;
    industryType: IndustryType;
    country: string;
    email: string;
    password: string;
  }) => request<ApiEnvelope<{ organizationId: string; userId: string; message: string }>>('/api/org/signup', {
    method: 'POST',
    body: input,
    auth: false,
  }),

  verifyEmail: (email: string, otp: string) =>
    request<ApiEnvelope<{ message: string }>>('/api/org/verifyOtp', {
      method: 'POST',
      body: { email, otp },
      auth: false,
    }),

  login: (email: string, password: string) =>
    request<ApiEnvelope<LoginResult>>('/api/org/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string; data?: { otpSent: boolean; remainingTime?: number } }>(
      '/api/org/forgot-password',
      { method: 'POST', body: { email }, auth: false },
    ),

  // Checks the reset code without using it up; resetPassword checks it again.
  verifyResetOtp: (email: string, otp: string) =>
    request<{ success: boolean; message: string }>('/api/org/verify-reset-otp', {
      method: 'POST',
      body: { email, otp },
      auth: false,
    }),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/api/org/reset-password', {
      method: 'POST',
      body: { email, otp, newPassword },
      auth: false,
    }),

  logout: () => request<{ message: string }>('/api/org/org-logout', { method: 'POST' }),

  profile: () => request<ApiEnvelope<Profile>>('/api/org/profile'),

  health: () => request<string>('/api/health', { auth: false, responseType: 'text' }),
};

// ─── Tickets ───

export const ticketApi = {
  raise: (purpose: string, amount: number) =>
    request<ApiEnvelope<Ticket>>('/api/emp/raise-ticket', { method: 'POST', body: { purpose, amount } }),

  // source: 'MANUAL' lists only advances, 'RECEIPT' only bill claims.
  mine: (query: CursorQuery & { status?: TicketStatus; source?: 'MANUAL' | 'RECEIPT' }) =>
    request<CursorPage<Ticket>>('/api/emp/my-tickets-list', { query }),

  department: (query: CursorQuery & { status?: TicketStatus; departmentId?: string }) =>
    request<CursorPage<Ticket>>('/api/mang/ticket/list', { query }),

  organization: (query: CursorQuery & { status?: TicketStatus; departmentId?: string }) =>
    request<CursorPage<Ticket>>('/api/org/ticket/list-tickets', { query }),

  byId: (ticketId: string) => request<ApiEnvelope<Ticket>>(`/api/org/ticket/${ticketId}`),

  approve: (ticketId: string) =>
    request<ApiEnvelope<Ticket>>(`/api/mang/ticket/approve/${ticketId}`, { method: 'PATCH' }),

  reject: (ticketId: string, rejectionReason: string) =>
    request<ApiEnvelope<Ticket>>(`/api/mang/ticket/reject/${ticketId}`, {
      method: 'PATCH',
      body: { rejectionReason },
    }),

  disburse: (ticketId: string, recipient: { email?: string; phoneNumber?: string }) =>
    request<ApiEnvelope<Ticket>>(`/api/org/ticket/disburse-ticket/${ticketId}`, {
      method: 'PATCH',
      body: recipient,
    }),

  wallet: () => request<ApiEnvelope<Wallet>>('/api/emp/my-wallet'),

  // Turns a confirmed scanned bill into a PENDING ticket for approval. The
  // backend reads the amount from the invoice itself (converted to AED). A bill
  // already submitted answers 409 with details.ticketId.
  fromInvoice: (invoiceId: string) =>
    request<ApiEnvelope<Ticket>>('/api/emp/tickets/from-invoice', { method: 'POST', body: { invoiceId } }),
};

// ─── Advances: bills against an advance, settlement ───
// An advance (MANUAL ticket) credits the wallet when finance hands over the
// cash. The employee adds scanned bills against it; each approved bill is
// debited. When done, they send it for settlement and the Finance Manager
// settles the difference in cash.

export const advanceApi = {
  // One advance with its bills and wallet rows (the raiser or staff).
  details: (ticketId: string) => request<ApiEnvelope<AdvanceDetails>>(`/api/org/advances/${ticketId}`),

  // Employee: add a confirmed scanned bill to an advance whose cash they collected.
  addBill: (ticketId: string, invoiceId: string) =>
    request<ApiEnvelope<AdvanceBill>>(`/api/emp/advances/${ticketId}/bills`, { method: 'POST', body: { invoiceId } }),

  // Employee: done spending, send it to finance.
  requestSettlement: (ticketId: string) =>
    request<ApiEnvelope<{ ticket: Ticket; balance: number }>>(`/api/emp/advances/${ticketId}/submit-settlement`, {
      method: 'POST',
    }),

  // Employee: every bill they added to an advance.
  myBills: () => request<ApiEnvelope<MyAdvanceBill[]>>('/api/emp/my-bills'),

  // Manager / Finance Manager / CEO: bills on advances waiting for review.
  pendingBills: () => request<ApiEnvelope<PendingAdvanceBill[]>>('/api/mang/bills/pending'),

  approveBill: (billId: string) =>
    request<ApiEnvelope<Ticket>>(`/api/mang/bills/approve/${billId}`, { method: 'PATCH' }),

  rejectBill: (billId: string, reason: string) =>
    request<ApiEnvelope<AdvanceBill>>(`/api/mang/bills/reject/${billId}`, { method: 'PATCH', body: { reason } }),

  // Finance Manager / CEO / HR: advances whose cash is out.
  outstanding: () => request<ApiEnvelope<OutstandingAdvance[]>>('/api/org/advances/outstanding'),

  // Finance Manager, after the cash changed hands.
  settle: (ticketId: string) => request<ApiEnvelope<Ticket>>(`/api/org/advances/${ticketId}/settle`, { method: 'PATCH' }),
};

// ─── Employees ───

export const employeeApi = {
  list: (query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    designation?: string;
    departmentId?: string;
  }) =>
    request<ApiEnvelope<Employee[]> & { pagination: Pagination }>('/api/org/list-employees', { query }),

  allInOrganization: (query: CursorQuery) =>
    request<CursorPage<Employee>>('/api/org/get-org-all-employees', { query }),

  inDepartment: (departmentId?: string) =>
    request<ApiEnvelope<Employee[]>>('/api/mang/employees/list', { query: { departmentId } }),

  details: (employeeId: string) => request<ApiEnvelope<EmployeeDetails>>(`/api/org/get-employee/${employeeId}`),

  // CEO / HR / Finance send a department name; managers add into their own department.
  add: (input: { name: string; email: string; phoneNumber?: string; designation: string; department?: string }) =>
    request<ApiEnvelope<Employee>>('/api/org/add-employee-manual', { method: 'POST', body: input }),

  uploadCsv: (file: { uri: string; name: string; mimeType?: string; file?: File }) => {
    const form = new FormData();
    if (file.file) {
      form.append('file', file.file);
    } else {
      // React Native's FormData accepts a { uri, name, type } descriptor for files.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'text/csv' } as unknown as Blob);
    }
    return request<ApiEnvelope<CsvUploadResult>>('/api/org/upload-csv', { method: 'POST', body: form });
  },

  csvTemplate: () => request<string>('/api/org/csv-template-download', { responseType: 'text' }),

  changeRole: (employeeId: string, role: UserRole) =>
    request<ApiEnvelope<Employee>>(`/api/org/change-employee-role/${employeeId}`, {
      method: 'PATCH',
      body: { role },
    }),

  remove: (employeeId: string) =>
    request<ApiEnvelope<{ message: string }>>(`/api/org/delete-employee/${employeeId}`, { method: 'DELETE' }),

  // Manager-only variants, limited to the manager's own department.
  editAsManager: (employeeId: string, input: { name?: string; phoneNumber?: string; designation?: string }) =>
    request<ApiEnvelope<Employee>>(`/api/mang/employee/edit/${employeeId}`, { method: 'PATCH', body: input }),

  removeAsManager: (employeeId: string) =>
    request<{ message: string }>(`/api/mang/employee/delete/${employeeId}`, { method: 'DELETE' }),
};

// ─── Departments & budgets ───

export const departmentApi = {
  list: () => request<ApiEnvelope<Department[]>>('/api/org/get-departmentList'),

  budgetStatus: (departmentId: string, query: MonthQuery = {}) =>
    request<ApiEnvelope<BudgetStatus>>(`/api/mang/dept/budget/status/${departmentId}`, { query }),

  budget: (departmentId: string, query: MonthQuery = {}) =>
    request<ApiEnvelope<{ amount: string; department: { name: string } } | null>>(
      `/api/org/budget/get-department-budget/${departmentId}`,
      { query },
    ),

  organizationBudget: (query: MonthQuery = {}) =>
    request<ApiEnvelope<OrgBudget[]>>('/api/org/budget/get-organization-budget', { query }),

  allocateBudget: (input: { departmentId: string; amount: number; month: number; year: number }) =>
    request<ApiEnvelope<OrgBudget>>('/api/org/budget/allocate-budget', { method: 'POST', body: input }),
};

// ─── Manager ⇄ department assignments ───

export const managerApi = {
  // Managers always get their own list; the CEO passes any manager's id.
  // (/api/mang/departments/list is not used: it reads a :managerId param its route doesn't declare.)
  departments: (managerId: string) =>
    request<ApiEnvelope<ManagerDepartment[]>>(`/api/org/managers/${managerId}/departments`),

  setPrimaryDepartment: (managerId: string, departmentId: string) =>
    request<ApiEnvelope<Employee>>(`/api/org/managers/${managerId}/primary-department`, {
      method: 'PATCH',
      body: { departmentId },
    }),

  assignDepartment: (managerId: string, departmentId: string) =>
    request<unknown>('/api/org/managers/assign-department', { method: 'POST', body: { managerId, departmentId } }),

  unassignDepartment: (managerId: string, departmentId: string) =>
    request<{ message: string }>(`/api/org/managers/${managerId}/departments`, {
      method: 'DELETE',
      body: { departmentId },
    }),

  replaceDepartments: (managerId: string, departmentIds: string[]) =>
    request<ApiEnvelope<ManagerDepartment[]>>(`/api/org/managers/${managerId}/departments`, {
      method: 'PUT',
      body: { departmentIds },
    }),

  setApprovalLimit: (managerId: string, departmentId: string, limit: number) =>
    request<ApiEnvelope<unknown>>(`/api/org/managers/${managerId}/departments/${departmentId}`, {
      method: 'PATCH',
      body: { limit },
    }),
};

// ─── Dashboards & reports ───

export const dashboardApi = {
  summary: (query: MonthQuery = {}) => request<ApiEnvelope<DashboardSummary>>('/api/org/dashboard/summary', { query }),

  pendingTickets: (query: MonthQuery = {}) =>
    request<ApiEnvelope<Ticket[]>>('/api/org/dashboard/pending-tickets', { query }),

  recentActivity: (query: CursorQuery) =>
    request<CursorPage<Activity>>('/api/org/dashboard/recent-activities', { query }),

  disbursedTickets: (query: MonthQuery = {}) =>
    request<ApiEnvelope<Ticket[]>>('/api/dashboard/disbursed-tickets', { query }),

  disbursedSummary: (query: MonthQuery = {}) =>
    request<ApiEnvelope<DisbursedSummary>>('/api/dashboard/disbursed-tickets-summary', { query }),

  dailyReport: (startdate: string, enddate: string) =>
    request<ApiEnvelope<DailyReport>>('/api/dashboard/daily-ticket-report', { query: { startdate, enddate } }),
};

// ─── Notifications ───

export const notificationApi = {
  list: (query: CursorQuery & { unreadOnly?: boolean }) =>
    request<CursorPage<AppNotification>>('/api/org/notifications', { query }),

  unreadCount: () => request<ApiEnvelope<number>>('/api/org/notifications/unread-count'),

  markRead: (notificationId: string) =>
    request<ApiEnvelope<AppNotification>>(`/api/org/notifications/mark-read/${notificationId}`, { method: 'PATCH' }),

  markAllRead: () => request<ApiEnvelope<{ count: number }>>('/api/org/notifications/mark-all-read', { method: 'PATCH' }),
};
