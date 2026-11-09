'use client';

import { useMutation } from '@tanstack/react-query';
import { Lock, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';

// Shared Edit / Delete controls used across the CRM. Delete is admin-only and is a soft delete on the server:
// the record disappears from every list but is kept, with a snapshot in the audit log.
export type DeletableRecord =
  | 'patient' | 'lead' | 'follow-up' | 'task' | 'waitlist' | 'appointment' | 'treatment-record'
  | 'encounter' | 'sitting' | 'file' | 'invoice' | 'package';

export function useIsAdmin() {
  const { session } = useSessionStore();
  return session?.user.role === 'ADMIN';
}

export const toDateInput = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const toDateTimeInput = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${toDateInput(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
/** Local date/datetime input value → ISO string (undefined when empty). */
export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : undefined);
/** Drops empty strings so optional fields are not sent as "". */
export const withoutEmpty = <T extends Record<string, unknown>>(values: T) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== undefined)) as Partial<T>;

function Modal({ title, subtitle, onClose, children, footer, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
    <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className={cn('relative flex max-h-full w-full flex-col overflow-hidden rounded-2xl bg-background shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
      <header className="flex items-start justify-between gap-3 border-b bg-surface px-5 py-4">
        <div><h2 className="text-lg font-semibold">{title}</h2>{subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}</div>
        <Button type="button" variant="ghost" className="size-9 p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-5 py-3">{footer}</footer>
    </div>
  </div>, document.body);
}

/** Small "Edit" button. */
export function EditButton({ onClick, label = 'Edit', className }: { onClick: () => void; label?: string; className?: string }) {
  return <Button type="button" variant="secondary" className={cn('h-8 px-2.5 text-xs', className)} onClick={onClick}><Pencil className="size-3.5" />{label}</Button>;
}

/** Shown instead of Edit/Delete on signed legal documents. */
export function LockedBadge({ label = 'Signed · locked' }: { label?: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" title="Signed documents cannot be edited or deleted"><Lock className="size-3" />{label}</span>;
}

/** Admin-only Delete button with its own confirmation dialog. Renders nothing for other roles. */
export function DeleteRecordButton({ kind, id, name, what, warning, onDeleted, className, iconOnly = false }: {
  kind: DeletableRecord; id: string; name: string; what: string; warning?: string; onDeleted?: () => void; className?: string; iconOnly?: boolean;
}) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => apiRequest(`/records/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => { setOpen(false); onDeleted?.(); },
  });
  if (!isAdmin) return null;
  return <>
    <Button type="button" variant="secondary" className={cn('h-8 px-2.5 text-xs text-red-700 hover:bg-red-50 hover:text-red-800', className)} onClick={(event) => { event.stopPropagation(); remove.reset(); setOpen(true); }} aria-label={`Delete ${what}`} title={`Delete ${what}`}>
      <Trash2 className="size-3.5" />{iconOnly ? null : 'Delete'}
    </Button>
    {open ? <Modal title={`Delete ${what}?`} subtitle={name} onClose={() => setOpen(false)} footer={<>
      <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      <Button type="button" className="bg-red-600 text-white hover:bg-red-700" disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 className="size-4" />{remove.isPending ? 'Deleting…' : 'Delete'}</Button>
    </>}>
      <p className="text-sm">This removes the {what} from every list and screen. A copy is kept in the audit log, so it can be recovered by an administrator if needed.</p>
      {warning ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p> : null}
      {remove.isError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{remove.error.message}</p> : null}
    </Modal> : null}
  </>;
}

export type EditField = {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'email' | 'tel' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
  min?: number;
  step?: string;
  hint?: string;
};

/** Generic edit form in a dialog. `onSubmit` receives the form values as strings. */
export function EditRecordDialog({ title, subtitle, fields, initial, onSubmit, onClose, onSaved, wide = false }: {
  title: string; subtitle?: string; fields: EditField[]; initial: Record<string, string>; wide?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<unknown>; onClose: () => void; onSaved?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const save = useMutation({ mutationFn: () => onSubmit(values), onSuccess: () => { onSaved?.(); onClose(); } });
  const missing = fields.find((field) => field.required && !String(values[field.name] ?? '').trim());
  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));
  return <Modal title={title} subtitle={subtitle} onClose={onClose} wide={wide} footer={<>
    {missing ? <p className="mr-auto text-xs text-muted-foreground">{missing.label} is required</p> : null}
    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    <Button type="button" disabled={Boolean(missing) || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
  </>}>
    <div className={cn('grid gap-4', wide && 'sm:grid-cols-2')}>
      {fields.map((field) => {
        const value = values[field.name] ?? '';
        const control = field.type === 'checkbox'
          ? <input className="size-4 accent-primary" type="checkbox" checked={value === 'true'} onChange={(event) => set(field.name, String(event.target.checked))} />
          : field.type === 'textarea'
          ? <textarea className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={value} placeholder={field.placeholder} onChange={(event) => set(field.name, event.target.value)} />
          : field.type === 'select'
            ? <Select value={value} onChange={(event) => set(field.name, event.target.value)}>{field.required ? null : <option value="">—</option>}{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
            : <Input type={field.type === 'datetime' ? 'datetime-local' : field.type ?? 'text'} value={value} min={field.min} step={field.step} placeholder={field.placeholder} onChange={(event) => set(field.name, event.target.value)} />;
        return <label key={field.name} className={cn(field.type === 'checkbox' ? 'flex items-center gap-2 rounded-md border border-border p-3 text-sm' : 'grid gap-1 text-sm', wide && (field.wide || field.type === 'textarea' || field.type === 'checkbox') && 'sm:col-span-2')}>
          {field.type === 'checkbox' ? control : null}
          <span className="font-medium">{field.label}{field.required || field.type === 'checkbox' ? null : <span className="font-normal text-muted-foreground"> (optional)</span>}</span>
          {field.type === 'checkbox' ? null : control}
          {field.hint ? <span className="text-xs text-muted-foreground">{field.hint}</span> : null}
        </label>;
      })}
    </div>
    {save.isError ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{save.error.message}</p> : null}
  </Modal>;
}
