import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { LeadScoringView } from '@/modules/settings/lead-scoring-view';
export default function LeadScoringPage() { return <AuthGate><AppShell><RoleGate allowed={['ADMIN']}><LeadScoringView /></RoleGate></AppShell></AuthGate>; }
