'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BranchToggle } from '@/modules/dashboard/branch-toggle';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';

export function Header() {
  const { session, setSession } = useSessionStore();

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div>
        <div className="text-sm text-muted-foreground">Signed in as</div>
        <div className="font-medium">{session?.user.name ?? 'Team member'}</div>
      </div>
      <div className="flex items-center gap-3">
        {session?.user.role === 'RECEPTIONIST' ? <BranchToggle /> : null}
        <Button
          aria-label="Logout"
          title="Logout"
          variant="secondary"
          onClick={async () => {
            await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
            setSession(null);
          }}
          className="w-10 px-0"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
