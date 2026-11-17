import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('min-w-0 rounded-[20px] border border-white/80 bg-surface p-4 shadow-card sm:p-5', className)}
      {...props}
    />
  );
}

/** Standard card heading: title + optional description on the left, action (link, select) on the right. */
export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-6">{title}</h2>
        {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0 text-[13px]">{action}</div> : null}
    </div>
  );
}
