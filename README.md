<h1 align="center">PeoplePay360</h1>

<p align="center">
  <strong>HR &amp; Payroll Platform — Odoo Hackathon 2026 Finalist</strong>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#repository-layout">Repository Layout</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#application-flow">Application Flow</a> •
  <a href="#modules--api-surface">API</a> •
  <a href="#roles--permissions">Permissions</a> •
  <a href="#getting-started">Getting Started</a>
</p>

---

## Overview

PeoplePay360 is a full-stack HR and payroll system: employee records, contracts,
working schedules, attendance, time off, a configurable salary-rule engine,
monthly payroll runs, PDF payslips and payslip grievances — under a single
role-based permission model enforced on the server.

Two pieces carry the product:

- **A salary-rule engine** that evaluates ordered, code-referencing rules
  (`NET = GROSS - PF`) with `Decimal.js` money arithmetic, so an HR user can
  express a pay structure without a code change.
- **Period contract resolution** that finds every contract in force during a
  payroll period and pro-rates each one, so an employee who changed contract
  mid-month gets a correct payslip instead of the latest wage applied to the
  whole month.

---

## Repository Layout

The project is split across branches. No single branch contains everything, so
check out the one you need.

| Branch | Contents |
|---|---|
| `frontend` | **The React client.** Current UI, wired to the live API over Axios. Run this for the app. |
| `backend` | **The implemented API.** Express + Prisma server with the full service layer, PDF, mailer and audit logging, plus an earlier prototype client under `client/`. Run this for the server. |
| `main` | API scaffold and documentation: the complete route surface, middleware, RBAC config and pure core engines. Route handlers return `notImplemented` — this branch does not serve data. |
| `database` | MySQL `base.sql` (schema + demo seed) alongside the Prisma schema and migration. |

To run the full stack, pair `backend` (server) with `frontend` (client).

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Charts | Recharts 3 |
| Icons | Lucide React |
| HTTP | Axios |
| Linting | Oxlint |

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| Language | TypeScript 5 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 (MySQL script also provided on `database`) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Validation | Zod |
| Money | Decimal.js |
| Formulas | math.js |
| PDF | PDFKit |
| Email | Nodemailer (optional) |
| Hardening | Helmet, CORS, Morgan |
| Testing | Vitest + Supertest |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React SPA (Vite, :5173)                                 │
│                                                          │
│  Pages ─► useApi hook ─► api client (Axios)              │
│                            │                             │
│      AuthContext ──────────┤  request:  Bearer <JWT>     │
│      ProtectedRoute        │  response: unwrap envelope  │
│      RequireRole           │  401 ─► clear + /login      │
└────────────────────────────┼─────────────────────────────┘
                             │  /api/v1
┌────────────────────────────▼─────────────────────────────┐
│  Express API (:4000)                                     │
│                                                          │
│  helmet ─► cors ─► morgan ─► json                        │
│      │                                                   │
│      ├─ requireAuth   verify JWT, attach req.auth        │
│      ├─ requireRole   check against ROLE_GROUPS          │
│      ├─ scopeToSelf   EMPLOYEE narrowed to own records   │
│      ├─ validate      Zod schema per route               │
│      │                                                   │
│  routes ─► services ─► core engines (pure)               │
│                          salary-engine                   │
│                          contract-resolution             │
│                          formula / money / warnings      │
│      │                                                   │
│      └─ errorHandler ─► { success: false, error }        │
└────────────────────────────┬─────────────────────────────┘
                             │ Prisma
                    ┌────────▼────────┐
                    │  PostgreSQL 16  │
                    └─────────────────┘
```

**Response envelope.** Every endpoint returns `{ success, data, meta? }` on
success and `{ success: false, error: { code, message, details? } }` on failure.
The client unwraps this centrally and rethrows an `ApiError` carrying `code`, so
callers branch on `FORBIDDEN` rather than matching strings. The one exception is
`GET /payslips/:id/pdf`, which returns a file.

**Core engines are pure.** `core/` imports no Prisma type and no Express type —
plain objects in, plain results out. That is what makes the payroll maths
unit-testable without a database.

---

## Application Flow

### 1. Authentication

```
/login  ──POST /auth/login──►  { token, user }
                               token → localStorage (pp360_token)
                               ↓
                        AuthProvider hydrates
                        GET /auth/me on boot
                               ↓
                        ProtectedRoute ─► app shell
```

A 401 on any request other than `/auth/me` clears the session and hard-redirects
to `/login`. A 401 on `/auth/me` during boot is treated as a normal expired token
and does not bounce the user mid-render.

### 2. The landing screen resolves by role

`/` does not render one fixed dashboard. `GET /dashboard` is payroll-scoped and
refuses `HR_MANAGER` and `EMPLOYEE`, so each role is sent to a screen built only
from endpoints it can actually read:

| Role | Landing screen |
|---|---|
| `ADMIN`, `HR_PAYROLL_MANAGER`, `HR_PAYROLL_USER` | Payroll dashboard — headcount, net payroll, department breakdown |
| `HR_MANAGER` | People overview — directory, attendance, time-off queues |
| `EMPLOYEE` | My workspace — own attendance, balances, payslips |

### 3. Payroll run lifecycle

The primary workflow of the product.

```
Configure                Run                              Deliver
─────────                ───                              ───────
Salary Structure    ┌─► POST /payruns/eligible-employees   (preview only)
  └─ Salary Rules   │        │
       sequenced    │        ▼
       BASIC        └─► POST /payruns                DRAFT
       ALLOWANCE             │
       GROSS                 ▼
       DEDUCTION      POST /payruns/:id/compute      COMPUTED
       NET                   │   resolve contracts
                             │   run the rule engine
Employee                     │   emit payslip lines
  └─ Contract (wage)         │   collect warnings
       └─ Working Schedule   ▼
            └─ Attendance  POST /payruns/:id/validate    VALIDATED
                             │
                             ▼
                           POST /payruns/:id/mark-paid    PAID
                             │
                             ▼
                           POST /payruns/:id/send-payslips
                             │
                             ├─► PDF via PDFKit  (GET /payslips/:id/pdf)
                             └─► Email via Nodemailer

Payrun states:  DRAFT → COMPUTED → VALIDATED → PAID   (or CANCELLED)
Payslip states: DRAFT → COMPUTED → VALIDATED → PAID
```

**How a payslip is computed.** Rules are sorted by ascending `sequence` and
evaluated in order, each writing its amount into a context keyed by `rule.code`
so later rules can reference earlier ones. `DEDUCTION` lines are stored negative,
so the lines sum to net — while the context keeps the magnitude, which is why
`NET = GROSS - PF` reads the way an HR user wrote it.

A rule computes by `FIXED` amount, `PERCENTAGE` of another rule (or of the
contract wage), or `FORMULA`. Formulas are parsed, not evaluated as JavaScript:
member access and function calls are rejected, unknown identifiers throw rather
than defaulting to zero, and division by zero has defined behaviour.

### 4. Attendance and time off

```
Attendance:  POST /attendance/check-in ─► GET /attendance/active
                                       ─► POST /attendance/check-out
             → worked hours, overtime, status
               PRESENT / LATE / HALF_DAY / ABSENT / MISSING_CHECKOUT

Time off:    TimeOffType  (paid?, unit, requires allocation?)
                  │
                  ▼
             Allocation      PENDING ──approve──► APPROVED / REFUSED
                  │
                  ▼
             Request         DRAFT → PENDING ──►  APPROVED / REFUSED
                  │
                  ▼
             GET /timeoff/balance/:employeeId

             Unpaid leave days feed the next payroll computation.
```

### 5. Grievances

An employee raises a grievance, optionally attached to a specific payslip:
`OPEN → UNDER_REVIEW → RESOLVED | REJECTED`. Only payroll roles and `ADMIN` may
resolve one; `HR_MANAGER` cannot, since it never sees the payslip in question.

---

## Modules &amp; API Surface

Base path `/api/v1`. If a path is not listed here, it does not exist.

| Resource | Endpoints |
|---|---|
| `GET /health` | Liveness; also reports whether the Prisma client has been generated |
| `/auth` | `POST /login`, `GET /me` |
| `/users` | `GET /`, `POST /`, `PATCH /:id/role` — admin only |
| `/employees` | `GET /`, `GET /:id`, `GET /:id/summary`, `GET /departments`, `POST /`, `PATCH /:id` |
| `/contracts` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` |
| `/schedules` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` |
| `/attendance` | `GET /`, `GET /active`, `POST /check-in`, `POST /check-out`, `POST /`, `PATCH /:id` |
| `/timeoff` | `GET`/`POST /types`, `GET`/`POST /allocations`, `POST /allocations/:id/approve`, `GET`/`POST /requests`, `POST /requests/:id/approve`, `POST /requests/:id/refuse`, `GET /balance/:employeeId` |
| `/salary-structures` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` |
| `/salary-rules` | `GET /`, `POST /`, `PATCH /:id` |
| `/payruns` | `GET /`, `GET /:id`, `POST /eligible-employees`, `POST /`, `POST /:id/compute`, `POST /:id/validate`, `POST /:id/mark-paid`, `POST /:id/send-payslips` |
| `/payslips` | `GET /`, `GET /:id`, `GET /:id/pdf` |
| `/grievances` | `GET /`, `POST /`, `PATCH /:id` |
| `/dashboard` | `GET /`, `GET /filters` |

---

## Roles &amp; Permissions

Five roles, defined once in `server/src/config/roles.ts` and mirrored for UX in
`src/auth/permissions.ts`. **The frontend copy hides controls only. The server
enforces every rule independently** — if the two disagree, the server wins and
the user sees a 403.

| Role group | Members |
|---|---|
| `ADMIN_ONLY` | `ADMIN` |
| `HR_PLUS` | `HR_MANAGER`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` |
| `SALARY_READ` | `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` |
| `SALARY_WRITE` | `HR_PAYROLL_MANAGER`, `ADMIN` |
| `PAYROLL` | `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` |
| `DASHBOARD` | `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` |
| `PAYSLIP_READ` | `EMPLOYEE`, `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` |
| `GRIEVANCE_RESOLVE` | `HR_PAYROLL_USER`, `HR_PAYROLL_MANAGER`, `ADMIN` |

Two rules shape the whole matrix:

- **`HR_MANAGER` has no payroll access at all** — no payruns, no payslips, no
  salary configuration, not even the dashboard. It runs people operations only.
  This is the most heavily tested rule in the project.
- **`EMPLOYEE` is scoped to itself.** `scopeToSelf` narrows every people-ops and
  payslip query to the caller's own records; reading another employee's data
  returns 403 rather than an empty list.

`HR_PAYROLL_USER` is read-only on salary configuration: it may read structures
and rules, but only `HR_PAYROLL_MANAGER` and `ADMIN` may write them.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 9
- PostgreSQL 16 (or MySQL 8 using `base.sql` on the `database` branch)

### 1. Backend

```bash
git clone https://github.com/bhupendrasharmaX/Odoo-Hackathon-2026-Finalist.git
cd Odoo-Hackathon-2026-Finalist
git checkout backend
cd server

npm install
cp .env.example .env      # set DATABASE_URL and JWT_SECRET

npm run db:setup          # migrate deploy + generate + seed
npm run dev
```

The API runs at **http://localhost:4000**, base path `/api/v1`. Check
`GET /api/v1/health` — it reports `prisma-client-not-generated` if
`npm run prisma:generate` has not run, which is the usual reason a fresh clone
misbehaves.

Environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `4000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Token signing secret. Required in production; development falls back insecurely and warns at boot |
| `JWT_EXPIRES_IN` | Token lifetime (default `24h`) |
| `CORS_ORIGIN` | Comma-separated allowed origins; the Vite dev server is `http://localhost:5173` |
| `SMTP_*` | Optional. With SMTP unset, sending payslips is logged and still recorded as sent, so the demo works offline |

### 2. Frontend

In a second terminal, from a separate clone or worktree:

```bash
git checkout frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:4000/api/v1
npm run dev
```

The app runs at **http://localhost:5173**.

---

## Demo Accounts

Created by the seed. The password is `demo1234` for every account.

| Email | Role | Sees |
|---|---|---|
| `admin@peoplepay.com` | `ADMIN` | Everything, including user management |
| `payrollmgr@peoplepay.com` | `HR_PAYROLL_MANAGER` | Full payroll; salary config read/write |
| `payroll@peoplepay.com` | `HR_PAYROLL_USER` | Full payroll; salary config read-only |
| `hr@peoplepay.com` | `HR_MANAGER` | People ops only — no payroll anywhere |
| `aarav@peoplepay.com` | `EMPLOYEE` | Own record, attendance, balances, payslips |

The seed also creates 13 employees across 4 departments, a standard 9–6 working
schedule, a `Regular Salary` structure (BASIC / HRA / GROSS / PF / NET), three
time-off types, and three payruns — two `PAID`, one `VALIDATED`.

---

## Project Structure

```
server/                              # backend branch
├── prisma/
│   ├── schema.prisma                # 15 models, 12 enums
│   └── migrations/
├── src/
│   ├── config/
│   │   ├── env.ts                   # validated environment
│   │   └── roles.ts                 # roles + ROLE_GROUPS (single source)
│   ├── core/                        # pure, database-free business logic
│   │   ├── salary-engine.ts         # ordered rule evaluation
│   │   ├── contract-resolution.ts   # in-force contracts + pro-rata
│   │   ├── formula.ts               # safe expression evaluation
│   │   ├── money.ts                 # Decimal.js arithmetic
│   │   └── warnings.ts              # non-fatal payslip warnings
│   ├── http/
│   │   ├── envelope.ts              # { success, data, meta }
│   │   ├── errors.ts                # AppError + error codes
│   │   ├── pagination.ts
│   │   └── asyncHandler.ts
│   ├── middleware/
│   │   ├── requireAuth.ts           # JWT verification
│   │   ├── requireRole.ts           # role-group gate
│   │   ├── scopeToSelf.ts           # EMPLOYEE narrowing
│   │   ├── validate.ts              # Zod request validation
│   │   └── errorHandler.ts
│   ├── modules/                     # routes + services per feature
│   │   ├── auth/  users/  employees/  contracts/  schedules/
│   │   ├── attendance/  timeoff/  salary/  grievances/  dashboard/
│   │   └── payroll/                 # payruns, payslips, pdf.ts, mailer.ts
│   ├── lib/                         # prisma, logger, audit, dates, serialize
│   ├── routes.ts                    # the complete /api/v1 surface
│   ├── app.ts                       # middleware assembly
│   ├── index.ts                     # entry point
│   └── seed.ts
└── tests/
    ├── core-logic.test.ts           # formula, money, contract resolution
    └── permission-wall.test.ts      # RBAC enforcement via Supertest

src/                                 # frontend branch
├── api/
│   ├── client.ts                    # Axios instance, interceptors, API surface
│   └── index.ts
├── auth/
│   ├── AuthContext.tsx              # session state + boot hydration
│   ├── ProtectedRoute.tsx           # ProtectedRoute + RequireRole
│   └── permissions.ts               # mirrored role matrix (UX only)
├── components/                      # DataTable, charts, forms, Toast, Topbar
├── layouts/AppLayout.tsx            # shell, scroll reset, route transitions
├── lib/
│   ├── useApi.ts                    # fetch / loading / error hook
│   └── format.ts
├── pages/                           # 25 route-level screens
├── types/index.ts                   # shared API types
├── App.tsx                          # routing + role gates
└── main.tsx
```

---

## Scripts

### Backend (`backend` branch, in `server/`)

| Command | Effect |
|---|---|
| `npm run dev` | Start with `tsx watch` (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm run test` | Run the Vitest suites |
| `npm run seed` | Seed demo data |
| `npm run db:setup` | `migrate deploy` + `generate` + `seed` |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create and apply a dev migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:reset` | Drop and rebuild the database |

### Frontend (`frontend` branch)

| Command | Effect |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check, then production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Oxlint |

---

## Testing

```bash
cd server && npm run test
```

Two suites, covering the parts where a silent error would be expensive:

- **`core-logic.test.ts`** — formula evaluation (including rejection of
  `process.exit(1)`, member access and function calls), inclusive day counting,
  period overlap at exact boundaries, mid-month contract changes returning
  *both* contracts rather than silently the latest, and overlap validation that
  lets a contract be edited without clashing with itself.
- **`permission-wall.test.ts`** — the RBAC matrix end to end via Supertest:
  missing and wrongly-signed tokens, `HR_MANAGER` locked out of every payroll
  endpoint while retaining people ops, `HR_PAYROLL_USER` read-only on salary
  config, `/users` restricted to `ADMIN`, and `EMPLOYEE` receiving 403 rather
  than another employee's records.

---

## License

Built for the Odoo Hackathon 2026. All rights reserved.
