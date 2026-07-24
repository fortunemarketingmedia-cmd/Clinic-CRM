'use client';

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Settings,
  UserRoundCheck,
  Users,
  Rows3,
  ListPlus,
  Stethoscope,
  MessageCircle,
  Workflow,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';
import type { Role } from '@/constants/roles';
import { cn } from '@/lib/utils';

const allOperational: Role[] = ['ADMIN', 'RECEPTIONIST'];
const crmRoles: Role[] = ['ADMIN', 'RECEPTIONIST'];
const doctorReviveRoles: Role[] = ['ADMIN'];
const developerRoles: Role[] = ['DEVELOPER'];
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
      { label: 'Follow-ups', icon: Clock3, href: '/follow-ups', roles: crmRoles },
      { label: 'Tasks', icon: ListTodo, href: '/tasks', roles: allOperational },
    ],
  },
  {
    label: 'Front Desk',
    items: [
      { label: 'Calendar', icon: CalendarDays, href: '/appointments', roles: allOperational },
      { label: 'Today’s Queue', icon: Rows3, href: '/today-queue', roles: allOperational },
      { label: 'Waitlist', icon: ListPlus, href: '/waitlist', roles: allOperational },
      { label: 'Schedules & Rooms', icon: Stethoscope, href: '/schedules', roles: allOperational },
    ],
  },
  {
    label: 'Patients',
    items: [
      {
        label: 'Patient Directory',
        icon: UserRoundCheck,
        href: '/patients',
        roles: allOperational,
      },
      {
        label: 'Doctor Workspace',
        icon: Stethoscope,
        href: '/doctor-workspace',
        roles: allOperational,
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        label: 'Communication',
        icon: MessageCircle,
        href: '/communication-centre',
        roles: allOperational,
      },
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
      { label: 'Master Records', icon: ClipboardCheck, href: '/clients', roles: doctorReviveRoles },
      { label: 'Lead Scoring', icon: BarChart3, href: '/settings/lead-scoring', roles: doctorReviveRoles },
      { label: 'Automations', icon: Workflow, href: '/automations', roles: doctorReviveRoles },
      {
        label: 'Forms & Consents',
        icon: ClipboardCheck,
        href: '/settings/forms-consents',
        roles: doctorReviveRoles,
      },
      { label: 'Settings', icon: Settings, href: '/settings', roles: doctorReviveRoles },
    ],
  },
  {
    label: 'Developer',
    items: [
      { label: 'System & Integrations', icon: Wrench, href: '/settings/integrations', roles: developerRoles },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{ label: string; icon: React.ElementType; href: string; roles: Role[] }>;
}>;

export const navigationItems = navigationSections.flatMap((section) => section.items);

export function Sidebar({ role }: { role: Role }) {
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
      className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-border bg-surface px-4 py-5 shadow-sm md:block"
    >
      <div className="mb-7 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-md border border-border bg-white p-1 shadow-sm">
          <img
            alt="Revive Clinic"
            className="h-full w-full object-contain"
            src="/revive-logo.png"
          />
        </div>
        <div>
          <div className="text-lg font-semibold text-primary">Revive Clinic</div>
          <div className="text-sm text-muted-foreground">Clinic operating system</div>
        </div>
      </div>
      <nav className="space-y-5">
        {navigationSections.map((section) => {
          const items = section.items.filter((item) => item.roles.includes(role));
          if (!items.length) return null;
          return (
            <div key={section.label || 'main'}>
              {section.label ? (
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
                      pathname === item.href &&
                        'bg-primary/10 font-medium text-primary ring-1 ring-primary/15',
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
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
