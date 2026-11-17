import type { ElementType, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** KPI tile. `highlight` renders the deep-teal hero card; use it for at most one metric per view. */
export function MetricCard({ label, value, icon: Icon, hint, highlight = false }: { label: string; value: ReactNode; icon?: ElementType; hint?: ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn('flex flex-col justify-between gap-4 p-4 sm:p-5', highlight && 'border-transparent bg-[linear-gradient(135deg,#238F88_0%,#14606B_55%,#0F4A55_100%)] text-white')}>
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', highlight ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary')}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <span className={cn('truncate text-[13px] font-medium', highlight ? 'text-white/85' : 'text-muted-foreground')}>{label}</span>
      </div>
      <div>
        <div className="text-[28px] font-semibold leading-none tracking-tight tabular-nums sm:text-[32px]">{value}</div>
        {hint ? <div className={cn('mt-1.5 text-xs', highlight ? 'text-white/75' : 'text-muted-foreground')}>{hint}</div> : null}
      </div>
    </Card>
  );
}
