/**
 * PeoplePay360 - payload shapes, mirrored 1:1 from the server's
 * `src/lib/serialize.ts`. Every enum here is the exact literal the API emits;
 * no lowercase aliases, no client-side renaming.
 */

// ---------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------

export interface Meta {
  page: number;
  limit: number;
  total: number;
}

export interface Paged<T> {
  data: T[];
  meta: Meta;
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

export type Role =
  | 'EMPLOYEE'
  | 'HR_MANAGER'
  | 'HR_PAYROLL_USER'
  | 'HR_PAYROLL_MANAGER'
  | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export interface MeResult extends AuthUser {
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    departmentId: string;
    departmentName: string | null;
    jobPosition: string | null;
    avatarUrl: string | null;
  } | null;
}

// ---------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------

export type EmployeeType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  departmentId: string;
  departmentName: string | null;
  jobPosition: string | null;
  managerId: string | null;
  managerName: string | null;
  workingScheduleId: string | null;
  employeeType: EmployeeType;
  status: EmployeeStatus;
  bankAccount: string | null;
  avatarUrl: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headcount?: number;
}

export interface EmployeeSummary {
  employeeId: string;
  contracts: number;
  attendance: number;
  timeOff: number;
  allocations: number;
  payslips: number;
  grievances: number;
}

// ---------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------

export type ContractStatus = 'DRAFT' | 'RUNNING' | 'EXPIRED' | 'CANCELLED';

export interface Contract {
  id: string;
  employeeId: string;
  employeeName: string | null;
  startDate: string | null;
  endDate: string | null;
  wage: number;
  jobPosition: string | null;
  departmentId: string;
  departmentName: string | null;
  workingScheduleId: string | null;
  workingScheduleName: string | null;
  salaryStructureId: string | null;
  salaryStructureName: string | null;
  status: ContractStatus;
}

// ---------------------------------------------------------------------
// Working schedules
// ---------------------------------------------------------------------

export interface ScheduleLine {
  id?: string;
  workingScheduleId?: string;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface WorkingSchedule {
  id: string;
  name: string;
  lines: ScheduleLine[];
  weeklyHours: number;
  employeeCount?: number;
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'MISSING_CHECKOUT';

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  notes: string | null;
  isManuallyEdited: boolean;
}

export interface AttendanceActive {
  session: Attendance | null;
  today: { workedHours: number; overtimeHours: number; sessions: number };
}

// ---------------------------------------------------------------------
// Time off
// ---------------------------------------------------------------------

export type TimeOffUnit = 'DAYS' | 'HOURS';
export type AllocationStatus = 'PENDING' | 'APPROVED' | 'REFUSED';
export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REFUSED';

export interface TimeOffType {
  id: string;
  name: string;
  unit: TimeOffUnit;
  requiresAllocation: boolean;
  isPaid: boolean;
  color: string | null;
}

export interface Allocation {
  id: string;
  employeeId: string;
  employeeName: string | null;
  timeOffTypeId: string;
  timeOffTypeName: string | null;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  validFrom: string | null;
  validTo: string | null;
  status: AllocationStatus;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string | null;
  timeOffTypeId: string;
  timeOffTypeName: string | null;
  allocationId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  durationDays: number;
  status: RequestStatus;
  reason: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
}

export interface BalanceRow extends Allocation {
  pendingDays: number;
  availableDays: number;
}

export interface TimeOffBalance {
  employeeId: string;
  employeeName: string;
  balances: BalanceRow[];
  totals: { allocatedDays: number; usedDays: number; remainingDays: number };
}

// ---------------------------------------------------------------------
// Salary configuration
// ---------------------------------------------------------------------

export type RuleCategory = 'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET';
export type ComputeType = 'FIXED' | 'PERCENTAGE' | 'FORMULA';

export interface SalaryRule {
  id: string;
  structureId: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  computeType: ComputeType;
  amount: number | null;
  percentage: number | null;
  formula: string | null;
  baseRuleCode: string | null;
}

/** What POST /salary-structures accepts for each rule (no id yet). */
export type SalaryRuleInput = Omit<SalaryRule, 'id' | 'structureId'>;

export interface SalaryStructure {
  id: string;
  name: string;
  rules: SalaryRule[];
  ruleCount?: number;
}

// ---------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------

export type PayrunStatus = 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID' | 'CANCELLED';
export type PayslipStatus = 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';

export type WarningSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type WarningCode =
  | 'MISSING_BANK'
  | 'DUPLICATE_PAYSLIP'
  | 'NO_CONTRACT_FOR_PERIOD'
  | 'CONTRACT_CHANGED_MID_PERIOD'
  | 'CONTRACT_EXPIRING_SOON'
  | 'NEGATIVE_NET'
  | 'ZERO_WORKED_DAYS';

export interface PayslipWarning {
  code: WarningCode;
  severity: WarningSeverity;
  message: string;
  payslipId?: string;
  employeeName?: string;
}

export interface PayslipLine {
  ruleCode: string;
  ruleName: string;
  category: RuleCategory;
  sequence: number;
  amount: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeCode: string | null;
  payrunId: string;
  payrunName: string | null;
  structureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  contractId: string | null;
  workedDays: number;
  status: PayslipStatus;
  lines: PayslipLine[];
  gross: number;
  totalDeductions: number;
  net: number;
  warnings: PayslipWarning[];
}

export interface Payrun {
  id: string;
  name: string;
  salaryStructureId: string;
  salaryStructureName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: PayrunStatus;
  createdById: string;
  createdByName: string | null;
  createdAt: string | null;
  payslipCount: number;
  totalNet: number;
  totalGross: number;
}

export interface PayrunDetail extends Payrun {
  payslips: Payslip[];
  warnings: Record<WarningSeverity, PayslipWarning[]>;
  canCompute: boolean;
  canValidate: boolean;
  canMarkPaid: boolean;
  canSendPayslips: boolean;
}

export interface EligibleEmployee {
  employeeId: string;
  employeeCode: string;
  name: string;
  departmentId: string;
  departmentName: string | null;
  jobPosition: string | null;
  employeeType: EmployeeType;
  hasBankAccount: boolean;
  alreadyHasPayslipForPeriod: boolean;
  existingPayslipId: string | null;
  contractCount: number;
  wage: number;
  warnings: PayslipWarning[];
}

export interface EligibleResult {
  salaryStructureId: string;
  salaryStructureName: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  employees: EligibleEmployee[];
}

export interface ComputeResult extends PayrunDetail {
  computed: number;
  failures: Array<{ employeeId: string; employeeName?: string; reason: string }>;
}

export interface SendResult {
  payrunId: string;
  attempted: number;
  sent: number;
  results: Array<{ payslipId: string; email?: string; ok: boolean; error?: string }>;
}

// ---------------------------------------------------------------------
// Grievances & users
// ---------------------------------------------------------------------

export type GrievanceStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface Grievance {
  id: string;
  employeeId: string;
  employeeName: string | null;
  payslipId: string | null;
  subject: string;
  description: string;
  status: GrievanceStatus;
  response: string | null;
  resolvedById: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
  employeeName: string | null;
  createdAt: string | null;
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

export interface DashboardAlert {
  type: string;
  severity: WarningSeverity;
  message: string;
  payslipId?: string;
  employeeId?: string;
  contractId?: string;
}

export interface Dashboard {
  period: string;
  periodStart: string;
  periodEnd: string;
  filters: { departmentId: string | null; employeeType: string | null };
  kpis: {
    totalNetPaid: number;
    payslipsGenerated: number;
    averageSalary: number;
    approvedTimeOffDays: number;
    attendanceHealth: number;
    openGrievances: number;
  };
  salaryByDepartment: Array<{ department: string; headcount: number; totalSalary: number }>;
  monthlyNetTrend: Array<{ period: string; net: number }>;
  attendanceOverview: {
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    overtimeHours: number;
    missingCheckouts: number;
    manualEdits: number;
  };
  alerts: DashboardAlert[];
}

export interface DashboardFilterOptions {
  departments: Array<{ id: string; name: string; code: string }>;
  periods: string[];
  employeeTypes: EmployeeType[];
}
