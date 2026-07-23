'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_UNAUTHORIZED_EVENT, restoreSession, setAccessToken } from '@/services/api';
import type { AuthSession } from '@/types/auth';

const SESSION_KEY = 'revive_session';
const SELECTED_BRANCH_KEY = 'revive_selected_branch_id';

type SessionContextValue = {
  session: AuthSession | null;
  selectedBranchId: string | null;
  hasHydrated: boolean;
  setSession: (session: AuthSession | null) => void;
  setSelectedBranchId: (branchId: string | null) => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    async function hydrate() {
      try {
        const storedSession = window.localStorage.getItem(SESSION_KEY);
        const storedBranchId = window.localStorage.getItem(SELECTED_BRANCH_KEY);

        if (storedBranchId !== null) {
          setSelectedBranchIdState(storedBranchId);
        }

        if (storedSession) {
          try {
            const parsedSession = JSON.parse(storedSession) as { user?: AuthSession['user'] };
            if (parsedSession.user) {
              try {
                const refreshed = await restoreSession<AuthSession>();
                if (refreshed) setSessionState(refreshed);
                else window.localStorage.removeItem(SESSION_KEY);
              } catch {
                // Preserve the session marker and branch preference during transient outages.
                setAccessToken(null);
              }
            } else {
              window.localStorage.removeItem(SESSION_KEY);
            }
          } catch {
            window.localStorage.removeItem(SESSION_KEY);
            setAccessToken(null);
          }
        }
      } catch {
        setAccessToken(null);
      } finally {
        setHasHydrated(true);
      }
    }
    void hydrate();
  }, []);

  const updateSelectedBranchId = useCallback((branchId: string | null) => {
    setSelectedBranchIdState(branchId);

    if (branchId === null) {
      window.localStorage.removeItem(SELECTED_BRANCH_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_BRANCH_KEY, branchId);
  }, []);

  const updateSession = useCallback((nextSession: AuthSession | null) => {
    setSessionState(nextSession);
    setAccessToken(nextSession?.accessToken ?? null);

    if (nextSession) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ user: nextSession.user }));
      return;
    }

    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SELECTED_BRANCH_KEY);
    setSelectedBranchIdState(null);
  }, []);

  useEffect(() => {
    const clearExpiredSession = () => updateSession(null);
    const syncLogout = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue === null) updateSession(null);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearExpiredSession);
    window.addEventListener('storage', syncLogout);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearExpiredSession);
      window.removeEventListener('storage', syncLogout);
    };
  }, [updateSession]);

  const value = useMemo(
    () => ({
      session,
      selectedBranchId,
      hasHydrated,
      setSession: updateSession,
      setSelectedBranchId: updateSelectedBranchId,
    }),
    [session, selectedBranchId, hasHydrated, updateSession, updateSelectedBranchId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionStore() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSessionStore must be used inside SessionProvider');
  }

  return context;
}
