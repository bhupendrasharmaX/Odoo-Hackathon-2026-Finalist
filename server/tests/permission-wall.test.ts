import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import type { Role } from '../src/config/roles';

/**
 * THE WALL, as a test.
 *
 * This suite needs no database and no Prisma client - it drives the middleware
 * stack directly. That is the point: the permission rules are enforced in
 * middleware, so they are provable before a single row exists.
 *
 * A route that is allowed answers 500 "Not implemented yet" for now. That is a
 * pass: what matters here is that it did NOT answer 403.
 */

const app = createApp();
const BASE = '/api/v1';

function tokenFor(role: Role, employeeId = 'emp-self'): string {
  return jwt.sign(
    {
      userId: `user-${role.toLowerCase()}`,
      employeeId,
      role,
      email: `${role.toLowerCase()}@peoplepay.com`,
      name: role,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

const auth = (role: Role, employeeId?: string) => ({
  Authorization: `Bearer ${tokenFor(role, employeeId)}`,
});

describe('health', () => {
  it('answers without a token and uses the locked envelope', async () => {
    const response = await request(app).get(`${BASE}/health`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });
});

describe('authentication', () => {
  it('rejects a missing token with 401 UNAUTHORIZED', async () => {
    const response = await request(app).get(`${BASE}/payruns`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: 'x', role: 'ADMIN', email: 'x@y.z' }, 'not-the-secret');
    const response = await request(app)
      .get(`${BASE}/payruns`)
      .set('Authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 NOT_FOUND for an unknown route', async () => {
    const response = await request(app).get(`${BASE}/does-not-exist`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('THE WALL: HR_MANAGER has zero payroll access', () => {
  const walled = [
    ['get', '/salary-structures'],
    ['get', '/salary-rules'],
    ['get', '/payruns'],
    ['get', '/payslips'],
    ['get', '/dashboard'],
  ] as const;

  it.each(walled)('%s %s returns 403', async (method, path) => {
    const response = await request(app)[method](`${BASE}${path}`).set(auth('HR_MANAGER'));

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('still allows HR_MANAGER into the people-ops modules', async () => {
    const response = await request(app).get(`${BASE}/employees`).set(auth('HR_MANAGER'));

    expect(response.status).not.toBe(403);
  });
});

describe('HR_PAYROLL_USER is read-only on salary config', () => {
  it('may read salary structures', async () => {
    const response = await request(app)
      .get(`${BASE}/salary-structures`)
      .set(auth('HR_PAYROLL_USER'));

    expect(response.status).not.toBe(403);
  });

  it('may not create a salary structure', async () => {
    const response = await request(app)
      .post(`${BASE}/salary-structures`)
      .set(auth('HR_PAYROLL_USER'))
      .send({ name: 'Regular Salary' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('may not update a salary rule', async () => {
    const response = await request(app)
      .patch(`${BASE}/salary-rules/rule-1`)
      .set(auth('HR_PAYROLL_USER'))
      .send({ amount: 1 });

    expect(response.status).toBe(403);
  });

  it('has full access to payruns', async () => {
    const response = await request(app).get(`${BASE}/payruns`).set(auth('HR_PAYROLL_USER'));

    expect(response.status).not.toBe(403);
  });
});

describe('/users is ADMIN only', () => {
  it.each(['EMPLOYEE', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER'] as const)(
    'rejects %s',
    async (role) => {
      const response = await request(app).get(`${BASE}/users`).set(auth(role));

      expect(response.status).toBe(403);
    },
  );

  it('admits ADMIN', async () => {
    const response = await request(app).get(`${BASE}/users`).set(auth('ADMIN'));

    expect(response.status).not.toBe(403);
  });
});

describe('EMPLOYEE is scoped to their own records', () => {
  it('403s when reading another employee by id', async () => {
    const response = await request(app)
      .get(`${BASE}/employees/someone-else`)
      .set(auth('EMPLOYEE', 'emp-self'));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows reading their own record', async () => {
    const response = await request(app)
      .get(`${BASE}/employees/emp-self`)
      .set(auth('EMPLOYEE', 'emp-self'));

    expect(response.status).not.toBe(403);
  });

  it('403s on another employee time-off balance', async () => {
    const response = await request(app)
      .get(`${BASE}/timeoff/balance/someone-else`)
      .set(auth('EMPLOYEE', 'emp-self'));

    expect(response.status).toBe(403);
  });

  it('may read their own payslips but not the dashboard', async () => {
    const payslips = await request(app).get(`${BASE}/payslips`).set(auth('EMPLOYEE'));
    const dashboard = await request(app).get(`${BASE}/dashboard`).set(auth('EMPLOYEE'));

    expect(payslips.status).not.toBe(403);
    expect(dashboard.status).toBe(403);
  });
});
