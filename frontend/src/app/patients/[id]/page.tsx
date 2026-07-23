import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { Patient360View } from '@/modules/patients/patient-360-view';

export default async function Patient360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthGate><AppShell><Patient360View patientId={id} /></AppShell></AuthGate>;
}
