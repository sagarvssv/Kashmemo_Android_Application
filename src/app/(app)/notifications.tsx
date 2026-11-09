import React from 'react';

import { NotificationsScreen } from '@/features/notifications/notifications-screen';

// Opened from the bell on Home; slides in over the tabs with a back button.
export default function NotificationsRoute() {
  return <NotificationsScreen showBack />;
}
