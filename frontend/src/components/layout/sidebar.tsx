'use client';

import { BarChart3, CalendarDays, LayoutDashboard, Settings, UserRoundCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/constants/roles';
import { cn } from '@/lib/utils';

export const navigationItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['ADMIN', 'RECEPTIONIST'] },
  { label: 'Leads', icon: Users, href: '/leads', roles: ['ADMIN', 'RECEPTIONIST'] },
  { label: 'Appointments', icon: CalendarDays, href: '/appointments', roles: ['ADMIN', 'RECEPTIONIST'] },
  { label: 'Patients', icon: UserRoundCheck, href: '/patients', roles: ['ADMIN', 'RECEPTIONIST'] },
  { label: 'Master Records', icon: Users, href: '/clients', roles: ['ADMIN'] },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', roles: ['ADMIN'] },
  { label: 'Settings', icon: Settings, href: '/settings', roles: ['ADMIN'] },
] satisfies Array<{ label: string; icon: React.ElementType; href: string; roles: Role[] }>;

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 border-r border-border bg-surface px-4 py-5 shadow-sm md:block">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-md border border-border bg-white p-1 shadow-sm">
            <img alt="Revive Clinic" className="h-full w-full object-contain" src="/revive-logo.png" />
          </div>
          <div>
            <div className="text-lg font-semibold text-primary">Revive Clinic</div>
            <div className="text-sm text-muted-foreground">Skin & Hair CRM</div>
          </div>
        </div>
      </div>
      <nav className="space-y-1">
        {navigationItems
          .filter((item) => item.roles.includes(role))
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground',
                pathname === item.href && 'bg-primary/10 font-medium text-primary ring-1 ring-primary/15',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
      </nav>
    </aside>
  );
}
