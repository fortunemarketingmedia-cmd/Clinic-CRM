import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { DoctorWorkspaceView } from '@/modules/patients/doctor-workspace-view';

export default function DoctorWorkspacePage() { return <AuthGate><AppShell><DoctorWorkspaceView /></AppShell></AuthGate>; }
