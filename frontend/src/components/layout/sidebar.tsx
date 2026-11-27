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
  Stethoscope,
  BellRing,
  Pill,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/constants/roles';
import { cn } from '@/lib/utils';
import { useReminderNotifications } from '@/modules/notifications/use-reminder-notifications';

const allOperational: Role[] = ['ADMIN', 'RECEPTIONIST'];
const crmRoles: Role[] = ['ADMIN', 'RECEPTIONIST'];
const doctorReviveRoles: Role[] = ['ADMIN'];

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
      { label: 'Notifications', icon: BellRing, href: '/notifications', roles: allOperational },
      { label: 'Tasks', icon: ListTodo, href: '/tasks', roles: allOperational },
    ],
  },
  {
    label: 'Front Desk',
    items: [
      { label: 'Appointments', icon: CalendarDays, href: '/appointments', roles: allOperational },
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
        roles: allOperational,
      },
      { label: 'Finance', icon: Wallet, href: '/finance', roles: doctorReviveRoles },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Master Records', icon: ClipboardCheck, href: '/clients', roles: allOperational },
      { label: 'Medicines', icon: Pill, href: '/medicines', roles: allOperational },
      { label: 'Settings', icon: Settings, href: '/settings', roles: doctorReviveRoles },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{ label: string; icon: React.ElementType; href: string; roles: Role[] }>;
}>;

export const navigationItems = navigationSections.flatMap((section) => section.items);

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavList({ role, collapsed = false, onNavigate }: { role: Role; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const reminderQuery = useReminderNotifications();
  const reminderCount = reminderQuery.data?.count ?? 0;
  return (
    <nav aria-label="Primary" className="space-y-5">
      {navigationSections.map((section) => {
        const items = section.items.filter((item) => item.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={section.label || 'main'}>
            {section.label && !collapsed ? (
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</div>
            ) : null}
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
                      collapsed && 'justify-center px-0',
                      active && 'bg-primary-soft font-medium text-primary hover:bg-primary-soft hover:text-primary',
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                    {item.href === '/notifications' && reminderCount > 0 ? (
                      <span className={cn('grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-5 text-white', collapsed ? 'absolute -right-0.5 -top-0.5' : 'ml-auto')}>
                        {Math.min(reminderCount, 99)}
                        <span className="sr-only"> new reminders</span>
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Slim icon rail that expands on hover or keyboard focus to show labels and section titles, then collapses
 * again when the pointer leaves. It overlays the page, so content never shifts.
 */
export function Rail({ role }: { role: Role }) {
  const pathname = usePathname();
  const reminderQuery = useReminderNotifications();
  const reminderCount = reminderQuery.data?.count ?? 0;
  const groups = navigationSections
    .map((section) => ({ label: section.label, items: section.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);
  return (
    <aside className="relative hidden w-[76px] shrink-0 lg:block">
      <nav
        aria-label="Primary"
        className="group/rail absolute left-5 top-1 z-40 flex w-[52px] flex-col overflow-hidden rounded-[26px] bg-white/75 p-1.5 hover:bg-white focus-within:bg-white shadow-card ring-1 ring-white/80 transition-[width,box-shadow] duration-200 ease-out hover:w-[236px] hover:shadow-[0_22px_48px_-18px_rgba(18,84,95,0.35)] focus-within:w-[236px] focus-within:shadow-[0_22px_48px_-18px_rgba(18,84,95,0.35)]"
      >
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-0.5">
            {groupIndex > 0 ? (
              <div className="relative h-6" aria-hidden>
                <span className="absolute inset-x-3 top-3 h-px bg-border transition-opacity duration-150 group-hover/rail:opacity-0 group-focus-within/rail:opacity-0" />
                <span className="absolute left-3.5 top-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">{group.label}</span>
              </div>
            ) : null}
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-10 w-full items-center gap-3 rounded-full px-[11px] text-muted-foreground transition-colors duration-150 hover:bg-white hover:text-foreground',
                    active && 'bg-deep text-white shadow-sm hover:bg-deep hover:text-white',
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="whitespace-nowrap text-[13.5px] font-medium opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">{item.label}</span>
                  {item.href === '/notifications' && reminderCount > 0 ? (
                    <>
                      <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-danger ring-2 ring-white group-hover/rail:hidden group-focus-within/rail:hidden" aria-hidden />
                      <span className="ml-auto hidden min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-semibold leading-5 text-white group-hover/rail:grid group-focus-within/rail:grid">{Math.min(reminderCount, 99)}<span className="sr-only"> new reminders</span></span>
                    </>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
