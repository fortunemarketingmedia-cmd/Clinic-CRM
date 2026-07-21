'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ClipboardList, Database, Download, QrCode, Receipt, Save, Settings2, UserCog } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { UsersView } from '@/modules/users/users-view';
import { apiRequest } from '@/services/api';
import type { Lead } from '@/types/lead';
import type { Patient } from '@/types/patient';

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
  invoicePrefix: z.string().min(1),
  gstPercent: z.coerce.number().min(0).max(100),
  invoiceTerms: z.string().optional(),
  invoiceSignature: z.string().optional(),
  invoiceFooter: z.string().optional(),
  paymentInstructions: z.string().optional(),
  qrRegistrationEnabled: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

type SettingsResponse = SettingsValues & {
  patientFormConfig?: Record<string, FieldMode>;
};

type FieldMode = 'REQUIRED' | 'OPTIONAL' | 'HIDDEN';
type SettingsSection = 'OVERVIEW' | 'CLINIC' | 'INTAKE' | 'BILLING' | 'TEAM' | 'DATA';

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

export function SettingsView() {
  const queryClient = useQueryClient();
  const [fieldModes, setFieldModes] = useState<Record<string, FieldMode>>(defaultFieldModes);
  const [activeSection, setActiveSection] = useState<SettingsSection>('OVERVIEW');
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
      invoicePrefix: 'REV-',
      gstPercent: 0,
      invoiceTerms: '',
      invoiceSignature: '',
      invoiceFooter: '',
      paymentInstructions: '',
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
      invoicePrefix: settings.invoicePrefix ?? 'REV-',
      gstPercent: Number(settings.gstPercent ?? 0),
      invoiceTerms: settings.invoiceTerms ?? '',
      invoiceSignature: settings.invoiceSignature ?? '',
      invoiceFooter: settings.invoiceFooter ?? '',
      paymentInstructions: settings.paymentInstructions ?? '',
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

  async function exportPatients() {
    const response = await apiRequest<{ data: Patient[] }>('/patients');
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

  async function exportRevenue() {
    const response = await apiRequest<{ data: { totals: Record<string, string | number> } }>('/analytics');
    downloadCsv('revive-revenue.csv', [response.data.totals]);
  }

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-3">{activeSection !== 'OVERVIEW' ? <Button type="button" variant="secondary" className="w-10 px-0" onClick={() => setActiveSection('OVERVIEW')} aria-label="Back to settings"><ChevronLeft className="size-4" /></Button> : null}<div><h1 className="text-2xl font-semibold">{activeSection === 'OVERVIEW' ? 'Settings' : ({ CLINIC: 'Clinic profile', INTAKE: 'Patient intake', BILLING: 'Billing & invoices', TEAM: 'Team & access', DATA: 'Data & exports', OVERVIEW: 'Settings' } as const)[activeSection]}</h1><p className="text-sm text-muted-foreground">Configure the CRM in focused sections without an overwhelming long form.</p></div></div>
      </div>

      {activeSection === 'OVERVIEW' ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingsTile icon={Settings2} title="Clinic profile" description="Identity, contact details and business information" onClick={() => setActiveSection('CLINIC')} />
        <SettingsTile icon={ClipboardList} title="Patient intake" description="QR registration and patient form visibility" onClick={() => setActiveSection('INTAKE')} />
        <SettingsTile icon={Receipt} title="Billing & invoices" description="GST, invoice numbering, terms and payment text" onClick={() => setActiveSection('BILLING')} />
        <SettingsTile icon={UserCog} title="Team & access" description="Users, roles and branch access" onClick={() => setActiveSection('TEAM')} />
        <SettingsTile icon={Database} title="Data & exports" description="Export patient, lead and revenue records" onClick={() => setActiveSection('DATA')} />
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
            <Field label="Opening Hours"><Input placeholder="Mon–Sat, 10:00 AM–7:00 PM" {...form.register('openingHours')} /></Field>
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

        {activeSection === 'BILLING' ? (
        <Card>
          <h2 className="text-base font-semibold">Invoice Settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Invoice Prefix"><Input {...form.register('invoicePrefix')} /></Field>
            <Field label="GST %"><Input type="number" step="0.01" {...form.register('gstPercent')} /></Field>
            <Field label="Terms & Conditions"><textarea className="min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary" {...form.register('invoiceTerms')} /></Field>
            <Field label="Signature"><Input {...form.register('invoiceSignature')} /></Field>
            <Field label="Footer"><Input {...form.register('invoiceFooter')} /></Field>
            <Field label="Payment Instructions"><textarea className="min-h-24 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary" {...form.register('paymentInstructions')} /></Field>
          </div>
        </Card>
        ) : null}

        <Button type="submit" disabled={saveSettings.isPending}>
          <Save className="size-4" />
          Save Settings
        </Button>
      </form> : null}

      {activeSection === 'TEAM' ? <UsersView /> : null}

      {activeSection === 'DATA' ? (
      <Card>
        <h2 className="text-base font-semibold">Export CSV</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={exportPatients}><Download className="size-4" />Export Patients</Button>
          <Button type="button" variant="secondary" onClick={exportRevenue}><Download className="size-4" />Export Revenue</Button>
          <Button type="button" variant="secondary" onClick={exportLeads}><Download className="size-4" />Export Leads</Button>
        </div>
      </Card>
      ) : null}
    </section>
  );
}

function SettingsTile({ icon: Icon, title, description, onClick }: { icon: typeof Settings2; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group rounded-xl border border-border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div><h2 className="mt-4 font-semibold group-hover:text-primary">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p><span className="mt-4 inline-block text-sm font-medium text-primary">Open settings →</span></button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
