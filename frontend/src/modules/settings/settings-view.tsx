'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, QrCode, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { UsersView } from '@/modules/users/users-view';
import { apiRequest } from '@/services/api';
import type { Branch } from '@/types/branch';
import type { Lead } from '@/types/lead';
import type { Patient } from '@/types/patient';

const settingsSchema = z.object({
  clinicName: z.string().min(2),
  clinicEmail: z.string().email().optional().or(z.literal('')),
  clinicLogoUrl: z.string().optional(),
  businessPhone: z.string().optional(),
  businessAddress: z.string().optional(),
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
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => apiRequest<{ data: SettingsResponse }>('/settings') });
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: () => apiRequest<{ data: Branch[] }>('/branches') });

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      clinicName: 'Revive Clinic',
      clinicEmail: '',
      clinicLogoUrl: '',
      businessPhone: '',
      businessAddress: '',
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

  const updateBranch = useMutation({
    mutationFn: ({ id, address, phone }: { id: string; address: string; phone: string }) =>
      apiRequest(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify({ address, phone }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  });

  const branchDrafts = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);

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
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Clinic, branches, users, QR registration, patient form, invoice, and exports.</p>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit((values) => saveSettings.mutate(values))}>
        <Card>
          <h2 className="text-base font-semibold">Clinic Settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Clinic Name"><Input {...form.register('clinicName')} /></Field>
            <Field label="Logo URL"><Input {...form.register('clinicLogoUrl')} /></Field>
            <Field label="Email"><Input {...form.register('clinicEmail')} /></Field>
            <Field label="Mobile Number"><Input {...form.register('businessPhone')} /></Field>
            <Field label="GST Number"><Input {...form.register('gstNumber')} /></Field>
            <Field label="Clinic Address"><Input {...form.register('businessAddress')} /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Branches</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {branchDrafts.map((branch) => (
              <BranchEditor key={branch.id} branch={branch} onSave={(values) => updateBranch.mutate({ id: branch.id, ...values })} />
            ))}
          </div>
        </Card>

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

        <Button type="submit" disabled={saveSettings.isPending}>
          <Save className="size-4" />
          Save Settings
        </Button>
      </form>

      <UsersView />

      <Card>
        <h2 className="text-base font-semibold">Export CSV</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={exportPatients}><Download className="size-4" />Export Patients</Button>
          <Button type="button" variant="secondary" onClick={exportRevenue}><Download className="size-4" />Export Revenue</Button>
          <Button type="button" variant="secondary" onClick={exportLeads}><Download className="size-4" />Export Leads</Button>
        </div>
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function BranchEditor({ branch, onSave }: { branch: Branch; onSave: (values: { address: string; phone: string }) => void }) {
  const [address, setAddress] = useState(branch.address);
  const [phone, setPhone] = useState(branch.phone);

  useEffect(() => {
    setAddress(branch.address);
    setPhone(branch.phone);
  }, [branch.address, branch.phone]);

  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="font-semibold">{branch.name}</h3>
      <div className="mt-3 space-y-3">
        <Field label="Address"><Input value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
        <Field label="Contact Number"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
        <Button type="button" variant="secondary" onClick={() => onSave({ address, phone })}>Save Branch</Button>
      </div>
    </div>
  );
}
