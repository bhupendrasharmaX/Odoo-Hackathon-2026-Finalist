import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, RequireRole } from './auth/ProtectedRoute';
import { ToastProvider } from './components/Toast';
import { AppLayout } from './layouts/AppLayout';

import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { EmployeesPage } from './pages/Employees';
import { EmployeeDetailPage } from './pages/EmployeeDetail';
import { ContractsPage } from './pages/Contracts';
import { SchedulesPage } from './pages/Schedules';
import { AttendancePage } from './pages/Attendance';
import { TimeOffPage } from './pages/TimeOff';
import { AllocationsPage } from './pages/Allocations';
import { TimeOffTypesPage } from './pages/TimeOffTypes';
import { PayrunsPage } from './pages/Payruns';
import { PayrunWizardPage } from './pages/PayrunWizard';
import { PayrunDetailPage } from './pages/PayrunDetail';
import { PayslipsPage } from './pages/Payslips';
import { PayslipDetailPage } from './pages/PayslipDetail';
import { StructuresPage } from './pages/Structures';
import { StructureDetailPage } from './pages/StructureDetail';
import { SalaryRulesPage } from './pages/SalaryRules';
import { GrievancesPage } from './pages/Grievances';
import { UsersPage } from './pages/Users';
import { SettingsPage } from './pages/Settings';
import { NotFoundPage } from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomePage />} />

              {/* People */}
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="employees/:id" element={<EmployeeDetailPage />} />
              <Route
                path="contracts"
                element={
                  <RequireRole group="HR_PLUS">
                    <ContractsPage />
                  </RequireRole>
                }
              />
              <Route
                path="schedules"
                element={
                  <RequireRole group="HR_PLUS">
                    <SchedulesPage />
                  </RequireRole>
                }
              />

              {/* Attendance & time off */}
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="time-off" element={<TimeOffPage />} />
              <Route path="time-off/allocations" element={<AllocationsPage />} />
              <Route
                path="time-off/types"
                element={
                  <RequireRole group="HR_PLUS">
                    <TimeOffTypesPage />
                  </RequireRole>
                }
              />

              {/* Payroll - HR_MANAGER is walled out of everything below */}
              <Route
                path="payroll/payruns"
                element={
                  <RequireRole group="PAYROLL">
                    <PayrunsPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/payruns/new"
                element={
                  <RequireRole group="PAYROLL">
                    <PayrunWizardPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/payruns/:id"
                element={
                  <RequireRole group="PAYROLL">
                    <PayrunDetailPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/payslips"
                element={
                  <RequireRole group="PAYSLIP_READ">
                    <PayslipsPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/payslips/:id"
                element={
                  <RequireRole group="PAYSLIP_READ">
                    <PayslipDetailPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/structures"
                element={
                  <RequireRole group="SALARY_READ">
                    <StructuresPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/structures/:id"
                element={
                  <RequireRole group="SALARY_READ">
                    <StructureDetailPage />
                  </RequireRole>
                }
              />
              <Route
                path="payroll/rules"
                element={
                  <RequireRole group="SALARY_READ">
                    <SalaryRulesPage />
                  </RequireRole>
                }
              />

              {/* Everything else */}
              <Route path="grievances" element={<GrievancesPage />} />
              <Route
                path="users"
                element={
                  <RequireRole group="ADMIN_ONLY">
                    <UsersPage />
                  </RequireRole>
                }
              />
              <Route path="settings" element={<SettingsPage />} />

              {/* Legacy paths from the earlier prototype. */}
              <Route path="payroll" element={<Navigate to="/payroll/payslips" replace />} />
              <Route path="leaves" element={<Navigate to="/time-off" replace />} />

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
