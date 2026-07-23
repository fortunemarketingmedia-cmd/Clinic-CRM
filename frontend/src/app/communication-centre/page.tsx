'use client';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { CommunicationCentreView } from '@/modules/communication/communication-centre-view';
const roles = ['ADMIN', 'RECEPTIONIST'] as const;
export default function CommunicationCentrePage() { return <AuthGate><AppShell><RoleGate allowed={[...roles]}><CommunicationCentreView /></RoleGate></AppShell></AuthGate>; }
