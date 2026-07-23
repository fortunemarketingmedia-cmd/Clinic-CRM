import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { FollowUpsView } from '@/modules/follow-ups/follow-ups-view';
export default function FollowUpsPage() { return <AuthGate><AppShell><FollowUpsView /></AppShell></AuthGate>; }

