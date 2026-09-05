# PeoplePay360

HR & Payroll management system - Odoo Hackathon 2026.

## Stack

| Layer | Tech |
|---|---|
| Database | PostgreSQL 16 |
| ORM / Schema | Prisma |
| Backend | Node.js + Express (TypeScript) |
| Auth | JWT (Bearer token) |
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| PDF | pdfkit (backend-generated) |
| Charts | Recharts |

Backend runs on `http://localhost:4000`, frontend on `http://localhost:5173`.
API base path: `/api/v1`.

## Repository layout

| Path | Owner |
|---|---|
| `prisma/schema.prisma` | Person 1 - Database |
| `prisma/seed.ts` | Person 1 - Database |
| `shared/types.ts` | Person 1 generates, everyone imports |
| `server/` | Person 2 - Backend |
| `client/` | Person 3 - Frontend |

Nobody edits a folder they don't own.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Only merged, working code |
| `feature/database` | Person 1 |
| `feature/backend` | Person 2 |
| `feature/frontend` | Person 3 |

Branch off `main`, open a PR back into `main`.

## Getting started

```bash
git clone https://github.com/bhupendrasharmaX/Odoo-Hackathon-2026-Finalist.git
cd Odoo-Hackathon-2026-Finalist
git checkout <your-feature-branch>
```

Per-area setup lives in each folder's own README (see `server/README.md`).

## Shared contract

Model names, enums, role strings, the API response envelope and the endpoint
list are locked in `00_SHARED_CONTRACT.md`. Nobody changes that file alone -
all three agree first, then it gets updated.
