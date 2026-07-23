import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { TasksView } from '@/modules/tasks/tasks-view';
export default function TasksPage() { return <AuthGate><AppShell><TasksView /></AppShell></AuthGate>; }

