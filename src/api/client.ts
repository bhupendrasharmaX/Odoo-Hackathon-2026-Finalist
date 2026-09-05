import axios, { AxiosError } from 'axios';
import type {
  Allocation,
  Attendance,
  AttendanceActive,
  ComputeResult,
  Contract,
  Dashboard,
  DashboardFilterOptions,
  Department,
  EligibleResult,
  Employee,
  EmployeeSummary,
  Grievance,
  LoginResult,
  Meta,
  MeResult,
  Paged,
  Payrun,
  PayrunDetail,
  Payslip,
  Role,
  SalaryRule,
  SalaryRuleInput,
  SalaryStructure,
  ScheduleLine,
  SendResult,
  TimeOffBalance,
  TimeOffRequest,
  TimeOffType,
  User,
  WorkingSchedule,
} from '../types';

export const TOKEN_KEY = 'pp360_token';
export const USER_KEY = 'pp360_user';

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export const http = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * The API's error envelope is `{ success: false, error: { code, message } }`.
 * Everything below rejects with a plain `Error` carrying that message, plus a
 * `code` so callers can branch on FORBIDDEN without string-matching.
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function onUnauthorized(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // A hard redirect rather than a router navigate: the interceptor lives
  // outside React, and the token is already gone either way.
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string; details?: unknown } }>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data?.error;

    // A 401 on /auth/me during boot is normal (expired token) and must not
    // bounce the user mid-render; every other 401 means the session is dead.
    if (status === 401 && !error.config?.url?.endsWith('/auth/me')) {
      onUnauthorized();
    }

    throw new ApiError(
      body?.message ?? error.message ?? 'Network error - is the API running?',
      body?.code ?? (status === 0 ? 'NETWORK' : 'UNKNOWN'),
      status,
      body?.details,
    );
  },
);

// ---------------------------------------------------------------------
// Envelope unwrapping
// ---------------------------------------------------------------------

type Params = Record<string, string | number | boolean | undefined | null>;

/** Drops empty filter values so `?status=` never reaches the server. */
function clean(params?: Params): Params | undefined {
  if (!params) return undefined;
  const out: Params = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

async function get<T>(url: string, params?: Params): Promise<T> {
  const res = await http.get(url, { params: clean(params) });
  return res.data.data as T;
}

async function getPaged<T>(url: string, params?: Params): Promise<Paged<T>> {
  const res = await http.get(url, { params: clean(params) });
  return { data: res.data.data as T[], meta: res.data.meta as Meta };
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post(url, body ?? {});
  return res.data.data as T;
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  const res = await http.patch(url, body);
  return res.data.data as T;
}

// ---------------------------------------------------------------------
// The API surface, grouped exactly as the server's routes.ts is
// ---------------------------------------------------------------------

export const api = {
  health: () => get<{ status: string; database: string }>('/health'),

  auth: {
    login: (email: string, password: string) => post<LoginResult>('/auth/login', { email, password }),
    me: () => get<MeResult>('/auth/me'),
  },

  users: {
    list: (params?: { search?: string; role?: Role; page?: number; limit?: number }) =>
      getPaged<User>('/users', params as Params),
    create: (body: {
      email: string;
      password: string;
      name: string;
      role: Role;
      employeeId?: string | null;
    }) => post<User>('/users', body),
    changeRole: (id: string, role: Role) => patch<User>(`/users/${id}/role`, { role }),
  },

  employees: {
    list: (params?: {
      search?: string;
      department?: string;
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
    }) => getPaged<Employee>('/employees', params as Params),
    get: (id: string) => get<Employee>(`/employees/${id}`),
    summary: (id: string) => get<EmployeeSummary>(`/employees/${id}/summary`),
    create: (body: Partial<Employee>) => post<Employee>('/employees', body),
    update: (id: string, body: Partial<Employee>) => patch<Employee>(`/employees/${id}`, body),
    departments: () => get<Department[]>('/employees/departments'),
  },

  contracts: {
    list: (params?: { employeeId?: string; status?: string; page?: number; limit?: number }) =>
      getPaged<Contract>('/contracts', params as Params),
    get: (id: string) => get<Contract>(`/contracts/${id}`),
    create: (body: Partial<Contract>) => post<Contract>('/contracts', body),
    update: (id: string, body: Partial<Contract>) => patch<Contract>(`/contracts/${id}`, body),
  },

  schedules: {
    list: (params?: { page?: number; limit?: number }) =>
      getPaged<WorkingSchedule>('/schedules', params as Params),
    get: (id: string) => get<WorkingSchedule>(`/schedules/${id}`),
    create: (body: { name: string; lines: ScheduleLine[] }) =>
      post<WorkingSchedule>('/schedules', body),
    update: (id: string, body: { name?: string; lines?: ScheduleLine[] }) =>
      patch<WorkingSchedule>(`/schedules/${id}`, body),
  },

  attendance: {
    list: (params?: {
      employeeId?: string;
      from?: string;
      to?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) => getPaged<Attendance>('/attendance', params as Params),
    active: () => get<AttendanceActive>('/attendance/active'),
    checkIn: () => post<Attendance>('/attendance/check-in'),
    checkOut: () => post<Attendance>('/attendance/check-out'),
    create: (body: {
      employeeId: string;
      checkIn: string;
      checkOut?: string | null;
      status?: string;
      notes?: string | null;
    }) => post<Attendance>('/attendance', body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<Attendance>(`/attendance/${id}`, body),
  },

  timeoff: {
    types: () => get<TimeOffType[]>('/timeoff/types'),
    createType: (body: {
      name: string;
      unit: string;
      requiresAllocation: boolean;
      isPaid: boolean;
      color?: string | null;
    }) => post<TimeOffType>('/timeoff/types', body),

    allocations: (params?: {
      employeeId?: string;
      timeOffTypeId?: string;
      page?: number;
      limit?: number;
    }) => getPaged<Allocation>('/timeoff/allocations', params as Params),
    createAllocation: (body: {
      employeeId: string;
      timeOffTypeId: string;
      allocatedDays: number;
      validFrom: string;
      validTo: string;
      status?: string;
    }) => post<Allocation>('/timeoff/allocations', body),
    approveAllocation: (id: string) => post<Allocation>(`/timeoff/allocations/${id}/approve`),

    requests: (params?: {
      employeeId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) => getPaged<TimeOffRequest>('/timeoff/requests', params as Params),
    createRequest: (body: {
      employeeId?: string;
      timeOffTypeId: string;
      allocationId?: string | null;
      dateFrom: string;
      dateTo: string;
      reason?: string | null;
    }) => post<TimeOffRequest>('/timeoff/requests', body),
    approveRequest: (id: string) => post<TimeOffRequest>(`/timeoff/requests/${id}/approve`),
    refuseRequest: (id: string) => post<TimeOffRequest>(`/timeoff/requests/${id}/refuse`),
    balance: (employeeId: string) => get<TimeOffBalance>(`/timeoff/balance/${employeeId}`),
  },

  salary: {
    structures: (params?: { page?: number; limit?: number }) =>
      getPaged<SalaryStructure>('/salary-structures', params as Params),
    structure: (id: string) => get<SalaryStructure>(`/salary-structures/${id}`),
    createStructure: (body: { name: string; rules: SalaryRuleInput[] }) =>
      post<SalaryStructure>('/salary-structures', body),
    updateStructure: (id: string, body: { name?: string; rules?: SalaryRuleInput[] }) =>
      patch<SalaryStructure>(`/salary-structures/${id}`, body),

    rules: (params?: { structureId?: string; page?: number; limit?: number }) =>
      getPaged<SalaryRule>('/salary-rules', params as Params),
    createRule: (body: SalaryRuleInput & { structureId: string }) =>
      post<SalaryRule>('/salary-rules', body),
    updateRule: (id: string, body: Partial<SalaryRuleInput>) =>
      patch<SalaryRule>(`/salary-rules/${id}`, body),
  },

  payruns: {
    list: (params?: { status?: string; period?: string; page?: number; limit?: number }) =>
      getPaged<Payrun>('/payruns', params as Params),
    get: (id: string) => get<PayrunDetail>(`/payruns/${id}`),
    /** Preview only - creates nothing. */
    eligible: (body: { salaryStructureId: string; periodStart: string; periodEnd: string }) =>
      post<EligibleResult>('/payruns/eligible-employees', body),
    create: (body: {
      name: string;
      salaryStructureId: string;
      periodStart: string;
      periodEnd: string;
      employeeIds: string[];
    }) => post<PayrunDetail>('/payruns', body),
    compute: (id: string) => post<ComputeResult>(`/payruns/${id}/compute`),
    validate: (id: string) => post<PayrunDetail>(`/payruns/${id}/validate`),
    markPaid: (id: string) => post<PayrunDetail>(`/payruns/${id}/mark-paid`),
    sendPayslips: (id: string) => post<SendResult>(`/payruns/${id}/send-payslips`),
  },

  payslips: {
    list: (params?: {
      payrunId?: string;
      employeeId?: string;
      period?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) => getPaged<Payslip>('/payslips', params as Params),
    get: (id: string) => get<Payslip>(`/payslips/${id}`),
    /** The one endpoint that does not use the envelope - it returns a file. */
    pdf: async (id: string, filename: string) => {
      const res = await http.get(`/payslips/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on the next tick so the download has already started.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  },

  grievances: {
    list: (params?: {
      employeeId?: string;
      status?: string;
      payslipId?: string;
      page?: number;
      limit?: number;
    }) => getPaged<Grievance>('/grievances', params as Params),
    create: (body: {
      employeeId?: string;
      payslipId?: string | null;
      subject: string;
      description: string;
    }) => post<Grievance>('/grievances', body),
    update: (id: string, body: { status?: string; response?: string | null }) =>
      patch<Grievance>(`/grievances/${id}`, body),
  },

  dashboard: {
    get: (params?: { period?: string; departmentId?: string; employeeType?: string }) =>
      get<Dashboard>('/dashboard', params as Params),
    filters: () => get<DashboardFilterOptions>('/dashboard/filters'),
  },
};

export default api;
