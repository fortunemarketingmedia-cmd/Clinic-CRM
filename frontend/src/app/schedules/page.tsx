import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { SchedulesView } from '@/modules/front-desk/schedules-view';
import { RoleGate } from '@/components/layout/role-gate';
export default function SchedulesPage() { return <AuthGate><RoleGate allowed={['ADMIN', 'RECEPTIONIST']}><AppShell><SchedulesView /></AppShell></RoleGate></AuthGate>; }
