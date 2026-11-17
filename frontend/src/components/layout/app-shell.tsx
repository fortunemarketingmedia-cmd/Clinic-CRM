'use client';

import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Header } from '@/components/layout/header';
import { QuickActionProvider } from '@/components/layout/quick-actions';
import { NavList, Rail } from '@/components/layout/sidebar';
import { useModalFocus } from '@/components/layout/use-modal-focus';
import { useSessionStore } from '@/store/session-store';
import { X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

const AppShellContext = createContext(false);

export function AppShell({ children }: { children: React.ReactNode }) {
  const alreadyInsideShell = useContext(AppShellContext);
  const { session } = useSessionStore();
  const pathname = usePathname();
  const role = session?.user.role ?? 'RECEPTIONIST';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useModalFocus();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileMenuOpen]);

  if (alreadyInsideShell) return children;

  return (
    <AppShellContext.Provider value>
      <QuickActionProvider>
      <div className="app-canvas min-h-dvh">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-white">Skip to content</a>
        <Header onOpenMenu={() => setMobileMenuOpen(true)} />
        <div className="flex">
          <Rail role={role} />
          <main id="main-content" className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1480px] px-4 pb-10 pt-2 sm:px-6 lg:px-8">
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </div>
        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
            <button type="button" aria-label="Close navigation" className="absolute inset-0 w-full bg-foreground/40" onClick={() => setMobileMenuOpen(false)} />
            <aside role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 flex w-[min(85vw,320px)] flex-col bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div><div className="font-semibold text-foreground">Revive Clinic</div><div className="text-xs text-muted-foreground">Workspace</div></div>
                <button type="button" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"><NavList role={role} onNavigate={() => setMobileMenuOpen(false)} /></div>
            </aside>
          </div>
        ) : null}
      </div>
      </QuickActionProvider>
    </AppShellContext.Provider>
  );
}
