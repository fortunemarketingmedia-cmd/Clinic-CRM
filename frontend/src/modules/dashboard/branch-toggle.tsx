'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Branch } from '@/types/branch';
import { cn } from '@/lib/utils';

export function BranchToggle({ className }: { className?: string }) {
  const { session, selectedBranchId, setSelectedBranchId, hasHydrated } = useSessionStore();

  const isAdmin = session?.user.role === 'ADMIN';

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
    enabled: hasHydrated && Boolean(session),
  });

  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);

  useEffect(() => {
    if (!hasHydrated || branches.length === 0) {
      return;
    }

    if (isAdmin && selectedBranchId === null) {
      setSelectedBranchId('');
      return;
    }

    if (!isAdmin && (!selectedBranchId || !branches.some((branch) => branch.id === selectedBranchId))) {
      setSelectedBranchId(branches[0].id);
      return;
    }

    if (selectedBranchId && !branches.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(isAdmin ? '' : branches[0].id);
    }
  }, [branches, hasHydrated, isAdmin, selectedBranchId, setSelectedBranchId]);

  const value = selectedBranchId ?? (isAdmin ? '' : branches[0]?.id ?? '');

  return (
    <Select
      aria-label="Branch"
      value={value}
      onChange={(event) => setSelectedBranchId(event.target.value)}
      className={cn('w-44', className)}
      disabled={!hasHydrated || branchesQuery.isLoading || branches.length === 0}
    >
      {isAdmin ? <option value="">All branches</option> : null}

      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </Select>
  );
}
