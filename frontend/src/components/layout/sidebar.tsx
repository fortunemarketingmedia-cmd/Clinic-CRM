'use client';

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Columns3,
  LayoutDashboard,
  ListTodo,
  Settings,
  Users,
  Rows3,
  Stethoscope,
  PanelLeftClose,
  PanelLeftOpen,
  BellRing,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';
import type { Role } from '@/constants/roles';
import { cn } from '@/lib/utils';

const allOperational: Role[] = ['ADMIN', 'RECEPTIONIST'];
const crmRoles: Role[] = ['ADMIN', 'RECEPTIONIST'];
const doctorReviveRoles: Role[] = ['ADMIN'];
const SIDEBAR_SCROLL_KEY = 'revive_sidebar_scroll_top';

export const navigationSections = [
  {
    label: '',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: allOperational },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Leads', icon: Users, href: '/leads', roles: crmRoles },
      { label: 'Lead Journey', icon: Columns3, href: '/follow-ups', roles: crmRoles },
      { label: 'Notifications & Followups', icon: BellRing, href: '/notifications', roles: allOperational },
      { label: 'Tasks', icon: ListTodo, href: '/tasks', roles: allOperational },
    ],
  },
  {
    label: 'Front Desk',
    items: [
      { label: 'Appointments', icon: CalendarDays, href: '/appointments', roles: allOperational },
      { label: 'Daily Client Queue', icon: Rows3, href: '/daily-client-queue', roles: allOperational },
      { label: 'Schedules & Rooms', icon: Stethoscope, href: '/schedules', roles: allOperational },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        label: 'Analytics',
        icon: BarChart3,
        href: '/reports',
        roles: doctorReviveRoles,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Master Records', icon: ClipboardCheck, href: '/clients', roles: allOperational },
      { label: 'Settings', icon: Settings, href: '/settings', roles: doctorReviveRoles },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{ label: string; icon: React.ElementType; href: string; roles: Role[] }>;
}>;

export const navigationItems = navigationSections.flatMap((section) => section.items);

export function Sidebar({ role, collapsed, onToggle }: { role: Role; collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const savedPosition = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? 0);
    if (Number.isFinite(savedPosition)) sidebar.scrollTop = savedPosition;
    const rememberPosition = () =>
      window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sidebar.scrollTop));
    sidebar.addEventListener('scroll', rememberPosition, { passive: true });
    return () => {
      rememberPosition();
      sidebar.removeEventListener('scroll', rememberPosition);
    };
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className={cn('sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-border bg-surface py-5 shadow-sm transition-[width] duration-200 md:block', collapsed ? 'w-20 px-3' : 'w-64 px-4')}
    >
      <div className={cn('mb-7 flex items-center gap-3', collapsed && 'justify-center')}>
        <div className="flex size-12 items-center justify-center rounded-md border border-border bg-white p-1 shadow-sm">
          <img
            alt="Revive Clinic"
            className="h-full w-full object-contain"
            src="/revive-logo.png"
          />
        </div>
        <div className={cn(collapsed && 'hidden')}>
          <div className="text-lg font-semibold text-primary">Revive Clinic</div>
          <div className="text-sm text-muted-foreground">Clinic operating system</div>
        </div>
        <button type="button" onClick={onToggle} className={cn('ml-auto grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground', collapsed && 'ml-0')} aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} title={collapsed ? 'Open sidebar' : 'Close sidebar'}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
      <nav className="space-y-5">
        {navigationSections.map((section) => {
          const items = section.items.filter((item) => item.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.label || 'main'}>
              {section.label && !collapsed ? (
                <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </div>
              ) : null}
              <div className="space-y-1">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center px-0',
                      pathname === item.href &&
                        'bg-primary/10 font-medium text-primary ring-1 ring-primary/15',
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
