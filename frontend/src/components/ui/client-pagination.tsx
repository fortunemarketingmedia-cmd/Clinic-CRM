'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/** Splits an in-memory list into pages so long lists stay compact. Resets to page 1 when the list shrinks. */
export function usePagedList<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const current = Math.min(page, totalPages);
  return { page: current, setPage, totalPages, total: items.length, pageSize, visible: items.slice((current - 1) * pageSize, current * pageSize) };
}

export function ClientPagination({ page, totalPages, total, pageSize, onPageChange, className }: { page: number; totalPages: number; total: number; pageSize: number; onPageChange: (page: number) => void; className?: string }) {
  if (totalPages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className={`mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground ${className ?? ''}`}>
      <span>Showing {first}–{last} of {total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
        <span className="px-1">Page {page} of {totalPages}</span>
        <Button type="button" variant="secondary" className="h-8 px-3 text-xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
