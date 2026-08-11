'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { FollowUp, Task } from '@/types/foundation';

export function Header() {
  const { session, setSession, selectedBranchId } = useSessionStore();
  const reminderParams = new URLSearchParams();
  if (selectedBranchId) reminderParams.set('branchId', selectedBranchId);
  if (session?.user.role === 'RECEPTIONIST') reminderParams.set('assignedUserId', session.user.id);
  const reminderQuery = useQuery({
    queryKey: ['header-reminders', selectedBranchId, session?.user.id],
    queryFn: async () => {
      const [followUps, tasks] = await Promise.all([
        apiRequest<{ data: FollowUp[] }>(`/follow-ups?${reminderParams}`),
        apiRequest<{ data: Task[] }>(`/tasks?${reminderParams}`),
      ]);
      const now = Date.now();
      return [...followUps.data, ...tasks.data].filter((item) =>
        !['COMPLETED', 'CANCELLED'].includes(item.status) &&
        new Date(item.reminderAt || item.dueAt).getTime() <= now,
      ).length;
    },
    enabled: Boolean(session && (session.user.role === 'ADMIN' || selectedBranchId)),
    refetchInterval: 30_000,
  });

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div>
        <div className="text-sm text-muted-foreground">Signed in as</div>
        <div className="font-medium">{session?.user.name ?? 'Team member'}</div>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/notifications" aria-label="Open notifications and reminders" title="Notifications and reminders" className="relative grid size-10 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Bell className="size-4" />
          {(reminderQuery.data ?? 0) > 0 ? <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-5 text-white">{Math.min(reminderQuery.data ?? 0, 99)}</span> : null}
        </Link>
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
