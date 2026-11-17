'use client';

import { Button } from './button';

export type PaginationMeta = { total: number; page: number; pageSize: number; totalPages: number };

export function PaginationControls({ meta, onPageChange }: { meta?: PaginationMeta; onPageChange: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.total, meta.page * meta.pageSize);
  return <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Showing {first}–{last} of {meta.total}</p><div className="grid grid-cols-2 gap-2 sm:flex sm:items-center"><Button type="button" variant="secondary" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>Previous</Button><span className="order-first col-span-2 flex items-center text-sm text-muted-foreground sm:order-none sm:px-2">Page {meta.page} of {meta.totalPages}</span><Button type="button" variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>Next</Button></div></div>;
}
