import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { WaitlistView } from '@/modules/front-desk/waitlist-view';
export default function WaitlistPage() { return <AuthGate><AppShell><WaitlistView /></AppShell></AuthGate>; }
