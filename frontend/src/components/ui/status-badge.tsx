import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const tones: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-soft text-emerald-800',
  warning: 'bg-warning-soft text-amber-800',
  danger: 'bg-danger-soft text-red-700',
  info: 'bg-info-soft text-blue-800',
  primary: 'bg-primary-soft text-primary',
};

/** Pill with a leading dot so status is never conveyed by colour alone. */
export function StatusBadge({ tone = 'neutral', className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)} {...props}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

/** Shared tone mapping for lead / patient-journey statuses. */
export function leadStatusTone(status: string): StatusTone {
  if (['NEW', 'UNASSIGNED'].includes(status)) return 'info';
  if (['QUALIFIED', 'CONNECTED', 'CONVERTED', 'ARRIVED', 'CONFIRMED'].includes(status)) return 'success';
  if (['LOST', 'DISQUALIFIED', 'CANCELLED', 'NOT_ARRIVED'].includes(status)) return 'danger';
  if (['NURTURING', 'POSTPONED', 'ATTEMPTING_CONTACT'].includes(status)) return 'warning';
  if (['APPOINTMENT_PROPOSED', 'APPOINTMENT_BOOKED', 'BOOKED'].includes(status)) return 'primary';
  return 'neutral';
}
