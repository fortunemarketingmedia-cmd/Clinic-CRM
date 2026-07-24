'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  FileText,
  Monitor,
  Pencil,
  Plus,
  Printer,
  Search,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MARITAL_STATUS_OPTIONS,
  MENSTRUAL_HISTORY_OPTIONS,
  PREGNANCY_STATUS_OPTIONS,
  SCAR_HISTORY_OPTIONS,
  SEX_OPTIONS,
} from '@/constants/patient-options';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment } from '@/types/appointment';
import type { Branch } from '@/types/branch';
import type { Patient, PatientSession, PrescriptionMedicine } from '@/types/patient';

const medicalSchema = z.object({
  referredBy: z.string().optional(),
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

const treatmentSchema = z.object({
  appointmentId: z.string().optional(),
  treatmentType: z.enum(['CONSULTATION', 'VIDEO_CONSULTATION', 'TREATMENT_ROOM', 'PROCEDURE', 'FOLLOW_UP', 'OTHER']),
  visitDate: z.string().min(1, 'Treatment date and time are required'),
  doctorConsulted: z.string().min(2, 'Doctor / provider is required'),
  chiefComplaint: z.string().optional(),
  diagnosis: z.string().optional(),
  treatmentSuggested: z.string().optional(),
  treatmentTaken: z.string().min(2, 'Treatment or consultation details are required'),
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

const blankMedicine = (): PrescriptionMedicine => ({ medicine: '', dosage: '', frequency: '', duration: '', instructions: '' });

type MedicalValues = z.infer<typeof medicalSchema>;
type TreatmentValues = z.infer<typeof treatmentSchema>;
type PatientCreateValues = z.infer<typeof patientCreateSchema>;

const treatmentLabels: Record<PatientSession['treatmentType'], string> = {
  CONSULTATION: 'Consultation',
  VIDEO_CONSULTATION: 'Video consultation',
  TREATMENT_ROOM: 'Treatment room',
  PROCEDURE: 'Procedure',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Other treatment',
};

export function PatientsView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId, setSelectedBranchId, hasHydrated } = useSessionStore();
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activePatientTab, setActivePatientTab] = useState<'details' | 'treatments'>('details');
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [isEditingMedical, setIsEditingMedical] = useState(false);
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [showCreateTreatment, setShowCreateTreatment] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<PatientSession | null>(null);
  const [prescriptionEnabled, setPrescriptionEnabled] = useState(false);
  const [prescription, setPrescription] = useState<PrescriptionMedicine[]>([blankMedicine()]);
  const [treatmentFile, setTreatmentFile] = useState<File | null>(null);
  const isAdmin = session?.user.role === 'ADMIN';

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
    enabled: hasHydrated && Boolean(session),
  });
  const branches = useMemo(() => branchesQuery.data?.data ?? [], [branchesQuery.data]);

  useEffect(() => {
    if (!hasHydrated || !branches.length) return;
    if (isAdmin && selectedBranchId === null) return setSelectedBranchId('');
    if (!isAdmin && (!selectedBranchId || !branches.some((branch) => branch.id === selectedBranchId))) return setSelectedBranchId(branches[0].id);
    if (selectedBranchId && !branches.some((branch) => branch.id === selectedBranchId)) setSelectedBranchId(isAdmin ? '' : branches[0].id);
  }, [branches, hasHydrated, isAdmin, selectedBranchId, setSelectedBranchId]);

  const activeBranchId = selectedBranchId ?? (isAdmin ? '' : branches[0]?.id ?? '');
  const formBranchId = activeBranchId || branches[0]?.id || '';
  const patientQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (!isAdmin || activeBranchId) params.set('branchId', activeBranchId);
    if (search.trim()) params.set('search', search.trim());
    return params.toString();
  }, [activeBranchId, isAdmin, search]);

  const patientsQuery = useQuery({
    queryKey: ['patients', patientQueryString],
    queryFn: () => apiRequest<{ data: Patient[] }>(`/patients?${patientQueryString}`),
    enabled: hasHydrated && Boolean(session) && Boolean(isAdmin || activeBranchId),
  });
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    return (patientsQuery.data?.data ?? []).filter((patient) => {
      const identity = patient.mobile.replace(/\D/g, '').slice(-10) || patient.id;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [patientsQuery.data]);
  const selectedPatient = uniquePatients.find((patient) => patient.id === selectedPatientId);

  const sessionsQuery = useQuery({
    queryKey: ['patient-sessions', selectedPatient?.id],
    queryFn: () => apiRequest<{ data: PatientSession[] }>(`/patients/${selectedPatient?.id}/sessions`),
    enabled: Boolean(selectedPatient?.id),
  });
  const visitsQuery = useQuery({
    queryKey: ['patient-visits', selectedPatient?.mobile],
    queryFn: () => apiRequest<{ data: Appointment[] }>(`/appointments?search=${encodeURIComponent(selectedPatient?.mobile ?? '')}`),
    enabled: Boolean(selectedPatient?.mobile),
  });

  const medicalForm = useForm<z.infer<typeof medicalSchema>>({ resolver: zodResolver(medicalSchema) });
  const patientForm = useForm<z.infer<typeof patientEditSchema>>({ resolver: zodResolver(patientEditSchema) });
  const createPatientForm = useForm<z.infer<typeof patientCreateSchema>>({
    resolver: zodResolver(patientCreateSchema),
    defaultValues: { branchId: formBranchId, fullName: '', mobile: '' },
  });
  const treatmentForm = useForm<z.infer<typeof treatmentSchema>>({
    resolver: zodResolver(treatmentSchema),
    defaultValues: {
      appointmentId: '',
      treatmentType: 'CONSULTATION',
      visitDate: '',
      doctorConsulted: '',
    },
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
    medicalForm.reset({
      referredBy: selectedPatient.medicalProfile?.referredBy ?? '',
      skinConcern: selectedPatient.medicalProfile?.skinConcern ?? '',
      hairConcern: selectedPatient.medicalProfile?.hairConcern ?? '',
      medicalHistory: selectedPatient.medicalProfile?.medicalHistory ?? '',
      currentMedications: selectedPatient.medicalProfile?.currentMedications ?? '',
      allergyToDrugs: selectedPatient.medicalProfile?.allergyToDrugs ?? '',
      keloidOrHypertrophicScar: selectedPatient.medicalProfile?.keloidOrHypertrophicScar ?? '',
      productsCurrentlyUsed: selectedPatient.medicalProfile?.productsCurrentlyUsed ?? '',
      menstrualHistory: selectedPatient.medicalProfile?.menstrualHistory ?? '',
      pregnancyStatus: selectedPatient.medicalProfile?.pregnancyStatus ?? '',
      notes: selectedPatient.medicalProfile?.notes ?? '',
    });
  }, [medicalForm, patientForm, selectedPatient]);

  const updatePatient = useMutation({
    mutationFn: (values: z.infer<typeof patientEditSchema>) => apiRequest(`/patients/${selectedPatient?.id}`, {
      method: 'PATCH', body: JSON.stringify({ ...values, email: values.email || undefined }),
    }),
    onSuccess: () => { setIsEditingPatient(false); queryClient.invalidateQueries({ queryKey: ['patients'] }); },
  });
  const createPatient = useMutation({
    mutationFn: (values: z.infer<typeof patientCreateSchema>) => apiRequest<{ data: Patient }>('/patients', {
      method: 'POST', body: JSON.stringify({ ...values, email: values.email || undefined }),
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
    mutationFn: (values: z.infer<typeof medicalSchema>) => apiRequest(`/patients/${selectedPatient?.id}/medical-profile`, {
      method: 'PUT', body: JSON.stringify(values),
    }),
    onSuccess: () => { setIsEditingMedical(false); queryClient.invalidateQueries({ queryKey: ['patients'] }); },
  });

  const createTreatment = useMutation({
    mutationFn: async (values: z.infer<typeof treatmentSchema>) => {
      if (!selectedPatient) throw new Error('Select a patient first');
      const validPrescription = prescriptionEnabled
        ? prescription.filter((item) => item.medicine && item.dosage && item.frequency && item.duration)
        : [];
      if (prescriptionEnabled && !validPrescription.length) throw new Error('Complete at least one prescription medicine');

      const treatment = await apiRequest<{ data: PatientSession }>(`/patients/${selectedPatient.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          appointmentId: values.appointmentId || undefined,
          treatmentType: values.treatmentType,
          visitDate: values.visitDate,
          doctorConsulted: values.doctorConsulted,
          chiefComplaint: values.chiefComplaint || undefined,
          diagnosis: values.diagnosis || undefined,
          treatmentSuggested: values.treatmentSuggested || undefined,
          treatmentTaken: values.treatmentTaken,
          medicinesPrescribed: validPrescription.map((item) => `${item.medicine} ${item.dosage} ${item.frequency} for ${item.duration}`).join('; ') || undefined,
          prescription: validPrescription.length ? validPrescription : undefined,
          notes: values.notes || undefined,
          followupDate: values.followupDate || undefined,
        }),
      });

      if (treatmentFile) {
        if (treatmentFile.size > 5 * 1024 * 1024) throw new Error('Attachment must be 5 MB or smaller');
        const dataUrl = await fileToDataUrl(treatmentFile);
        await apiRequest(`/patients/${selectedPatient.id}/files`, {
          method: 'POST',
          body: JSON.stringify({
            sessionId: treatment.data.id,
            category: treatmentFile.type.startsWith('image/') ? 'IMAGE' : 'REPORT',
            name: treatmentFile.name,
            url: dataUrl,
            mimeType: treatmentFile.type || undefined,
            sizeBytes: treatmentFile.size,
          }),
        });
      }

      return treatment.data;
    },
    onSuccess: () => {
      treatmentForm.reset({ appointmentId: '', treatmentType: 'CONSULTATION', visitDate: '', doctorConsulted: '' });
      setPrescriptionEnabled(false);
      setPrescription([blankMedicine()]);
      setTreatmentFile(null);
      setShowCreateTreatment(false);
      queryClient.invalidateQueries({ queryKey: ['patient-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['patient-files'] });
    },
  });

  const openTreatmentForm = () => {
    treatmentForm.setValue('visitDate', toLocalDateTime(new Date()));
    setShowCreateTreatment(true);
  };

  const selectAppointment = (appointmentId: string) => {
    treatmentForm.setValue('appointmentId', appointmentId);
    const appointment = visitsQuery.data?.data.find((item) => item.id === appointmentId);
    if (!appointment) return;
    treatmentForm.setValue('visitDate', toLocalDateTime(new Date(appointment.appointmentAt)));
    treatmentForm.setValue('treatmentType', appointment.appointmentType === 'VIDEO_CONSULTATION' ? 'VIDEO_CONSULTATION' : appointment.resourceType === 'TREATMENT_ROOM' ? 'TREATMENT_ROOM' : 'CONSULTATION');
    treatmentForm.setValue('treatmentTaken', appointment.resourceType === 'TREATMENT_ROOM' ? `Treatment room${appointment.roomNumber ? ` ${appointment.roomNumber}` : ''}` : appointment.appointmentType === 'VIDEO_CONSULTATION' ? 'Video consultation' : 'Consultation');
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-semibold">Patients</h1><p className="text-sm text-muted-foreground">Patient profiles, clinical details, treatments, prescriptions, and files.</p></div>
        <Button type="button" onClick={() => setShowCreatePatient(true)}><Plus className="size-4" />Create Patient</Button>
      </div>

      <Card>
        <div className="mb-4">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search patient name, mobile, or patient no" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Patient</th><th className="px-4 py-3 font-medium">Mobile</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 font-medium">Action</th></tr></thead>
            <tbody>{patientsQuery.isLoading ? Array.from({ length: 6 }, (_, row) => <tr key={row} className="border-t border-border">{Array.from({ length: 6 }, (_, column) => <td key={column} className="px-4 py-4"><Skeleton className={column === 0 ? 'h-5 w-32' : 'h-4 w-24'} /></td>)}</tr>) : uniquePatients.map((patient) => <tr key={patient.id} className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => { setSelectedPatientId(patient.id); setActivePatientTab('details'); }}><td className="px-4 py-3"><div className="font-medium">{patient.fullName}</div><div className="text-xs text-muted-foreground">{patient.patientNo}</div></td><td className="px-4 py-3">{patient.mobile}</td><td className="px-4 py-3">{patient.branch?.name}</td><td className="px-4 py-3">{formatEnum(patient.lead?.source)}</td><td className="px-4 py-3">{formatDateTime(patient.createdAt)}</td><td className="px-4 py-3"><Button type="button" variant="secondary" onClick={(event) => { event.stopPropagation(); setSelectedPatientId(patient.id); setActivePatientTab('details'); }}>View Profile</Button></td></tr>)}
              {!patientsQuery.isLoading && uniquePatients.length === 0 ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No patients found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreatePatient ? <PatientCreateModal branches={branches} form={createPatientForm} mutation={createPatient} onClose={() => setShowCreatePatient(false)} /> : null}

      {selectedPatient ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-2 sm:p-4">
          <Card className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1400px]">
            <div className="space-y-6">
              <div className="sticky -top-6 z-10 flex flex-col gap-3 border-b border-border bg-surface py-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="mb-1 flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{selectedPatient.patientNo}</span><span className="text-xs text-muted-foreground">Created {formatDateTime(selectedPatient.createdAt)}</span></div><h2 className="text-2xl font-semibold">{selectedPatient.fullName}</h2><p className="text-sm text-muted-foreground">{selectedPatient.mobile} · {selectedPatient.branch?.name} · Source: {formatEnum(selectedPatient.lead?.source)}</p></div>
                <div className="flex gap-2"><Link href={`/patients/${selectedPatient.id}`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><UserRound className="mr-2 size-4" />Patient 360</Link><Button type="button" variant="secondary" onClick={() => setIsEditingPatient((value) => !value)}><Pencil className="size-4" />{isEditingPatient ? 'Close Edit' : 'Edit Patient'}</Button><Button type="button" variant="secondary" className="w-10 px-0" aria-label="Close profile" onClick={() => { setSelectedPatientId(null); setIsEditingPatient(false); }}><X className="size-4" /></Button></div>
              </div>

              {isEditingPatient ? <form className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 lg:grid-cols-3" onSubmit={patientForm.handleSubmit((values) => updatePatient.mutate(values))}><Input placeholder="Full name" {...patientForm.register('fullName')} /><Input placeholder="Mobile" {...patientForm.register('mobile')} /><Input type="email" placeholder="Email" {...patientForm.register('email')} /><Input type="number" placeholder="Age" {...patientForm.register('age')} /><Select {...patientForm.register('sex')}><option value="">Select sex</option>{SEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><Input placeholder="Address" {...patientForm.register('address')} /><Input placeholder="Occupation" {...patientForm.register('occupation')} /><Select {...patientForm.register('maritalStatus')}><option value="">Select marital status</option>{withLegacyOption(MARITAL_STATUS_OPTIONS, selectedPatient.maritalStatus).map((option) => <option key={option} value={option}>{option}</option>)}</Select><div className="lg:col-span-3"><Button type="submit" disabled={updatePatient.isPending}>Save Patient</Button></div></form> : null}

              <div className="grid gap-3 sm:grid-cols-2"><PatientSummary label="Patient since" value={formatDateTime(selectedPatient.createdAt)} /><PatientSummary label="Treatments" value={sessionsQuery.data?.data.length ?? 0} /></div>

              <div className="flex gap-2 overflow-x-auto border-b border-border pb-3"><Button type="button" variant={activePatientTab === 'details' ? 'primary' : 'secondary'} onClick={() => setActivePatientTab('details')}><UserRound className="size-4" />Patient Details</Button><Button type="button" variant={activePatientTab === 'treatments' ? 'primary' : 'secondary'} onClick={() => setActivePatientTab('treatments')}><Stethoscope className="size-4" />Medical Treatments</Button></div>

              {activePatientTab === 'details' ? (
                <div className="space-y-5">
                  <SectionHeader title="Personal & registration details" description="Patient identity, contact, registration time, and source." />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <InfoCard title="Personal information"><div className="grid gap-4 sm:grid-cols-2"><Detail label="Full name" value={selectedPatient.fullName} /><Detail label="Age" value={selectedPatient.age ?? '-'} /><Detail label="Sex" value={formatEnum(selectedPatient.sex)} /><Detail label="Marital status" value={selectedPatient.maritalStatus ?? '-'} /><Detail label="Occupation" value={selectedPatient.occupation ?? '-'} /><Detail label="Address" value={selectedPatient.address ?? '-'} /></div></InfoCard>
                    <InfoCard title="Contact & registration"><div className="grid gap-4 sm:grid-cols-2"><Detail label="Mobile" value={selectedPatient.mobile} /><Detail label="Email" value={selectedPatient.email ?? '-'} /><Detail label="Patient created" value={formatDateTime(selectedPatient.createdAt)} /><Detail label="Source" value={formatEnum(selectedPatient.lead?.source)} /><Detail label="Referred by" value={selectedPatient.medicalProfile?.referredBy ?? '-'} /><Detail label="Branch" value={selectedPatient.branch?.name ?? '-'} /></div></InfoCard>
                  </div>

                  <div className="flex items-end justify-between gap-3"><SectionHeader title="Medical background" description="Clinical intake information supplied by the patient or clinic team." /><Button type="button" variant="secondary" onClick={() => setIsEditingMedical((value) => !value)}><Pencil className="size-4" />{isEditingMedical ? 'Close' : 'Edit Medical Details'}</Button></div>
                  {isEditingMedical ? <MedicalEditForm form={medicalForm} mutation={saveMedical} /> : <InfoCard title="Clinical intake"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Skin concern" value={selectedPatient.medicalProfile?.skinConcern ?? '-'} /><Detail label="Hair concern" value={selectedPatient.medicalProfile?.hairConcern ?? '-'} /><Detail label="Medical history" value={selectedPatient.medicalProfile?.medicalHistory ?? '-'} /><Detail label="Current medications" value={selectedPatient.medicalProfile?.currentMedications ?? '-'} /><Detail label="Drug allergies" value={selectedPatient.medicalProfile?.allergyToDrugs ?? '-'} /><Detail label="Scar / keloid history" value={selectedPatient.medicalProfile?.keloidOrHypertrophicScar ?? '-'} /><Detail label="Products currently used" value={selectedPatient.medicalProfile?.productsCurrentlyUsed ?? '-'} /><Detail label="Menstrual history" value={selectedPatient.medicalProfile?.menstrualHistory ?? '-'} /><Detail label="Pregnancy status" value={selectedPatient.medicalProfile?.pregnancyStatus ?? '-'} /><Detail label="Clinical notes" value={selectedPatient.medicalProfile?.notes ?? '-'} /></div></InfoCard>}
                </div>
              ) : null}

              {activePatientTab === 'treatments' ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SectionHeader title="Medical treatments" description="Consultations, video visits, treatment-room sessions, procedures, prescriptions, and clinical files." /><Button type="button" onClick={openTreatmentForm}><ClipboardPlus className="size-4" />Create Treatment</Button></div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sessionsQuery.data?.data.map((item) => <TreatmentCard key={item.id} treatment={item} onClick={() => setSelectedTreatment(item)} />)}
                    {!sessionsQuery.isLoading && !sessionsQuery.data?.data.length ? <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center"><Stethoscope className="mx-auto mb-3 size-8 text-muted-foreground" /><div className="font-medium">No treatments recorded</div><p className="mt-1 text-sm text-muted-foreground">Create the first treatment from an appointment, consultation, or room booking.</p></div> : null}
                  </div>

                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {showCreateTreatment && selectedPatient ? <TreatmentCreateModal patient={selectedPatient} appointments={visitsQuery.data?.data ?? []} form={treatmentForm} prescriptionEnabled={prescriptionEnabled} setPrescriptionEnabled={setPrescriptionEnabled} prescription={prescription} setPrescription={setPrescription} file={treatmentFile} setFile={setTreatmentFile} mutation={createTreatment} onAppointmentChange={selectAppointment} onClose={() => setShowCreateTreatment(false)} /> : null}
      {selectedTreatment && selectedPatient ? <TreatmentDetailModal patient={selectedPatient} treatment={selectedTreatment} onClose={() => setSelectedTreatment(null)} /> : null}
    </section>
  );
}

type MutationFor<T> = { mutate: (values: T) => void; isPending: boolean; error: Error | null };

function PatientCreateModal({ branches, form, mutation, onClose }: { branches: Branch[]; form: UseFormReturn<PatientCreateValues>; mutation: MutationFor<PatientCreateValues>; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><Card className="mx-auto max-w-5xl"><ModalHeader title="Create Patient" description="Add registration, contact, and initial medical details." onClose={onClose} /><form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values: any) => mutation.mutate(values))}><Select {...form.register('branchId')}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select><Input placeholder="Referred by" {...form.register('referredBy')} /><Input placeholder="Full name" {...form.register('fullName')} /><Input type="email" placeholder="Email" {...form.register('email')} /><Input type="number" placeholder="Age" {...form.register('age')} /><Select {...form.register('sex')}><option value="">Select sex</option>{SEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select><Input placeholder="Contact number" {...form.register('mobile')} /><Input placeholder="Address" {...form.register('address')} /><Select {...form.register('maritalStatus')}><option value="">Select marital status</option>{MARITAL_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Input placeholder="Occupation" {...form.register('occupation')} /><Input placeholder="Skin concern" {...form.register('skinConcern')} /><Input placeholder="Hair concern" {...form.register('hairConcern')} /><Input placeholder="Medical history" {...form.register('medicalHistory')} /><Input placeholder="Current medications" {...form.register('currentMedications')} /><Input placeholder="Allergy to drugs" {...form.register('allergyToDrugs')} /><Select {...form.register('keloidOrHypertrophicScar')}><option value="">Keloid / hypertrophic scar history</option>{SCAR_HISTORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Input placeholder="Products currently used" {...form.register('productsCurrentlyUsed')} /><Select {...form.register('menstrualHistory')}><option value="">Select menstrual history</option>{MENSTRUAL_HISTORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Select {...form.register('pregnancyStatus')}><option value="">Select pregnancy status</option>{PREGNANCY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Input placeholder="Other notes" {...form.register('notes')} />{mutation.error ? <ErrorMessage message={mutation.error.message} className="md:col-span-2" /> : null}<div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>Create Patient</Button></div></form></Card></div>;
}

function MedicalEditForm({ form, mutation }: { form: UseFormReturn<MedicalValues>; mutation: MutationFor<MedicalValues> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <form className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={form.handleSubmit((values: any) => mutation.mutate(values))}><Input placeholder="Referred by" {...form.register('referredBy')} /><Input placeholder="Skin concern" {...form.register('skinConcern')} /><Input placeholder="Hair concern" {...form.register('hairConcern')} /><Input placeholder="Medical history" {...form.register('medicalHistory')} /><Input placeholder="Current medications" {...form.register('currentMedications')} /><Input placeholder="Allergy to drugs" {...form.register('allergyToDrugs')} /><Select {...form.register('keloidOrHypertrophicScar')}><option value="">Keloid / hypertrophic scar history</option>{SCAR_HISTORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Input placeholder="Products currently used" {...form.register('productsCurrentlyUsed')} /><Select {...form.register('menstrualHistory')}><option value="">Select menstrual history</option>{MENSTRUAL_HISTORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Select {...form.register('pregnancyStatus')}><option value="">Select pregnancy status</option>{PREGNANCY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</Select><Input placeholder="Clinical notes" {...form.register('notes')} /><div className="md:col-span-2 lg:col-span-3"><Button type="submit" disabled={mutation.isPending}><Stethoscope className="size-4" />Save Medical Details</Button></div></form>;
}

function withLegacyOption(options: readonly string[], current?: string | null) {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

function TreatmentCreateModal({ patient, appointments, form, prescriptionEnabled, setPrescriptionEnabled, prescription, setPrescription, file, setFile, mutation, onAppointmentChange, onClose }: { patient: Patient; appointments: Appointment[]; form: UseFormReturn<TreatmentValues>; prescriptionEnabled: boolean; setPrescriptionEnabled: (value: boolean) => void; prescription: PrescriptionMedicine[]; setPrescription: (items: PrescriptionMedicine[]) => void; file: File | null; setFile: (file: File | null) => void; mutation: MutationFor<TreatmentValues>; onAppointmentChange: (id: string) => void; onClose: () => void }) {
  const availableAppointments = appointments.filter((appointment) => appointment.lead?.patient?.id === patient.id || appointment.leadId === patient.leadId);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-2 sm:p-4"><Card className="mx-auto max-w-5xl"><ModalHeader title="Create Treatment" description={`Record a complete treatment for ${patient.fullName}. Appointment and room details can be pulled in automatically.`} onClose={onClose} /><form className="space-y-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
    <FormSection number="1" title="Visit & treatment"><div className="grid gap-3 md:grid-cols-2"><Field label="Appointment / room booking (optional)"><Select {...form.register('appointmentId')} onChange={(event) => onAppointmentChange(event.target.value)}><option value="">Not linked to an appointment</option>{availableAppointments.map((item) => <option key={item.id} value={item.id}>{formatDateTime(item.appointmentAt)} · {item.appointmentType === 'VIDEO_CONSULTATION' ? 'Video consultation' : item.resourceType === 'TREATMENT_ROOM' ? `Room ${item.roomNumber ?? ''}` : 'Consultation'} · {formatEnum(item.status)}</option>)}</Select></Field><Field label="Treatment type"><Select {...form.register('treatmentType')}><option value="CONSULTATION">Consultation</option><option value="VIDEO_CONSULTATION">Video consultation</option><option value="TREATMENT_ROOM">Treatment room</option><option value="PROCEDURE">Procedure</option><option value="FOLLOW_UP">Follow-up</option><option value="OTHER">Other</option></Select></Field><Field label="Date & time" required><Input type="datetime-local" {...form.register('visitDate')} /></Field><Field label="Doctor / provider" required><Input placeholder="Doctor or treatment provider" {...form.register('doctorConsulted')} /></Field><Field label="Chief complaint"><Input placeholder="Reason for visit" {...form.register('chiefComplaint')} /></Field><Field label="Diagnosis"><Input placeholder="Clinical diagnosis" {...form.register('diagnosis')} /></Field><Field label="Treatment advised"><Input placeholder="Recommended plan" {...form.register('treatmentSuggested')} /></Field><Field label="Treatment performed" required><Input placeholder="Consultation, procedure, room treatment…" {...form.register('treatmentTaken')} /></Field><Field label="Follow-up date"><Input type="datetime-local" {...form.register('followupDate')} /></Field><Field label="Clinical notes"><Input placeholder="Observations, advice, precautions" {...form.register('notes')} /></Field></div></FormSection>

    <FormSection number="2" title="Prescription"><label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface p-3"><input type="checkbox" checked={prescriptionEnabled} onChange={(event) => setPrescriptionEnabled(event.target.checked)} /><span><span className="block text-sm font-medium">Generate a prescription</span><span className="block text-xs text-muted-foreground">Add medicine, dose, frequency, duration, and instructions. It can be printed from the treatment card.</span></span></label>{prescriptionEnabled ? <div className="mt-4 space-y-3"><datalist id="medicine-catalog"><option value="Paracetamol" /><option value="Cetirizine" /><option value="Amoxicillin" /><option value="Azithromycin" /><option value="Doxycycline" /><option value="Isotretinoin" /><option value="Tretinoin cream" /><option value="Clindamycin gel" /><option value="Minoxidil" /><option value="Vitamin D3" /></datalist>{prescription.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_auto]"><Input list="medicine-catalog" placeholder="Medicine" value={item.medicine} onChange={(event) => updateMedicine(prescription, setPrescription, index, 'medicine', event.target.value)} /><Select value={item.dosage} onChange={(event) => updateMedicine(prescription, setPrescription, index, 'dosage', event.target.value)}><option value="">Dose</option><option>½ tablet</option><option>1 tablet</option><option>2 tablets</option><option>5 ml</option><option>10 ml</option><option>Apply thin layer</option><option>As directed</option></Select><Select value={item.frequency} onChange={(event) => updateMedicine(prescription, setPrescription, index, 'frequency', event.target.value)}><option value="">Frequency</option><option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>At bedtime</option><option>As needed</option></Select><Input placeholder="Duration" value={item.duration} onChange={(event) => updateMedicine(prescription, setPrescription, index, 'duration', event.target.value)} /><Input placeholder="Before/after food, precautions" value={item.instructions} onChange={(event) => updateMedicine(prescription, setPrescription, index, 'instructions', event.target.value)} /><Button type="button" variant="ghost" className="w-10 px-0" aria-label="Remove medicine" onClick={() => setPrescription(prescription.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>)}<Button type="button" variant="secondary" onClick={() => setPrescription([...prescription, blankMedicine()])}><Plus className="size-4" />Add Medicine</Button></div> : null}</FormSection>

    <FormSection number="3" title="Attachment"><Field label="Treatment file (optional)"><Input type="file" accept="image/*,.pdf,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field><p className="mt-2 text-xs text-muted-foreground">Images, reports, and documents up to 5 MB. {file ? `Selected: ${file.name}` : ''}</p></FormSection>

    {Object.keys(form.formState.errors).length ? <ErrorMessage message={Object.values(form.formState.errors)[0]?.message as string || 'Please check the required fields'} /> : null}{mutation.error ? <ErrorMessage message={mutation.error.message} /> : null}<div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface py-3"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving treatment…' : 'Save Treatment'}</Button></div>
  </form></Card></div>;
}

function TreatmentCard({ treatment, onClick }: { treatment: PatientSession; onClick: () => void }) {
  const Icon = treatment.treatmentType === 'VIDEO_CONSULTATION' ? Monitor : treatment.treatmentType === 'TREATMENT_ROOM' || treatment.treatmentType === 'PROCEDURE' ? Stethoscope : UserRound;
  return <button type="button" onClick={onClick} className="group rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></span><ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" /></div><div className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">{treatmentLabels[treatment.treatmentType] ?? formatEnum(treatment.treatmentType)}</div><h3 className="mt-1 font-semibold">{treatment.treatmentTaken || treatment.treatmentSuggested || 'Clinical visit'}</h3><div className="mt-3 space-y-1 text-sm text-muted-foreground"><div className="flex items-center gap-2"><CalendarDays className="size-4" />{formatDateTime(treatment.visitDate)}</div>{treatment.doctorConsulted ? <div>Dr. / Provider: {treatment.doctorConsulted}</div> : null}</div><div className="mt-4 flex flex-wrap gap-2">{treatment.prescription?.length ? <Badge>Prescription</Badge> : null}{treatment.files?.length ? <Badge>{treatment.files.length} attachment{treatment.files.length === 1 ? '' : 's'}</Badge> : null}{treatment.followupDate ? <Badge>Follow-up set</Badge> : null}</div></button>;
}

function TreatmentDetailModal({ patient, treatment, onClose }: { patient: Patient; treatment: PatientSession; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3"><Card className="mx-auto max-w-4xl"><ModalHeader title={treatment.treatmentTaken || treatmentLabels[treatment.treatmentType]} description={`${treatmentLabels[treatment.treatmentType]} · ${formatDateTime(treatment.visitDate)}`} onClose={onClose} /><div className="grid gap-4 md:grid-cols-2"><InfoCard title="Clinical details"><div className="space-y-4"><Detail label="Doctor / provider" value={treatment.doctorConsulted ?? '-'} /><Detail label="Chief complaint" value={treatment.chiefComplaint ?? '-'} /><Detail label="Diagnosis" value={treatment.diagnosis ?? '-'} /><Detail label="Treatment advised" value={treatment.treatmentSuggested ?? '-'} /><Detail label="Treatment performed" value={treatment.treatmentTaken ?? '-'} /><Detail label="Clinical notes" value={treatment.notes ?? '-'} /><Detail label="Follow-up" value={treatment.followupDate ? formatDateTime(treatment.followupDate) : '-'} /></div></InfoCard><InfoCard title="Clinical files"><div className="space-y-4">{treatment.files?.length ? treatment.files.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm font-medium hover:bg-muted"><FileText className="size-4 text-primary" />{file.name}</a>) : <p className="text-sm text-muted-foreground">No files attached.</p>}</div></InfoCard></div>{treatment.prescription?.length ? <div className="mt-5 rounded-xl border border-border p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Prescription</h3><p className="text-xs text-muted-foreground">{treatment.prescription.length} medicine{treatment.prescription.length === 1 ? '' : 's'}</p></div><Button type="button" variant="secondary" onClick={() => printPrescription(patient, treatment)}><Printer className="size-4" />Print Prescription</Button></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">Medicine</th><th className="p-3">Dose</th><th className="p-3">Frequency</th><th className="p-3">Duration</th><th className="p-3">Instructions</th></tr></thead><tbody>{treatment.prescription.map((item, index) => <tr key={`${item.medicine}-${index}`} className="border-t border-border"><td className="p-3 font-medium">{item.medicine}</td><td className="p-3">{item.dosage}</td><td className="p-3">{item.frequency}</td><td className="p-3">{item.duration}</td><td className="p-3">{item.instructions || '-'}</td></tr>)}</tbody></table></div></div> : treatment.medicinesPrescribed ? <InfoCard title="Prescription"><p className="text-sm">{treatment.medicinesPrescribed}</p></InfoCard> : null}</Card></div>;
}

function FormSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-border bg-muted/10 p-4"><div className="mb-4 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{number}</span><h3 className="font-semibold">{title}</h3></div>{children}</section>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}{required ? <span className="text-primary"> *</span> : null}</span>{children}</label>; }
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border border-border bg-surface p-4"><h3 className="mb-4 font-semibold">{title}</h3>{children}</div>; }
function SectionHeader({ title, description }: { title: string; description: string }) { return <div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
function ModalHeader({ title, description, onClose }: { title: string; description: string; onClose: () => void }) { return <div className="mb-5 flex items-start justify-between gap-4 border-b border-border pb-4"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Button type="button" variant="secondary" className="w-10 shrink-0 px-0" aria-label="Close" onClick={onClose}><X className="size-4" /></Button></div>; }
function ErrorMessage({ message, className = '' }: { message: string; className?: string }) { return <div className={`rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`}>{message}</div>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{children}</span>; }
function Detail({ label, value }: { label: string; value: string | number }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm font-medium">{value || '-'}</div></div>; }
function PatientSummary({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-muted/30 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>; }

function formatEnum(value?: string | null) { if (!value) return '-'; return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string | Date) { return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
function toLocalDateTime(value: Date) { const offset = value.getTimezoneOffset(); return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16); }
function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the selected file')); reader.readAsDataURL(file); }); }
function updateMedicine(items: PrescriptionMedicine[], setItems: (items: PrescriptionMedicine[]) => void, index: number, key: keyof PrescriptionMedicine, value: string) { setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
function escapeHtml(value?: string | null) { return (value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character] ?? character); }
function printPrescription(patient: Patient, treatment: PatientSession) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  const rows = (treatment.prescription ?? []).map((item, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(item.medicine)}</strong></td><td>${escapeHtml(item.dosage)}</td><td>${escapeHtml(item.frequency)}</td><td>${escapeHtml(item.duration)}</td><td>${escapeHtml(item.instructions) || '-'}</td></tr>`).join('');
  printWindow.document.write(`<!doctype html><html><head><title>Prescription - ${escapeHtml(patient.fullName)}</title><style>body{font:14px Arial,sans-serif;color:#241417;margin:42px}.header{text-align:center;border-bottom:2px solid #e63843;padding-bottom:18px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:24px 0}.rx{font-size:28px;color:#e63843;margin:20px 0 8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#fff3ed}.footer{margin-top:60px;display:flex;justify-content:space-between}.muted{color:#6b5b5e}@media print{body{margin:20px}.no-print{display:none}}</style></head><body><div class="header"><h1>Revive Clinic</h1><div>Medical Prescription</div></div><div class="meta"><div><strong>Patient:</strong> ${escapeHtml(patient.fullName)}</div><div><strong>Patient No:</strong> ${escapeHtml(patient.patientNo)}</div><div><strong>Mobile:</strong> ${escapeHtml(patient.mobile)}</div><div><strong>Date:</strong> ${escapeHtml(formatDateTime(treatment.visitDate))}</div><div><strong>Doctor / Provider:</strong> ${escapeHtml(treatment.doctorConsulted)}</div><div><strong>Diagnosis:</strong> ${escapeHtml(treatment.diagnosis) || '-'}</div></div><div class="rx">℞</div><table><thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${rows}</tbody></table>${treatment.notes ? `<p><strong>Advice / Notes:</strong> ${escapeHtml(treatment.notes)}</p>` : ''}${treatment.followupDate ? `<p><strong>Follow-up:</strong> ${escapeHtml(formatDateTime(treatment.followupDate))}</p>` : ''}<div class="footer"><span class="muted">This prescription belongs to ${escapeHtml(patient.fullName)}.</span><span>Doctor’s signature</span></div><script>window.onload=()=>window.print()</script></body></html>`);
  printWindow.document.close();
}
