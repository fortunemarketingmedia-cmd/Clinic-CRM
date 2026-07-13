'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken } from '@/services/api';
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
    try {
      const storedSession = window.localStorage.getItem(SESSION_KEY);
      const storedBranchId = window.localStorage.getItem(SELECTED_BRANCH_KEY);

      if (storedSession) {
        const parsedSession = JSON.parse(storedSession) as AuthSession;

        setSessionState(parsedSession);
        setAccessToken(parsedSession.accessToken);
      }

      if (storedBranchId !== null) {
        setSelectedBranchIdState(storedBranchId);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(SELECTED_BRANCH_KEY);
      setAccessToken(null);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  const updateSelectedBranchId = useCallback((branchId: string | null) => {
    setSelectedBranchIdState(branchId);

    if (branchId === null) {
      window.localStorage.removeItem(SELECTED_BRANCH_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_BRANCH_KEY, branchId);
  }, []);

  const updateSession = useCallback(
    (nextSession: AuthSession | null) => {
      setSessionState(nextSession);
      setAccessToken(nextSession?.accessToken ?? null);

      if (nextSession) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        return;
      }

      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(SELECTED_BRANCH_KEY);
      setSelectedBranchIdState(null);
    },
    [],
  );

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