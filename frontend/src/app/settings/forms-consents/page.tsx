import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { FormsConsentsSettingsView } from '@/modules/settings/forms-consents-settings-view';

export default function FormsConsentsSettingsPage() { return <AuthGate><AppShell><FormsConsentsSettingsView /></AppShell></AuthGate>; }
