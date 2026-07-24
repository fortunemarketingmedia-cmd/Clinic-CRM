import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="grid gap-4 border-b border-border bg-muted/40 p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-4 w-3/4" />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="grid gap-4 border-b border-border/70 p-4 last:border-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={cn('h-4', column === 0 ? 'w-4/5' : 'w-2/3')} />)}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-label="Loading content" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 rounded-md border border-border/70 p-3">
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4" aria-label="Loading board" aria-busy="true">
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className="min-h-56 rounded-lg border border-border bg-surface p-3">
          <div className="mb-4 flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="size-5 rounded-full" /></div>
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <section className="space-y-5" aria-label="Loading page" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 border border-border" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <TableSkeleton rows={6} columns={4} />
        <div className="space-y-4">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-32 border border-border" />)}</div>
      </div>
    </section>
  );
}

export function AppChromeSkeleton() {
  return (
    <div className="flex min-h-screen" aria-label="Loading application" aria-busy="true">
      <aside className="hidden h-screen w-64 shrink-0 border-r border-border bg-surface p-5 md:block">
        <div className="flex items-center gap-3"><Skeleton className="size-12" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-3 w-36" /></div></div>
        <div className="mt-8 space-y-5">{Array.from({ length: 5 }, (_, section) => <div key={section} className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>)}</div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="flex min-h-16 items-center justify-between border-b border-border bg-surface px-6"><div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-28" /></div><Skeleton className="h-10 w-64" /></div>
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 xl:px-8"><PageSkeleton /></div>
      </main>
    </div>
  );
}
