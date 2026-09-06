import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { PayrollDashboard } from './Dashboard';
import { PeopleOverview } from './PeopleOverview';
import { MyWorkspace } from './MyWorkspace';

/**
 * The landing screen depends on what the caller may actually see.
 *
 * `GET /dashboard` is payroll-scoped and refuses HR_MANAGER and EMPLOYEE, so
 * neither of them is shown a panel that would only 403 - each gets the
 * overview built from endpoints their role can read.
 */
export function HomePage() {
  const { role } = useAuth();

  if (CAN.viewDashboard(role)) return <PayrollDashboard />;
  if (CAN.viewPeople(role)) return <PeopleOverview />;
  return <MyWorkspace />;
}
