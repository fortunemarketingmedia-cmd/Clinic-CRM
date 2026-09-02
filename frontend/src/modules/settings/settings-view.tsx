'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ClipboardList, Database, Download, QrCode, Save, Upload, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { UsersView } from '@/modules/users/users-view';
import { apiRequest } from '@/services/api';
import type { Lead } from '@/types/lead';
import type { Patient } from '@/types/patient';
import { useSessionStore } from '@/store/session-store';

const settingsSchema = z.object({
  clinicName: z.string().min(2),
  clinicEmail: z.string().email().optional().or(z.literal('')),
  clinicLogoUrl: z.string().optional(),
  businessPhone: z.string().optional(),
  businessAddress: z.string().optional(),
  legalName: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  registrationNumber: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  openingHours: z.string().optional(),
  timezone: z.string().optional(),
  gstNumber: z.string().optional(),
  qrRegistrationEnabled: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

type SettingsResponse = SettingsValues & {
  patientFormConfig?: Record<string, FieldMode>;
};

type FieldMode = 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
type SettingsSection = 'OVERVIEW' | 'CLINIC' | 'INTAKE' | 'TEAM' | 'DATA';

const patientFields = [
  'Name',
  'Mobile',
  'Address',
  'Medical History',
  'Products Used',
  'Pregnancy',
  'Allergy',
  'Occupation',
  'Blood Group',
];

const defaultFieldModes = patientFields.reduce<Record<string, FieldMode>>((acc, field) => {
  acc[field] = ['Name', 'Mobile'].includes(field) ? 'REQUIRED' : 'OPTIONAL';
  return acc;
}, {});

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  const headers = Object.keys(rows[0] ?? { message: 'No data' });
  const escape = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ImportPatient = { fullName: string; mobile: string; email?: string; age?: number; sex?: 'MALE' | 'FEMALE' | 'OTHER'; address?: string; occupation?: string; maritalStatus?: string; referredBy?: string; medicalHistory?: string; notes?: string };
type ImportResult = { received: number; imported: number; skipped: number; failed: number; errors: Array<{ row: number; name: string; message: string }> };

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += character;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function patientRowsFromCsv(text: string): ImportPatient[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The CSV must contain a header row and at least one patient.');
  const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const headers = rows[0].map(key);
  const column = (...names: string[]) => names.map(key).map((name) => headers.indexOf(name)).find((index) => index !== -1) ?? -1;
  const nameIndex = column('fullName', 'name', 'patientName');
  const mobileIndex = column('mobile', 'phone', 'mobileNumber', 'phoneNumber');
  if (nameIndex < 0 || mobileIndex < 0) throw new Error('CSV headers must include Name (or Full Name) and Mobile.');
  const optional = (values: string[], ...names: string[]) => { const index = column(...names); return index >= 0 && values[index]?.trim() ? values[index].trim() : undefined; };
  return rows.slice(1).map((values, index) => {
    const fullName = values[nameIndex]?.trim(); const mobile = values[mobileIndex]?.replace(/\s+/g, '');
    if (!fullName || !mobile) throw new Error(`Row ${index + 2} is missing Name or Mobile.`);
    const sexValue = optional(values, 'sex', 'gender')?.toUpperCase();
    const ageValue = optional(values, 'age');
    return { fullName, mobile, email: optional(values, 'email'), age: ageValue ? Number(ageValue) : undefined, sex: sexValue && ['MALE', 'FEMALE', 'OTHER'].includes(sexValue) ? sexValue as ImportPatient['sex'] : undefined, address: optional(values, 'address'), occupation: optional(values, 'occupation'), maritalStatus: optional(values, 'maritalStatus'), referredBy: optional(values, 'referredBy', 'referral'), medicalHistory: optional(values, 'medicalHistory'), notes: optional(values, 'notes', 'note') };
  });
}

export function SettingsView() {
  const queryClient = useQueryClient();
  const { selectedBranchId } = useSessionStore();
  const [fieldModes, setFieldModes] = useState<Record<string, FieldMode>>(defaultFieldModes);
  const [activeSection, setActiveSection] = useState<SettingsSection>('OVERVIEW');
  const [importRows, setImportRows] = useState<ImportPatient[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => apiRequest<{ data: SettingsResponse }>('/settings') });

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      clinicName: 'Revive Clinic',
      clinicEmail: '',
      clinicLogoUrl: '',
      businessPhone: '',
      businessAddress: '',
      legalName: '',
      website: '',
      registrationNumber: '',
      city: '',
      state: '',
      postalCode: '',
      openingHours: '',
      timezone: 'Asia/Kolkata',
      gstNumber: '',
      qrRegistrationEnabled: true,
    },
  });

  const clinicQrUrl = typeof window !== 'undefined' ? `${window.location.origin}/qr/clinic` : '/qr/clinic';
  const clinicQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(clinicQrUrl)}`;

  useEffect(() => {
    const settings = settingsQuery.data?.data;
    if (!settings) return;

    form.reset({
      clinicName: settings.clinicName ?? 'Revive Clinic',
      clinicEmail: settings.clinicEmail ?? '',
      clinicLogoUrl: settings.clinicLogoUrl ?? '',
      businessPhone: settings.businessPhone ?? '',
      businessAddress: settings.businessAddress ?? '',
      legalName: settings.legalName ?? '',
      website: settings.website ?? '',
      registrationNumber: settings.registrationNumber ?? '',
      city: settings.city ?? '',
      state: settings.state ?? '',
      postalCode: settings.postalCode ?? '',
      openingHours: settings.openingHours ?? '',
      timezone: settings.timezone ?? 'Asia/Kolkata',
      gstNumber: settings.gstNumber ?? '',
      qrRegistrationEnabled: settings.qrRegistrationEnabled ?? true,
    });
    setFieldModes({ ...defaultFieldModes, ...(settings.patientFormConfig ?? {}) });
  }, [form, settingsQuery.data]);

  const saveSettings = useMutation({
    mutationFn: (values: SettingsValues) =>
      apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ ...values, patientFormConfig: fieldModes }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  const importPatients = useMutation({
    mutationFn: () => apiRequest<{ data: ImportResult }>('/patients/import', { method: 'POST', body: JSON.stringify({ branchId: selectedBranchId, rows: importRows }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patients'] }); queryClient.invalidateQueries({ queryKey: ['clients-patients'] }); queryClient.invalidateQueries({ queryKey: ['clients-analytics'] }); queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }); },
  });

  async function exportPatients() {
    const response = await apiRequest<{ data: Patient[] }>('/patients');
    await apiRequest('/security/exports', { method: 'POST', body: JSON.stringify({ resourceType: 'PATIENTS', format: 'CSV', rowCount: response.data.length, status: 'COMPLETED', purpose: 'Administrator requested clinic data export' }) });
    downloadCsv(
      'revive-patients.csv',
      response.data.map((patient) => ({
        patientNo: patient.patientNo,
        name: patient.fullName,
        mobile: patient.mobile,
        branch: patient.branch?.name,
        source: patient.lead?.source,
      })),
    );
  }

  async function exportLeads() {
    const response = await apiRequest<{ data: Lead[] }>('/leads');
    await apiRequest('/security/exports', { method: 'POST', body: JSON.stringify({ resourceType: 'LEADS', format: 'CSV', rowCount: response.data.length, status: 'COMPLETED', purpose: 'Administrator requested clinic data export' }) });
    downloadCsv(
      'revive-leads.csv',
      response.data.map((lead) => ({
        name: lead.name,
        mobile: lead.mobile,
        source: lead.source,
        status: lead.status,
        branch: lead.branch?.name,
        campaign: lead.adLeads?.[0]?.campaignName,
      })),
    );
  }

  if (settingsQuery.isLoading) return <PageSkeleton />;

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-3">{activeSection !== 'OVERVIEW' ? <Button type="button" variant="secondary" className="w-10 px-0" onClick={() => setActiveSection('OVERVIEW')} aria-label="Back to settings"><ChevronLeft className="size-4" /></Button> : null}<div><h1 className="text-2xl font-semibold">{activeSection === 'OVERVIEW' ? 'Settings' : ({ CLINIC: 'Clinic profile', INTAKE: 'Patient intake', TEAM: 'Team & access', DATA: 'Data & exports', OVERVIEW: 'Settings' } as const)[activeSection]}</h1><p className="text-sm text-muted-foreground">Configure the CRM in focused sections without an overwhelming long form.</p></div></div>
      </div>

      {activeSection === 'OVERVIEW' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingsTile icon={ClipboardList} title="Patient intake" description="QR registration and patient form visibility" onClick={() => setActiveSection('INTAKE')} />
        <SettingsTile icon={UserCog} title="Team & access" description="Users, roles and branch access" onClick={() => setActiveSection('TEAM')} />
        <SettingsTile icon={Database} title="Data & exports" description="Export patient and lead records with governance logs" onClick={() => setActiveSection('DATA')} />
      </div> : null}

      {activeSection !== 'OVERVIEW' && activeSection !== 'TEAM' && activeSection !== 'DATA' ? <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveSettings.mutate(values))}>
        {activeSection === 'CLINIC' ? (
        <Card>
          <h2 className="text-base font-semibold">Clinic Settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Clinic Name"><Input {...form.register('clinicName')} /></Field>
            <Field label="Legal / Registered Name"><Input {...form.register('legalName')} /></Field>
            <Field label="Logo URL"><Input {...form.register('clinicLogoUrl')} /></Field>
            <Field label="Email"><Input {...form.register('clinicEmail')} /></Field>
            <Field label="Mobile Number"><Input {...form.register('businessPhone')} /></Field>
            <Field label="Website"><Input placeholder="https://" {...form.register('website')} /></Field>
            <Field label="Clinic Registration Number"><Input {...form.register('registrationNumber')} /></Field>
            <Field label="GST Number"><Input {...form.register('gstNumber')} /></Field>
            <Field label="Clinic Address"><Input {...form.register('businessAddress')} /></Field>
            <Field label="City"><Input {...form.register('city')} /></Field>
            <Field label="State"><Input {...form.register('state')} /></Field>
            <Field label="PIN / Postal Code"><Input {...form.register('postalCode')} /></Field>
            <Field label="Opening Hours"><Input placeholder="Mon-Sat, 10:00 AM-7:00 PM" {...form.register('openingHours')} /></Field>
            <Field label="Timezone"><Select {...form.register('timezone')}><option value="Asia/Kolkata">India Standard Time (IST)</option><option value="UTC">UTC</option></Select></Field>
          </div>
        </Card>
        ) : null}

        {activeSection === 'INTAKE' ? <>
        <Card>
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            <h2 className="text-base font-semibold">QR Registration Settings</h2>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-md border border-border bg-white p-4">
              <img src={clinicQrImage} alt="Clinic registration QR code" className="mx-auto size-64" />
            </div>
            <div className="space-y-4">
              <Field label="QR URL"><Input value={clinicQrUrl} readOnly /></Field>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" {...form.register('qrRegistrationEnabled')} />
                Enable QR Registration
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => window.print()}>Download / Print QR</Button>
                <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(clinicQrUrl)}>Copy QR URL</Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Patient Form Builder</h2>
          <div className="mt-4 overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr><th className="px-4 py-3 font-medium">Field</th><th className="px-4 py-3 font-medium">Visibility</th></tr>
              </thead>
              <tbody>
                {patientFields.map((field) => (
                  <tr key={field} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{field}</td>
                    <td className="px-4 py-3">
                      <Select value={fieldModes[field]} onChange={(event) => setFieldModes((current) => ({ ...current, [field]: event.target.value as FieldMode }))}>
                        <option value="REQUIRED">Required</option>
                        <option value="OPTIONAL">Optional</option>
                        <option value="HIDDEN">Hidden</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </> : null}

        <Button type="submit" disabled={saveSettings.isPending}>
          <Save className="size-4" />
          Save Settings
        </Button>
      </form> : null}

      {activeSection === 'TEAM' ? <UsersView /> : null}

      {activeSection === 'DATA' ? (
      <div className="space-y-5">
        <Card>
          <h2 className="text-base font-semibold">Upload previous patient data</h2>
          <p className="mt-1 text-sm text-muted-foreground">Import past and ongoing patient records into the patient directory. Existing patients with the same mobile or email are safely skipped.</p>
          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <label className="block text-sm font-medium">Patient CSV file<Input className="mt-2" type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; setImportError(''); importPatients.reset(); if (!file) { setImportRows([]); setImportFileName(''); return; } try { const rows = patientRowsFromCsv(await file.text()); setImportRows(rows); setImportFileName(file.name); } catch (error) { setImportRows([]); setImportFileName(file.name); setImportError(error instanceof Error ? error.message : 'The CSV could not be read.'); } }} /></label>
            <p className="mt-2 text-xs text-muted-foreground">Required columns: Name, Mobile. Optional: Email, Age, Sex, Address, Occupation, Marital Status, Referred By, Medical History, Notes.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => downloadCsv('revive-patient-import-template.csv', [{ Name: 'Example Patient', Mobile: '9876543210', Email: 'patient@example.com', Age: 32, Sex: 'FEMALE', Address: '', Occupation: '', 'Marital Status': '', 'Referred By': '', 'Medical History': '', Notes: '' }])}><Download className="size-4" />Download CSV template</Button>
          </div>
          {importFileName && importRows.length ? <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><strong>{importFileName}</strong> is ready: {importRows.length.toLocaleString('en-IN')} patient rows found.</div> : null}
          {!selectedBranchId ? <p className="mt-3 text-sm font-medium text-amber-700">Choose a specific branch from the top bar before importing patients.</p> : null}
          {importError ? <p className="mt-3 text-sm text-red-600">{importError}</p> : null}
          {importPatients.isError ? <p className="mt-3 text-sm text-red-600">{importPatients.error.message}</p> : null}
          {importPatients.data ? <div className="mt-4 rounded-lg border border-border p-4"><h3 className="font-medium">Import complete</h3><p className="mt-1 text-sm text-muted-foreground">Imported {importPatients.data.data.imported}, skipped {importPatients.data.data.skipped} duplicates, failed {importPatients.data.data.failed}.</p>{importPatients.data.data.errors.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">View skipped/failed rows</summary><ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-muted-foreground">{importPatients.data.data.errors.map((error) => <li key={`${error.row}-${error.name}`}>Row {error.row}: {error.name} — {error.message}</li>)}</ul></details> : null}</div> : null}
          <Button className="mt-4" type="button" disabled={!selectedBranchId || !importRows.length || importPatients.isPending} onClick={() => importPatients.mutate()}><Upload className="size-4" />{importPatients.isPending ? 'Importing patients...' : `Import ${importRows.length || ''} patients`}</Button>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Export CSV</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={exportPatients}><Download className="size-4" />Export Patients</Button>
            <Button type="button" variant="secondary" onClick={exportLeads}><Download className="size-4" />Export Leads</Button>
          </div>
        </Card>
      </div>
      ) : null}
    </section>
  );
}

function SettingsTile({ icon: Icon, title, description, onClick }: { icon: React.ElementType; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group rounded-xl border border-border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div><h2 className="mt-4 font-semibold group-hover:text-primary">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p><span className="mt-4 inline-block text-sm font-medium text-primary">Open settings to</span></button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
