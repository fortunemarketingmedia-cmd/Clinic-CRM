export default function Loading() {
  return (
    <main className="space-y-5 p-6" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-lg border border-border bg-muted/60"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg border border-border bg-muted/60" />
    </main>
  );
}
