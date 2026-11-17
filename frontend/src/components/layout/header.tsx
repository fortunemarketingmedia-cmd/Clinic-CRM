'use client';

import { Bell, CalendarPlus, CheckCircle2, ChevronDown, Clock3, ListChecks, LogOut, Menu, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useQuickAction, type QuickAction } from '@/components/layout/quick-actions';
import { BranchToggle } from '@/modules/dashboard/branch-toggle';
import { REMINDER_POPUP_EVENT, useReminderNotifications, type ReminderAlert } from '@/modules/notifications/use-reminder-notifications';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';

function ProfileMenu() {
  const { session, setSession } = useSessionStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = session?.user.name ?? 'Team member';
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const role = (session?.user.role ?? '').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === 'Escape') setOpen(false); return; }
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex h-10 items-center gap-2 rounded-full bg-white/80 pl-1.5 pr-3 ring-1 ring-white transition-colors hover:bg-white">
        <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{initials || 'U'}</span>
        <span className="hidden text-left leading-tight sm:block"><span className="block max-w-32 truncate text-[13px] font-medium">{name}</span><span className="block text-[11px] text-muted-foreground">{role}</span></span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
          <div className="border-b border-border px-3 py-2"><div className="truncate text-sm font-medium">{name}</div><div className="text-xs text-muted-foreground">{role}</div></div>
          <button type="button" role="menuitem" className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={async () => { await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined); setSession(null); }}>
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [popup, setPopup] = useState<ReminderAlert | null>(null);
  const reminderQuery = useReminderNotifications();

  useEffect(() => {
    const showPopup = (event: Event) => {
      const alert = (event as CustomEvent<ReminderAlert>).detail;
      if (!alert) return;
      window.sessionStorage.setItem(`revive-alert:${alert.key}`, 'seen');
      setPopup(alert);
    };
    window.addEventListener(REMINDER_POPUP_EVENT, showPopup);
    return () => window.removeEventListener(REMINDER_POPUP_EVENT, showPopup);
  }, []);

  useEffect(() => {
    if (popup || !reminderQuery.data?.alerts.length) return;
    const next = reminderQuery.data.alerts.find((alert) => window.sessionStorage.getItem(`revive-alert:${alert.key}`) !== 'seen');
    if (!next) return;
    window.sessionStorage.setItem(`revive-alert:${next.key}`, 'seen');
    setPopup(next);
  }, [popup, reminderQuery.data]);

  const openQuickAction = useQuickAction();
  const quickLinks: Array<{ action: QuickAction; label: string; icon: typeof UserPlus }> = [
    { action: 'lead', label: 'Add lead', icon: UserPlus },
    { action: 'appointment', label: 'Book appointment', icon: CalendarPlus },
    { action: 'queue', label: 'Client queue', icon: ListChecks },
  ];
  return (
    <header className="relative z-30 flex items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <button type="button" onClick={onOpenMenu} aria-label="Open navigation" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/70 text-foreground ring-1 ring-white hover:bg-white lg:hidden"><Menu className="size-5" /></button>
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="Revive Clinic home">
        <span className="grid size-10 place-items-center rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-white"><img alt="" className="h-full w-full object-contain" src="/revive-logo.png" /></span>
        <span className="hidden text-[15px] font-semibold text-deep sm:block">Revive Clinic</span>
      </Link>
      <nav aria-label="Quick actions" className="ml-2 hidden items-center gap-2 xl:flex">
        {quickLinks.map((link) => (
          <button key={link.action} type="button" onClick={() => openQuickAction(link.action)} className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-white/70 px-3.5 text-[13px] font-medium text-foreground ring-1 ring-white transition-colors hover:bg-white">
            <link.icon className="size-4 text-primary" aria-hidden />{link.label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        <BranchToggle className="h-10 w-32 rounded-full border-white bg-white/80 pl-4 sm:w-44" />
        <Link href="/notifications" aria-label="Open notifications and followups" title="Notifications and followups" className="relative grid size-10 place-items-center rounded-full bg-white/80 text-muted-foreground ring-1 ring-white transition-colors hover:bg-white hover:text-foreground">
          <Bell className="size-4" />
          {(reminderQuery.data?.count ?? 0) > 0 ? <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-5 text-white">{Math.min(reminderQuery.data?.count ?? 0, 99)}</span> : null}
        </Link>
        <ProfileMenu />
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
