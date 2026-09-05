// ============================================================
// PeoplePay360 — Locked Key Payload Shapes
// All API responses must conform to these interfaces.
// ============================================================

// --- Roles ---
export type Role =
  | 'super_admin'
  | 'hr_manager'
  | 'hr_executive'
  | 'payroll_manager'
  | 'employee';

// --- Auth ---
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string;
  name: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}

// --- Employee ---
export type EmployeeStatus = 'active' | 'inactive' | 'terminated' | 'on_leave';

export interface Employee {
  id: string;
  employeeId: string;        // e.g. "EMP-001"
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  dateOfJoining: string;     // ISO date
  status: EmployeeStatus;
  salary: number;
  bankAccountNumber: string;
  ifscCode: string;
  panNumber: string;
  avatarUrl?: string;
}

// --- Payroll ---
export type PayrollStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'rejected';

export interface PayrollRun {
  id: string;
  month: number;             // 1-12
  year: number;
  status: PayrollStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  createdAt: string;
  approvedBy?: string;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  grossSalary: number;
  pf: number;
  esi: number;
  tax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  status: PayrollStatus;
}

// --- Attendance ---
export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'leave'
  | 'holiday'
  | 'weekend';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;              // ISO date
  checkIn: string | null;    // ISO datetime
  checkOut: string | null;
  hoursWorked: number;
  status: AttendanceStatus;
}

// --- Leave ---
export type LeaveType =
  | 'casual'
  | 'sick'
  | 'earned'
  | 'maternity'
  | 'paternity'
  | 'unpaid';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  approvedBy?: string;
}

// --- Department ---
export interface Department {
  id: string;
  name: string;
  head: string;
  employeeCount: number;
}

// --- Dashboard ---
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  pendingLeaves: number;
  currentPayrollStatus: string;
  totalPayrollAmount: number;
  recentHires: Employee[];
  departmentBreakdown: { department: string; count: number }[];
}

// --- API Envelope ---
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// --- Permission Module/Action types ---
export type PermissionModule =
  | 'employees'
  | 'payroll'
  | 'attendance'
  | 'leave'
  | 'settings'
  | 'reports';

export type PermissionAction = 'read' | 'write' | 'delete' | 'approve';

// "self" means the user can only access their own records
export type PermissionValue = boolean | 'self';
