import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('min-w-0 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_hsl(350_20%_20%/0.035)] sm:p-5', className)}
      {...props}
    />
  );
}
