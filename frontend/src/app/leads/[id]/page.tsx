import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { LeadProfileView } from '@/modules/leads/lead-profile-view';
export default async function LeadProfilePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AuthGate><AppShell><LeadProfileView leadId={id} /></AppShell></AuthGate>; }
