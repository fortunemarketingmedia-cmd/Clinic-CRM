import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { NotificationsView } from '@/modules/notifications/notifications-view';

export default function NotificationsPage() {
  return <AuthGate><AppShell><NotificationsView /></AppShell></AuthGate>;
}
