'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock3, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BranchToggle } from '@/modules/dashboard/branch-toggle';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { FollowUp, Task } from '@/types/foundation';

export function Header() {
  const { session, setSession, selectedBranchId } = useSessionStore();
  const [popup, setPopup] = useState<{ key: string; kind: 'Followup' | 'Task'; title: string; detail: string; dueAt: string } | null>(null);
  const reminderParams = new URLSearchParams();
  if (selectedBranchId) reminderParams.set('branchId', selectedBranchId);
  if (session?.user.role === 'RECEPTIONIST') reminderParams.set('assignedUserId', session.user.id);
  reminderParams.set('scope', 'ALL');
  const reminderQuery = useQuery({
    queryKey: ['header-reminders', selectedBranchId, session?.user.id],
    queryFn: async () => {
      const [followUps, tasks] = await Promise.all([
        apiRequest<{ data: FollowUp[] }>(`/follow-ups?${reminderParams}`),
        apiRequest<{ data: Task[] }>(`/tasks?${reminderParams}`),
      ]);
      const now = Date.now();
      const activeFollowUps = followUps.data.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status));
      const activeTasks = tasks.data.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status));
      const dueItems = [...activeFollowUps, ...activeTasks].filter((item) => new Date(item.reminderAt || item.dueAt).getTime() <= now);
      const alerts = [
        ...activeFollowUps.filter((item) => new Date(item.reminderAt || item.dueAt).getTime() <= now).map((item) => ({
          key: `due-followup-${item.id}`, kind: 'Followup' as const, title: item.activityType,
          detail: `${item.person.fullName} · ${item.notes || 'Scheduled followup is ready'}`, dueAt: item.dueAt,
        })),
        ...activeTasks.filter((item) => new Date(item.reminderAt || item.dueAt).getTime() <= now).map((item) => ({
          key: `due-task-${item.id}`, kind: 'Task' as const, title: item.title,
          detail: item.description || 'Assigned task is ready for action', dueAt: item.dueAt,
        })),
        ...activeTasks.filter((item) => item.assignedUser.id === session?.user.id && item.createdAt && now - new Date(item.createdAt).getTime() <= 120_000).map((item) => ({
          key: `assigned-task-${item.id}`, kind: 'Task' as const, title: 'New task assigned',
          detail: item.title, dueAt: item.dueAt,
        })),
      ].sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime());
      return { count: dueItems.length, alerts };
    },
    enabled: Boolean(session && (session.user.role === 'ADMIN' || selectedBranchId)),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (popup || !reminderQuery.data?.alerts.length) return;
    const next = reminderQuery.data.alerts.find((alert) => window.sessionStorage.getItem(`revive-alert:${alert.key}`) !== 'seen');
    if (!next) return;
    window.sessionStorage.setItem(`revive-alert:${next.key}`, 'seen');
    setPopup(next);
  }, [popup, reminderQuery.data]);

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="hidden min-w-0 sm:block">
        <div className="text-sm text-muted-foreground">Signed in as</div>
        <div className="font-medium">{session?.user.name ?? 'Team member'}</div>
      </div>
      <div className="flex items-center gap-3">
        <BranchToggle className="w-36 sm:w-44" />
        <Link href="/notifications" aria-label="Open notifications and followups" title="Notifications and followups" className="relative grid size-10 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Bell className="size-4" />
          {(reminderQuery.data?.count ?? 0) > 0 ? <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-5 text-white">{Math.min(reminderQuery.data?.count ?? 0, 99)}</span> : null}
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
      {popup ? (
        <div role="alertdialog" aria-label={`${popup.kind} notification`} className="fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-primary/25 bg-surface p-4 shadow-2xl shadow-black/15">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{popup.kind === 'Task' ? <CheckCircle2 className="size-5" /> : <Clock3 className="size-5" />}</span>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{popup.kind} notification</p><h2 className="mt-1 font-semibold">{popup.title}</h2><p className="mt-1 text-sm text-muted-foreground">{popup.detail}</p><p className="mt-2 text-xs font-medium">Due {new Date(popup.dueAt).toLocaleString('en-IN')}</p></div>
            <button type="button" aria-label="Dismiss notification" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={() => setPopup(null)}><X className="size-4" /></button>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setPopup(null)}>Dismiss</Button><Link href="/notifications" onClick={() => setPopup(null)} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-white">Open inbox</Link></div>
        </div>
      ) : null}
    </header>
  );
}
