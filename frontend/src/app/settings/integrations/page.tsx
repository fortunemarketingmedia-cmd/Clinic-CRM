'use client';
import { AppShell } from '@/components/layout/app-shell'; import { AuthGate } from '@/components/layout/auth-gate'; import { RoleGate } from '@/components/layout/role-gate'; import { CommunicationCentreView } from '@/modules/communication/communication-centre-view';
export default function IntegrationsPage() { return <AuthGate><AppShell><RoleGate allowed={['DEVELOPER']}><CommunicationCentreView initialTab="integration" /></RoleGate></AppShell></AuthGate>; }
