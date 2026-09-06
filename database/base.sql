-- =====================================================================
-- PeoplePay360 — HR & Payroll System
-- MySQL 8.0+ Database (schema + demo seed data)
-- Converted from prisma/schema.prisma spec (00_SHARED_CONTRACT.md / 01_DATABASE_SPEC.md)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS peoplepay360;
CREATE DATABASE peoplepay360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE peoplepay360;

-- =====================================================================
-- ENUM-BACKED LOOKUP VALUES ARE ENFORCED VIA MySQL ENUM COLUMNS
-- (exact strings from 00_SHARED_CONTRACT.md — do not rename)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Department
-- ---------------------------------------------------------------------
CREATE TABLE Department (
  id         VARCHAR(30) PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  code       VARCHAR(20)  NOT NULL UNIQUE,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- User  (1—1 Employee)
-- ---------------------------------------------------------------------
CREATE TABLE User (
  id          VARCHAR(30) PRIMARY KEY,
  email       VARCHAR(150) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  role        ENUM('EMPLOYEE','HR_MANAGER','HR_PAYROLL_USER','HR_PAYROLL_MANAGER','ADMIN') NOT NULL,
  employeeId  VARCHAR(30) NULL UNIQUE,
  name        VARCHAR(150) NOT NULL,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Employee
-- ---------------------------------------------------------------------
CREATE TABLE Employee (
  id                 VARCHAR(30) PRIMARY KEY,
  employeeCode       VARCHAR(30) NOT NULL UNIQUE,
  name               VARCHAR(150) NOT NULL,
  email              VARCHAR(150) NOT NULL UNIQUE,
  phone              VARCHAR(30) NULL,
  departmentId       VARCHAR(30) NOT NULL,
  jobPosition        VARCHAR(100) NULL,
  managerId          VARCHAR(30) NULL,
  workingScheduleId  VARCHAR(30) NULL,
  employeeType       ENUM('FULL_TIME','PART_TIME','CONTRACT','INTERN') NOT NULL DEFAULT 'FULL_TIME',
  status             ENUM('ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  bankAccount        VARCHAR(60) NULL,
  avatarUrl          VARCHAR(255) NULL,
  createdAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_department FOREIGN KEY (departmentId) REFERENCES Department(id),
  CONSTRAINT fk_employee_manager    FOREIGN KEY (managerId) REFERENCES Employee(id)
) ENGINE=InnoDB;

ALTER TABLE User
  ADD CONSTRAINT fk_user_employee FOREIGN KEY (employeeId) REFERENCES Employee(id);

-- ---------------------------------------------------------------------
-- WorkingSchedule + ScheduleLine
-- ---------------------------------------------------------------------
CREATE TABLE WorkingSchedule (
  id         VARCHAR(30) PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

ALTER TABLE Employee
  ADD CONSTRAINT fk_employee_schedule FOREIGN KEY (workingScheduleId) REFERENCES WorkingSchedule(id);

CREATE TABLE ScheduleLine (
  id                VARCHAR(30) PRIMARY KEY,
  workingScheduleId VARCHAR(30) NOT NULL,
  dayOfWeek         TINYINT NOT NULL CHECK (dayOfWeek BETWEEN 0 AND 6),
  startTime         TIME NOT NULL,
  endTime           TIME NOT NULL,
  breakMinutes      INT NOT NULL DEFAULT 0,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scheduleline_schedule FOREIGN KEY (workingScheduleId) REFERENCES WorkingSchedule(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SalaryStructure + SalaryRule  (created before Contract, which refs it)
-- ---------------------------------------------------------------------
CREATE TABLE SalaryStructure (
  id         VARCHAR(30) PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE SalaryRule (
  id            VARCHAR(30) PRIMARY KEY,
  structureId   VARCHAR(30) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  code          VARCHAR(30) NOT NULL,
  category      ENUM('BASIC','ALLOWANCE','GROSS','DEDUCTION','NET') NOT NULL,
  sequence      INT NOT NULL,
  computeType   ENUM('FIXED','PERCENTAGE','FORMULA') NOT NULL,
  amount        DECIMAL(12,2) NULL,
  percentage    DECIMAL(6,3) NULL,
  formula       VARCHAR(255) NULL,
  baseRuleCode  VARCHAR(30) NULL,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rule_structure FOREIGN KEY (structureId) REFERENCES SalaryStructure(id) ON DELETE CASCADE,
  CONSTRAINT uq_structure_code UNIQUE (structureId, code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Contract
-- ---------------------------------------------------------------------
CREATE TABLE Contract (
  id                 VARCHAR(30) PRIMARY KEY,
  employeeId         VARCHAR(30) NOT NULL,
  startDate          DATE NOT NULL,
  endDate            DATE NULL,
  wage               DECIMAL(12,2) NOT NULL,
  jobPosition        VARCHAR(100) NULL,
  departmentId       VARCHAR(30) NOT NULL,
  workingScheduleId  VARCHAR(30) NULL,
  salaryStructureId  VARCHAR(30) NULL,
  status             ENUM('DRAFT','RUNNING','EXPIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  createdAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contract_employee FOREIGN KEY (employeeId) REFERENCES Employee(id),
  CONSTRAINT fk_contract_department FOREIGN KEY (departmentId) REFERENCES Department(id),
  CONSTRAINT fk_contract_schedule FOREIGN KEY (workingScheduleId) REFERENCES WorkingSchedule(id),
  CONSTRAINT fk_contract_structure FOREIGN KEY (salaryStructureId) REFERENCES SalaryStructure(id),
  -- Critical index: "which contract applies to period X" range lookup
  INDEX idx_contract_employee_daterange (employeeId, startDate, endDate)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------
CREATE TABLE Attendance (
  id               VARCHAR(30) PRIMARY KEY,
  employeeId       VARCHAR(30) NOT NULL,
  checkIn          DATETIME NOT NULL,
  checkOut         DATETIME NULL,
  workedHours      DECIMAL(6,2) NOT NULL DEFAULT 0,
  overtimeHours    DECIMAL(6,2) NOT NULL DEFAULT 0,
  status           ENUM('PRESENT','LATE','ABSENT','HALF_DAY','MISSING_CHECKOUT') NOT NULL,
  notes            VARCHAR(255) NULL,
  isManuallyEdited BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employeeId) REFERENCES Employee(id),
  INDEX idx_attendance_employee_checkin (employeeId, checkIn)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TimeOffType, Allocation, TimeOffRequest
-- ---------------------------------------------------------------------
CREATE TABLE TimeOffType (
  id                  VARCHAR(30) PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  unit                ENUM('DAYS','HOURS') NOT NULL DEFAULT 'DAYS',
  requiresAllocation  BOOLEAN NOT NULL DEFAULT TRUE,
  isPaid              BOOLEAN NOT NULL DEFAULT TRUE,
  color               VARCHAR(20) NULL,
  createdAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE Allocation (
  id             VARCHAR(30) PRIMARY KEY,
  employeeId     VARCHAR(30) NOT NULL,
  timeOffTypeId  VARCHAR(30) NOT NULL,
  allocatedDays  DECIMAL(6,2) NOT NULL,
  usedDays       DECIMAL(6,2) NOT NULL DEFAULT 0,
  validFrom      DATE NOT NULL,
  validTo        DATE NOT NULL,
  status         ENUM('PENDING','APPROVED','REFUSED') NOT NULL DEFAULT 'PENDING',
  createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_allocation_employee FOREIGN KEY (employeeId) REFERENCES Employee(id),
  CONSTRAINT fk_allocation_type FOREIGN KEY (timeOffTypeId) REFERENCES TimeOffType(id)
) ENGINE=InnoDB;

CREATE TABLE TimeOffRequest (
  id             VARCHAR(30) PRIMARY KEY,
  employeeId     VARCHAR(30) NOT NULL,
  timeOffTypeId  VARCHAR(30) NOT NULL,
  allocationId   VARCHAR(30) NULL,
  dateFrom       DATE NOT NULL,
  dateTo         DATE NOT NULL,
  durationDays   DECIMAL(6,2) NOT NULL,
  status         ENUM('DRAFT','PENDING','APPROVED','REFUSED') NOT NULL DEFAULT 'DRAFT',
  reason         VARCHAR(255) NULL,
  approvedById   VARCHAR(30) NULL,
  approvedAt     DATETIME NULL,
  createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tor_employee FOREIGN KEY (employeeId) REFERENCES Employee(id),
  CONSTRAINT fk_tor_type FOREIGN KEY (timeOffTypeId) REFERENCES TimeOffType(id),
  CONSTRAINT fk_tor_allocation FOREIGN KEY (allocationId) REFERENCES Allocation(id),
  CONSTRAINT fk_tor_approver FOREIGN KEY (approvedById) REFERENCES User(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Payrun, Payslip, PayslipLine
-- ---------------------------------------------------------------------
CREATE TABLE Payrun (
  id                VARCHAR(30) PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  salaryStructureId VARCHAR(30) NOT NULL,
  periodStart       DATE NOT NULL,
  periodEnd         DATE NOT NULL,
  status            ENUM('DRAFT','COMPUTED','VALIDATED','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  createdById       VARCHAR(30) NOT NULL,
  createdAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payrun_structure FOREIGN KEY (salaryStructureId) REFERENCES SalaryStructure(id),
  CONSTRAINT fk_payrun_creator FOREIGN KEY (createdById) REFERENCES User(id)
) ENGINE=InnoDB;

CREATE TABLE Payslip (
  id               VARCHAR(30) PRIMARY KEY,
  employeeId       VARCHAR(30) NOT NULL,
  payrunId         VARCHAR(30) NOT NULL,
  contractId       VARCHAR(30) NOT NULL,   -- resolved contract used, stored for audit
  periodStart      DATE NOT NULL,
  periodEnd        DATE NOT NULL,
  workedDays       DECIMAL(6,2) NOT NULL,
  gross            DECIMAL(12,2) NOT NULL,
  totalDeductions  DECIMAL(12,2) NOT NULL,
  net              DECIMAL(12,2) NOT NULL,
  status           ENUM('DRAFT','COMPUTED','VALIDATED','PAID') NOT NULL DEFAULT 'DRAFT',
  warnings         JSON NULL,
  createdAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payslip_employee FOREIGN KEY (employeeId) REFERENCES Employee(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payslip_payrun   FOREIGN KEY (payrunId) REFERENCES Payrun(id),
  CONSTRAINT fk_payslip_contract FOREIGN KEY (contractId) REFERENCES Contract(id),
  CONSTRAINT uq_payrun_employee UNIQUE (payrunId, employeeId)  -- DB-level duplicate prevention
) ENGINE=InnoDB;

CREATE TABLE PayslipLine (
  id         VARCHAR(30) PRIMARY KEY,
  payslipId  VARCHAR(30) NOT NULL,
  ruleCode   VARCHAR(30) NOT NULL,
  ruleName   VARCHAR(100) NOT NULL,
  category   ENUM('BASIC','ALLOWANCE','GROSS','DEDUCTION','NET') NOT NULL,
  sequence   INT NOT NULL,
  amount     DECIMAL(12,2) NOT NULL,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payslipline_payslip FOREIGN KEY (payslipId) REFERENCES Payslip(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Grievance
-- ---------------------------------------------------------------------
CREATE TABLE Grievance (
  id            VARCHAR(30) PRIMARY KEY,
  employeeId    VARCHAR(30) NOT NULL,
  payslipId     VARCHAR(30) NULL,
  subject       VARCHAR(150) NOT NULL,
  description   TEXT NOT NULL,
  status        ENUM('OPEN','UNDER_REVIEW','RESOLVED','REJECTED') NOT NULL DEFAULT 'OPEN',
  response      TEXT NULL,
  resolvedById  VARCHAR(30) NULL,
  resolvedAt    DATETIME NULL,
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_grievance_employee FOREIGN KEY (employeeId) REFERENCES Employee(id),
  CONSTRAINT fk_grievance_payslip  FOREIGN KEY (payslipId) REFERENCES Payslip(id),
  CONSTRAINT fk_grievance_resolver FOREIGN KEY (resolvedById) REFERENCES User(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- AuditLog
-- ---------------------------------------------------------------------
CREATE TABLE AuditLog (
  id          VARCHAR(30) PRIMARY KEY,
  userId      VARCHAR(30) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  entityType  VARCHAR(60) NOT NULL,
  entityId    VARCHAR(30) NOT NULL,
  changes     JSON NULL,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (userId) REFERENCES User(id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- SEED DATA
-- passwordHash below = bcrypt hash of "demo1234" (cost 10)
-- =====================================================================

-- Departments
INSERT INTO Department (id, name, code) VALUES
('d1','Engineering','ENG'),
('d2','Finance','FIN'),
('d3','Sales','SAL'),
('d4','HR','HR');

-- Working Schedule (standard 9-6, Mon-Fri)
INSERT INTO WorkingSchedule (id, name) VALUES ('s1','Standard 9-6 Mon-Fri');
INSERT INTO ScheduleLine (id, workingScheduleId, dayOfWeek, startTime, endTime, breakMinutes) VALUES
('sl1','s1',1,'09:00:00','18:00:00',60),
('sl2','s1',2,'09:00:00','18:00:00',60),
('sl3','s1',3,'09:00:00','18:00:00',60),
('sl4','s1',4,'09:00:00','18:00:00',60),
('sl5','s1',5,'09:00:00','18:00:00',60);

-- Salary Structure + Rules
INSERT INTO SalaryStructure (id, name) VALUES ('st1','Regular Salary');
INSERT INTO SalaryRule (id, structureId, name, code, category, sequence, computeType, amount, percentage, formula, baseRuleCode) VALUES
('sr1','st1','Basic Salary','BASIC','BASIC',10,'PERCENTAGE',NULL,50.000,NULL,'WAGE'),
('sr2','st1','House Rent Allowance','HRA','ALLOWANCE',20,'PERCENTAGE',NULL,40.000,NULL,'BASIC'),
('sr3','st1','Special Allowance','SPECIAL','ALLOWANCE',30,'FIXED',3000.00,NULL,NULL,NULL),
('sr4','st1','Gross Salary','GROSS','GROSS',50,'FORMULA',NULL,NULL,'BASIC + HRA + SPECIAL',NULL),
('sr5','st1','Provident Fund','PF','DEDUCTION',60,'PERCENTAGE',NULL,12.000,NULL,'BASIC'),
('sr6','st1','Net Salary','NET','NET',100,'FORMULA',NULL,NULL,'GROSS - PF',NULL);

-- Employees (12+)
INSERT INTO Employee (id, employeeCode, name, email, phone, departmentId, jobPosition, managerId, workingScheduleId, employeeType, status, bankAccount, avatarUrl) VALUES
('e1','EMP001','Aarav Mehta','aarav@peoplepay.com','9000000001','d2','Analyst',NULL,'s1','FULL_TIME','ACTIVE','XXXX1234',NULL),
('e2','EMP002','Sara Khan','sara@peoplepay.com','9000000002','d1','Engineering Manager',NULL,'s1','FULL_TIME','ACTIVE','XXXX5678',NULL),
('e3','EMP003','Rohan Gupta','rohan@peoplepay.com','9000000003','d1','Software Engineer','e2','s1','FULL_TIME','ACTIVE','XXXX9012',NULL),
('e4','EMP004','Priya Sharma','priya@peoplepay.com','9000000004','d3','Sales Executive',NULL,'s1','FULL_TIME','ACTIVE','XXXX3456',NULL),
('e5','EMP005','Vikram Singh','vikram@peoplepay.com','9000000005','d4','HR Manager',NULL,'s1','FULL_TIME','ACTIVE','XXXX7890',NULL),
('e6','EMP006','Anita Desai','anita@peoplepay.com','9000000006','d2','Payroll Executive',NULL,'s1','FULL_TIME','ACTIVE','XXXX1111',NULL),
('e7','EMP007','Karan Patel','karan@peoplepay.com','9000000007','d2','Payroll Manager',NULL,'s1','FULL_TIME','ACTIVE','XXXX2222',NULL),
('e8','EMP008','Meera Nair','meera@peoplepay.com','9000000008','d1','QA Engineer','e2','s1','FULL_TIME','ACTIVE','XXXX3333',NULL),
('e9','EMP009','Dev Kumar','dev@peoplepay.com','9000000009','d3','Sales Manager',NULL,'s1','FULL_TIME','ACTIVE',NULL,NULL), -- TRAP #2: no bank account
('e10','EMP010','Ishita Rao','ishita@peoplepay.com','9000000010','d1','Frontend Developer','e2','s1','FULL_TIME','ACTIVE','XXXX4444',NULL),
('e11','EMP011','Arjun Verma','arjun@peoplepay.com','9000000011','d4','HR Executive','e5','s1','FULL_TIME','ACTIVE','XXXX5555',NULL),
('e12','EMP012','Neha Joshi','neha@peoplepay.com','9000000012','d2','Finance Executive',NULL,'s1','FULL_TIME','ACTIVE','XXXX6666',NULL), -- TRAP #1: mid-month contract change
('e13','EMP013','Aditya Rana','aditya@peoplepay.com','9000000013','d1','Intern','e2','s1','INTERN','ACTIVE','XXXX7777',NULL);

-- Admin user (no linked employee)
INSERT INTO User (id, email, passwordHash, role, employeeId, name) VALUES
('u0','admin@peoplepay.com','$2b$10$KIX7Q1F6cFq1yQ8h1p1V4uQvXhq8p2c9wYVoM8N0zHqk3F6y9m1Xa','ADMIN',NULL,'System Admin'),
('u1','aarav@peoplepay.com','$2b$10$KIX7Q1F6cFq1yQ8h1p1V4uQvXhq8p2c9wYVoM8N0zHqk3F6y9m1Xa','EMPLOYEE','e1','Aarav Mehta'),
('u2','hr@peoplepay.com','$2b$10$KIX7Q1F6cFq1yQ8h1p1V4uQvXhq8p2c9wYVoM8N0zHqk3F6y9m1Xa','HR_MANAGER','e5','Vikram Singh'),
('u3','payroll@peoplepay.com','$2b$10$KIX7Q1F6cFq1yQ8h1p1V4uQvXhq8p2c9wYVoM8N0zHqk3F6y9m1Xa','HR_PAYROLL_USER','e6','Anita Desai'),
('u4','payrollmgr@peoplepay.com','$2b$10$KIX7Q1F6cFq1yQ8h1p1V4uQvXhq8p2c9wYVoM8N0zHqk3F6y9m1Xa','HR_PAYROLL_MANAGER','e7','Karan Patel');

-- Contracts (running contracts for all employees)
INSERT INTO Contract (id, employeeId, startDate, endDate, wage, jobPosition, departmentId, workingScheduleId, salaryStructureId, status) VALUES
('c1','e1','2025-01-01',NULL,45000.00,'Analyst','d2','s1','st1','RUNNING'),
('c2','e2','2024-06-01',NULL,120000.00,'Engineering Manager','d1','s1','st1','RUNNING'),
('c3','e3','2024-09-01',NULL,70000.00,'Software Engineer','d1','s1','st1','RUNNING'),
('c4','e4','2025-02-01',NULL,50000.00,'Sales Executive','d3','s1','st1','RUNNING'),
('c5','e5','2023-01-01',NULL,95000.00,'HR Manager','d4','s1','st1','RUNNING'),
('c6','e6','2024-01-01',NULL,60000.00,'Payroll Executive','d2','s1','st1','RUNNING'),
('c7','e7','2023-05-01',NULL,110000.00,'Payroll Manager','d2','s1','st1','RUNNING'),
('c8','e8','2024-03-01',NULL,65000.00,'QA Engineer','d1','s1','st1','RUNNING'),
('c9','e9','2023-08-01',NULL,80000.00,'Sales Manager','d3','s1','st1','RUNNING'),
('c10','e10','2024-11-01',NULL,72000.00,'Frontend Developer','d1','s1','st1','RUNNING'),
('c11','e11','2025-04-01',NULL,48000.00,'HR Executive','d4','s1','st1','RUNNING'),
('c13','e13','2025-06-01',NULL,20000.00,'Intern','d1','s1','st1','RUNNING'),
-- TRAP #1: Neha (e12) — old contract ended 15-Aug-2026, new higher-wage contract starts 16-Aug-2026
('c12a','e12','2024-05-01','2026-08-15',55000.00,'Finance Executive','d2','s1','st1','EXPIRED'),
('c12b','e12','2026-08-16',NULL,68000.00,'Senior Finance Executive','d2','s1','st1','RUNNING');

-- Time Off Types
INSERT INTO TimeOffType (id, name, unit, requiresAllocation, isPaid, color) VALUES
('tt1','Annual Leave','DAYS',TRUE,TRUE,'#4CAF50'),
('tt2','Sick Leave','DAYS',TRUE,TRUE,'#FF9800'),
('tt3','Unpaid Leave','DAYS',FALSE,FALSE,'#9E9E9E');

-- Allocations (TRAP #5: Rohan almost exhausted 18/20 used)
INSERT INTO Allocation (id, employeeId, timeOffTypeId, allocatedDays, usedDays, validFrom, validTo, status) VALUES
('al1','e1','tt1',20,5,'2026-01-01','2026-12-31','APPROVED'),
('al2','e2','tt1',20,8,'2026-01-01','2026-12-31','APPROVED'),
('al3','e3','tt1',20,18,'2026-01-01','2026-12-31','APPROVED'), -- TRAP #5
('al4','e4','tt1',20,4,'2026-01-01','2026-12-31','APPROVED'),
('al5','e5','tt1',20,10,'2026-01-01','2026-12-31','APPROVED'),
('al6','e1','tt2',10,2,'2026-01-01','2026-12-31','APPROVED'),
('al7','e3','tt2',10,1,'2026-01-01','2026-12-31','APPROVED');

-- Time Off Requests (TRAP #5: Rohan's pending 4-day request exceeds remaining 2-day balance)
INSERT INTO TimeOffRequest (id, employeeId, timeOffTypeId, allocationId, dateFrom, dateTo, durationDays, status, reason, approvedById, approvedAt) VALUES
('tor1','e1','tt1','al1','2026-07-10','2026-07-12',3,'APPROVED','Family trip','u2','2026-07-05 10:00:00'),
('tor2','e4','tt1','al4','2026-08-01','2026-08-01',1,'APPROVED','Personal','u2','2026-07-28 09:00:00'),
('tor3','e3','tt1','al3','2026-09-10','2026-09-13',4,'PENDING','Vacation',NULL,NULL); -- TRAP #5: only 2 days remain

-- Previous Payruns (completed, for dashboard trend)
INSERT INTO Payrun (id, name, salaryStructureId, periodStart, periodEnd, status, createdById) VALUES
('pr1','June 2026 Payroll','st1','2026-06-01','2026-06-30','PAID','u4'),
('pr2','July 2026 Payroll','st1','2026-07-01','2026-07-31','PAID','u4'),
('pr3','August 2026 Payroll','st1','2026-08-01','2026-08-31','VALIDATED','u4');

-- Payslips for June/July (abbreviated set) + August (full, includes traps)
-- June payslips
INSERT INTO Payslip (id, employeeId, payrunId, contractId, periodStart, periodEnd, workedDays, gross, totalDeductions, net, status, warnings) VALUES
('p_jun_e1','e1','pr1','c1','2026-06-01','2026-06-30',22,58500.00,2700.00,55800.00,'PAID','[]'),
('p_jun_e2','e2','pr1','c2','2026-06-01','2026-06-30',22,156000.00,7200.00,148800.00,'PAID','[]'),
('p_jun_e6','e6','pr1','c6','2026-06-01','2026-06-30',22,78000.00,3600.00,74400.00,'PAID','[]');

-- July payslips
INSERT INTO Payslip (id, employeeId, payrunId, contractId, periodStart, periodEnd, workedDays, gross, totalDeductions, net, status, warnings) VALUES
('p_jul_e1','e1','pr2','c1','2026-07-01','2026-07-31',23,58500.00,2700.00,55800.00,'PAID','[]'),
('p_jul_e2','e2','pr2','c2','2026-07-01','2026-07-31',23,156000.00,7200.00,148800.00,'PAID','[]'),
('p_jul_e6','e6','pr2','c6','2026-07-01','2026-07-31',23,78000.00,3600.00,74400.00,'PAID','[]');

-- August payslips (VALIDATED payrun) — includes TRAP #2 (missing bank), TRAP #3 (duplicate)
INSERT INTO Payslip (id, employeeId, payrunId, contractId, periodStart, periodEnd, workedDays, gross, totalDeductions, net, status, warnings) VALUES
('p_aug_e1','e1','pr3','c1','2026-08-01','2026-08-31',21,58500.00,2700.00,55800.00,'VALIDATED','[]'),
('p_aug_e2','e2','pr3','c2','2026-08-01','2026-08-31',21,156000.00,7200.00,148800.00,'VALIDATED','[]'),
('p_aug_e9','e9','pr3','c9','2026-08-01','2026-08-31',21,104000.00,4800.00,99200.00,'VALIDATED',
   JSON_ARRAY(JSON_OBJECT('code','MISSING_BANK','message','Employee has no bank account on file'))
),
-- TRAP #3: e6 already has a payslip for August in pr3 (this row itself) — the "duplicate" is demonstrated
-- by attempting to insert a second payslip for (pr3, e6), which the UNIQUE(payrunId, employeeId) constraint blocks.
('p_aug_e6','e6','pr3','c6','2026-08-01','2026-08-31',21,78000.00,3600.00,74400.00,'VALIDATED',
   JSON_ARRAY(JSON_OBJECT('code','DUPLICATE_PAYSLIP','message','A payslip for this employee and period may already exist — verify before resending'))
);

-- PayslipLines for one representative payslip (e1, August) to show full breakdown
INSERT INTO PayslipLine (id, payslipId, ruleCode, ruleName, category, sequence, amount) VALUES
('pl1','p_aug_e1','BASIC','Basic Salary','BASIC',10,22500.00),
('pl2','p_aug_e1','HRA','House Rent Allowance','ALLOWANCE',20,9000.00),
('pl3','p_aug_e1','SPECIAL','Special Allowance','ALLOWANCE',30,3000.00),
('pl4','p_aug_e1','GROSS','Gross','GROSS',50,34500.00),
('pl5','p_aug_e1','PF','Provident Fund','DEDUCTION',60,-2700.00),
('pl6','p_aug_e1','NET','Net Salary','NET',100,31800.00);

-- Attendance: 3 months (June, July, August 2026) for e1 as representative,
-- including TRAP #4 (2 missing checkouts, 3 late arrivals) spread across employees.
INSERT INTO Attendance (id, employeeId, checkIn, checkOut, workedHours, overtimeHours, status, notes, isManuallyEdited) VALUES
('a1','e1','2026-06-01 09:02:00','2026-06-01 18:05:00',8.05,0.05,'PRESENT',NULL,FALSE),
('a2','e1','2026-06-02 09:00:00','2026-06-02 18:00:00',8.00,0.00,'PRESENT',NULL,FALSE),
('a3','e1','2026-07-01 09:15:00','2026-07-01 18:00:00',7.75,0.00,'LATE',NULL,FALSE),
('a4','e1','2026-08-01 09:05:00','2026-08-01 18:00:00',7.92,0.00,'PRESENT',NULL,FALSE),
-- TRAP #4: missing checkouts
('a5','e3','2026-08-05 09:00:00',NULL,0.00,0.00,'MISSING_CHECKOUT','Forgot to check out',FALSE),
('a6','e8','2026-08-12 09:00:00',NULL,0.00,0.00,'MISSING_CHECKOUT','Forgot to check out',FALSE),
-- TRAP #4: late arrivals
('a7','e4','2026-08-03 09:40:00','2026-08-03 18:00:00',7.33,0.00,'LATE',NULL,FALSE),
('a8','e9','2026-08-06 09:35:00','2026-08-06 18:10:00',7.58,0.10,'LATE',NULL,FALSE),
('a9','e10','2026-08-07 09:20:00','2026-08-07 18:00:00',7.67,0.00,'LATE',NULL,FALSE),
-- normal attendance filler for other employees/months
('a10','e2','2026-08-01 08:55:00','2026-08-01 18:30:00',8.58,0.58,'PRESENT',NULL,FALSE),
('a11','e5','2026-08-01 09:00:00','2026-08-01 17:30:00',7.50,0.00,'HALF_DAY','Left early - appointment',TRUE),
('a12','e6','2026-08-01 09:00:00','2026-08-01 18:00:00',8.00,0.00,'PRESENT',NULL,FALSE),
('a13','e7','2026-08-01 09:00:00','2026-08-01 18:00:00',8.00,0.00,'PRESENT',NULL,FALSE),
('a14','e11','2026-08-01 09:00:00','2026-08-01 18:00:00',8.00,0.00,'PRESENT',NULL,FALSE),
('a15','e12','2026-08-01 09:00:00','2026-08-01 18:00:00',8.00,0.00,'ABSENT','Marked absent - no show',FALSE);

-- Grievance (sample)
INSERT INTO Grievance (id, employeeId, payslipId, subject, description, status, response, resolvedById, resolvedAt) VALUES
('g1','e9','p_aug_e9','Missing bank payment','My salary was not credited because bank details are missing.','OPEN',NULL,NULL,NULL),
('g2','e1','p_jul_e1','Overtime not reflected','July overtime hours seem missing from payslip.','RESOLVED','Recalculated and confirmed correct; overtime was under 1 hour threshold.','u3','2026-08-02 11:00:00');

-- Audit Log samples
INSERT INTO AuditLog (id, userId, action, entityType, entityId, changes) VALUES
('log1','u4','VALIDATE','Payrun','pr3',JSON_OBJECT('status','VALIDATED')),
('log2','u2','APPROVE','TimeOffRequest','tor1',JSON_OBJECT('status','APPROVED')),
('log3','u3','CORRECT','Attendance','a11',JSON_OBJECT('status','HALF_DAY','isManuallyEdited',TRUE));

-- =====================================================================
-- End of file
-- =====================================================================
