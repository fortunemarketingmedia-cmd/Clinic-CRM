'use client';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { RoleGate } from '@/components/layout/role-gate';
import { CommunicationCentreView } from '@/modules/communication/communication-centre-view';
const roles = ['ADMIN', 'ORGANISATION_OWNER', 'CLINIC_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST', 'LEAD_COUNSELLOR', 'MARKETING_USER', 'SUPPORT_EXECUTIVE'] as const;
export default function CommunicationCentrePage() { return <AuthGate><AppShell><RoleGate allowed={[...roles]}><CommunicationCentreView /></RoleGate></AppShell></AuthGate>; }
