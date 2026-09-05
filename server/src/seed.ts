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

// Deterministic helpers for the volume data below. Seed data must remain
// repeatable so screenshots and dashboard totals do not change between runs.
function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isWeekday(iso: string) {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function workingDaysBetween(from: string, to: string) {
  let total = 0;
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    if (isWeekday(isoDay(cursor))) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

function endAfterWorkingDays(from: string, days: number) {
  const cursor = new Date(`${from}T00:00:00.000Z`);
  let counted = 0;
  while (counted < days) {
    if (isWeekday(isoDay(cursor))) counted += 1;
    if (counted < days) cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return isoDay(cursor);
}

function dayBefore(iso: string) {
  const value = new Date(`${iso}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return isoDay(value);
}

function clock(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function daysInRange(from: string, to: string) {
  const output: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    if (isWeekday(isoDay(cursor))) output.push(isoDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return output;
}

function generateAttendance(employeeIds: string[], approvedLeaveDays: Set<string>) {
  const random = mulberry32(42);
  const rows: Prisma.AttendanceCreateManyInput[] = [];
  const existing = new Set([
    'e1:2026-07-01', 'e1:2026-08-01', 'e3:2026-08-05', 'e8:2026-08-12',
    'e4:2026-08-03', 'e9:2026-08-06', 'e10:2026-08-07',
  ]);
  let manualEdits = 0;

  for (const month of [
    { start: '2026-07-20', end: '2026-07-31' },
    { start: '2026-08-01', end: '2026-08-31' },
  ]) {
    const cursor = new Date(`${month.start}T00:00:00.000Z`);
    const end = new Date(`${month.end}T00:00:00.000Z`);
    while (cursor <= end) {
      const day = isoDay(cursor);
      if (isWeekday(day)) {
        for (const employeeId of employeeIds) {
          const key = `${employeeId}:${day}`;
          if (existing.has(key) || approvedLeaveDays.has(key)) continue;

          const roll = random();
          const id = `a_${day.replaceAll('-', '_')}_${employeeId}`;
          // a11 is the preserved original correction, so add four more for
          // the intended demo total of roughly five manual edits.
          const manual = manualEdits < 4 && random() < 0.015;
          if (manual) manualEdits += 1;
          const edited = manual ? { isManuallyEdited: true, notes: 'Corrected after manager review' } : {};

          if (roll < 0.82) {
            const checkIn = clock(8 * 60 + 50 + Math.floor(random() * 21));
            const worked = Number((8 + random() * 0.75).toFixed(2));
            rows.push({ id, employeeId, checkIn: at(`${day}T${checkIn}:00`), checkOut: at(`${day}T18:${Math.floor(random() * 46).toString().padStart(2, '0')}:00`), workedHours: D(worked), overtimeHours: D(Math.max(0, worked - 8)), status: 'PRESENT', ...edited });
          } else if (roll < 0.91) {
            const checkIn = clock(9 * 60 + 16 + Math.floor(random() * 60));
            const worked = Number((7 + random() * 0.8).toFixed(2));
            rows.push({ id, employeeId, checkIn: at(`${day}T${checkIn}:00`), checkOut: at(`${day}T18:05:00`), workedHours: D(worked), overtimeHours: D(0), status: 'LATE', ...edited });
          } else if (roll < 0.95) {
            rows.push({ id, employeeId, checkIn: at(`${day}T09:00:00`), checkOut: at(`${day}T13:30:00`), workedHours: D(4), overtimeHours: D(0), status: 'HALF_DAY', notes: 'Half day approved by manager', ...edited });
          } else if (roll < 0.98) {
            rows.push({ id, employeeId, checkIn: at(`${day}T09:00:00`), checkOut: at(`${day}T18:00:00`), workedHours: D(0), overtimeHours: D(0), status: 'ABSENT', notes: 'Absent - no check-in recorded', ...edited });
          } else {
            rows.push({ id, employeeId, checkIn: at(`${day}T09:05:00`), checkOut: null, workedHours: D(0), overtimeHours: D(0), status: 'MISSING_CHECKOUT', notes: 'Checkout missing', ...edited });
          }
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return rows;
}

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
      { id: 'd5', name: 'Operations', code: 'OPS' },
      { id: 'd6', name: 'Marketing', code: 'MKT' },
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
  await prisma.workingSchedule.createMany({
    data: [
      { id: 's2', name: 'Part-Time 9-1 Mon-Fri' },
      { id: 's3', name: 'Night 22-06 Mon-Fri' },
    ],
  });
  await prisma.scheduleLine.createMany({
    data: [
      ...[1, 2, 3, 4, 5].map((day) => ({ id: `sl2${day}`, workingScheduleId: 's2', dayOfWeek: day, startTime: '09:00:00', endTime: '13:00:00', breakMinutes: 0 })),
      ...[1, 2, 3, 4, 5].map((day) => ({ id: `sl3${day}`, workingScheduleId: 's3', dayOfWeek: day, startTime: '22:00:00', endTime: '06:00:00', breakMinutes: 60 })),
    ],
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
  const employees: Prisma.EmployeeCreateManyInput[] = [
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
    { id: 'e14', employeeCode: 'EMP014', name: 'Nikhil Bansal', email: 'nikhil@peoplepay.com', phone: '9000000014', departmentId: 'd5', jobPosition: 'Operations Manager', managerId: null, bankAccount: 'XXXX7814', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e15', employeeCode: 'EMP015', name: 'Kavya Iyer', email: 'kavya@peoplepay.com', phone: '9000000015', departmentId: 'd6', jobPosition: 'Marketing Lead', managerId: null, bankAccount: 'XXXX7815', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e16', employeeCode: 'EMP016', name: 'Siddharth Jain', email: 'siddharth@peoplepay.com', phone: '9000000016', departmentId: 'd1', jobPosition: 'Senior Backend Engineer', managerId: 'e2', bankAccount: 'XXXX7816', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e17', employeeCode: 'EMP017', name: 'Tanvi Kapoor', email: 'tanvi@peoplepay.com', phone: '9000000017', departmentId: 'd1', jobPosition: 'Product Designer', managerId: 'e2', bankAccount: 'XXXX7817', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e18', employeeCode: 'EMP018', name: 'Manav Arora', email: 'manav@peoplepay.com', phone: '9000000018', departmentId: 'd1', jobPosition: 'DevOps Engineer', managerId: 'e2', bankAccount: 'XXXX7818', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e19', employeeCode: 'EMP019', name: 'Ayesha Mirza', email: 'ayesha@peoplepay.com', phone: '9000000019', departmentId: 'd1', jobPosition: 'Software Engineer', managerId: 'e2', bankAccount: 'XXXX7819', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e20', employeeCode: 'EMP020', name: 'Rahul Sethi', email: 'rahul@peoplepay.com', phone: '9000000020', departmentId: 'd1', jobPosition: 'Mobile Developer', managerId: 'e2', bankAccount: 'XXXX7820', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e21', employeeCode: 'EMP021', name: 'Divya Menon', email: 'divya@peoplepay.com', phone: '9000000021', departmentId: 'd1', jobPosition: 'QA Analyst', managerId: 'e2', bankAccount: 'XXXX7821', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e22', employeeCode: 'EMP022', name: 'Yash Malhotra', email: 'yash@peoplepay.com', phone: '9000000022', departmentId: 'd1', jobPosition: 'Engineering Intern', managerId: 'e2', bankAccount: 'XXXX7822', employeeType: 'INTERN' as const, status: 'ACTIVE' as const },
    { id: 'e23', employeeCode: 'EMP023', name: 'Pooja Reddy', email: 'pooja@peoplepay.com', phone: '9000000023', departmentId: 'd3', jobPosition: 'Account Executive', managerId: 'e9', bankAccount: 'XXXX7823', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e24', employeeCode: 'EMP024', name: 'Harsh Vora', email: 'harsh@peoplepay.com', phone: '9000000024', departmentId: 'd3', jobPosition: 'Sales Associate', managerId: 'e9', bankAccount: null, employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e25', employeeCode: 'EMP025', name: 'Ira Bhatt', email: 'ira@peoplepay.com', phone: '9000000025', departmentId: 'd3', jobPosition: 'Sales Associate', managerId: 'e9', bankAccount: 'XXXX7825', employeeType: 'PART_TIME' as const, status: 'ACTIVE' as const, workingScheduleId: 's2' },
    { id: 'e26', employeeCode: 'EMP026', name: 'Varun Pillai', email: 'varun@peoplepay.com', phone: '9000000026', departmentId: 'd3', jobPosition: 'Business Development Executive', managerId: 'e9', bankAccount: 'XXXX7826', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e27', employeeCode: 'EMP027', name: 'Ritika Bose', email: 'ritika@peoplepay.com', phone: '9000000027', departmentId: 'd3', jobPosition: 'Sales Coordinator', managerId: 'e9', bankAccount: 'XXXX7827', employeeType: 'PART_TIME' as const, status: 'ACTIVE' as const, workingScheduleId: 's2' },
    { id: 'e28', employeeCode: 'EMP028', name: 'Gaurav Tiwari', email: 'gaurav@peoplepay.com', phone: '9000000028', departmentId: 'd3', jobPosition: 'Sales Executive', managerId: 'e9', bankAccount: 'XXXX7828', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e29', employeeCode: 'EMP029', name: 'Sneha Kulkarni', email: 'sneha@peoplepay.com', phone: '9000000029', departmentId: 'd2', jobPosition: 'Financial Analyst', managerId: 'e7', bankAccount: 'XXXX7829', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e30', employeeCode: 'EMP030', name: 'Aman Chawla', email: 'aman@peoplepay.com', phone: '9000000030', departmentId: 'd2', jobPosition: 'Accounts Associate', managerId: 'e7', bankAccount: 'XXXX7830', employeeType: 'CONTRACT' as const, status: 'ACTIVE' as const },
    { id: 'e31', employeeCode: 'EMP031', name: 'Rhea Thomas', email: 'rhea@peoplepay.com', phone: '9000000031', departmentId: 'd4', jobPosition: 'Talent Acquisition Specialist', managerId: 'e5', bankAccount: 'XXXX7831', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const },
    { id: 'e32', employeeCode: 'EMP032', name: 'Kabir Sood', email: 'kabir@peoplepay.com', phone: '9000000032', departmentId: 'd4', jobPosition: 'HR Associate', managerId: 'e5', bankAccount: 'XXXX7832', employeeType: 'PART_TIME' as const, status: 'ACTIVE' as const, workingScheduleId: 's2' },
    { id: 'e33', employeeCode: 'EMP033', name: 'Sonal Dutta', email: 'sonal@peoplepay.com', phone: '9000000033', departmentId: 'd5', jobPosition: 'Operations Analyst', managerId: 'e14', bankAccount: 'XXXX7833', employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const, workingScheduleId: 's3' },
    { id: 'e34', employeeCode: 'EMP034', name: 'Pranav Nanda', email: 'pranav@peoplepay.com', phone: '9000000034', departmentId: 'd5', jobPosition: 'Shift Supervisor', managerId: 'e14', bankAccount: null, employeeType: 'FULL_TIME' as const, status: 'ACTIVE' as const, workingScheduleId: 's3' },
    { id: 'e35', employeeCode: 'EMP035', name: 'Mitali Das', email: 'mitali@peoplepay.com', phone: '9000000035', departmentId: 'd5', jobPosition: 'Operations Associate', managerId: 'e14', bankAccount: 'XXXX7835', employeeType: 'CONTRACT' as const, status: 'INACTIVE' as const },
    { id: 'e36', employeeCode: 'EMP036', name: 'Ritesh Goel', email: 'ritesh@peoplepay.com', phone: '9000000036', departmentId: 'd5', jobPosition: 'Warehouse Coordinator', managerId: 'e14', bankAccount: 'XXXX7836', employeeType: 'CONTRACT' as const, status: 'INACTIVE' as const },
    { id: 'e37', employeeCode: 'EMP037', name: 'Nandini Roy', email: 'nandini@peoplepay.com', phone: '9000000037', departmentId: 'd6', jobPosition: 'Content Strategist', managerId: 'e15', bankAccount: 'XXXX7837', employeeType: 'FULL_TIME' as const, status: 'INACTIVE' as const },
    { id: 'e38', employeeCode: 'EMP038', name: 'Kunal Oberoi', email: 'kunal@peoplepay.com', phone: '9000000038', departmentId: 'd6', jobPosition: 'Marketing Associate', managerId: 'e15', bankAccount: 'XXXX7838', employeeType: 'FULL_TIME' as const, status: 'ARCHIVED' as const },
  ];

  // Managers must exist before their reports reference them.
  for (const e of employees.filter((x) => x.managerId === null)) {
    await prisma.employee.create({
      data: { ...e, workingScheduleId: e.workingScheduleId ?? 's1', employeeType: e.employeeType ?? (e.id === 'e13' ? 'INTERN' : 'FULL_TIME'), status: e.status ?? 'ACTIVE' },
    });
  }
  for (const e of employees.filter((x) => x.managerId !== null)) {
    await prisma.employee.create({
      data: { ...e, workingScheduleId: e.workingScheduleId ?? 's1', employeeType: e.employeeType ?? (e.id === 'e13' ? 'INTERN' : 'FULL_TIME'), status: e.status ?? 'ACTIVE' },
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
      { id: 'u5', email: 'hr2@peoplepay.com', passwordHash, role: 'HR_MANAGER', employeeId: 'e31', name: 'Rhea Thomas' },
      { id: 'u6', email: 'payroll2@peoplepay.com', passwordHash, role: 'HR_PAYROLL_USER', employeeId: 'e29', name: 'Sneha Kulkarni' },
      { id: 'u7', email: 'siddharth@peoplepay.com', passwordHash, role: 'EMPLOYEE', employeeId: 'e16', name: 'Siddharth Jain' },
      { id: 'u8', email: 'tanvi@peoplepay.com', passwordHash, role: 'EMPLOYEE', employeeId: 'e17', name: 'Tanvi Kapoor' },
      { id: 'u9', email: 'nikhil@peoplepay.com', passwordHash, role: 'EMPLOYEE', employeeId: 'e14', name: 'Nikhil Bansal' },
    ],
  });

  // ------------------------------------------------------------------
  // Contracts
  // ------------------------------------------------------------------
  const contracts: Array<{
    id: string; employeeId: string; startDate: string; endDate: string | null;
    wage: number; jobPosition: string; departmentId: string; status: 'DRAFT' | 'RUNNING' | 'EXPIRED'; workingScheduleId?: string;
  }> = [
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
    // Two historical raises use clean month boundaries, so each pay period has
    // exactly one applicable contract.
    { id: 'c16a', employeeId: 'e16', startDate: '2023-02-01', endDate: '2025-12-31', wage: 78000, jobPosition: 'Backend Engineer', departmentId: 'd1', status: 'EXPIRED' },
    { id: 'c16', employeeId: 'e16', startDate: '2026-01-01', endDate: null, wage: 98000, jobPosition: 'Senior Backend Engineer', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c17a', employeeId: 'e17', startDate: '2024-01-01', endDate: '2025-12-31', wage: 68000, jobPosition: 'UX Designer', departmentId: 'd1', status: 'EXPIRED' },
    { id: 'c17', employeeId: 'e17', startDate: '2026-01-01', endDate: null, wage: 88000, jobPosition: 'Product Designer', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c14', employeeId: 'e14', startDate: '2021-04-01', endDate: null, wage: 165000, jobPosition: 'Operations Manager', departmentId: 'd5', status: 'RUNNING' },
    { id: 'c15', employeeId: 'e15', startDate: '2022-07-01', endDate: null, wage: 155000, jobPosition: 'Marketing Lead', departmentId: 'd6', status: 'RUNNING' },
    { id: 'c18', employeeId: 'e18', startDate: '2023-08-01', endDate: null, wage: 76000, jobPosition: 'DevOps Engineer', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c19', employeeId: 'e19', startDate: '2024-02-01', endDate: null, wage: 62000, jobPosition: 'Software Engineer', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c20', employeeId: 'e20', startDate: '2025-03-01', endDate: null, wage: 58000, jobPosition: 'Mobile Developer', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c21', employeeId: 'e21', startDate: '2025-08-01', endDate: null, wage: 42000, jobPosition: 'QA Analyst', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c22', employeeId: 'e22', startDate: '2026-06-01', endDate: null, wage: 21000, jobPosition: 'Engineering Intern', departmentId: 'd1', status: 'RUNNING' },
    { id: 'c23', employeeId: 'e23', startDate: '2023-06-01', endDate: null, wage: 68000, jobPosition: 'Account Executive', departmentId: 'd3', status: 'RUNNING' },
    { id: 'c24', employeeId: 'e24', startDate: '2025-01-01', endDate: null, wage: 38000, jobPosition: 'Sales Associate', departmentId: 'd3', status: 'RUNNING' },
    { id: 'c25', employeeId: 'e25', startDate: '2025-05-01', endDate: null, wage: 32000, jobPosition: 'Sales Associate', departmentId: 'd3', status: 'RUNNING', workingScheduleId: 's2' },
    { id: 'c26', employeeId: 'e26', startDate: '2024-04-01', endDate: null, wage: 55000, jobPosition: 'Business Development Executive', departmentId: 'd3', status: 'RUNNING' },
    { id: 'c27', employeeId: 'e27', startDate: '2026-02-01', endDate: null, wage: 30000, jobPosition: 'Sales Coordinator', departmentId: 'd3', status: 'RUNNING', workingScheduleId: 's2' },
    { id: 'c28', employeeId: 'e28', startDate: '2025-10-01', endDate: null, wage: 44000, jobPosition: 'Sales Executive', departmentId: 'd3', status: 'RUNNING' },
    { id: 'c29', employeeId: 'e29', startDate: '2024-07-01', endDate: null, wage: 72000, jobPosition: 'Financial Analyst', departmentId: 'd2', status: 'RUNNING' },
    { id: 'c30', employeeId: 'e30', startDate: '2026-03-01', endDate: null, wage: 40000, jobPosition: 'Accounts Associate', departmentId: 'd2', status: 'RUNNING' },
    { id: 'c31', employeeId: 'e31', startDate: '2023-11-01', endDate: null, wage: 65000, jobPosition: 'Talent Acquisition Specialist', departmentId: 'd4', status: 'RUNNING' },
    { id: 'c32', employeeId: 'e32', startDate: '2026-04-01', endDate: null, wage: 32000, jobPosition: 'HR Associate', departmentId: 'd4', status: 'RUNNING', workingScheduleId: 's2' },
    { id: 'c33', employeeId: 'e33', startDate: '2024-08-01', endDate: null, wage: 60000, jobPosition: 'Operations Analyst', departmentId: 'd5', status: 'RUNNING', workingScheduleId: 's3' },
    { id: 'c34', employeeId: 'e34', startDate: '2025-09-01', endDate: '2026-09-25', wage: 85000, jobPosition: 'Shift Supervisor', departmentId: 'd5', status: 'RUNNING', workingScheduleId: 's3' },
    { id: 'c35', employeeId: 'e35', startDate: '2024-01-01', endDate: '2026-05-31', wage: 36000, jobPosition: 'Operations Associate', departmentId: 'd5', status: 'EXPIRED' },
    { id: 'c36', employeeId: 'e36', startDate: '2023-06-01', endDate: '2026-04-30', wage: 42000, jobPosition: 'Warehouse Coordinator', departmentId: 'd5', status: 'EXPIRED' },
    { id: 'c37', employeeId: 'e37', startDate: '2024-09-01', endDate: '2026-03-31', wage: 55000, jobPosition: 'Content Strategist', departmentId: 'd6', status: 'EXPIRED' },
    { id: 'c38', employeeId: 'e38', startDate: '2025-01-01', endDate: '2026-02-28', wage: 40000, jobPosition: 'Marketing Associate', departmentId: 'd6', status: 'EXPIRED' },
    { id: 'c30draft', employeeId: 'e30', startDate: '2026-10-01', endDate: null, wage: 45000, jobPosition: 'Accounts Associate', departmentId: 'd2', status: 'DRAFT' },
  ];
  await prisma.contract.createMany({
    data: contracts.map((c) => ({
      ...c,
      startDate: date(c.startDate),
      endDate: c.endDate ? date(c.endDate) : null,
      wage: D(c.wage),
      workingScheduleId: c.workingScheduleId ?? 's1',
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
      { id: 'tt4', name: 'Maternity / Paternity Leave', unit: 'DAYS', requiresAllocation: true, isPaid: true, color: '#7E57C2' },
      { id: 'tt5', name: 'Comp Off', unit: 'DAYS', requiresAllocation: true, isPaid: true, color: '#26A69A' },
    ],
  });

  const activeEmployeeIds: string[] = employees.map((employee) => employee.id!).filter((employeeId) => !['e35', 'e36', 'e37', 'e38'].includes(employeeId));
  const annualAllocationId = (employeeId: string) => ({ e1: 'al1', e2: 'al2', e3: 'al3', e4: 'al4', e5: 'al5' }[employeeId] ?? `al_annual_${employeeId}`);
  const sickAllocationId = (employeeId: string) => ({ e1: 'al6', e3: 'al7' }[employeeId] ?? `al_sick_${employeeId}`);
  const allocations: Prisma.AllocationCreateManyInput[] = [
    { id: 'al1', employeeId: 'e1', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(5), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
    { id: 'al2', employeeId: 'e2', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(8), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
    // TRAP #5: 18 of 20 used - only 2 days remain.
    { id: 'al3', employeeId: 'e3', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(18), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
    { id: 'al4', employeeId: 'e4', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(4), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
    { id: 'al5', employeeId: 'e5', timeOffTypeId: 'tt1', allocatedDays: D(20), usedDays: D(10), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
    { id: 'al6', employeeId: 'e1', timeOffTypeId: 'tt2', allocatedDays: D(10), usedDays: D(2), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
    { id: 'al7', employeeId: 'e3', timeOffTypeId: 'tt2', allocatedDays: D(10), usedDays: D(1), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' },
  ];
  for (const employeeId of activeEmployeeIds) {
    const ordinal = Number(employeeId.slice(1));
    if (!['e1', 'e2', 'e3', 'e4', 'e5'].includes(employeeId)) {
      allocations.push({ id: annualAllocationId(employeeId), employeeId, timeOffTypeId: 'tt1', allocatedDays: D(18 + (ordinal % 7)), usedDays: D(2 + (ordinal % 8)), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' });
    }
    if (!['e1', 'e3'].includes(employeeId)) {
      allocations.push({ id: sickAllocationId(employeeId), employeeId, timeOffTypeId: 'tt2', allocatedDays: D(10), usedDays: D(ordinal % 6), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'APPROVED' });
    }
  }
  for (const employeeId of ['e29', 'e30', 'e31', 'e33']) {
    allocations.push({ id: `al_comp_${employeeId}`, employeeId, timeOffTypeId: 'tt5', allocatedDays: D(2), usedDays: D(0), validFrom: date('2026-01-01'), validTo: date('2026-12-31'), status: 'PENDING' });
  }
  await prisma.allocation.createMany({
    data: allocations,
  });

  type RequestSpec = readonly [string, 'tt1' | 'tt2', string, number, 'APPROVED' | 'PENDING' | 'REFUSED' | 'DRAFT'];
  const requestSpecs: RequestSpec[] = [
    ['e14', 'tt1', '2026-01-12', 2, 'APPROVED'], ['e15', 'tt1', '2026-02-16', 3, 'APPROVED'], ['e16', 'tt2', '2026-03-23', 2, 'APPROVED'], ['e17', 'tt1', '2026-04-06', 1, 'APPROVED'],
    ['e18', 'tt1', '2026-05-12', 3, 'APPROVED'], ['e19', 'tt2', '2026-06-08', 2, 'APPROVED'], ['e20', 'tt1', '2026-07-13', 3, 'APPROVED'], ['e21', 'tt2', '2026-07-24', 1, 'APPROVED'],
    ['e22', 'tt1', '2026-08-17', 2, 'APPROVED'], ['e23', 'tt1', '2026-08-24', 2, 'APPROVED'], ['e24', 'tt2', '2026-01-28', 1, 'APPROVED'], ['e25', 'tt1', '2026-02-09', 2, 'APPROVED'],
    ['e26', 'tt1', '2026-03-02', 1, 'APPROVED'], ['e27', 'tt2', '2026-08-03', 2, 'APPROVED'], ['e28', 'tt1', '2026-09-07', 3, 'APPROVED'], ['e29', 'tt2', '2026-09-14', 1, 'APPROVED'],
    ['e30', 'tt1', '2026-09-21', 2, 'APPROVED'], ['e31', 'tt1', '2026-09-28', 2, 'APPROVED'],
    ['e5', 'tt1', '2026-02-20', 1, 'PENDING'], ['e6', 'tt2', '2026-04-13', 2, 'PENDING'], ['e8', 'tt1', '2026-05-18', 2, 'PENDING'], ['e10', 'tt2', '2026-06-22', 1, 'PENDING'],
    ['e14', 'tt1', '2026-07-27', 2, 'PENDING'], ['e33', 'tt2', '2026-09-03', 1, 'PENDING'], ['e34', 'tt1', '2026-09-08', 2, 'PENDING'],
    ['e11', 'tt1', '2026-03-16', 1, 'REFUSED'], ['e18', 'tt2', '2026-04-20', 2, 'REFUSED'], ['e24', 'tt1', '2026-06-15', 1, 'REFUSED'], ['e32', 'tt2', '2026-09-17', 1, 'REFUSED'],
    ['e7', 'tt1', '2026-05-04', 2, 'DRAFT'], ['e19', 'tt1', '2026-08-10', 1, 'DRAFT'], ['e26', 'tt2', '2026-09-24', 1, 'DRAFT'],
  ];
  const generatedRequests: Prisma.TimeOffRequestCreateManyInput[] = requestSpecs.map(([employeeId, timeOffTypeId, dateFrom, requestedDays, status], index) => {
    const dateTo = endAfterWorkingDays(dateFrom, requestedDays);
    const allocationId = timeOffTypeId === 'tt1' ? annualAllocationId(employeeId) : sickAllocationId(employeeId);
    const approved = status === 'APPROVED';
    return {
      id: `tor${index + 4}`, employeeId, timeOffTypeId, allocationId, dateFrom: date(dateFrom), dateTo: date(dateTo), durationDays: D(workingDaysBetween(dateFrom, dateTo)), status,
      reason: approved ? 'Planned personal leave' : status === 'PENDING' ? 'Awaiting manager approval' : status === 'REFUSED' ? 'Leave request not approved for this period' : 'Saved for later submission',
      ...(approved ? { approvedById: index % 2 === 0 ? 'u2' : 'u5', approvedAt: at(`${dayBefore(dateFrom)}T10:00:00`) } : {}),
    };
  });
  await prisma.timeOffRequest.createMany({
    data: [
      { id: 'tor1', employeeId: 'e1', timeOffTypeId: 'tt1', allocationId: 'al1', dateFrom: date('2026-07-10'), dateTo: date('2026-07-12'), durationDays: D(3), status: 'APPROVED', reason: 'Family trip', approvedById: 'u2', approvedAt: at('2026-07-05T10:00:00') },
      { id: 'tor2', employeeId: 'e4', timeOffTypeId: 'tt1', allocationId: 'al4', dateFrom: date('2026-08-01'), dateTo: date('2026-08-01'), durationDays: D(1), status: 'APPROVED', reason: 'Personal', approvedById: 'u2', approvedAt: at('2026-07-28T09:00:00') },
      // TRAP #5: 4 days requested against a 2-day remaining balance.
      { id: 'tor3', employeeId: 'e3', timeOffTypeId: 'tt1', allocationId: 'al3', dateFrom: date('2026-09-10'), dateTo: date('2026-09-13'), durationDays: D(4), status: 'PENDING', reason: 'Vacation' },
      ...generatedRequests,
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
      { id: 'pr4', name: 'September 2026 Payroll', salaryStructureId: 'st1', periodStart: date('2026-09-01'), periodEnd: date('2026-09-30'), status: 'DRAFT', createdById: 'u4' },
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

  // Resolve the contract that covers each period rather than assuming the
  // current contract. This keeps historical payruns truthful after a raise.
  const contractsByEmployee = new Map<string, typeof contracts>();
  for (const contract of contracts) {
    const records = contractsByEmployee.get(contract.employeeId) ?? [];
    records.push(contract);
    contractsByEmployee.set(contract.employeeId, records);
  }
  const resolveContract = (employeeId: string, periodStart: string, periodEnd: string) => {
    const records = contractsByEmployee.get(employeeId) ?? [];
    const wholePeriod = records.filter((contract) => contract.startDate <= periodStart && (contract.endDate === null || contract.endDate >= periodEnd));
    if (wholePeriod.length) return wholePeriod.sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    return records
      .filter((contract) => contract.startDate <= periodEnd && (contract.endDate === null || contract.endDate >= periodStart))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  };
  const payrollPeriods = [
    { id: 'pr1', prefix: 'jun', periodStart: '2026-06-01', periodEnd: '2026-06-30', workedDays: 22, status: 'PAID' as const },
    { id: 'pr2', prefix: 'jul', periodStart: '2026-07-01', periodEnd: '2026-07-31', workedDays: 23, status: 'PAID' as const },
    { id: 'pr3', prefix: 'aug', periodStart: '2026-08-01', periodEnd: '2026-08-31', workedDays: 21, status: 'VALIDATED' as const },
  ];
  for (const period of payrollPeriods) {
    for (const [index, employeeId] of activeEmployeeIds.entries()) {
      if (built.some((entry) => entry.payslip.payrunId === period.id && entry.payslip.employeeId === employeeId)) continue;
      const contract = resolveContract(employeeId, period.periodStart, period.periodEnd);
      if (!contract) continue;
      const employee = employees.find((item) => item.id === employeeId)!;
      const warnings: unknown[] = [];
      if (!employee.bankAccount) warnings.push(MISSING_BANK);
      if (employeeId === 'e12' && period.id === 'pr3') warnings.push(warning('CONTRACT_CHANGED_MID_PERIOD'));
      if (employeeId === 'e34' && period.id === 'pr3') warnings.push(warning('CONTRACT_EXPIRING_SOON'));
      const missedDays = (index + period.workedDays) % 9 === 0 ? 2 : (index + period.workedDays) % 5 === 0 ? 1 : 0;
      built.push(regularPayslip({
        id: `p_${period.prefix}_${employeeId}`, employeeId, payrunId: period.id, contractId: contract.id, wage: contract.wage,
        periodStart: period.periodStart, periodEnd: period.periodEnd, workedDays: period.workedDays - missedDays, status: period.status,
        warnings: warnings.length ? warnings : undefined,
      }));
    }
  }

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
  const approvedLeaveDays = new Set<string>();
  for (const request of generatedRequests) {
    if (request.status !== 'APPROVED') continue;
    const employeeId = request.employeeId;
    const from = isoDay(request.dateFrom as Date);
    const to = isoDay(request.dateTo as Date);
    for (const leaveDay of daysInRange(from, to)) approvedLeaveDays.add(`${employeeId}:${leaveDay}`);
  }
  await prisma.attendance.createMany({
    data: generateAttendance(activeEmployeeIds, approvedLeaveDays),
  });

  // ------------------------------------------------------------------
  // Grievances and audit log
  // ------------------------------------------------------------------
  await prisma.grievance.createMany({
    data: [
      { id: 'g1', employeeId: 'e9', payslipId: 'p_aug_e9', subject: 'Missing bank payment', description: 'My salary was not credited because bank details are missing.', status: 'OPEN' },
      { id: 'g2', employeeId: 'e1', payslipId: 'p_jul_e1', subject: 'Overtime not reflected', description: 'July overtime hours seem missing from payslip.', status: 'RESOLVED', response: 'Recalculated and confirmed correct; overtime was under the 1 hour threshold.', resolvedById: 'u3', resolvedAt: at('2026-08-02T11:00:00') },
      { id: 'g3', employeeId: 'e16', payslipId: 'p_aug_e16', subject: 'PF deduction higher than expected', description: 'Please explain the provident fund deduction on my August payslip.', status: 'OPEN' },
      { id: 'g4', employeeId: 'e24', payslipId: 'p_aug_e24', subject: 'August salary credited late', description: 'My salary credit is awaiting bank detail confirmation.', status: 'OPEN' },
      { id: 'g5', employeeId: 'e18', payslipId: 'p_jul_e18', subject: 'Overtime for 15 Aug not counted', description: 'I would like the attendance and overtime entries reviewed.', status: 'UNDER_REVIEW' },
      { id: 'g6', employeeId: 'e23', payslipId: 'p_aug_e23', subject: 'Leave balance shows wrong figure', description: 'Annual leave usage appears different from my approved requests.', status: 'UNDER_REVIEW' },
      { id: 'g7', employeeId: 'e29', payslipId: 'p_jun_e29', subject: 'Incorrect job title on payslip', description: 'The payslip should show Financial Analyst.', status: 'RESOLVED', response: 'The contract title was corrected and the payslip header was regenerated.', resolvedById: 'u6', resolvedAt: at('2026-07-03T14:00:00') },
      { id: 'g8', employeeId: 'e31', payslipId: 'p_aug_e31', subject: 'Travel reimbursement request', description: 'Request to include an out-of-policy travel reimbursement.', status: 'REJECTED', response: 'Travel reimbursement is handled outside the regular payroll structure.', resolvedById: 'u5', resolvedAt: at('2026-08-20T16:00:00') },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { id: 'log1', userId: 'u4', action: 'VALIDATE', entityType: 'Payrun', entityId: 'pr3', changes: { status: 'VALIDATED' } },
      { id: 'log2', userId: 'u2', action: 'APPROVE', entityType: 'TimeOffRequest', entityId: 'tor1', changes: { status: 'APPROVED' } },
      { id: 'log3', userId: 'u3', action: 'CORRECT', entityType: 'Attendance', entityId: 'a11', changes: { status: 'HALF_DAY', isManuallyEdited: true } },
      { id: 'log4', userId: 'u4', action: 'PAY', entityType: 'Payrun', entityId: 'pr2', changes: { status: 'PAID' } },
      { id: 'log5', userId: 'u4', action: 'PAY', entityType: 'Payrun', entityId: 'pr1', changes: { status: 'PAID' } },
      { id: 'log6', userId: 'u5', action: 'APPROVE', entityType: 'TimeOffRequest', entityId: 'tor4', changes: { status: 'APPROVED', durationDays: 2 } },
      { id: 'log7', userId: 'u2', action: 'REFUSE', entityType: 'TimeOffRequest', entityId: 'tor29', changes: { status: 'REFUSED' } },
      { id: 'log8', userId: 'u3', action: 'CORRECT', entityType: 'Attendance', entityId: 'a_2026_08_14_e17', changes: { checkIn: '09:04', reason: 'Device sync correction' } },
      { id: 'log9', userId: 'u2', action: 'CREATE', entityType: 'Employee', entityId: 'e31', changes: { employeeCode: 'EMP031' } },
      { id: 'log10', userId: 'u5', action: 'UPDATE', entityType: 'Employee', entityId: 'e24', changes: { bankAccount: null } },
      { id: 'log11', userId: 'u4', action: 'UPDATE', entityType: 'Contract', entityId: 'c16', changes: { wage: 98000, effectiveDate: '2026-01-01' } },
      { id: 'log12', userId: 'u4', action: 'UPDATE', entityType: 'Contract', entityId: 'c17', changes: { wage: 88000, effectiveDate: '2026-01-01' } },
      { id: 'log13', userId: 'u6', action: 'CORRECT', entityType: 'Attendance', entityId: 'a_2026_08_18_e33', changes: { status: 'PRESENT' } },
      { id: 'log14', userId: 'u2', action: 'APPROVE', entityType: 'TimeOffRequest', entityId: 'tor12', changes: { status: 'APPROVED' } },
      { id: 'log15', userId: 'u4', action: 'VALIDATE', entityType: 'Payrun', entityId: 'pr3', changes: { warningCount: 4 } },
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
