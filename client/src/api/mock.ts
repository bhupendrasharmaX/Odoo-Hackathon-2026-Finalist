/**
 * PeoplePay360 — Mock API Layer
 * Same function signatures as the real API client.
 * Returns hardcoded fixtures after a 300ms delay.
 */

import type {
  LoginResponse,
  Employee,
  PayrollRun,
  Payslip,
  AttendanceRecord,
  LeaveRequest,
  Department,
  DashboardStats,
  Role,
} from '../types';

// --- Helpers ---
const delay = <T>(data: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), 300));

// --- Mock Users (for login) ---
const MOCK_USERS: Record<string, { password: string; role: Role; name: string; employeeId: string }> = {
  'admin@peoplepay360.com':     { password: 'admin123',   role: 'super_admin',     name: 'Raj Mehta',        employeeId: 'EMP-001' },
  'hr@peoplepay360.com':        { password: 'hr123',      role: 'hr_manager',      name: 'Priya Sharma',     employeeId: 'EMP-002' },
  'hrexec@peoplepay360.com':    { password: 'hrexec123',  role: 'hr_executive',    name: 'Ankit Verma',      employeeId: 'EMP-003' },
  'payroll@peoplepay360.com':   { password: 'payroll123', role: 'payroll_manager', name: 'Sunita Desai',     employeeId: 'EMP-004' },
  'employee@peoplepay360.com':  { password: 'emp123',     role: 'employee',        name: 'Vikram Singh',     employeeId: 'EMP-010' },
};

// --- Mock Employees ---
const MOCK_EMPLOYEES: Employee[] = [
  { id: '1',  employeeId: 'EMP-001', firstName: 'Raj',      lastName: 'Mehta',     email: 'admin@peoplepay360.com',    phone: '+91 98765 43210', department: 'Management',  designation: 'CEO',                 dateOfJoining: '2020-01-15', status: 'active',     salary: 250000, bankAccountNumber: '1234567890', ifscCode: 'HDFC0001234', panNumber: 'ABCDE1234F' },
  { id: '2',  employeeId: 'EMP-002', firstName: 'Priya',    lastName: 'Sharma',    email: 'hr@peoplepay360.com',       phone: '+91 98765 43211', department: 'HR',          designation: 'HR Manager',          dateOfJoining: '2020-03-01', status: 'active',     salary: 120000, bankAccountNumber: '1234567891', ifscCode: 'HDFC0001234', panNumber: 'ABCDE1235G' },
  { id: '3',  employeeId: 'EMP-003', firstName: 'Ankit',    lastName: 'Verma',     email: 'hrexec@peoplepay360.com',   phone: '+91 98765 43212', department: 'HR',          designation: 'HR Executive',        dateOfJoining: '2021-06-15', status: 'active',     salary: 60000,  bankAccountNumber: '1234567892', ifscCode: 'ICIC0001234', panNumber: 'ABCDE1236H' },
  { id: '4',  employeeId: 'EMP-004', firstName: 'Sunita',   lastName: 'Desai',     email: 'payroll@peoplepay360.com',  phone: '+91 98765 43213', department: 'Finance',     designation: 'Payroll Manager',     dateOfJoining: '2020-07-01', status: 'active',     salary: 110000, bankAccountNumber: '1234567893', ifscCode: 'SBIN0001234', panNumber: 'ABCDE1237J' },
  { id: '5',  employeeId: 'EMP-005', firstName: 'Rahul',    lastName: 'Kumar',     email: 'rahul@peoplepay360.com',    phone: '+91 98765 43214', department: 'Engineering', designation: 'Senior Developer',    dateOfJoining: '2020-09-01', status: 'active',     salary: 150000, bankAccountNumber: '1234567894', ifscCode: 'HDFC0001234', panNumber: 'ABCDE1238K' },
  { id: '6',  employeeId: 'EMP-006', firstName: 'Meena',    lastName: 'Patel',     email: 'meena@peoplepay360.com',    phone: '+91 98765 43215', department: 'Engineering', designation: 'Developer',           dateOfJoining: '2021-02-15', status: 'active',     salary: 95000,  bankAccountNumber: '1234567895', ifscCode: 'ICIC0001234', panNumber: 'ABCDE1239L' },
  { id: '7',  employeeId: 'EMP-007', firstName: 'Arjun',    lastName: 'Nair',      email: 'arjun@peoplepay360.com',    phone: '+91 98765 43216', department: 'Sales',       designation: 'Sales Lead',          dateOfJoining: '2021-04-01', status: 'active',     salary: 100000, bankAccountNumber: '1234567896', ifscCode: 'SBIN0001234', panNumber: 'ABCDE1240M' },
  { id: '8',  employeeId: 'EMP-008', firstName: 'Neha',     lastName: 'Gupta',     email: 'neha@peoplepay360.com',     phone: '+91 98765 43217', department: 'Marketing',   designation: 'Marketing Manager',   dateOfJoining: '2021-08-01', status: 'active',     salary: 105000, bankAccountNumber: '1234567897', ifscCode: 'HDFC0001234', panNumber: 'ABCDE1241N' },
  { id: '9',  employeeId: 'EMP-009', firstName: 'Deepak',   lastName: 'Joshi',     email: 'deepak@peoplepay360.com',   phone: '+91 98765 43218', department: 'Engineering', designation: 'QA Engineer',         dateOfJoining: '2022-01-10', status: 'active',     salary: 75000,  bankAccountNumber: '1234567898', ifscCode: 'ICIC0001234', panNumber: 'ABCDE1242P' },
  { id: '10', employeeId: 'EMP-010', firstName: 'Vikram',   lastName: 'Singh',     email: 'employee@peoplepay360.com', phone: '+91 98765 43219', department: 'Operations',  designation: 'Operations Analyst',  dateOfJoining: '2022-03-01', status: 'active',     salary: 65000,  bankAccountNumber: '1234567899', ifscCode: 'SBIN0001234', panNumber: 'ABCDE1243Q' },
  { id: '11', employeeId: 'EMP-011', firstName: 'Kavita',   lastName: 'Reddy',     email: 'kavita@peoplepay360.com',   phone: '+91 98765 43220', department: 'Engineering', designation: 'DevOps Engineer',     dateOfJoining: '2022-06-15', status: 'active',     salary: 130000, bankAccountNumber: '1234567900', ifscCode: 'HDFC0001234', panNumber: 'ABCDE1244R' },
  { id: '12', employeeId: 'EMP-012', firstName: 'Sanjay',   lastName: 'Mishra',    email: 'sanjay@peoplepay360.com',   phone: '+91 98765 43221', department: 'Sales',       designation: 'Sales Executive',     dateOfJoining: '2023-01-05', status: 'on_leave',   salary: 55000,  bankAccountNumber: '1234567901', ifscCode: 'ICIC0001234', panNumber: 'ABCDE1245S' },
  { id: '13', employeeId: 'EMP-013', firstName: 'Pooja',    lastName: 'Iyer',      email: 'pooja@peoplepay360.com',    phone: '+91 98765 43222', department: 'Finance',     designation: 'Accountant',          dateOfJoining: '2023-04-01', status: 'active',     salary: 70000,  bankAccountNumber: '1234567902', ifscCode: 'SBIN0001234', panNumber: 'ABCDE1246T' },
  { id: '14', employeeId: 'EMP-014', firstName: 'Amit',     lastName: 'Saxena',    email: 'amit@peoplepay360.com',     phone: '+91 98765 43223', department: 'Engineering', designation: 'Junior Developer',    dateOfJoining: '2024-07-15', status: 'active',     salary: 50000,  bankAccountNumber: '1234567903', ifscCode: 'HDFC0001234', panNumber: 'ABCDE1247U' },
  { id: '15', employeeId: 'EMP-015', firstName: 'Ritu',     lastName: 'Chopra',    email: 'ritu@peoplepay360.com',     phone: '+91 98765 43224', department: 'Marketing',   designation: 'Content Writer',      dateOfJoining: '2024-09-01', status: 'inactive',   salary: 45000,  bankAccountNumber: '1234567904', ifscCode: 'ICIC0001234', panNumber: 'ABCDE1248V' },
];

// --- Mock Payroll Runs ---
const MOCK_PAYROLL_RUNS: PayrollRun[] = [
  { id: 'PR-001', month: 8, year: 2026, status: 'paid',    totalEmployees: 13, totalGross: 1680000, totalDeductions: 336000,  totalNet: 1344000, createdAt: '2026-08-25T10:00:00Z', approvedBy: 'Priya Sharma' },
  { id: 'PR-002', month: 9, year: 2026, status: 'pending', totalEmployees: 13, totalGross: 1680000, totalDeductions: 336000,  totalNet: 1344000, createdAt: '2026-09-01T10:00:00Z' },
];

// --- Mock Payslips ---
const MOCK_PAYSLIPS: Payslip[] = MOCK_EMPLOYEES
  .filter((e) => e.status === 'active')
  .map((e) => {
    const basic = Math.round(e.salary * 0.5);
    const hra = Math.round(e.salary * 0.2);
    const conveyance = 1600;
    const otherAllowances = e.salary - basic - hra - conveyance;
    const gross = e.salary;
    const pf = Math.round(basic * 0.12);
    const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const tax = Math.round(gross * 0.1);
    const otherDeductions = 0;
    const totalDeductions = pf + esi + tax + otherDeductions;
    const netPay = gross - totalDeductions;
    return {
      id: `PS-${e.employeeId}`,
      payrollRunId: 'PR-002',
      employeeId: e.employeeId,
      employeeName: `${e.firstName} ${e.lastName}`,
      basicSalary: basic,
      hra,
      conveyance,
      otherAllowances,
      grossSalary: gross,
      pf,
      esi,
      tax,
      otherDeductions,
      totalDeductions,
      netPay,
      status: 'pending' as const,
    };
  });

// --- Mock Attendance ---
const today = new Date().toISOString().slice(0, 10);
const MOCK_ATTENDANCE: AttendanceRecord[] = MOCK_EMPLOYEES
  .filter((e) => e.status === 'active')
  .map((e, i) => ({
    id: `ATT-${e.employeeId}`,
    employeeId: e.employeeId,
    employeeName: `${e.firstName} ${e.lastName}`,
    date: today,
    checkIn: i < 10 ? `${today}T09:${String(i * 3).padStart(2, '0')}:00` : null,
    checkOut: i < 8 ? `${today}T18:${String(i * 5).padStart(2, '0')}:00` : null,
    hoursWorked: i < 8 ? 8 + (i % 3) * 0.5 : i < 10 ? 4 : 0,
    status: (i < 8 ? 'present' : i < 10 ? 'half_day' : i < 11 ? 'leave' : 'absent') as AttendanceRecord['status'],
  }));

// --- Mock Leaves ---
const MOCK_LEAVES: LeaveRequest[] = [
  { id: 'LV-001', employeeId: 'EMP-012', employeeName: 'Sanjay Mishra', leaveType: 'casual',    startDate: '2026-09-03', endDate: '2026-09-05', days: 3, reason: 'Family function',          status: 'approved', appliedAt: '2026-08-28T10:00:00Z', approvedBy: 'Priya Sharma' },
  { id: 'LV-002', employeeId: 'EMP-006', employeeName: 'Meena Patel',   leaveType: 'sick',      startDate: '2026-09-08', endDate: '2026-09-09', days: 2, reason: 'Medical appointment',       status: 'pending',  appliedAt: '2026-09-01T14:00:00Z' },
  { id: 'LV-003', employeeId: 'EMP-009', employeeName: 'Deepak Joshi',  leaveType: 'earned',    startDate: '2026-09-15', endDate: '2026-09-19', days: 5, reason: 'Annual vacation',           status: 'pending',  appliedAt: '2026-09-02T09:00:00Z' },
  { id: 'LV-004', employeeId: 'EMP-005', employeeName: 'Rahul Kumar',   leaveType: 'casual',    startDate: '2026-08-20', endDate: '2026-08-20', days: 1, reason: 'Personal work',             status: 'approved', appliedAt: '2026-08-18T11:00:00Z', approvedBy: 'Priya Sharma' },
  { id: 'LV-005', employeeId: 'EMP-008', employeeName: 'Neha Gupta',    leaveType: 'sick',      startDate: '2026-08-25', endDate: '2026-08-26', days: 2, reason: 'Fever',                     status: 'rejected', appliedAt: '2026-08-24T16:00:00Z' },
  { id: 'LV-006', employeeId: 'EMP-010', employeeName: 'Vikram Singh',  leaveType: 'casual',    startDate: '2026-09-10', endDate: '2026-09-11', days: 2, reason: 'Personal errand',           status: 'pending',  appliedAt: '2026-09-03T08:30:00Z' },
  { id: 'LV-007', employeeId: 'EMP-014', employeeName: 'Amit Saxena',   leaveType: 'earned',    startDate: '2026-09-22', endDate: '2026-09-26', days: 5, reason: 'Hometown visit',            status: 'pending',  appliedAt: '2026-09-04T10:00:00Z' },
];

// --- Mock Departments ---
const MOCK_DEPARTMENTS: Department[] = [
  { id: 'D-001', name: 'Management',  head: 'Raj Mehta',    employeeCount: 1 },
  { id: 'D-002', name: 'HR',          head: 'Priya Sharma', employeeCount: 2 },
  { id: 'D-003', name: 'Finance',     head: 'Sunita Desai', employeeCount: 2 },
  { id: 'D-004', name: 'Engineering', head: 'Rahul Kumar',  employeeCount: 5 },
  { id: 'D-005', name: 'Sales',       head: 'Arjun Nair',   employeeCount: 2 },
  { id: 'D-006', name: 'Marketing',   head: 'Neha Gupta',   employeeCount: 2 },
  { id: 'D-007', name: 'Operations',  head: 'Vikram Singh', employeeCount: 1 },
];

// --- Dashboard Stats ---
const MOCK_DASHBOARD: DashboardStats = {
  totalEmployees: 15,
  activeEmployees: 13,
  presentToday: 8,
  pendingLeaves: 4,
  currentPayrollStatus: 'pending',
  totalPayrollAmount: 1344000,
  recentHires: MOCK_EMPLOYEES.slice(-3).reverse(),
  departmentBreakdown: MOCK_DEPARTMENTS.map((d) => ({
    department: d.name,
    count: d.employeeCount,
  })),
};

// ========================================================
// Mock API — same signatures as real API
// ========================================================
export const mockApi = {
  // Auth
  login: (email: string, _password: string): Promise<LoginResponse> => {
    const user = MOCK_USERS[email];
    if (!user) return Promise.reject(new Error('Invalid email or password'));
    return delay({
      user: {
        id: user.employeeId,
        email,
        role: user.role,
        employeeId: user.employeeId,
        name: user.name,
      },
      token: `mock-jwt-token-${user.role}-${Date.now()}`,
    });
  },

  // Dashboard
  getDashboardStats: (): Promise<DashboardStats> => delay(MOCK_DASHBOARD),

  // Employees
  getEmployees: (): Promise<Employee[]> => delay([...MOCK_EMPLOYEES]),
  getEmployee: (id: string): Promise<Employee> => {
    const emp = MOCK_EMPLOYEES.find((e) => e.id === id);
    if (!emp) return Promise.reject(new Error('Employee not found'));
    return delay(emp);
  },
  createEmployee: (data: Partial<Employee>): Promise<Employee> => {
    const newEmp = {
      id: String(MOCK_EMPLOYEES.length + 1),
      employeeId: `EMP-${String(MOCK_EMPLOYEES.length + 1).padStart(3, '0')}`,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '',
      designation: '',
      dateOfJoining: new Date().toISOString().slice(0, 10),
      status: 'active' as const,
      salary: 0,
      bankAccountNumber: '',
      ifscCode: '',
      panNumber: '',
      ...data,
    };
    MOCK_EMPLOYEES.push(newEmp);
    return delay(newEmp);
  },
  updateEmployee: (id: string, data: Partial<Employee>): Promise<Employee> => {
    const idx = MOCK_EMPLOYEES.findIndex((e) => e.id === id);
    if (idx === -1) return Promise.reject(new Error('Employee not found'));
    MOCK_EMPLOYEES[idx] = { ...MOCK_EMPLOYEES[idx], ...data };
    return delay(MOCK_EMPLOYEES[idx]);
  },
  deleteEmployee: (_id: string): Promise<void> => delay(undefined as unknown as void),

  // Payroll
  getPayrollRuns: (): Promise<PayrollRun[]> => delay([...MOCK_PAYROLL_RUNS]),
  getPayslips: (_runId: string): Promise<Payslip[]> => delay([...MOCK_PAYSLIPS]),
  createPayrollRun: (data: { month: number; year: number }): Promise<PayrollRun> => {
    const run: PayrollRun = {
      id: `PR-${String(MOCK_PAYROLL_RUNS.length + 1).padStart(3, '0')}`,
      ...data,
      status: 'draft',
      totalEmployees: 13,
      totalGross: 1680000,
      totalDeductions: 336000,
      totalNet: 1344000,
      createdAt: new Date().toISOString(),
    };
    MOCK_PAYROLL_RUNS.push(run);
    return delay(run);
  },
  approvePayrollRun: (runId: string): Promise<PayrollRun> => {
    const run = MOCK_PAYROLL_RUNS.find((r) => r.id === runId);
    if (!run) return Promise.reject(new Error('Run not found'));
    run.status = 'approved';
    return delay(run);
  },
  rejectPayrollRun: (runId: string): Promise<PayrollRun> => {
    const run = MOCK_PAYROLL_RUNS.find((r) => r.id === runId);
    if (!run) return Promise.reject(new Error('Run not found'));
    run.status = 'rejected';
    return delay(run);
  },

  // Attendance
  getAttendance: (_date: string): Promise<AttendanceRecord[]> =>
    delay([...MOCK_ATTENDANCE]),

  // Leaves
  getLeaveRequests: (): Promise<LeaveRequest[]> => delay([...MOCK_LEAVES]),
  createLeaveRequest: (data: Partial<LeaveRequest>): Promise<LeaveRequest> => {
    const req: LeaveRequest = {
      id: `LV-${String(MOCK_LEAVES.length + 1).padStart(3, '0')}`,
      employeeId: '',
      employeeName: '',
      leaveType: 'casual',
      startDate: '',
      endDate: '',
      days: 0,
      reason: '',
      status: 'pending',
      appliedAt: new Date().toISOString(),
      ...data,
    };
    MOCK_LEAVES.push(req);
    return delay(req);
  },
  approveLeave: (id: string): Promise<LeaveRequest> => {
    const lv = MOCK_LEAVES.find((l) => l.id === id);
    if (!lv) return Promise.reject(new Error('Leave not found'));
    lv.status = 'approved';
    return delay(lv);
  },
  rejectLeave: (id: string): Promise<LeaveRequest> => {
    const lv = MOCK_LEAVES.find((l) => l.id === id);
    if (!lv) return Promise.reject(new Error('Leave not found'));
    lv.status = 'rejected';
    return delay(lv);
  },

  // Departments
  getDepartments: (): Promise<Department[]> => delay([...MOCK_DEPARTMENTS]),
  createDepartment: (data: Partial<Department>): Promise<Department> => {
    const dept: Department = {
      id: `D-${String(MOCK_DEPARTMENTS.length + 1).padStart(3, '0')}`,
      name: '',
      head: '',
      employeeCount: 0,
      ...data,
    };
    MOCK_DEPARTMENTS.push(dept);
    return delay(dept);
  },
};
