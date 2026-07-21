'use client';

import { cn } from '@/lib/utils';

export type ChartDatum = { label: string; value: number; color?: string; secondaryValue?: number };

const palette = ['#e73748', '#f59e0b', '#14b8a6', '#6366f1', '#0ea5e9', '#8b5cf6'];

export function DonutChart({ data, centerLabel, centerValue }: { data: ChartDatum[]; centerLabel: string; centerValue: string | number }) {
  const total = Math.max(data.reduce((sum, item) => sum + item.value, 0), 1);
  let cursor = 0;
  const segments = data.map((item, index) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color ?? palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto size-40 shrink-0 rounded-full" style={{ background: `conic-gradient(${segments.join(',') || '#f2e9e5 0 100%'})` }}>
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-surface text-center shadow-inner">
          <strong className="text-2xl">{centerValue}</strong>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><i className="size-2.5 shrink-0 rounded-full" style={{ background: item.color ?? palette[index % palette.length] }} /> <span className="truncate">{item.label}</span></span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarChart({ data, valueSuffix = '', compact = false }: { data: ChartDatum[]; valueSuffix?: string; compact?: boolean }) {
  const max = Math.max(...data.map((item) => Math.max(item.value, item.secondaryValue ?? 0)), 1);
  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {data.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-muted-foreground">{item.label}</span>
            <strong className="text-foreground">{item.value.toLocaleString('en-IN')}{valueSuffix}</strong>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
            {item.secondaryValue !== undefined ? <div className="absolute inset-y-0 left-0 rounded-full bg-primary/20" style={{ width: `${Math.max((item.secondaryValue / max) * 100, item.secondaryValue ? 4 : 0)}%` }} /> : null}
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`, background: item.color ?? palette[index % palette.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({ data, valueSuffix = '' }: { data: ChartDatum[]; valueSuffix?: string }) {
  const max = Math.max(...data.map((item) => Math.max(item.value, item.secondaryValue ?? 0)), 1);
  return (
    <div className="flex h-56 items-end gap-3 border-b border-border pt-8">
      {data.map((item, index) => (
        <div key={item.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <div className="relative flex h-40 w-full items-end justify-center gap-1">
            <div className="relative w-full max-w-9 rounded-t-md transition-opacity group-hover:opacity-80" style={{ height: `${Math.max((item.value / max) * 100, item.value ? 5 : 0)}%`, background: item.color ?? palette[index % palette.length] }}>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold">{item.value}{valueSuffix}</span>
            </div>
            {item.secondaryValue !== undefined ? <div className="w-full max-w-9 rounded-t-md bg-primary/25" style={{ height: `${Math.max((item.secondaryValue / max) * 100, item.secondaryValue ? 5 : 0)}%` }} /> : null}
          </div>
          <span className="max-w-full truncate text-[11px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SegmentedTabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ label: string; value: T; count?: number }>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/60 p-1" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value} onClick={() => onChange(tab.value)} className={cn('flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition', value === tab.value && 'bg-surface text-foreground shadow-sm')}>
          {tab.label}{tab.count !== undefined ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
