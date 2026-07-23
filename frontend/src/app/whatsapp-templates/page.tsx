'use client';
import { AppShell } from '@/components/layout/app-shell'; import { AuthGate } from '@/components/layout/auth-gate'; import { RoleGate } from '@/components/layout/role-gate'; import { CommunicationCentreView } from '@/modules/communication/communication-centre-view';
export default function WhatsAppTemplatesPage() { return <AuthGate><AppShell><RoleGate allowed={['ADMIN']}><CommunicationCentreView initialTab="templates" /></RoleGate></AppShell></AuthGate>; }
