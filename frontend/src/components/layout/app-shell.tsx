'use client';

import { Header } from '@/components/layout/header';
import { navigationItems, Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/store/session-store';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

const AppShellContext = createContext(false);

export function AppShell({ children }: { children: React.ReactNode }) {
  const alreadyInsideShell = useContext(AppShellContext);
  const { session } = useSessionStore();
  const pathname = usePathname();
  const role = session?.user.role ?? 'RECEPTIONIST';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('revive_sidebar_collapsed') === 'true');
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('revive_sidebar_collapsed', String(next));
      return next;
    });
  }

  if (alreadyInsideShell) return children;

  return (
    <AppShellContext.Provider value>
      <div className="flex min-h-screen">
        <Sidebar role={role} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main className="min-w-0 flex-1">
          <Header />
          <nav className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2 md:hidden">
            {navigationItems
              .filter((item) => item.roles.includes(role))
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground',
                    pathname === item.href && 'bg-muted font-medium text-foreground',
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
          </nav>
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 xl:px-8">{children}</div>
        </main>
      </div>
    </AppShellContext.Provider>
  );
}
