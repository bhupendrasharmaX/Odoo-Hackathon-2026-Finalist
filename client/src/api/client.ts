import axios from 'axios';
import type { ApiResponse } from '../types';

/**
 * Axios instance for PeoplePay360 backend.
 * - baseURL: http://localhost:4000/api/v1
 * - Attaches Bearer token from localStorage
 * - Unwraps the { success, data } envelope
 * - Throws on { success: false }
 */
const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp360_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap envelope
apiClient.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiResponse<unknown>;
    if (envelope.success === false) {
      return Promise.reject(new Error(envelope.message || 'Request failed'));
    }
    return envelope.data as any;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pp360_token');
      localStorage.removeItem('pp360_user');
      window.location.href = '/login';
    }
    const msg =
      error.response?.data?.message || error.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

export default apiClient;

// --- Real API functions ---
import type {
  LoginResponse,
  Employee,
  PayrollRun,
  Payslip,
  AttendanceRecord,
  LeaveRequest,
  Department,
  DashboardStats,
} from '../types';

export const realApi = {
  // Auth
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiClient.post('/auth/login', { email, password }),

  // Dashboard
  getDashboardStats: (): Promise<DashboardStats> =>
    apiClient.get('/dashboard/stats'),

  // Employees
  getEmployees: (): Promise<Employee[]> => apiClient.get('/employees'),
  getEmployee: (id: string): Promise<Employee> =>
    apiClient.get(`/employees/${id}`),
  createEmployee: (data: Partial<Employee>): Promise<Employee> =>
    apiClient.post('/employees', data),
  updateEmployee: (id: string, data: Partial<Employee>): Promise<Employee> =>
    apiClient.put(`/employees/${id}`, data),
  deleteEmployee: (id: string): Promise<void> =>
    apiClient.delete(`/employees/${id}`),

  // Payroll
  getPayrollRuns: (): Promise<PayrollRun[]> => apiClient.get('/payroll/runs'),
  getPayslips: (runId: string): Promise<Payslip[]> =>
    apiClient.get(`/payroll/runs/${runId}/payslips`),
  createPayrollRun: (data: {
    month: number;
    year: number;
  }): Promise<PayrollRun> => apiClient.post('/payroll/runs', data),
  approvePayrollRun: (runId: string): Promise<PayrollRun> =>
    apiClient.post(`/payroll/runs/${runId}/approve`),
  rejectPayrollRun: (runId: string): Promise<PayrollRun> =>
    apiClient.post(`/payroll/runs/${runId}/reject`),

  // Attendance
  getAttendance: (date: string): Promise<AttendanceRecord[]> =>
    apiClient.get(`/attendance?date=${date}`),

  // Leaves
  getLeaveRequests: (): Promise<LeaveRequest[]> => apiClient.get('/leaves'),
  createLeaveRequest: (data: Partial<LeaveRequest>): Promise<LeaveRequest> =>
    apiClient.post('/leaves', data),
  approveLeave: (id: string): Promise<LeaveRequest> =>
    apiClient.post(`/leaves/${id}/approve`),
  rejectLeave: (id: string): Promise<LeaveRequest> =>
    apiClient.post(`/leaves/${id}/reject`),

  // Departments
  getDepartments: (): Promise<Department[]> => apiClient.get('/departments'),
  createDepartment: (data: Partial<Department>): Promise<Department> =>
    apiClient.post('/departments', data),
};
