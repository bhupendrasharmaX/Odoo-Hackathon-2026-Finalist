/**
 * PeoplePay360 — demo seed.
 *
 * Run:  cd server && npm run prisma:seed
 *
 * Two things worth knowing before you edit this file:
 *
 * 1. The "Regular Salary" structure reproduces the numbers locked in the
 *    shared contract and asserted by server/src/core/salary-engine.ts:
 *      wage 80000 -> BASIC 40000, HRA 16000, GROSS 56000, PF -4800, NET 51200
 *    That is BASIC = 50% of wage, HRA = 40% of BASIC, PF = 12% of BASIC,
 *    GROSS = BASIC + HRA, NET = GROSS - PF. There is deliberately NO extra
 *    fixed allowance - adding one breaks those assertions.
 *
 * 2. Payslip headers are never typed in by hand. `regularPayslip()` derives
 *    gross / totalDeductions / net AND the lines from the same wage, so a
 *    header can never disagree with its own breakdown.
 *
 * The five demo traps are marked TRAP #n where they are seeded.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { warning } from './core/warnings';

const prisma = new PrismaClient();

const D = (value: number) => new Prisma.Decimal(value.toFixed(2));
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(`${iso}Z`);

// ---------------------------------------------------------------------
// Salary maths — the single source for every seeded payslip.
// ---------------------------------------------------------------------

interface RegularBreakdown {
  basic: number;
  hra: number;
  gross: number;
  pf: number;
  net: number;
}

function regularBreakdown(wage: number): RegularBreakdown {
  const basic = wage * 0.5;
  const hra = basic * 0.4;
  const gross = basic + hra;
  const pf = basic * 0.12;
  return { basic, hra, gross, pf, net: gross - pf };
}

/**
 * Builds a payslip plus its lines from the contract wage. DEDUCTION lines are
 * stored negative, matching the engine contract, so summing lines gives net.
 */
function regularPayslip(args: {
  id: string;
  employeeId: string;
  payrunId: string;
  contractId: string;
  wage: number;
  periodStart: string;
  periodEnd: string;
  workedDays: number;
  status: 'DRAFT' | 'COMPUTED' | 'VALIDATED' | 'PAID';
  warnings?: unknown[];
}) {
  const b = regularBreakdown(args.wage);
  return {
    payslip: {
      id: args.id,
      employeeId: args.employeeId,
      payrunId: args.payrunId,
      contractId: args.contractId,
      periodStart: date(args.periodStart),
      periodEnd: date(args.periodEnd),
      workedDays: D(args.workedDays),
      gross: D(b.gross),
      totalDeductions: D(b.pf),
      net: D(b.net),
      status: args.status,
      warnings: (args.warnings ?? []) as Prisma.InputJsonValue,
    },
    lines: [
      { id: `${args.id}_basic`, payslipId: args.id, ruleCode: 'BASIC', ruleName: 'Basic Salary', category: 'BASIC' as const, sequence: 10, amount: D(b.basic) },
      { id: `${args.id}_hra`, payslipId: args.id, ruleCode: 'HRA', ruleName: 'House Rent Allowance', category: 'ALLOWANCE' as const, sequence: 20, amount: D(b.hra) },
      { id: `${args.id}_gross`, payslipId: args.id, ruleCode: 'GROSS', ruleName: 'Gross Salary', category: 'GROSS' as const, sequence: 50, amount: D(b.gross) },
      { id: `${args.id}_pf`, payslipId: args.id, ruleCode: 'PF', ruleName: 'Provident Fund', category: 'DEDUCTION' as const, sequence: 60, amount: D(-b.pf) },
      { id: `${args.id}_net`, payslipId: args.id, ruleCode: 'NET', ruleName: 'Net Salary', category: 'NET' as const, sequence: 100, amount: D(b.net) },
    ],
  };
}

/**
 * Built from WARNING_CATALOG rather than typed out, so the seeded warning can
 * never drift from the severity the payrun-validation rule actually reads.
 */
const MISSING_BANK = warning('MISSING_BANK');

async function main() {
  // Reverse dependency order, so re-running the seed is safe.
  await prisma.auditLog.deleteMany();
  await prisma.grievance.deleteMany();
  await prisma.payslipLine.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrun.deleteMany();
  await prisma.timeOffRequest.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.salaryRule.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.scheduleLine.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.workingSchedule.deleteMany();
  await prisma.department.deleteMany();

  // ------------------------------------------------------------------
  // Departments
  // ------------------------------------------------------------------
  await prisma.department.createMany({
    data: [
      { id: 'd1', name: 'Engineering', code: 'ENG' },
      { id: 'd2', name: 'Finance', code: 'FIN' },
      { id: 'd3', name: 'Sales', code: 'SAL' },
      { id: 'd4', name: 'HR', code: 'HR' },
    ],
  });

  // ------------------------------------------------------------------
  // Working schedule — standard 9-6, Mon-Fri
  // ------------------------------------------------------------------
  await prisma.workingSchedule.create({ data: { id: 's1', name: 'Standard 9-6 Mon-Fri' } });
  await prisma.scheduleLine.createMany({
    data: [1, 2, 3, 4, 5].map((day) => ({
      id: `sl${day}`,
      workingScheduleId: 's1',
      dayOfWeek: day,
      startTime: '09:00:00',
      endTime: '18:00:00',
      breakMinutes: 60,
    })),
  });

  // ------------------------------------------------------------------
  // Salary structure — must reproduce the shared-contract numbers exactly.
  // ------------------------------------------------------------------
  await prisma.salaryStructure.create({ data: { id: 'st1', name: 'Regular Salary' } });
  await prisma.salaryRule.createMany({
    data: [
      { id: 'sr1', structureId: 'st1', name: 'Basic Salary', code: 'BASIC', category: 'BASIC', sequence: 10, computeType: 'PERCENTAGE', percentage: D(50), baseRuleCode: null },
      { id: 'sr2', structureId: 'st1', name: 'House Rent Allowance', code: 'HRA', category: 'ALLOWANCE', sequence: 20, computeType: 'PERCENTAGE', percentage: D(40), baseRuleCode: 'BASIC' },
      { id: 'sr3', structureId: 'st1', name: 'Gross Salary', code: 'GROSS', category: 'GROSS', sequence: 50, computeType: 'FORMULA', formula: 'BASIC + HRA' },
      { id: 'sr4', structureId: 'st1', name: 'Provident Fund', code: 'PF', category: 'DEDUCTION', sequence: 60, computeType: 'PERCENTAGE', percentage: D(12), baseRuleCode: 'BASIC' },
      { id: 'sr5', structureId: 'st1', name: 'Net Salary', code: 'NET', category: 'NET', sequence: 100, computeType: 'FORMULA', formula: 'GROSS - PF' },
    ],
  });

  // ------------------------------------------------------------------
  // Employees
  // ------------------------------------------------------------------
  const employees = [
    { id: 'e1', employeeCode: 'EMP001', name: 'Aarav Mehta', email: 'aarav@peoplepay.com', phone: '9000000001', departmentId: 'd2', jobPosition: 'Analyst', managerId: null, bankAccount: 'XXXX1234' },
    { id: 'e2', employeeCode: 'EMP002', name: 'Sara Khan', email: 'sara@peoplepay.com', phone: '9000000002', departmentId: 'd1', jobPosition: 'Engineering Manager', managerId: null, bankAccount: 'XXXX5678' },
    { id: 'e3', employeeCode: 'EMP003', name: 'Rohan Gupta', email: 'rohan@peoplepay.com', phone: '9000000003', departmentId: 'd1', jobPosition: 'Software Engineer', managerId: 'e2', bankAccount: 'XXXX9012' },
    { id: 'e4', employeeCode: 'EMP004', name: 'Priya Sharma', email: 'priya@peoplepay.com', phone: '9000000004', departmentId: 'd3', jobPosition: 'Sales Executive', managerId: null, bankAccount: 'XXXX3456' },
    { id: 'e5', employeeCode: 'EMP005', name: 'Vikram Singh', email: 'vikram@peoplepay.com', phone: '9000000005', departmentId: 'd4', jobPosition: 'HR Manager', managerId: null, bankAccount: 'XXXX7890' },
    { id: 'e6', employeeCode: 'EMP006', name: 'Anita Desai', email: 'anita@peoplepay.com', phone: '9000000006', departmentId: 'd2', jobPosition: 'Payroll Executive', managerId: null, bankAccount: 'XXXX1111' },
    { id: 'e7', employeeCode: 'EMP007', name: 'Karan Patel', email: 'karan@peoplepay.com', phone: '9000000007', departmentId: 'd2', jobPosition: 'Payroll Manager', managerId: null, bankAccount: 'XXXX2222' },
    { id: 'e8', employeeCode: 'EMP008', name: 'Meera Nair', email: 'meera@peoplepay.com', phone: '9000000008', departmentId: 'd1', jobPosition: 'QA Engineer', managerId: 'e2', bankAccount: 'XXXX3333' },
    // TRAP #2: no bank account -> HIGH MISSING_BANK warning blocks validation.
    { id: 'e9', employeeCode: 'EMP009', name: 'Dev Kumar', email: 'dev@peoplepay.com', phone: '9000000009', departmentId: 'd3', jobPosition: 'Sales Manager', managerId: null, bankAccount: null },
    { id: 'e10', employeeCode: 'EMP010', name: 'Ishita Rao', email: 'ishita@peoplepay.com', phone: '9000000010', departmentId: 'd1', jobPosition: 'Frontend Developer', managerId: 'e2', bankAccount: 'XXXX4444' },
    { id: 'e11', employeeCode: 'EMP011', name: 'Arjun Verma', email: 'arjun@peoplepay.com', phone: '9000000011', departmentId: 'd4', jobPosition: 'HR Executive', managerId: 'e5', bankAccount: 'XXXX5555' },
    // TRAP #1: mid-month contract change, see contracts below.
    { id: 'e12', employeeCode: 'EMP012', name: 'Neha Joshi', email: 'neha@peoplepay.com', phone: '9000000012', departmentId: 'd2', jobPosition: 'Finance Executive', managerId: null, bankAccount: 'XXXX6666' },
    { id: 'e13', employeeCode: 'EMP013', name: 'Aditya Rana', email: 'aditya@peoplepay.com', phone: '9000000013', departmentId: 'd1', jobPosition: 'Intern', managerId: 'e2', bankAccount: 'XXXX7777' },
  ];

  // Managers must exist before their reports reference them.
  for (const e of employees.filter((x) => x.managerId === null)) {
    await prisma.employee.create({
      data: { ...e, workingScheduleId: 's1', employeeType: e.id === 'e13' ? 'INTERN' : 'FULL_TIME', status: 'ACTIVE' },
    });
  }
  for (const e of employees.filter((x) => x.managerId !== null)) {
    await prisma.employee.create({
      data: { ...e, workingScheduleId: 's1', employeeType: e.id === 'e13' ? 'INTERN' : 'FULL_TIME', status: 'ACTIVE' },
    });
  }

  // ------------------------------------------------------------------
  // Users — password is "demo1234" for every account.
  // Hashed here rather than pasted as a literal, so the demo login is
  // guaranteed to work against whatever bcrypt cost we settle on.
  // ------------------------------------------------------------------
  const passwordHash = await bcrypt.hash('demo1234', 10);
  await prisma.user.createMany({
    data: [
      { id: 'u0', email: 'admin@peoplepay.com', passwordHash, role: 'ADMIN', employeeId: null, name: 'System Admin' },
      { id: 'u1', email: 'aarav@peoplepay.com', passwordHash, role: 'EMPLOYEE', employeeId: 'e1', name: 'Aarav Mehta' },
      { id: 'u2', email: 'hr@peoplepay.com', passwordHash, role: 'HR_MANAGER', employeeId: 'e5', name: 'Vikram Singh' },
      { id: 'u3', email: 'payroll@peoplepay.com', passwordHash, role: 'HR_PAYROLL_USER', employeeId: 'e6', name: 'Anita Desai' },
      { id: 'u4', email: 'payrollmgr@peoplepay.com', passwordHash, role: 'HR_PAYROLL_MANAGER', employeeId: 'e7', name: 'Karan Patel' },
    ],
  });

  // ------------------------------------------------------------------
  // Contracts
  // ------------------------------------------------------------------
  const contracts = [
    { id: 'c1', employeeId: 'e1', startDate: '2025-01-01', endDate: null, wage: 45000, jobPosition: 'Analyst', departmentId: 'd2', status: 'RUNNING' as const },
    { id: 'c2', employeeId: 'e2', startDate: '2024-06-01', endDate: null, wage: 120000, jobPosition: 'Engineering Manager', departmentId: 'd1', status: 'RUNNING' as const },
    { id: 'c3', employeeId: 'e3', startDate: '2024-09-01', endDate: null, wage: 70000, jobPosition: 'Software Engineer', departmentId: 'd1', status: 'RUNNING' as const },
    { id: 'c4', employeeId: 'e4', startDate: '2025-02-01', endDate: null, wage: 50000, jobPosition: 'Sales Executive', departmentId: 'd3', status: 'RUNNING' as const },
    { id: 'c5', employeeId: 'e5', startDate: '2023-01-01', endDate: null, wage: 95000, jobPosition: 'HR Manager', departmentId: 'd4', status: 'RUNNING' as const },
    { id: 'c6', employeeId: 'e6', startDate: '2024-01-01', endDate: null, wage: 60000, jobPosition: 'Payroll Executive', departmentId: 'd2', status: 'RUNNING' as const },
    { id: 'c7', employeeId: 'e7', startDate: '2023-05-01', endDate: null, wage: 110000, jobPosition: 'Payroll Manager', departmentId: 'd2', status: 'RUNNING' as const },
    { id: 'c8', employeeId: 'e8', startDate: '2024-03-01', endDate: null, wage: 65000, jobPosition: 'QA Engineer', departmentId: 'd1', status: 'RUNNING' as const },
    { id: 'c9', employeeId: 'e9', startDate: '2023-08-01', endDate: null, wage: 80000, jobPosition: 'Sales Manager', departmentId: 'd3', status: 'RUNNING' as const },
    { id: 'c10', employeeId: 'e10', startDate: '2024-11-01', endDate: null, wage: 72000, jobPosition: 'Frontend Developer', departmentId: 'd1', status: 'RUNNING' as const },
    { id: 'c11', employeeId: 'e11', startDate: '2025-04-01', endDate: null, wage: 48000, jobPosition: 'HR Executive', departmentId: 'd4', status: 'RUNNING' as const },
    { id: 'c13', employeeId: 'e13', startDate: '2025-06-01', endDate: null, wage: 20000, jobPosition: 'Intern', departmentId: 'd1', status: 'RUNNING' as const },
    // TRAP #1: Neha's old contract ends 15-Aug-2026, the new higher-wage one
    // starts 16-Aug. An August payrun must resolve BOTH and pro-rate, raising
    // CONTRACT_CHANGED_MID_PERIOD - never silently pick the later one.
    { id: 'c12a', employeeId: 'e12', startDate: '2024-05-01', endDate: '2026-08-15', wage: 55000, jobPosition: 'Finance Executive', departmentId: 'd2', status: 'EXPIRED' as const },
    { id: 'c12b', employeeId: 'e12', startDate: '2026-08-16', endDate: null, wage: 68000, jobPosition: 'Senior Finance Executive', departmentId: 'd2', status: 'RUNNING' as const },
  ];
  await prisma.contract.createMany({
    data: contracts.map((c) => ({
      ...c,
      startDate: date(c.startDate),
      endDate: c.endDate ? date(c.endDate) : null,
      wage: D(c.wage),
      workingScheduleId: 's1',
      salaryStructureId: 'st1',
    })),
  });

  // ------------------------------------------------------------------
  // Time off
  // ------------------------------------------------------------------
  await prisma.timeOffType.createMany({
    data: [
      { id: 'tt1', name: 'Annual Leave', unit: 'DAYS', requiresAllocation: true, isPaid: true, color: '#4CAF50' },
      { id: 'tt2', name: 'Sick Leave', unit: 'DAYS', requiresAllocation: true, isPaid: true, color: '#FF9800' },
      { id: 'tt3', name: 'Unpaid Leave', unit: 'DAYS', requiresAllocation: false, isPaid: false, color: '#9E9E9E' },
    ],
  });

  await prisma.allocation.createMany({
    data: [
      { id: 'al1', employeeId: 'e1', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(5) },
      { id: 'al2', employeeId: 'e2', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(8) },
      // TRAP #5: 18 of 20 used - only 2 days remain.
      { id: 'al3', employeeId: 'e3', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(18) },
      { id: 'al4', employeeId: 'e4', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(4) },
      { id: 'al5', employeeId: 'e5', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(10) },
      { id: 'al6', employeeId: 'e1', timeOffTypeId: 'tt2', allocatedDays: D(10), usedDays: D(2) },
      { id: 'al7', employeeId: 'e3', timeOffTypeId: 'tt2', allocatedDays: D(10), usedDays: D(1) },
    ].map((a) => ({ ...a, validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' as const })),
  });

  await prisma.timeOffRequest.createMany({
    data: [
      { id: 'tor1', employeeId: 'e1', timeOffTypeId: 'tt1', allocationId: 'al1', dateFrom: date('2026-07-10'), dateTo: date('2026-07-12'), durationDays: D(3), status: 'APPROVED', reason: 'Family trip', approvedById: 'u2', approvedAt: at('2026-07-05T10:00:00') },
      { id: 'tor2', employeeId: 'e4', timeOffTypeId: 'tt1', allocationId: 'al4', dateFrom: date('2026-08-01'), dateTo: date('2026-08-01'), durationDays: D(1), status: 'APPROVED', reason: 'Personal', approvedById: 'u2', approvedAt: at('2026-07-28T09:00:00') },
      // TRAP #5: 4 days requested against a 2-day remaining balance.
      { id: 'tor3', employeeId: 'e3', timeOffTypeId: 'tt1', allocationId: 'al3', dateFrom: date('2026-09-10'), dateTo: date('2026-09-13'), durationDays: D(4), status: 'PENDING', reason: 'Vacation' },
    ],
  });

  // ------------------------------------------------------------------
  // Payruns and payslips
  // ------------------------------------------------------------------
  await prisma.payrun.createMany({
    data: [
      { id: 'pr1', name: 'June 2026 Payroll', salaryStructureId: 'st1', periodStart: date('2026-06-01'), periodEnd: date('2026-06-30'), status: 'PAID', createdById: 'u4' },
      { id: 'pr2', name: 'July 2026 Payroll', salaryStructureId: 'st1', periodStart: date('2026-07-01'), periodEnd: date('2026-07-31'), status: 'PAID', createdById: 'u4' },
      { id: 'pr3', name: 'August 2026 Payroll', salaryStructureId: 'st1', periodStart: date('2026-08-01'), periodEnd: date('2026-08-31'), status: 'VALIDATED', createdById: 'u4' },
    ],
  });

  const built = [
    regularPayslip({ id: 'p_jun_e1', employeeId: 'e1', payrunId: 'pr1', contractId: 'c1', wage: 45000, periodStart: '2026-06-01', periodEnd: '2026-06-30', workedDays: 22, status: 'PAID' }),
    regularPayslip({ id: 'p_jun_e2', employeeId: 'e2', payrunId: 'pr1', contractId: 'c2', wage: 120000, periodStart: '2026-06-01', periodEnd: '2026-06-30', workedDays: 22, status: 'PAID' }),
    regularPayslip({ id: 'p_jun_e6', employeeId: 'e6', payrunId: 'pr1', contractId: 'c6', wage: 60000, periodStart: '2026-06-01', periodEnd: '2026-06-30', workedDays: 22, status: 'PAID' }),
    regularPayslip({ id: 'p_jul_e1', employeeId: 'e1', payrunId: 'pr2', contractId: 'c1', wage: 45000, periodStart: '2026-07-01', periodEnd: '2026-07-31', workedDays: 23, status: 'PAID' }),
    regularPayslip({ id: 'p_jul_e2', employeeId: 'e2', payrunId: 'pr2', contractId: 'c2', wage: 120000, periodStart: '2026-07-01', periodEnd: '2026-07-31', workedDays: 23, status: 'PAID' }),
    regularPayslip({ id: 'p_jul_e6', employeeId: 'e6', payrunId: 'pr2', contractId: 'c6', wage: 60000, periodStart: '2026-07-01', periodEnd: '2026-07-31', workedDays: 23, status: 'PAID' }),
    regularPayslip({ id: 'p_aug_e1', employeeId: 'e1', payrunId: 'pr3', contractId: 'c1', wage: 45000, periodStart: '2026-08-01', periodEnd: '2026-08-31', workedDays: 21, status: 'VALIDATED' }),
    regularPayslip({ id: 'p_aug_e2', employeeId: 'e2', payrunId: 'pr3', contractId: 'c2', wage: 120000, periodStart: '2026-08-01', periodEnd: '2026-08-31', workedDays: 21, status: 'VALIDATED' }),
    regularPayslip({ id: 'p_aug_e6', employeeId: 'e6', payrunId: 'pr3', contractId: 'c6', wage: 60000, periodStart: '2026-08-01', periodEnd: '2026-08-31', workedDays: 21, status: 'VALIDATED' }),
    // TRAP #2: Dev Kumar has no bank account. wage 80000 is also the exact
    // worked example in the shared contract: 40000/16000/56000/-4800/51200.
    regularPayslip({ id: 'p_aug_e9', employeeId: 'e9', payrunId: 'pr3', contractId: 'c9', wage: 80000, periodStart: '2026-08-01', periodEnd: '2026-08-31', workedDays: 21, status: 'VALIDATED', warnings: [MISSING_BANK] }),
  ];

  await prisma.payslip.createMany({ data: built.map((b) => b.payslip) });
  await prisma.payslipLine.createMany({ data: built.flatMap((b) => b.lines) });

  // TRAP #3 (duplicate payslip) needs no seed row: @@unique([payrunId,
  // employeeId]) on Payslip makes a second slip for the same employee and
  // payrun impossible. Demo it by trying to insert one for (pr3, e6).

  // ------------------------------------------------------------------
  // Attendance — TRAP #4: 2 missing checkouts, 3 late arrivals
  // ------------------------------------------------------------------
  await prisma.attendance.createMany({
    data: [
      { id: 'a1', employeeId: 'e1', checkIn: at('2026-06-01T09:02:00'), checkOut: at('2026-06-01T18:05:00'), workedHours: D(8.05), overtimeHours: D(0.05), status: 'PRESENT' },
      { id: 'a2', employeeId: 'e1', checkIn: at('2026-06-02T09:00:00'), checkOut: at('2026-06-02T18:00:00'), workedHours: D(8), overtimeHours: D(0), status: 'PRESENT' },
      { id: 'a3', employeeId: 'e1', checkIn: at('2026-07-01T09:15:00'), checkOut: at('2026-07-01T18:00:00'), workedHours: D(7.75), overtimeHours: D(0), status: 'LATE' },
      { id: 'a4', employeeId: 'e1', checkIn: at('2026-08-01T09:05:00'), checkOut: at('2026-08-01T18:00:00'), workedHours: D(7.92), overtimeHours: D(0), status: 'PRESENT' },
      // TRAP #4: missing checkouts
      { id: 'a5', employeeId: 'e3', checkIn: at('2026-08-05T09:00:00'), checkOut: null, workedHours: D(0), overtimeHours: D(0), status: 'MISSING_CHECKOUT', notes: 'Forgot to check out' },
      { id: 'a6', employeeId: 'e8', checkIn: at('2026-08-12T09:00:00'), checkOut: null, workedHours: D(0), overtimeHours: D(0), status: 'MISSING_CHECKOUT', notes: 'Forgot to check out' },
      // TRAP #4: late arrivals
      { id: 'a7', employeeId: 'e4', checkIn: at('2026-08-03T09:40:00'), checkOut: at('2026-08-03T18:00:00'), workedHours: D(7.33), overtimeHours: D(0), status: 'LATE' },
      { id: 'a8', employeeId: 'e9', checkIn: at('2026-08-06T09:35:00'), checkOut: at('2026-08-06T18:10:00'), workedHours: D(7.58), overtimeHours: D(0.1), status: 'LATE' },
      { id: 'a9', employeeId: 'e10', checkIn: at('2026-08-07T09:20:00'), checkOut: at('2026-08-07T18:00:00'), workedHours: D(7.67), overtimeHours: D(0), status: 'LATE' },
      { id: 'a10', employeeId: 'e2', checkIn: at('2026-08-01T08:55:00'), checkOut: at('2026-08-01T18:30:00'), workedHours: D(8.58), overtimeHours: D(0.58), status: 'PRESENT' },
      { id: 'a11', employeeId: 'e5', checkIn: at('2026-08-01T09:00:00'), checkOut: at('2026-08-01T17:30:00'), workedHours: D(7.5), overtimeHours: D(0), status: 'HALF_DAY', notes: 'Left early - appointment', isManuallyEdited: true },
      { id: 'a12', employeeId: 'e6', checkIn: at('2026-08-01T09:00:00'), checkOut: at('2026-08-01T18:00:00'), workedHours: D(8), overtimeHours: D(0), status: 'PRESENT' },
      { id: 'a13', employeeId: 'e7', checkIn: at('2026-08-01T09:00:00'), checkOut: at('2026-08-01T18:00:00'), workedHours: D(8), overtimeHours: D(0), status: 'PRESENT' },
      { id: 'a14', employeeId: 'e11', checkIn: at('2026-08-01T09:00:00'), checkOut: at('2026-08-01T18:00:00'), workedHours: D(8), overtimeHours: D(0), status: 'PRESENT' },
      { id: 'a15', employeeId: 'e12', checkIn: at('2026-08-01T09:00:00'), checkOut: at('2026-08-01T18:00:00'), workedHours: D(8), overtimeHours: D(0), status: 'ABSENT', notes: 'Marked absent - no show' },
    ],
  });

  // ------------------------------------------------------------------
  // Grievances and audit log
  // ------------------------------------------------------------------
  await prisma.grievance.createMany({
    data: [
      { id: 'g1', employeeId: 'e9', payslipId: 'p_aug_e9', subject: 'Missing bank payment', description: 'My salary was not credited because bank details are missing.', status: 'OPEN' },
      { id: 'g2', employeeId: 'e1', payslipId: 'p_jul_e1', subject: 'Overtime not reflected', description: 'July overtime hours seem missing from payslip.', status: 'RESOLVED', response: 'Recalculated and confirmed correct; overtime was under the 1 hour threshold.', resolvedById: 'u3', resolvedAt: at('2026-08-02T11:00:00') },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { id: 'log1', userId: 'u4', action: 'VALIDATE', entityType: 'Payrun', entityId: 'pr3', changes: { status: 'VALIDATED' } },
      { id: 'log2', userId: 'u2', action: 'APPROVE', entityType: 'TimeOffRequest', entityId: 'tor1', changes: { status: 'APPROVED' } },
      { id: 'log3', userId: 'u3', action: 'CORRECT', entityType: 'Attendance', entityId: 'a11', changes: { status: 'HALF_DAY', isManuallyEdited: true } },
    ],
  });

  // Sanity check: the shared-contract worked example must hold.
  const check = regularBreakdown(80000);
  const expected = { basic: 40000, hra: 16000, gross: 56000, pf: 4800, net: 51200 };
  for (const [key, value] of Object.entries(expected)) {
    if (check[key as keyof RegularBreakdown] !== value) {
      throw new Error(`Salary rules drifted from the shared contract: ${key} was ${check[key as keyof RegularBreakdown]}, expected ${value}`);
    }
  }

  console.log('Seed complete. Login with any seeded email / password "demo1234".');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
