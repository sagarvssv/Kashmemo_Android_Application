// Shapes returned by the KashMemo backend. Prisma serialises Decimal columns as
// strings, so every money field is typed `Money` and read through toAmount().

export type Money = string | number;

export type UserRole = 'CEO' | 'MANAGER' | 'HR' | 'EMPLOYEE' | 'FINANCE_MANAGER';
export type UserStatus = 'PENDING_VERIFICATION' | 'LOADED' | 'ROLE_ASSIGNED' | 'ACTIVE' | 'DISABLED';
// Advances (MANUAL tickets): PENDING -> APPROVED -> DISBURSED (cash collected,
// bills being added) -> SETTLEMENT_PENDING (employee is done) -> SETTLED.
// Receipt tickets (a bill paid with the employee's own money) stop at DISBURSED.
export type TicketStatus =
  | 'PENDING'
  | 'PARTIALLY_APPROVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'SETTLEMENT_PENDING'
  | 'SETTLED';

export const USER_ROLES: UserRole[] = ['EMPLOYEE', 'MANAGER', 'HR', 'FINANCE_MANAGER', 'CEO'];
export const TICKET_STATUSES: TicketStatus[] = [
  'PENDING',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'REJECTED',
  'DISBURSED',
  'SETTLEMENT_PENDING',
  'SETTLED',
];

export const INDUSTRY_TYPES = [
  'RETAIL',
  'MANUFACTURING',
  'HEALTHCARE',
  'INFORMATION_TECHNOLOGY',
  'REAL_ESTATE',
  'HOSPITALITY',
  'EDUCATION',
  'CONSTRUCTION',
  'LOGISTICS',
  'BANKING_FINANCE',
  'FOOD_BEVERAGE',
  'AUTOMOTIVE',
  'MEDIA_ENTERTAINMENT',
  'ECOMMERCE',
  'TELECOMMUNICATIONS',
  'AGRICULTURE',
  'PHARMACEUTICALS',
  'ENERGY_UTILITIES',
  'PROFESSIONAL_SERVICES',
  'OTHER',
] as const;
export type IndustryType = (typeof INDUSTRY_TYPES)[number];

export type ApiEnvelope<T> = { status?: string; success?: boolean; message?: string; data: T };
export type CursorPage<T> = ApiEnvelope<T[]> & { nextCursor: string | null };

export type SessionUser = {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  companyName?: string;
  plan?: string;
  phoneNumber?: string | null;
  designation?: string | null;
  mustResetPassword?: boolean;
};

export type LoginResult = {
  organizationId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  plan: string;
  companyName: string;
  department: string | null;
  token: { accessToken: string; refreshToken: string };
};

export type Profile = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  designation: string | null;
  departmentId: string | null;
  role: UserRole;
  status: UserStatus;
  mustResetPassword: boolean;
  createdAt: string;
};

export type DepartmentRef = { id?: string; name: string };

export type Ticket = {
  id: string;
  organizationId: string;
  departmentId: string;
  department?: DepartmentRef;
  raisedBy: string;
  purpose: string;
  amount: Money;
  status: TicketStatus;
  // MANUAL: raised by hand (money asked for in advance). RECEIPT: created from
  // a confirmed scanned bill; any one Manager, Finance Manager or CEO approves it.
  source?: 'MANUAL' | 'RECEIPT';
  // Receipt tickets only: the bill it came from and what was read from it.
  invoiceId?: string | null;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  category?: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  disbursedBy: string | null;
  disbursedAt: string | null;
  managerApprovedBy: string | null;
  managerApprovedAt: string | null;
  ceoApprovedBy: string | null;
  ceoApprovedAt: string | null;
  // Advances only: total of approved bills, and how the advance was closed.
  // settlementBalanceAmount is signed: +x = employee returned x unspent,
  // -x = finance paid the employee x they overspent.
  spentAmount?: Money;
  settledBy?: string | null;
  settledAt?: string | null;
  settlementBalanceAmount?: Money | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Advances, bills on advances and the wallet ledger ───

export type BillStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// A confirmed scanned bill added to an advance (TicketBill).
export type AdvanceBill = {
  id: string;
  organizationId?: string;
  ticketId: string;
  invoiceId: string;
  amount: Money; // in the ticket currency (converted by the backend)
  currency: string; // the bill's own currency
  vendorName: string | null;
  invoiceNumber?: string | null;
  invoiceDate: string | null;
  category: string | null;
  addedBy?: string;
  status: BillStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

// ADVANCE_CREDIT +  cash handed over · BILL_DEBIT -  a bill was approved
// CASH_RETURNED -  unspent cash given back · OVERSPEND_PAID +  finance paid the overspend
export type WalletTxnType = 'ADVANCE_CREDIT' | 'BILL_DEBIT' | 'CASH_RETURNED' | 'OVERSPEND_PAID';

export type WalletTransaction = {
  id: string;
  organizationId?: string;
  userId?: string;
  ticketId: string;
  billId: string | null;
  type: WalletTxnType;
  amount: Money; // signed
  createdBy: string;
  createdAt: string;
};

// GET /advances/:ticketId - one advance with its bills and wallet rows.
export type AdvanceDetails = Ticket & {
  bills: AdvanceBill[];
  walletTransactions: WalletTransaction[];
  balance: number; // + cash still with the employee, - owed to them
};

// GET /api/mang/bills/pending
export type PendingAdvanceBill = AdvanceBill & {
  ticket: {
    id: string;
    purpose: string;
    amount: Money;
    spentAmount: Money;
    raisedBy: string;
    department: { id: string; name: string };
  };
};

// GET /api/org/advances/outstanding
export type OutstandingAdvance = {
  id: string;
  purpose: string;
  amount: Money;
  spentAmount: Money;
  status: TicketStatus;
  raisedBy: string;
  disbursedAt: string | null;
  department: { id: string; name: string };
  employee: { id: string; name: string; email: string; phoneNumber: string | null } | null;
  pendingBills: number;
  toReturn: number;
  toPay: number;
};

// GET /api/emp/my-bills - every bill the user added to an advance.
export type MyAdvanceBill = AdvanceBill & {
  ticket: { id: string; purpose: string; status: TicketStatus };
};

// An advance whose cash is out, as listed in the wallet.
export type OpenAdvance = {
  id: string;
  purpose: string;
  amount: Money;
  spentAmount: Money;
  status: TicketStatus; // DISBURSED or SETTLEMENT_PENDING
  disbursedAt: string | null;
  department?: DepartmentRef;
  bills: Pick<
    AdvanceBill,
    'id' | 'invoiceId' | 'amount' | 'status' | 'vendorName' | 'category' | 'invoiceDate' | 'rejectionReason' | 'createdAt'
  >[];
  remaining: number;
  overspent: number;
};

// GET /api/emp/my-wallet. The balance is the sum of the user's wallet rows.
export type Wallet = {
  balance: number;
  cashInHand: number; // advance cash still with the user
  overspent: number; // what finance owes the user
  openAdvances: OpenAdvance[];
  // Approved, but the cash hasn't been collected from finance yet.
  awaitingCollection: {
    id: string;
    purpose: string;
    amount: Money;
    source?: 'MANUAL' | 'RECEIPT';
    approvedAt: string | null;
    department?: DepartmentRef;
  }[];
  transactions: WalletTransaction[];
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  designation?: string | null;
  role: UserRole;
  status?: UserStatus;
  source?: 'MANUAL' | 'CSV';
  createdAt?: string;
  department?: DepartmentRef | null;
};

export type EmployeeDetails = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  designation: string | null;
  role: UserRole;
  department: { name: string } | null;
  organization: { companyName: string };
};

export type Pagination = { page: number; limit: number; total: number; totalPages: number };

export type Department = { id: string; name: string };

export type ManagerDepartment = Department & {
  organizationId: string;
  isPrimary: boolean;
  createdAt: string;
};

export type BudgetStatus = {
  departmentId: { id: string; name: string };
  month: number;
  year: number;
  totalAllocated: number;
  spent: number;
  remaining: number;
  hasBudgetSet: boolean;
};

export type OrgBudget = {
  id: string;
  amount: Money;
  month: number;
  year: number;
  department: Department;
};

export type DashboardSummary = {
  month: number;
  year: number;
  totalEmployees: number;
  totalDepartments: number;
  budget: { totalAllocatedBudget: number; totalSpent: number; totalRemaining: number };
  tickets: Partial<Record<TicketStatus, number>>;
  departments: BudgetStatus[];
  employees: { id: string; name: string; role: UserRole; department: Department | null }[];
};

export type Activity = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  departmentId: string | null;
  actor: { id: string; name: string; email: string };
};

export type AppNotification = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata: { ticketId?: string; purpose?: string; amount?: Money; rejectionReason?: string } | null;
};

export type DisbursedSummary = {
  totalDisbursedAmount: number;
  departmentSummary: Record<string, { departmentName: string; totalAmount: number; ticketCount: number }>;
};

export type DailyReportDay = {
  day: string;
  count: Record<TicketStatus, number>;
  amount: Record<TicketStatus, number>;
  totalCount: number;
  totalAmount: number;
};

export type DailyReport = {
  summary: DailyReportDay[];
};

export type CsvUploadResult = { insertedCount: number; employees: Employee[] };
