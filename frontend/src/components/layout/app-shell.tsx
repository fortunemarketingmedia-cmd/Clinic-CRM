'use client';

import { Header } from '@/components/layout/header';
import { navigationSections, Sidebar } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/store/session-store';
import { X } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('revive_sidebar_collapsed') === 'true');
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileMenuOpen]);

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
      <div className="flex min-h-dvh">
        <Sidebar role={role} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <main className="min-w-0 flex-1">
          <Header onOpenMenu={() => setMobileMenuOpen(true)} />
          <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5 md:px-6 md:py-7 xl:px-8">{children}</div>
        </main>
        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
            <button type="button" aria-label="Close navigation" className="absolute inset-0 w-full bg-foreground/40" onClick={() => setMobileMenuOpen(false)} />
            <aside role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-[min(85vw,320px)] flex-col bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div><div className="font-semibold text-foreground">Revive Clinic</div><div className="text-xs text-muted-foreground">Workspace</div></div>
                <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
              </div>
              <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {navigationSections.map((section) => {
                  const items = section.items.filter((item) => item.roles.includes(role));
                  if (!items.length) return null;
                  return <div key={section.label || 'main'}>
                    {section.label ? <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</div> : null}
                    <div className="space-y-1">{items.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} aria-current={pathname === item.href ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground', pathname === item.href && 'bg-primary/10 font-semibold text-primary')}><item.icon className="size-4 shrink-0" />{item.label}</Link>)}</div>
                  </div>;
                })}
              </nav>
            </aside>
          </div>
        ) : null}
      </div>
    </AppShellContext.Provider>
  );
}
