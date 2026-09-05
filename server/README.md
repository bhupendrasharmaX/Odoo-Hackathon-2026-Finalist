# PeoplePay360 - Backend

REST API for the HR & Payroll system. Node.js + Express + TypeScript + Prisma + PostgreSQL.

Base URL: `http://localhost:4000/api/v1`

## Quick start

```bash
cd server
npm install
cp .env.example .env      # edit DATABASE_URL and JWT_SECRET
npm run dev
```

Then:

```bash
curl http://localhost:4000/api/v1/health
```

The server boots **without a database**. `prisma/schema.prisma` is owned by
Person 1 and may not exist yet, so the Prisma client is loaded lazily - health
checks pass and the whole permission layer is curl-testable before the schema
lands. Once it does:

```bash
npm run prisma:generate     # reads ../prisma/schema.prisma
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | tsx watch, restarts on save |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled build |
| `npm run typecheck` | tsc with no emit |
| `npm test` | vitest, single run |
| `npm run test:watch` | vitest, watch mode |
| `npm run prisma:generate` | Generates the client from `../prisma/schema.prisma` |
| `npm run prisma:migrate` | Dev migration |
| `npm run prisma:studio` | Prisma Studio |

## Layout

```
src/
  index.ts            Bootstrap: listen + graceful shutdown
  app.ts              Express app factory (createApp) - no listener, so tests can drive it
  routes.ts           The whole /api/v1 surface in one table
  config/
    env.ts            Zod-validated environment, parsed once at boot
    roles.ts          Locked role strings + the permission matrix as named groups
  http/
    envelope.ts       sendData / sendList / sendError - the locked response shape
    errors.ts         AppError + the six locked error codes
    asyncHandler.ts   Wrap every async handler (Express 4 does not catch rejections)
    pagination.ts     ?page= / ?limit= -> skip/take + meta
  middleware/
    requireAuth.ts    Verifies the bearer token, attaches req.user
    requireRole.ts    Route-level role gate
    scopeToSelf.ts    Forces EMPLOYEE callers into their own lane
    validate.ts       Zod validation for body / query / params
    errorHandler.ts   Central handler - registered last, nothing after it
    notFound.ts       404 for unmatched routes
  core/               PURE logic. No Prisma, no Express. Unit-testable today.
    money.ts          decimal.js helpers - never use floats for currency
    warnings.ts       The payslip warning catalog and severities
    contract-resolution.ts   CRITICAL #1 - which contract applies to a period
    formula.ts        Safe formula evaluation (never eval)
    salary-engine.ts  CRITICAL #2 - the rule engine
  modules/            One folder per domain: routes + service
  lib/
    prisma.ts         Lazy Prisma accessor
    logger.ts         Tiny leveled logger
tests/
  permission-wall.test.ts   The role wall, provable with no database
```

## Conventions

**Every response uses the envelope.** Never `res.json(x)` directly - use
`sendData`, `sendCreated`, `sendList`. Errors are thrown, never returned:
`throw notFound('Employee not found')` and the central handler renders it.

**Business logic lives in service files, not route handlers.** A route reads
the request, calls one service function, and sends the result.

**The `core/` folder never imports Prisma.** Plain objects in, plain values
out. That is what lets the salary engine be tested exhaustively without a
database - and the engine is the code that most needs testing.

**Money is `Decimal`, always.** `core/money.ts` for arithmetic, Prisma
`Decimal(12, 2)` for storage. A float on a payslip is a bug you will find at
the worst moment.

**Roles are enforced here, never in the frontend.** The frontend hides menus
for usability; this server decides. `npm test` proves it.

## Permission model

Named groups in `config/roles.ts` come straight from the permission matrix in
`00_SHARED_CONTRACT.md`. Routes reference the groups, so the matrix lives in
exactly one place.

The rule that gets tested live: **HR_MANAGER has zero access to
salary-structures, salary-rules, payruns, payslips and dashboard.** All five
answer 403. `tests/permission-wall.test.ts` asserts each one.

Second rule: **HR_PAYROLL_USER can read salary config but not write it** - the
read and write guards are applied per route rather than once at the router.

## Implementation status

Done and working:

- Response envelope, error taxonomy, central error handler
- Environment config, graceful shutdown, health endpoint
- `requireAuth` / `requireRole` / `scopeToSelf` / `validate`
- Every locked endpoint routed with its correct role guard
- Money helpers, warning catalog
- Permission wall test suite

Stubbed - each route answers `500 Not implemented yet` and each file carries a
TODO listing the service functions to write:

- All service layers (auth, employees, contracts, schedules, attendance,
  time off, salary config, payruns, payslips, grievances, dashboard)
- `core/contract-resolution.ts`, `core/formula.ts`, `core/salary-engine.ts`

Suggested order: the three `core/` files first. They are pure functions with no
database dependency, they carry their own TODO test lists, and they are the
hardest logic in the project - having them finished and tested before the
schema lands turns the rest into wiring.
