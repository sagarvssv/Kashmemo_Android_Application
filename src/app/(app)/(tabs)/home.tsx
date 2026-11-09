import React from 'react';

import { useCurrentUser } from '@/context/session';
import { EmployeeDashboard } from '@/features/dashboard/employee-dashboard';
import { FinanceDashboard } from '@/features/dashboard/finance-dashboard';
import { ManagerDashboard } from '@/features/dashboard/manager-dashboard';
import { OrgDashboard } from '@/features/dashboard/org-dashboard';

export default function HomeScreen() {
  const user = useCurrentUser();

  switch (user.role) {
    case 'CEO':
    case 'HR':
      return <OrgDashboard />;
    case 'FINANCE_MANAGER':
      return <FinanceDashboard />;
    case 'MANAGER':
      return <ManagerDashboard />;
    default:
      return <EmployeeDashboard />;
  }
}
