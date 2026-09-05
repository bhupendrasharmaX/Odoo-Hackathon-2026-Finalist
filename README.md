<p align="center">
  <strong>People</strong><em>Pay</em><strong>360</strong>
</p>

<h3 align="center">HR & Payroll Platform — Odoo Hackathon 2026 Finalist</h3>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#demo-accounts">Demo Accounts</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#permissions">Permissions</a> •
  <a href="#branches">Branches</a>
</p>

---

## Overview

**PeoplePay360** is a full-stack HR & Payroll management platform where teams can run headcount, attendance, leave, and payroll all without a single spreadsheet changing hands. Built for the **Odoo Hackathon 2026**, it features a modern React frontend with role-based access control and a Node.js/Express backend with Prisma ORM.

---

## Features

| Module | Description |
|---|---|
| **Dashboard** | At-a-glance stats total employees, present today, pending leaves, net payroll with department breakdown and recent hires |
| **Employees** | Full employee directory with search, status tracking (active / inactive / terminated / on leave), and CRUD operations |
| **Payroll** | Monthly payroll runs with detailed payslips (basic, HRA, conveyance, PF, ESI, tax), approval/reject workflow |
| **Attendance** | Daily attendance log with check-in/out times, hours worked, and status summary (present, absent, half day, leave, holiday, weekend) |
| **Leaves** | Leave request management with type filters (casual, sick, earned, maternity, paternity, unpaid), approve/reject actions |
| **Settings** | Organization details and department management |

### Additional Highlights

- 🔐 **Role-Based Access Control (RBAC)** - 5 roles with granular permission matrix
- 🧩 **Declarative Permission Gates** - `<Can>` component and `useCan()` hook for UX-level permission hiding
- 📱 **Fully Responsive** - Desktop top-nav with mobile hamburger drawer
- 🎨 **Premium UI** - Custom design system with CSS variables, glassmorphism accents, smooth transitions
- 🔄 **Mock API Layer** - Runs entirely client-side with realistic mock data for demo purposes
- ⚡ **Hot Module Replacement** - Instant feedback during development via Vite

---

## Tech Stack

### Frontend (`frontend` branch)

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build Tool | Vite 8 |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| HTTP Client | Axios |
| Linting | Oxlint |

### Backend (`main` branch)

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| Language | TypeScript 5 |
| ORM | Prisma 5 |
| Auth | JWT + bcryptjs |
| Validation | Zod |
| PDF | PDFKit |
| Email | Nodemailer |
| Math Engine | math.js + Decimal.js |
| Testing | Vitest + Supertest |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 9.x
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/bhupendrasharmaX/Odoo-Hackathon-2026-Finalist.git
cd Odoo-Hackathon-2026-Finalist
```

### 2. Run the Frontend

```bash
# Switch to the frontend branch
git checkout frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173/**

### 3. Run the Backend (optional)

```bash
# Switch to the main branch
git checkout main
cd server

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start the dev server
npm run dev
```

The API will be available at **http://localhost:3000/** (default)

---

## Demo Accounts

The frontend includes built-in demo accounts for quick testing. Click any role on the login page to auto-fill credentials:

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `admin@peoplepay360.com` | `admin123` |
| **HR Manager** | `hr@peoplepay360.com` | `hr123` |
| **HR Executive** | `hrexec@peoplepay360.com` | `hrexec123` |
| **Payroll Manager** | `payroll@peoplepay360.com` | `payroll123` |
| **Employee** | `employee@peoplepay360.com` | `emp123` |

---

## Project Structure

```
Odoo-Hackathon-2026-Finalist/
├── src/                          # Frontend source (React)
│   ├── api/                      # API client & mock data layer
│   │   ├── client.ts             # Axios HTTP client
│   │   ├── mock.ts               # Mock API with realistic data
│   │   └── index.ts              # API exports
│   ├── auth/                     # Authentication system
│   │   ├── AuthContext.tsx        # React context for auth state
│   │   ├── ProtectedRoute.tsx    # Route guard component
│   │   └── permissions.ts        # RBAC permission matrix & checker
│   ├── components/               # Reusable UI components
│   │   ├── Can.tsx               # Declarative permission gate
│   │   ├── DataTable.tsx         # Generic sortable/searchable table
│   │   ├── StatusBadge.tsx       # Color-coded status pills
│   │   ├── Toast.tsx             # Toast notification system
│   │   └── Topbar.tsx            # Navigation bar with mobile support
│   ├── layouts/
│   │   └── AppLayout.tsx         # Main app shell layout
│   ├── pages/                    # Route-level page components
│   │   ├── Dashboard.tsx         # Overview with stats & charts
│   │   ├── Employees.tsx         # Employee directory
│   │   ├── Payroll.tsx           # Payroll runs & payslips
│   │   ├── Attendance.tsx        # Daily attendance tracking
│   │   ├── Leaves.tsx            # Leave request management
│   │   ├── Login.tsx             # Authentication page
│   │   └── Settings.tsx          # Org & department settings
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces & types
│   ├── App.tsx                   # Root component with routing
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles & design tokens
├── server/                       # Backend source (Express + Prisma)
│   ├── src/
│   │   ├── config/               # App configuration
│   │   ├── core/                 # Business logic (contract resolution, etc.)
│   │   ├── http/                 # HTTP handlers
│   │   ├── lib/                  # Shared utilities
│   │   ├── middleware/           # Express middleware
│   │   ├── modules/              # Feature modules
│   │   ├── routes.ts             # API route definitions
│   │   ├── app.ts                # Express app setup
│   │   └── index.ts              # Server entry point
│   ├── tests/                    # Backend test suites
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── dist/                         # Production build output
├── package.json                  # Frontend dependencies
└── README.md
```

---

## Permissions

PeoplePay360 implements a granular permission matrix across 5 roles and 6 modules. The value `self` means users can only access their own records.

> **Note:** Frontend permission checks are UX convenience only — the backend enforces permissions independently.

| Module | Action | Super Admin | HR Manager | HR Executive | Payroll Manager | Employee |
|---|---|---|---|---|---|---|
| **Employees** | read | ✅ | ✅ | ✅ | ✅ | self |
| | write | ✅ | ✅ | ✅ | ❌ | ❌ |
| | delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Payroll** | read | ✅ | ✅ | ❌ | ✅ | self |
| | write | ✅ | ❌ | ❌ | ✅ | ❌ |
| | approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Attendance** | read | ✅ | ✅ | ✅ | ✅ | self |
| | write | ✅ | ✅ | ✅ | ❌ | self |
| **Leave** | read | ✅ | ✅ | ✅ | ❌ | self |
| | write | ✅ | ✅ | ❌ | ❌ | self |
| | approve | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Settings** | read | ✅ | ✅ | ❌ | ❌ | ❌ |
| | write | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Reports** | read | ✅ | ✅ | ❌ | ✅ | ❌ |

---

## Branches

| Branch | Description |
|---|---|
| `main` | Backend API — Express + Prisma + TypeScript server |
| `frontend` | Frontend app — React + Vite + Tailwind CSS |
| `database` | Database schema and migration scripts |

---

## Scripts

### Frontend

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check + production build
npm run preview    # Preview production build locally
npm run lint       # Run Oxlint
```

### Backend

```bash
npm run dev             # Start server with tsx watch (hot reload)
npm run build           # Compile TypeScript
npm run start           # Run compiled server
npm run typecheck       # Type-check without emitting
npm run test            # Run tests with Vitest
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
npm run prisma:studio   # Open Prisma Studio GUI
```

---

## License

This project was built for the **Odoo Hackathon 2026**. All rights reserved.

---

<p align="center">
  Built with ❤️<strong>PeoplePay360</strong>
</p>
