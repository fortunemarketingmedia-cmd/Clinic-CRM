import { Inbox } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

export function EmptyState({ title, description, icon: Icon = Inbox, action }: { title: string; description?: string; icon?: ElementType; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary"><Icon className="size-5" aria-hidden /></span>
      <h3 className="mt-3 text-[15px] font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
