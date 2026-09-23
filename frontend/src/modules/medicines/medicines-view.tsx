'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, FileUp, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PaginationControls, type PaginationMeta } from '@/components/ui/pagination-controls';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiRequest, apiUpload } from '@/services/api';
import { useSessionStore } from '@/store/session-store';

type MedicineStatus = 'ACTIVE' | 'INACTIVE';
type Medicine = { id: string; name: string; genericName?: string | null; strength?: string | null; form?: string | null; status: MedicineStatus; createdAt: string; updatedAt: string };
type MedicineInput = { name: string; genericName: string; strength: string; form: string; status: MedicineStatus };
const emptyMedicine: MedicineInput = { name: '', genericName: '', strength: '', form: '', status: 'ACTIVE' };

export function MedicinesView() {
  const client = useQueryClient();
  const { session, hasHydrated } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<'' | MedicineStatus>('');
  const [form, setForm] = useState('');
  const [sort, setSort] = useState('name_asc');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Medicine | null | undefined>(undefined);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, form, sort, status]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sort });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (status) params.set('status', status);
    if (form) params.set('form', form);
    return params.toString();
  }, [debouncedSearch, form, page, sort, status]);
  const enabled = hasHydrated && Boolean(session);
  const medicines = useQuery({
    queryKey: ['medicines', queryString],
    queryFn: () => apiRequest<{ data: Medicine[]; meta: PaginationMeta }>(`/medicines?${queryString}`),
    placeholderData: keepPreviousData,
    enabled,
  });
  const forms = useQuery({ queryKey: ['medicine-forms'], queryFn: () => apiRequest<{ data: string[] }>('/medicines/forms'), enabled });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['medicines'] }),
      client.invalidateQueries({ queryKey: ['medicine-forms'] }),
      client.invalidateQueries({ queryKey: ['clinical-medicines'] }),
    ]);
  };
  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: MedicineInput }) => apiRequest<{ data: Medicine }>(id ? `/medicines/${id}` : '/medicines', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(values) }),
    onSuccess: async (_response, variables) => { await refresh(); setEditing(undefined); setNotice({ type: 'success', text: variables.id ? 'Medicine updated.' : 'Medicine added to the prescription catalog.' }); },
    onError: (error: Error) => setNotice({ type: 'error', text: error.message }),
  });
  const remove = useMutation({
    mutationFn: (medicine: Medicine) => apiRequest<{ data: { deleted: boolean; message: string } }>(`/medicines/${medicine.id}`, { method: 'DELETE' }),
    onSuccess: async (response) => { await refresh(); setNotice({ type: 'success', text: response.data.message }); },
    onError: (error: Error) => setNotice({ type: 'error', text: error.message }),
  });
  const importCatalog = useMutation({
    mutationFn: (file: File) => apiUpload<{ data: { received: number; imported: number; skipped: number } }>('/medicines/import', file, {}),
    onSuccess: async (response) => { await refresh(); setShowImport(false); setNotice({ type: 'success', text: `Imported ${response.data.imported} medicines${response.data.skipped ? `; skipped ${response.data.skipped} duplicates.` : '.'}` }); },
    onError: (error: Error) => setNotice({ type: 'error', text: error.message }),
  });

  if (!hasHydrated || medicines.isLoading) return <PageSkeleton />;
  if (medicines.isError) return <Card><p className="text-sm text-red-700">Unable to load medicines. {medicines.error.message}</p></Card>;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold">Medicines</h1><p className="text-sm text-muted-foreground">Manage medicines and dermatology products used in prescriptions.</p></div>
        {isAdmin ? <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setShowImport(true)}><FileUp className="size-4" />Import</Button><Button type="button" onClick={() => setEditing(null)}><Plus className="size-4" />Add Medicine</Button></div> : null}
      </div>
      {notice ? <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${notice.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}><span>{notice.text}</span><button type="button" className="rounded p-1 hover:bg-black/5" onClick={() => setNotice(null)} aria-label="Dismiss message"><X className="size-4" /></button></div> : null}
      <Card>
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_150px_170px_190px]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, generic name, strength, or form" /></div>
          <Select aria-label="Medicine status" value={status} onChange={(event) => setStatus(event.target.value as '' | MedicineStatus)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select>
          <Select aria-label="Medicine form" value={form} onChange={(event) => setForm(event.target.value)}><option value="">All forms</option>{forms.data?.data.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
          <Select aria-label="Medicine sorting" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="created_desc">Recently added</option><option value="updated_desc">Recently updated</option></Select>
        </div>
        <div className="mt-4 overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Medicine / Product</th><th className="px-4 py-3 font-medium">Generic Name</th><th className="px-4 py-3 font-medium">Strength</th><th className="px-4 py-3 font-medium">Form</th><th className="px-4 py-3 font-medium">Status</th>{isAdmin ? <th className="px-4 py-3 text-right font-medium">Actions</th> : null}</tr></thead>
            <tbody>{medicines.data?.data.map((medicine) => <tr key={medicine.id} className="border-t border-border"><td className="px-4 py-3 font-medium">{medicine.name}</td><td className="px-4 py-3 text-muted-foreground">{medicine.genericName || '—'}</td><td className="px-4 py-3 text-muted-foreground">{medicine.strength || '—'}</td><td className="px-4 py-3 text-muted-foreground">{medicine.form || '—'}</td><td className="px-4 py-3"><StatusBadge status={medicine.status} /></td>{isAdmin ? <td className="px-4 py-3"><div className="flex justify-end gap-2"><Button type="button" variant="secondary" className="h-8 px-2" onClick={() => setEditing(medicine)} aria-label={`Edit ${medicine.name}`}><Edit3 className="size-3.5" /></Button><Button type="button" variant="secondary" className="h-8 px-2 text-red-700" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${medicine.name}? Used medicines will be kept and marked inactive.`)) remove.mutate(medicine); }} aria-label={`Remove ${medicine.name}`}><Trash2 className="size-3.5" /></Button></div></td> : null}</tr>)}
              {!medicines.data?.data.length ? <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={isAdmin ? 6 : 5}>No medicines match the current filters.</td></tr> : null}</tbody>
          </table>
        </div>
        <PaginationControls meta={medicines.data?.meta} onPageChange={setPage} />
      </Card>
      {editing !== undefined ? <MedicineDialog medicine={editing} pending={save.isPending} onClose={() => setEditing(undefined)} onSubmit={(values) => save.mutate({ id: editing?.id, values })} /> : null}
      {showImport ? <MedicineImportDialog pending={importCatalog.isPending} onClose={() => setShowImport(false)} onImport={(file) => importCatalog.mutate(file)} /> : null}
    </section>
  );
}

function StatusBadge({ status }: { status: MedicineStatus }) { return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>; }

function MedicineDialog({ medicine, pending, onClose, onSubmit }: { medicine: Medicine | null; pending: boolean; onClose: () => void; onSubmit: (values: MedicineInput) => void }) {
  const [values, setValues] = useState<MedicineInput>(medicine ? { name: medicine.name, genericName: medicine.genericName ?? '', strength: medicine.strength ?? '', form: medicine.form ?? '', status: medicine.status } : emptyMedicine);
  const update = (field: keyof MedicineInput, value: string) => setValues((current) => ({ ...current, [field]: value }));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><Card className="w-full max-w-lg"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{medicine ? 'Edit Medicine' : 'Add Medicine'}</h2><p className="text-sm text-muted-foreground">This catalog is shared with prescription selection.</p></div><Button type="button" variant="secondary" className="w-9 px-0" onClick={onClose} aria-label="Close medicine form"><X className="size-4" /></Button></div><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}><label className="grid gap-1.5 sm:col-span-2"><span className="text-sm font-medium">Medicine Name *</span><Input value={values.name} onChange={(event) => update('name', event.target.value)} required maxLength={160} autoFocus /></label><label className="grid gap-1.5"><span className="text-sm font-medium">Generic Name</span><Input value={values.genericName} onChange={(event) => update('genericName', event.target.value)} maxLength={120} /></label><label className="grid gap-1.5"><span className="text-sm font-medium">Strength</span><Input value={values.strength} onChange={(event) => update('strength', event.target.value)} maxLength={120} /></label><label className="grid gap-1.5"><span className="text-sm font-medium">Form</span><Input value={values.form} onChange={(event) => update('form', event.target.value)} placeholder="Tablet, Cream, Gel…" maxLength={120} /></label><label className="grid gap-1.5"><span className="text-sm font-medium">Status</span><Select value={values.status} onChange={(event) => update('status', event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></Select></label><div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || !values.name.trim()}>{pending ? 'Saving…' : medicine ? 'Save Changes' : 'Add Medicine'}</Button></div></form></Card></div>;
}

function MedicineImportDialog({ pending, onClose, onImport }: { pending: boolean; onClose: () => void; onImport: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><Card className="w-full max-w-lg"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Import Medicines</h2><p className="text-sm text-muted-foreground">Upload a CSV, XLSX, or XLS file to add medicines to the shared prescription catalog.</p></div><Button type="button" variant="secondary" className="w-9 px-0" onClick={onClose} aria-label="Close medicine import"><X className="size-4" /></Button></div><div className="mt-5 rounded-md border border-dashed p-4"><label className="grid cursor-pointer gap-2 text-sm font-medium"><span>Import file</span><Input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span className="text-xs font-normal text-muted-foreground">Required: a Medicine Name, Product Name, Item Name, or Name column. Optional: Generic Name, Strength or Packing, Form, Status.</span></label>{file ? <p className="mt-3 text-sm text-foreground">Selected: {file.name}</p> : null}</div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" disabled={!file || pending} onClick={() => file && onImport(file)}>{pending ? 'Importing…' : 'Import Medicines'}</Button></div></Card></div>;
}
