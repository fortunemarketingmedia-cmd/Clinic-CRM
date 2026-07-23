import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { TodayQueueView } from '@/modules/front-desk/today-queue-view';
export default function TodayQueuePage() { return <AuthGate><AppShell><TodayQueueView /></AppShell></AuthGate>; }
