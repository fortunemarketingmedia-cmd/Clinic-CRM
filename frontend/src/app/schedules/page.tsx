import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { SchedulesView } from '@/modules/front-desk/schedules-view';
export default function SchedulesPage() { return <AuthGate><AppShell><SchedulesView /></AppShell></AuthGate>; }
