'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus, FileText, Pencil, Plus, Search, Stethoscope, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Invoice } from '@/types/billing';
import type { Branch } from '@/types/branch';
import type { TimelineEvent } from '@/types/lead';
import type { Patient, PatientFile, PatientSession } from '@/types/patient';

const medicalSchema = z.object({
  referredBy: z.string().optional(),
  skinConcern: z.string().optional(),
  hairConcern: z.string().optional(),
  medicalHistory: z.string().optional(),
  currentMedications: z.string().optional(),
  allergyToDrugs: z.string().optional(),
  notes: z.string().optional(),
});

const sessionSchema = z.object({
  visitDate: z.string().min(1),
  doctorConsulted: z.string().optional(),
  treatmentSuggested: z.string().optional(),
  treatmentTaken: z.string().optional(),
  medicinesPrescribed: z.string().optional(),
  notes: z.string().optional(),
  followupDate: z.string().optional(),
});

const patientCreateSchema = z.object({
  branchId: z.string().min(1),
  referredBy: z.string().optional(),
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  age: z.coerce.number().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  mobile: z.string().min(8),
  address: z.string().optional(),
  maritalStatus: z.string().optional(),
  occupation: z.string().optional(),
  skinConcern: z.string().optional(),
  hairConcern: z.string().optional(),
  medicalHistory: z.string().optional(),
  currentMedications: z.string().optional(),
  allergyToDrugs: z.string().optional(),
  keloidOrHypertrophicScar: z.string().optional(),
  productsCurrentlyUsed: z.string().optional(),
  menstrualHistory: z.string().optional(),
  pregnancyStatus: z.string().optional(),
  notes: z.string().optional(),
});

const fileSchema = z.object({
  category: z.enum(['IMAGE', 'PRESCRIPTION', 'REPORT', 'INVOICE', 'OTHER']),
  name: z.string().min(1),
  url: z.string().min(1),
});

const invoiceSchema = z.object({
  serviceName: z.string().min(2),
  consultationFee: z.coerce.number().min(0).default(0),
  packageFee: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  gstAmount: z.coerce.number().min(0).default(0),
});

const patientEditSchema = z.object({
  fullName: z.string().min(2),
  mobile: z.string().min(8),
  email: z.string().email().optional().or(z.literal('')),
  age: z.coerce.number().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
});

export function PatientsView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId, setSelectedBranchId, hasHydrated } = useSessionStore();

  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activePatientTab, setActivePatientTab] = useState<'details' | 'medical' | 'sessions' | 'files' | 'invoices' | 'timeline'>('details');
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [showCreatePatient, setShowCreatePatient] = useState(false);

  const isAdmin = session?.user.role === 'ADMIN';

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
    enabled: hasHydrated && Boolean(session),
  });

  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);

  useEffect(() => {
    if (!hasHydrated || branches.length === 0) {
      return;
    }

    if (isAdmin && selectedBranchId === null) {
      setSelectedBranchId('');
      return;
    }

    if (!isAdmin && (!selectedBranchId || !branches.some((branch) => branch.id === selectedBranchId))) {
      setSelectedBranchId(branches[0].id);
      return;
    }

    if (selectedBranchId && !branches.some((branch) => branch.id === selectedBranchId)) {
      setSelectedBranchId(isAdmin ? '' : branches[0].id);
    }
  }, [branches, hasHydrated, isAdmin, selectedBranchId, setSelectedBranchId]);

  const activeBranchId = selectedBranchId ?? (isAdmin ? '' : branches[0]?.id ?? '');
  const formBranchId = activeBranchId || branches[0]?.id || '';

  const patientQueryString = useMemo(() => {
    const params = new URLSearchParams();

    if (!isAdmin || activeBranchId) {
      params.set('branchId', activeBranchId);
    }

    if (search.trim()) {
      params.set('search', search.trim());
    }

    return params.toString();
  }, [activeBranchId, isAdmin, search]);

  const patientsQuery = useQuery({
    queryKey: ['patients', patientQueryString],
    queryFn: () => apiRequest<{ data: Patient[] }>(`/patients?${patientQueryString}`),
    enabled: hasHydrated && Boolean(session) && Boolean(isAdmin || activeBranchId),
  });

  const selectedPatient = patientsQuery.data?.data.find((patient) => patient.id === selectedPatientId);

  const sessionsQuery = useQuery({
    queryKey: ['patient-sessions', selectedPatient?.id],
    queryFn: () => apiRequest<{ data: PatientSession[] }>(`/patients/${selectedPatient?.id}/sessions`),
    enabled: Boolean(selectedPatient?.id),
  });

  const filesQuery = useQuery({
    queryKey: ['patient-files', selectedPatient?.id],
    queryFn: () => apiRequest<{ data: PatientFile[] }>(`/patients/${selectedPatient?.id}/files`),
    enabled: Boolean(selectedPatient?.id),
  });

  const invoicesQuery = useQuery({
    queryKey: ['patient-invoices', selectedPatient?.id],
    queryFn: () => apiRequest<{ data: Invoice[] }>(`/billing/invoices?patientId=${selectedPatient?.id}`),
    enabled: Boolean(selectedPatient?.id),
  });

  const timelineQuery = useQuery({
    queryKey: ['patient-timeline', selectedPatient?.id],
    queryFn: () => apiRequest<{ data: TimelineEvent[] }>(`/patients/${selectedPatient?.id}/timeline`),
    enabled: Boolean(selectedPatient?.id),
  });

  const medicalForm = useForm<z.infer<typeof medicalSchema>>({
    resolver: zodResolver(medicalSchema),
  });

  const sessionForm = useForm<z.infer<typeof sessionSchema>>({
    resolver: zodResolver(sessionSchema),
    defaultValues: { visitDate: '' },
  });

  const fileForm = useForm<z.infer<typeof fileSchema>>({
    resolver: zodResolver(fileSchema),
    defaultValues: { category: 'OTHER' },
  });

  const invoiceForm = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { serviceName: '', consultationFee: 0, packageFee: 0, discount: 0, gstAmount: 0 },
  });

  const patientForm = useForm<z.infer<typeof patientEditSchema>>({
    resolver: zodResolver(patientEditSchema),
  });

  const createPatientForm = useForm<z.infer<typeof patientCreateSchema>>({
    resolver: zodResolver(patientCreateSchema),
    defaultValues: { branchId: formBranchId, fullName: '', mobile: '' },
  });

  useEffect(() => {
    if (formBranchId) createPatientForm.setValue('branchId', formBranchId);
  }, [createPatientForm, formBranchId]);

  useEffect(() => {
    setSelectedPatientId(null);
    setActivePatientTab('details');
    setIsEditingPatient(false);
  }, [activeBranchId]);

  useEffect(() => {
    if (!selectedPatient) return;
    patientForm.reset({
      fullName: selectedPatient.fullName,
      mobile: selectedPatient.mobile,
      email: selectedPatient.email ?? '',
      age: selectedPatient.age ?? undefined,
      sex: selectedPatient.sex ?? undefined,
      address: selectedPatient.address ?? '',
      occupation: selectedPatient.occupation ?? '',
      maritalStatus: selectedPatient.maritalStatus ?? '',
    });
  }, [patientForm, selectedPatient]);

  const updatePatient = useMutation({
    mutationFn: (values: z.infer<typeof patientEditSchema>) =>
      apiRequest<{ data: Patient }>(`/patients/${selectedPatient?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...values, email: values.email || undefined }),
      }),
    onSuccess: () => {
      setIsEditingPatient(false);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const createPatient = useMutation({
    mutationFn: (values: z.infer<typeof patientCreateSchema>) =>
      apiRequest<{ data: Patient }>('/patients', {
        method: 'POST',
        body: JSON.stringify({ ...values, email: values.email || undefined }),
      }),
    onSuccess: (result) => {
      createPatientForm.reset({ branchId: formBranchId, fullName: '', mobile: '' });
      setShowCreatePatient(false);
      setSelectedPatientId(result.data.id);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-patients'] });
    },
  });

  const saveMedical = useMutation({
    mutationFn: (values: z.infer<typeof medicalSchema>) =>
      apiRequest(`/patients/${selectedPatient?.id}/medical-profile`, {
        method: 'PUT',
        body: JSON.stringify(values),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patients'] }),
  });

  const createSession = useMutation({
    mutationFn: (values: z.infer<typeof sessionSchema>) =>
      apiRequest(`/patients/${selectedPatient?.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      sessionForm.reset({ visitDate: '' });
      queryClient.invalidateQueries({ queryKey: ['patient-sessions'] });
    },
  });

  const createFile = useMutation({
    mutationFn: (values: z.infer<typeof fileSchema>) =>
      apiRequest(`/patients/${selectedPatient?.id}/files`, {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      fileForm.reset({ category: 'OTHER', name: '', url: '' });
      queryClient.invalidateQueries({ queryKey: ['patient-files'] });
    },
  });

  const createInvoice = useMutation({
    mutationFn: (values: z.infer<typeof invoiceSchema>) =>
      apiRequest<{ data: Invoice }>('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          patientId: selectedPatient?.id,
          branchId: selectedPatient?.branchId,
        }),
      }),
    onSuccess: () => {
      invoiceForm.reset({ serviceName: '', consultationFee: 0, packageFee: 0, discount: 0, gstAmount: 0 });
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="text-sm text-muted-foreground">Patients are created from QR registration after an appointment or walk-in intake.</p>
        </div>

        <Button type="button" onClick={() => setShowCreatePatient(true)}>
          <Plus className="size-4" />
          Create Patient
        </Button>
      </div>

      <Card>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_240px]">
          <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
              placeholder="Search patient name, mobile, or patient no"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          {isAdmin ? (
            <Select aria-label="Branch filter" value={activeBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {patientsQuery.data?.data.map((patient) => (
                <tr key={patient.id} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => {
                  setSelectedPatientId(patient.id);
                  setActivePatientTab('details');
                }}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{patient.fullName}</div>
                    <div className="text-xs text-muted-foreground">{patient.patientNo}</div>
                  </td>
                  <td className="px-4 py-3">{patient.mobile}</td>
                  <td className="px-4 py-3">{patient.branch?.name}</td>
                  <td className="px-4 py-3">{patient.lead?.source?.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <Button type="button" variant="secondary" onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPatientId(patient.id);
                      setActivePatientTab('details');
                    }}>
                      View Profile
                    </Button>
                  </td>
                </tr>
              ))}
              {!patientsQuery.isLoading && patientsQuery.data?.data.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    No patients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreatePatient ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Create Patient</h2>
                <p className="text-sm text-muted-foreground">Same details as the clinic QR registration form.</p>
              </div>
              <Button type="button" variant="secondary" className="w-10 px-0" onClick={() => setShowCreatePatient(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={createPatientForm.handleSubmit((values) => createPatient.mutate(values))}>
              <Select {...createPatientForm.register('branchId')}>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <Input placeholder="Referred by" {...createPatientForm.register('referredBy')} />
              <Input placeholder="Full name" {...createPatientForm.register('fullName')} />
              <Input type="email" placeholder="Email" {...createPatientForm.register('email')} />
              <Input type="number" placeholder="Age" {...createPatientForm.register('age')} />
              <Select {...createPatientForm.register('sex')}>
                <option value="">Sex</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
              <Input placeholder="Contact number" {...createPatientForm.register('mobile')} />
              <Input placeholder="Address" {...createPatientForm.register('address')} />
              <Input placeholder="Marital status" {...createPatientForm.register('maritalStatus')} />
              <Input placeholder="Occupation" {...createPatientForm.register('occupation')} />
              <Input placeholder="Skin concern" {...createPatientForm.register('skinConcern')} />
              <Input placeholder="Hair concern" {...createPatientForm.register('hairConcern')} />
              <Input placeholder="Medical history" {...createPatientForm.register('medicalHistory')} />
              <Input placeholder="Current medications" {...createPatientForm.register('currentMedications')} />
              <Input placeholder="Allergy to drugs" {...createPatientForm.register('allergyToDrugs')} />
              <Input placeholder="Keloid / hypertrophic scar history" {...createPatientForm.register('keloidOrHypertrophicScar')} />
              <Input placeholder="Products currently used" {...createPatientForm.register('productsCurrentlyUsed')} />
              <Input placeholder="Menstrual history" {...createPatientForm.register('menstrualHistory')} />
              <Input placeholder="Pregnancy status" {...createPatientForm.register('pregnancyStatus')} />
              <Input placeholder="Other notes" {...createPatientForm.register('notes')} />
              {createPatient.error ? (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">{createPatient.error.message}</div>
              ) : null}
              <div className="md:col-span-2">
                <Button type="submit" disabled={createPatient.isPending}>
                  Create Patient
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {selectedPatient ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-6xl">
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedPatient.fullName}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedPatient.patientNo} · {selectedPatient.mobile} · {selectedPatient.branch?.name}
                </p>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  QR registration link:{' '}
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/qr/${selectedPatient.qrToken}`
                    : `/qr/${selectedPatient.qrToken}`}
                </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setIsEditingPatient((value) => !value)}>
                    <Pencil className="size-4" />
                    {isEditingPatient ? 'Close Edit' : 'Edit'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-10 px-0"
                    onClick={() => {
                      setSelectedPatientId(null);
                      setIsEditingPatient(false);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {isEditingPatient ? (
                <form className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-3" onSubmit={patientForm.handleSubmit((values) => updatePatient.mutate(values))}>
                  <Input placeholder="Full name" {...patientForm.register('fullName')} />
                  <Input placeholder="Mobile" {...patientForm.register('mobile')} />
                  <Input type="email" placeholder="Email" {...patientForm.register('email')} />
                  <Input type="number" placeholder="Age" {...patientForm.register('age')} />
                  <Select {...patientForm.register('sex')}>
                    <option value="">Sex</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </Select>
                  <Input placeholder="Address" {...patientForm.register('address')} />
                  <Input placeholder="Occupation" {...patientForm.register('occupation')} />
                  <Input placeholder="Marital status" {...patientForm.register('maritalStatus')} />
                  <div className="lg:col-span-3">
                    <Button type="submit" disabled={updatePatient.isPending}>
                      Save Patient
                    </Button>
                  </div>
                </form>
              ) : null}

              <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                {[
                  ['details', 'Patient Details'],
                  ['medical', 'Medical Profile'],
                  ['sessions', 'Sessions'],
                  ['files', 'Files'],
                  ['invoices', 'Invoices'],
                  ['timeline', 'Timeline'],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={activePatientTab === value ? 'primary' : 'secondary'}
                    onClick={() => {
                      setActivePatientTab(value as typeof activePatientTab);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {activePatientTab === 'details' ? (
                <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Age" value={selectedPatient.age ?? '-'} />
                  <Detail label="Sex" value={selectedPatient.sex ?? '-'} />
                  <Detail label="Address" value={selectedPatient.address ?? '-'} />
                  <Detail label="Occupation" value={selectedPatient.occupation ?? '-'} />
                  <Detail label="Marital status" value={selectedPatient.maritalStatus ?? '-'} />
                  <Detail label="Email" value={selectedPatient.email ?? '-'} />
                  <Detail label="Lead source" value={selectedPatient.lead?.source?.replace('_', ' ') ?? '-'} />
                  <Detail label="Branch" value={selectedPatient.branch?.name ?? '-'} />
                </div>
              ) : null}

              {activePatientTab === 'medical' ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                  <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
                    <Detail label="Referred by" value={selectedPatient.medicalProfile?.referredBy ?? '-'} />
                    <Detail label="Skin concern" value={selectedPatient.medicalProfile?.skinConcern ?? '-'} />
                    <Detail label="Hair concern" value={selectedPatient.medicalProfile?.hairConcern ?? '-'} />
                    <Detail label="Medical history" value={selectedPatient.medicalProfile?.medicalHistory ?? '-'} />
                    <Detail label="Current medications" value={selectedPatient.medicalProfile?.currentMedications ?? '-'} />
                    <Detail label="Allergy to drugs" value={selectedPatient.medicalProfile?.allergyToDrugs ?? '-'} />
                    <Detail label="Notes" value={selectedPatient.medicalProfile?.notes ?? '-'} />
                  </div>
                  <form className="space-y-3" onSubmit={medicalForm.handleSubmit((values) => saveMedical.mutate(values))}>
                    <h3 className="font-semibold">Update Medical Profile</h3>
                    <Input placeholder="Referred by" {...medicalForm.register('referredBy')} />
                    <Input placeholder="Skin concern" {...medicalForm.register('skinConcern')} />
                    <Input placeholder="Hair concern" {...medicalForm.register('hairConcern')} />
                    <Input placeholder="Medical history" {...medicalForm.register('medicalHistory')} />
                    <Button type="submit" disabled={saveMedical.isPending}>
                      <Stethoscope className="size-4" />
                      Save Medical
                    </Button>
                  </form>
                </div>
              ) : null}

              {activePatientTab === 'sessions' ? (
                <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
                  <form className="space-y-3" onSubmit={sessionForm.handleSubmit((values) => createSession.mutate(values))}>
                    <h3 className="font-semibold">New Session</h3>
                    <Input type="datetime-local" {...sessionForm.register('visitDate')} />
                    <Input placeholder="Doctor consulted" {...sessionForm.register('doctorConsulted')} />
                    <Input placeholder="Treatment suggested" {...sessionForm.register('treatmentSuggested')} />
                    <Input placeholder="Treatment taken" {...sessionForm.register('treatmentTaken')} />
                    <Input placeholder="Medicines prescribed" {...sessionForm.register('medicinesPrescribed')} />
                    <Input placeholder="Notes" {...sessionForm.register('notes')} />
                    <Input type="datetime-local" {...sessionForm.register('followupDate')} />
                    <Button type="submit" disabled={createSession.isPending}>Add Session</Button>
                  </form>
                  <ProfileList title="Sessions" rows={sessionsQuery.data?.data.map((item) => `${new Date(item.visitDate).toLocaleDateString()} · ${item.treatmentTaken ?? 'Visit'}`) ?? []} />
                </div>
              ) : null}

              {activePatientTab === 'files' ? (
                <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
                  <form className="space-y-3" onSubmit={fileForm.handleSubmit((values) => createFile.mutate(values))}>
                    <h3 className="font-semibold">Attach File</h3>
                    <Select {...fileForm.register('category')}>
                      <option value="IMAGE">Image</option>
                      <option value="PRESCRIPTION">Prescription</option>
                      <option value="REPORT">Report</option>
                      <option value="INVOICE">Invoice</option>
                      <option value="OTHER">Other</option>
                    </Select>
                    <Input placeholder="File name" {...fileForm.register('name')} />
                    <Input placeholder="File URL" {...fileForm.register('url')} />
                    <Button type="submit" disabled={createFile.isPending}>
                      <FilePlus className="size-4" />
                      Attach File
                    </Button>
                  </form>
                  <ProfileList title="Files" rows={filesQuery.data?.data.map((item) => `${item.category} · ${item.name}`) ?? []} />
                </div>
              ) : null}

              {activePatientTab === 'invoices' ? (
                <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
                  <form className="space-y-3" onSubmit={invoiceForm.handleSubmit((values) => createInvoice.mutate(values))}>
                    <h3 className="font-semibold">Generate Invoice</h3>
                    <Input placeholder="Service name" {...invoiceForm.register('serviceName')} />
                    <Input type="number" placeholder="Consultation fee" {...invoiceForm.register('consultationFee')} />
                    <Input type="number" placeholder="Treatment / package fee" {...invoiceForm.register('packageFee')} />
                    <Input type="number" placeholder="GST amount" {...invoiceForm.register('gstAmount')} />
                    <Input type="number" placeholder="Discount" {...invoiceForm.register('discount')} />
                    {createInvoice.error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{createInvoice.error.message}</div> : null}
                    <Button type="submit" disabled={createInvoice.isPending || !selectedPatient}>
                      <FileText className="size-4" />
                      Create Invoice
                    </Button>
                  </form>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Invoice</th>
                          <th className="px-4 py-3 font-medium">Service</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Paid</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicesQuery.data?.data.map((invoice) => (
                          <tr key={invoice.id} className="border-t border-border">
                            <td className="px-4 py-3 font-medium">{invoice.invoiceNo}</td>
                            <td className="px-4 py-3">{invoice.serviceName}</td>
                            <td className="px-4 py-3">Rs {invoice.totalAmount}</td>
                            <td className="px-4 py-3">Rs {invoice.paidAmount}</td>
                            <td className="px-4 py-3">{invoice.status}</td>
                            <td className="px-4 py-3"><a className="text-primary" href={`http://localhost:4000/api/billing/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">Open</a></td>
                          </tr>
                        ))}
                        {!invoicesQuery.isLoading && invoicesQuery.data?.data.length === 0 ? (
                          <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>No invoices yet.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activePatientTab === 'timeline' ? (
                <div className="space-y-3">
                  {timelineQuery.data?.data.map((event) => (
                    <div key={event.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{event.title}</div>
                        <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
                      </div>
                      {event.description ? <div className="mt-1 text-muted-foreground">{event.description}</div> : null}
                    </div>
                  ))}
                  {!timelineQuery.isLoading && timelineQuery.data?.data.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">No timeline events yet.</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function ProfileList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-md border border-border p-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
        {rows.length ? rows.map((row) => <div key={row}>{row}</div>) : <div>None yet.</div>}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
