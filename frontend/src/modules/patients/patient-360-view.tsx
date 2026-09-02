'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CalendarCheck2, CircleDollarSign, Download, HeartPulse, Plus, Printer, ReceiptText, Search, ShieldAlert, Stethoscope, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiBlob, apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicResource } from '@/types/appointment';
import type { Patient360 } from '@/types/clinical';
import type { StaffMember } from '@/types/front-desk';
import { PatientDocumentsPanel, PatientGalleryPanel } from './patient-forms-files-panel';

const tabs = ['Overview', 'Appointments', 'Care History', 'Billing', 'Prescriptions', 'Medical Profile', 'Documents'] as const;
type Tab = typeof tabs[number];
type MedicineOption = { id: string; name: string; genericName?: string | null; strength?: string | null; form?: string | null };
type PackageMasterOption = { id: string; branchId?: string | null; name: string; totalSessions: number; validityDays: number; price: string; taxPercent: string; active: boolean };
const clinicalRoles = ['ADMIN'];
const prescriberRoles = ['ADMIN'];
const format = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const nowLocal = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);
const overlaps = (first: { start: Date; end: Date }, second: { start: Date; end: Date }) => first.start < second.end && second.start < first.end;
function usePdfActions(path: (id: string) => string, filename: (id: string) => string) {
  const preview = useMutation({ mutationFn: (id: string) => apiBlob(path(id)), onSuccess: (blob) => { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); } });
  const download = useMutation({ mutationFn: (id: string) => apiBlob(path(id)), onSuccess: (blob, id) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename(id); link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000); } });
  const print = useMutation({ mutationFn: (id: string) => apiBlob(path(id)), onSuccess: (blob) => { const url = URL.createObjectURL(blob); const frame = document.createElement('iframe'); frame.style.display = 'none'; frame.src = url; frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); window.setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000); }; document.body.appendChild(frame); } });
  return { preview, download, print };
}
function dayRange(value: Date) {
  const start = new Date(value); start.setHours(0, 0, 0, 0);
  const end = new Date(value); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function Patient360View({ patientId, embedded = false }: { patientId: string; embedded?: boolean }) {
  const queryClient = useQueryClient();
  const { session } = useSessionStore();
  const [tab, setTab] = useState<Tab>('Overview');
  const [composer, setComposer] = useState<'encounter' | 'prescription' | null>(null);
  const patientQuery = useQuery({ queryKey: ['patient-360', patientId], queryFn: () => apiRequest<{ data: Patient360 }>(`/clinical/patients/${patientId}/360`) });
  const patient = patientQuery.data?.data;
  const canClinical = Boolean(session && clinicalRoles.includes(session.user.role));
  const canStartConsultation = session?.user.role === 'ADMIN';
  const canPrescribe = Boolean(session && prescriberRoles.includes(session.user.role));
  const staffQuery = useQuery({ queryKey: ['clinical-staff', patient?.branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${patient?.branchId}`), enabled: Boolean(patient?.branchId && canClinical) });
  const resourcesQuery = useQuery({ queryKey: ['clinical-resources', patient?.branchId], queryFn: () => apiRequest<{ data: ClinicResource[] }>(`/front-desk/resources?branchId=${patient?.branchId}`), enabled: Boolean(patient?.branchId && canClinical) });
  const staff = staffQuery.data?.data ?? [];
  const doctors = staff.filter((member) => member.role === 'ADMIN');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['patient-360', patientId] });
  const activeConsultation = patient?.lead.appointments.find((appointment) => appointment.resourceType === 'CONSULTATION' && ['WAITING', 'IN_CONSULTATION'].includes(appointment.status));
  const startConsultation = useMutation({
    mutationFn: () => activeConsultation && activeConsultation.status !== 'IN_CONSULTATION'
      ? apiRequest(`/appointments/${activeConsultation.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_CONSULTATION' }) })
      : Promise.resolve(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient-360', patientId] }),
        queryClient.invalidateQueries({ queryKey: ['daily-client-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      ]);
      setComposer('encounter');
    },
  });

  if (patientQuery.isLoading) return <PageSkeleton />;
  if (patientQuery.isError || !patient) return <Card className="border-red-200 text-sm text-red-700">{patientQuery.error?.message ?? 'Patient record could not be loaded.'}</Card>;

  const allergy = patient.medicalProfile?.allergyToDrugs || patient.medicalProfile?.productAllergies || patient.medicalProfile?.foodAllergies;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>{!embedded ? <Link href="/clients" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Master records</Link> : null}<h1 className="text-2xl font-semibold">{patient.fullName}</h1><p className="text-sm text-muted-foreground">{patient.patientNo} - {patient.mobile} - {patient.branch?.name}</p></div>
      {canStartConsultation && activeConsultation ? <Button type="button" disabled={startConsultation.isPending} onClick={() => startConsultation.mutate()}><Stethoscope className="size-4" />{startConsultation.isPending ? 'Starting...' : activeConsultation.status === 'IN_CONSULTATION' ? 'Continue consultancy' : 'Start consultancy'}</Button> : null}
    </div>

    {patient.medicalProfile?.criticalAlert ? <Card className="border-red-300 bg-red-50 text-red-900"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><div className="font-semibold">Critical medical alert</div><div className="text-sm">{patient.medicalProfile.clinicalAlerts || allergy || 'Review the medical profile before treatment.'}</div></div></div></Card> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Allergies" value={allergy ?? 'None recorded'} warning={Boolean(allergy)} />
      <Metric title="Last visit" value={format(patient.summary.lastVisit?.appointmentAt)} />
      <Metric title="Next appointment" value={format(patient.summary.nextAppointment?.appointmentAt)} />
      <Metric title="Sessions remaining" value={String(patient.summary.sessionsRemaining)} />
    </div>

    <div className="overflow-x-auto border-b"><div className="flex min-w-max gap-1">{tabs.map((item) => <button key={item} className={`border-b-2 px-3 py-2 text-sm ${tab === item ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setTab(item)}>{item}</button>)}</div></div>

    {tab === 'Overview' ? <Overview patient={patient} /> : null}
    {tab === 'Appointments' ? <AppointmentsPanel patient={patient} canEdit={canClinical} invalidate={invalidate} /> : null}
    {tab === 'Care History' ? <CareHistoryPanel patient={patient} /> : null}
    {tab === 'Billing' ? <BillingPanel patient={patient} canBill={canClinical} invalidate={invalidate} /> : null}
    {tab === 'Prescriptions' ? <Prescriptions patient={patient} canCreate={canPrescribe} onCreate={() => setComposer('prescription')} /> : null}
    {tab === 'Medical Profile' ? <MedicalProfile patient={patient} canEdit={canClinical} invalidate={invalidate} /> : null}
    {tab === 'Documents' ? <div className="space-y-6"><PatientGalleryPanel patient={patient} /><PatientDocumentsPanel patient={patient} /></div> : null}

    {composer ? <ClinicalComposer kind={composer} patient={patient} staff={staff} resources={resourcesQuery.data?.data ?? []} defaultDoctorId={doctors[0]?.id ?? staff[0]?.id} onClose={() => setComposer(null)} onSaved={() => { setComposer(null); invalidate(); }} /> : null}
  </section>;
}

function Metric({ title, value, warning }: { title: string; value: string; warning?: boolean }) { return <Card className="p-4"><div className="text-xs text-muted-foreground">{title}</div><div className={`mt-1 text-sm font-semibold ${warning ? 'text-red-700' : ''}`}>{value}</div></Card>; }
function ListState({ items, empty, action }: { items: React.ReactNode[]; empty: string; action?: React.ReactNode }) { return <Card><div className="mb-3 flex justify-end">{action}</div>{items.length ? <div className="space-y-2">{items}</div> : <div className="py-8 text-center text-sm text-muted-foreground">{empty}</div>}</Card>; }

function AppointmentsPanel({ patient, canEdit, invalidate }: { patient: Patient360; canEdit: boolean; invalidate: () => void }) {
  const [roomEdit, setRoomEdit] = useState<Appointment | null>(null);
  const appointments = patient.lead.appointments ?? [];
  const now = Date.now();
  const finished = (appointment: Appointment) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status);
  const upcoming = appointments.filter((appointment) => !finished(appointment) && new Date(appointment.appointmentAt).getTime() >= now).sort((a, b) => +new Date(a.appointmentAt) - +new Date(b.appointmentAt));
  const overdue = appointments.filter((appointment) => !finished(appointment) && new Date(appointment.appointmentAt).getTime() < now).sort((a, b) => +new Date(b.appointmentAt) - +new Date(a.appointmentAt));
  const completed = appointments.filter((appointment) => appointment.status === 'COMPLETED').sort((a, b) => +new Date(b.appointmentAt) - +new Date(a.appointmentAt));
  const cancelled = appointments.filter((appointment) => ['CANCELLED', 'NO_SHOW'].includes(appointment.status)).sort((a, b) => +new Date(b.appointmentAt) - +new Date(a.appointmentAt));
  const renderAppointment = (appointment: Appointment) => <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
    <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{appointment.service?.name ?? label(appointment.appointmentType)}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{label(appointment.status)}</span></div><div className="mt-1 text-xs text-muted-foreground">{format(appointment.appointmentAt)}{appointment.doctor?.name ? ` · ${appointment.doctor.name}` : ''}{appointment.resourceType === 'TREATMENT_ROOM' ? ` · Room ${appointment.roomNumber ?? 'not assigned'}` : ''}</div>{appointment.notes ? <p className="mt-1 text-sm text-muted-foreground">{appointment.notes}</p> : null}</div>
    {canEdit && appointment.resourceType === 'TREATMENT_ROOM' && !finished(appointment) ? <Button type="button" variant="secondary" onClick={() => setRoomEdit(appointment)}>Change room</Button> : null}
  </div>;
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Upcoming" value={String(upcoming.length)} /><Metric title="Overdue" value={String(overdue.length)} warning={overdue.length > 0} /><Metric title="Completed" value={String(completed.length)} /><Metric title="Cancelled / no-show" value={String(cancelled.length)} /></div>
    <div className="grid gap-4 xl:grid-cols-2"><AppointmentGroup title="Upcoming appointments" empty="No upcoming appointments." items={upcoming.map(renderAppointment)} /><AppointmentGroup title="Overdue appointments" empty="No overdue appointments." items={overdue.map(renderAppointment)} warning /></div>
    <AppointmentGroup title="Completed appointments" empty="No completed appointments." items={completed.map(renderAppointment)} />
    {cancelled.length ? <AppointmentGroup title="Cancelled and no-show" empty="" items={cancelled.map(renderAppointment)} /> : null}
    {roomEdit ? <ChangeAppointmentRoomModal appointment={roomEdit} onClose={() => setRoomEdit(null)} onSaved={() => { setRoomEdit(null); invalidate(); }} /> : null}
  </div>;
}

function AppointmentGroup({ title, empty, items, warning = false }: { title: string; empty: string; items: React.ReactNode[]; warning?: boolean }) { return <Card className={warning && items.length ? 'border-red-200' : ''}><h2 className="font-semibold">{title}</h2>{items.length ? <div className="mt-3 space-y-2">{items}</div> : <div className="py-7 text-center text-sm text-muted-foreground">{empty}</div>}</Card>; }

function CareHistoryPanel({ patient }: { patient: Patient360 }) {
  const packages = patient.packages ?? [];
  const invoices = patient.invoices ?? [];
  const paid = invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? invoice.payments.reduce((total, payment) => total + Number(payment.amount), 0)), 0);
  const completedCare = (patient.sessions?.length ?? 0) + (patient.clinicalEncounters?.filter((item) => ['COMPLETED', 'SIGNED', 'LOCKED'].includes(item.status)).length ?? 0) + (patient.procedureSessions?.filter((item) => item.status === 'COMPLETED').length ?? 0);
  return <div className="space-y-4">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Complete patient journey</p><h2 className="text-xl font-semibold">Treatments & consultations</h2><p className="text-sm text-muted-foreground">Care taken, package progress, amounts paid, and the next scheduled visit in one place.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Care visits recorded" value={String(completedCare)} /><Metric title="Money paid" value={`Rs ${paid.toLocaleString('en-IN')}`} /><Metric title="Sessions remaining" value={String(patient.summary.sessionsRemaining)} /><Metric title="Next session / visit" value={format(patient.summary.nextAppointment?.appointmentAt)} /></div>
    <Card><div className="flex items-center gap-2"><CalendarCheck2 className="size-5 text-primary" /><h3 className="font-semibold">Packages & session progress</h3></div>{packages.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{packages.map((item) => { const remaining = Math.max(0, item.totalSessions - item.completedSessions); return <div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{item.name}</div><div className="mt-1 text-xs text-muted-foreground">Purchased {format(item.purchaseDate)} · {label(item.status ?? 'ACTIVE')}</div></div><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{remaining} remaining</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${item.totalSessions ? Math.min(100, item.completedSessions / item.totalSessions * 100) : 0}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{item.completedSessions}/{item.totalSessions} completed</span><span>Paid Rs {Number(item.paidAmount).toLocaleString('en-IN')}</span></div>{item.expiryDate ? <p className="mt-2 text-xs text-muted-foreground">Valid until {format(item.expiryDate)}</p> : null}</div>; })}</div> : <div className="py-8 text-center text-sm text-muted-foreground">No packages purchased.</div>}</Card>
    <div className="grid gap-4 xl:grid-cols-2"><Card><div className="flex items-center gap-2"><Stethoscope className="size-5 text-primary" /><h3 className="font-semibold">Consultations & treatment records</h3></div><div className="mt-3 space-y-2">{(patient.sessions ?? []).map((session) => <div key={session.id} className="rounded-lg border p-3"><div className="font-medium">{label(session.treatmentType)}</div><div className="mt-1 text-xs text-muted-foreground">{format(session.visitDate)} · {session.doctorConsulted || 'Provider not recorded'}</div><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Detail title="Treatment taken" value={session.treatmentTaken || session.treatmentSuggested} /><Detail title="Diagnosis" value={session.diagnosis} /></dl></div>)}{(patient.clinicalEncounters ?? []).map((encounter) => <div key={encounter.id} className="rounded-lg border p-3"><div className="font-medium">{label(encounter.type)}</div><div className="mt-1 text-xs text-muted-foreground">{format(encounter.visitDate)} · Dr. {encounter.doctor.name}</div><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Detail title="Treatment advised" value={encounter.treatmentAdvised} /><Detail title="Diagnosis" value={encounter.diagnosis} /></dl></div>)}{!(patient.sessions?.length || patient.clinicalEncounters?.length) ? <div className="py-8 text-center text-sm text-muted-foreground">No consultation or treatment records.</div> : null}</div></Card>
    <Card><div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-primary" /><h3 className="font-semibold">Charges & payments</h3></div><div className="mt-3 space-y-2">{invoices.map((invoice) => { const invoicePaid = Number(invoice.paidAmount ?? invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)); return <div key={invoice.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{invoice.items?.map((item) => item.description).join(', ') || invoice.invoiceNo}</div><div className="mt-1 text-xs text-muted-foreground">{invoice.invoiceNo} · {format(invoice.invoiceDate)}</div></div><span className="text-sm font-semibold">Rs {Number(invoice.totalAmount).toLocaleString('en-IN')}</span></div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span>Paid: Rs {invoicePaid.toLocaleString('en-IN')}</span><span>Method: {invoice.payments[0]?.mode ? label(invoice.payments[0].mode) : 'Not recorded'}</span><span>Status: {label(invoice.status)}</span></div></div>; })}{!invoices.length ? <div className="py-8 text-center text-sm text-muted-foreground">No charges or payments recorded.</div> : null}</div></Card></div>
  </div>;
}

function ChangeAppointmentRoomModal({ appointment, onClose, onSaved }: { appointment: Appointment; onClose: () => void; onSaved: () => void }) {
  const [roomNumber, setRoomNumber] = useState(String(appointment.roomNumber ?? ''));
  const appointmentAt = useMemo(() => new Date(appointment.appointmentAt), [appointment.appointmentAt]);
  const range = useMemo(() => dayRange(appointmentAt), [appointmentAt]);
  const appointmentsQuery = useQuery({
    queryKey: ['client-room-change-availability', appointment.branchId, range.start.toISOString(), range.end.toISOString()],
    queryFn: () => {
      const params = new URLSearchParams({
        branchId: appointment.branchId,
        dateFrom: range.start.toISOString(),
        dateTo: range.end.toISOString(),
      });
      return apiRequest<{ data: Appointment[] }>(`/appointments?${params.toString()}`);
    },
  });
  const availableRooms = useMemo(() => {
    const requested = {
      start: appointmentAt,
      end: addMinutes(
        appointmentAt,
        (appointment.durationMinutes ?? 30) + (appointment.bufferMinutes ?? 0),
      ),
    };
    return [1, 2, 3, 4].filter((room) => {
      return !(appointmentsQuery.data?.data ?? []).some((item) => {
        if (item.id === appointment.id) return false;
        if (item.branchId !== appointment.branchId) return false;
        if (item.resourceType !== 'TREATMENT_ROOM' || item.roomNumber !== room) return false;
        if (item.status === 'CANCELLED' || item.status === 'NO_SHOW') return false;
        const existingStart = new Date(item.appointmentAt);
        const existingEnd = addMinutes(
          item.endAt ? new Date(item.endAt) : addMinutes(existingStart, item.durationMinutes ?? 30),
          item.bufferMinutes ?? 0,
        );
        return overlaps(requested, { start: existingStart, end: existingEnd });
      });
    });
  }, [appointment, appointmentAt, appointmentsQuery.data]);
  const mutation = useMutation({
    mutationFn: () => apiRequest(`/appointments/${appointment.id}`, { method: 'PATCH', body: JSON.stringify({ resourceType: 'TREATMENT_ROOM', roomNumber: Number(roomNumber) }) }),
    onSuccess: onSaved,
  });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <Card className="w-full max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Change appointment room</h2>
          <p className="mt-1 text-sm text-muted-foreground">{format(appointment.appointmentAt)} - Current room {appointment.roomNumber ?? '-'}</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="mt-5 grid gap-2">
        <Field label="Available treatment room">
          <Select value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} disabled={appointmentsQuery.isLoading}>
            <option value="">{appointmentsQuery.isLoading ? 'Checking availability...' : availableRooms.length ? 'Select available room' : 'No rooms available'}</option>
            {availableRooms.map((room) => <option key={room} value={room}>Room {room}</option>)}
          </Select>
        </Field>
        {mutation.isError ? <p className="text-sm text-red-700">{mutation.error.message}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" disabled={!roomNumber || mutation.isPending || Number(roomNumber) === appointment.roomNumber} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving...' : 'Save room'}
        </Button>
      </div>
    </Card>
  </div>;
}

function Overview({ patient }: { patient: Patient360 }) {
  const latestAppointment = patient.summary.lastVisit ?? patient.lead.appointments[0];
  const profile = patient.medicalProfile;
  const registrationSource = patient.registrationSource ?? patient.lead?.source;
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Personal details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail title="Full name" value={patient.fullName} />
          <Detail title="Client no." value={patient.patientNo} />
          <Detail title="Age" value={patient.age ? String(patient.age) : undefined} />
          <Detail title="Sex" value={patient.sex ? label(patient.sex) : undefined} />
          <Detail title="Marital status" value={patient.maritalStatus} />
          <Detail title="Occupation" value={patient.occupation} />
          <Detail title="Address" value={patient.address} />
        </dl>
      </Card>

      <Card>
        <h2 className="font-semibold">Contact & registration</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail title="Mobile" value={patient.mobile} />
          <Detail title="Email" value={patient.email} />
          <Detail title="Branch" value={patient.branch?.name} />
          <Detail title="Branch phone" value={patient.branch?.phone} />
          <Detail title="Branch address" value={patient.branch?.address} />
          <Detail title="Registration source" value={registrationSource ? label(registrationSource) : undefined} />
          <Detail title="Registered on" value={format(patient.registeredAt ?? patient.createdAt)} />
          <Detail title="Last updated" value={format(patient.updatedAt)} />
        </dl>
      </Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Clinic status</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail title="Client status" value={patient.status ? label(patient.status) : undefined} />
          <Detail title="Primary concern" value={patient.primaryConcern ?? profile?.skinConcern ?? profile?.hairConcern} />
          <Detail title="Active treatment" value={patient.summary.activeTreatmentPlan?.concern} />
          <Detail title="Latest visit" value={format(latestAppointment?.appointmentAt ?? patient.lastVisitAt)} />
          <Detail title="Next appointment" value={format(patient.summary.nextAppointment?.appointmentAt ?? patient.nextVisitAt)} />
          <Detail title="Sessions remaining" value={String(patient.summary.sessionsRemaining)} />
          <Detail title="Outstanding amount" value={`?${patient.summary.outstandingAmount.toLocaleString('en-IN')}`} />
        </dl>
      </Card>

      <Card>
        <h2 className="font-semibold">Medical background</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail title="Skin concern" value={profile?.skinConcern} />
          <Detail title="Hair concern" value={profile?.hairConcern} />
          <Detail title="Medical history" value={profile?.medicalHistory} />
          <Detail title="Surgical history" value={profile?.surgicalHistory} />
          <Detail title="Current medicines" value={profile?.currentMedications} />
          <Detail title="Drug allergies" value={profile?.allergyToDrugs} />
          <Detail title="Product allergies" value={profile?.productAllergies} />
          <Detail title="Food allergies" value={profile?.foodAllergies} />
          <Detail title="Clinical alerts" value={profile?.clinicalAlerts} />
          <Detail title="Pregnancy status" value={profile?.pregnancyStatus} />
        </dl>
      </Card>
    </div>

    <Card>
      <h2 className="font-semibold">Consent & communication</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail title="Transactional messages" value={patient.person?.transactionalConsent ? 'Allowed' : 'Not recorded'} />
        <Detail title="Appointment notifications" value={patient.person?.appointmentNotificationConsent ? 'Allowed' : 'Not recorded'} />
        <Detail title="Marketing messages" value={patient.person?.marketingConsent ? 'Allowed' : 'Not recorded'} />
        <Detail title="Data processing consent" value={patient.person?.dataProcessingConsent ? 'Allowed' : 'Not recorded'} />
      </dl>
    </Card>
  </div>;
}
function BillingPanel({ patient, canBill, invalidate }: { patient: Patient360; canBill: boolean; invalidate: () => void }) {
  const [payingInvoice, setPayingInvoice] = useState<Patient360['invoices'][number] | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const invoicePdf = usePdfActions((id) => `/billing/invoices/${id}/pdf`, (id) => `invoice-${id}.pdf`);
  const invoices = patient.invoices ?? [];
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <div className="text-sm text-muted-foreground">Total billed</div>
        <div className="mt-1 text-2xl font-semibold">Rs {invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount ?? 0), 0).toLocaleString('en-IN')}</div>
      </Card>
      <Card>
        <div className="text-sm text-muted-foreground">Collected</div>
        <div className="mt-1 text-2xl font-semibold">Rs {invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? invoice.payments.reduce((paid, payment) => paid + Number(payment.amount), 0)), 0).toLocaleString('en-IN')}</div>
      </Card>
      <Card>
        <div className="text-sm text-muted-foreground">Outstanding</div>
        <div className="mt-1 text-2xl font-semibold">Rs {patient.summary.outstandingAmount.toLocaleString('en-IN')}</div>
      </Card>
    </div>

    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Invoices and payments</h2><p className="mt-1 text-xs text-muted-foreground">Create GST or non-GST bills, collect payments, and print professional invoices.</p></div>{canBill ? <Button onClick={() => setShowInvoice(true)}><ReceiptText className="size-4" />Generate invoice</Button> : null}</div>
      <div className="mt-3 space-y-3">
        {invoices.length ? invoices.map((invoice) => {
          const paid = Number(invoice.paidAmount ?? invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
          const outstanding = Number(invoice.outstandingAmount ?? Math.max(0, Number(invoice.totalAmount) - paid));
          return <div key={invoice.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{invoice.invoiceNo} - {label(invoice.status)}</div>
                <div className="text-xs text-muted-foreground">{format(invoice.invoiceDate)}</div>
                {invoice.items?.length ? <div className="mt-2 space-y-1 text-sm">{invoice.items.map((item) => <div key={item.id}>{item.description} · {Number(item.quantity)} × Rs {Number(item.unitPrice).toLocaleString('en-IN')} · Rs {Number(item.totalAmount).toLocaleString('en-IN')}</div>)}</div> : null}
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm font-semibold">Rs {Number(invoice.totalAmount).toLocaleString('en-IN')}</div>
                <div className={outstanding > 0 ? 'text-xs text-red-700' : 'text-xs text-emerald-700'}>{outstanding > 0 ? `Outstanding Rs ${outstanding.toLocaleString('en-IN')}` : 'Paid'}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:justify-end"><Button className="h-8 px-2 text-xs" variant="secondary" disabled={invoicePdf.preview.isPending} onClick={() => invoicePdf.preview.mutate(invoice.id)}>Preview</Button><Button className="h-8 px-2 text-xs" variant="secondary" disabled={invoicePdf.download.isPending} onClick={() => invoicePdf.download.mutate(invoice.id)}><Download className="size-3.5" />Download</Button><Button className="h-8 px-2 text-xs" variant="secondary" disabled={invoicePdf.print.isPending} onClick={() => invoicePdf.print.mutate(invoice.id)}><Printer className="size-3.5" />Print</Button></div>
                {canBill && outstanding > 0 && ['ISSUED', 'PARTIAL', 'OVERDUE'].includes(invoice.status) ? <Button className="mt-2" variant="secondary" onClick={() => setPayingInvoice(invoice)}>Record payment</Button> : null}
              </div>
            </div>
          </div>;
        }) : <p className="py-6 text-center text-sm text-muted-foreground">No invoices generated yet.</p>}
      </div>
    </Card>
    {payingInvoice ? <PaymentModal patient={patient} invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onSaved={() => { setPayingInvoice(null); invalidate(); }} /> : null}
    {showInvoice ? <InvoiceModal patient={patient} onClose={() => setShowInvoice(false)} onSaved={() => { setShowInvoice(false); invalidate(); }} /> : null}
  </div>;
}

type InvoiceDraftItem = { category: 'CONSULTATION' | 'TREATMENT' | 'CUSTOM'; description: string; quantity: string; unitPrice: string; discount: string };
function InvoiceModal({ patient, onClose, onSaved }: { patient: Patient360; onClose: () => void; onSaved: () => void }) {
  const [invoiceFor, setInvoiceFor] = useState<'SERVICES' | 'PACKAGE'>('SERVICES');
  const [gst, setGst] = useState(true);
  const [gstPercent, setGstPercent] = useState('18');
  const [packageMasterId, setPackageMasterId] = useState('');
  const [packageDiscountPercent, setPackageDiscountPercent] = useState('0');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paidAt, setPaidAt] = useState(nowLocal());
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment is due on receipt. Services once provided are subject to the clinic cancellation and refund policy.');
  const [items, setItems] = useState<InvoiceDraftItem[]>([{ category: 'CONSULTATION', description: '', quantity: '1', unitPrice: '', discount: '0' }]);
  const packagesQuery = useQuery({ queryKey: ['invoice-package-masters', patient.branchId], queryFn: () => apiRequest<{ data: PackageMasterOption[] }>(`/billing/package-masters?branchId=${patient.branchId}`) });
  const availablePackages = (packagesQuery.data?.data ?? []).filter((item) => item.active && (!item.branchId || item.branchId === patient.branchId));
  const packageMaster = availablePackages.find((item) => item.id === packageMasterId);
  const updateItem = (index: number, key: keyof InvoiceDraftItem, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const packageDiscount = packageMaster ? Number(packageMaster.price) * Math.min(100, Math.max(0, Number(packageDiscountPercent || 0))) / 100 : 0;
  const billingItems = invoiceFor === 'PACKAGE' && packageMaster ? [{ category: 'PACKAGE' as const, description: packageMaster.name, quantity: '1', unitPrice: String(packageMaster.price), discount: String(packageDiscount) }] : items;
  const subtotal = billingItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const discount = billingItems.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const taxable = Math.max(0, subtotal - discount);
  const activeTaxPercent = gst ? Number(invoiceFor === 'PACKAGE' && packageMaster ? packageMaster.taxPercent : gstPercent) : 0;
  const tax = taxable * activeTaxPercent / 100;
  const total = taxable + tax;
  const paymentAmount = total;
  const valid = invoiceFor === 'PACKAGE' ? Boolean(packageMaster) : items.length > 0 && items.every((item) => item.description.trim().length >= 2 && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0);
  const mutation = useMutation({
    mutationFn: async () => {
      let patientPackageId: string | undefined;
      if (invoiceFor === 'PACKAGE' && packageMaster) {
        const purchased = await apiRequest<{ data: { id: string } }>('/billing/patient-packages', { method: 'POST', body: JSON.stringify({ patientId: patient.id, branchId: patient.branchId, packageMasterId: packageMaster.id, discount, taxPercent: activeTaxPercent, paidAmount: paymentAmount, notes: notes || undefined }) });
        patientPackageId = purchased.data.id;
      }
      const created = await apiRequest<{ data: { id: string } }>('/billing/invoices', { method: 'POST', body: JSON.stringify({ patientId: patient.id, branchId: patient.branchId, notes: notes || undefined, terms: terms || undefined, discountReason: discount > 0 ? invoiceFor === 'PACKAGE' ? `Package discount ${packageDiscountPercent}%` : 'Invoice discount' : undefined, items: billingItems.map((item, index) => ({ type: item.category === 'PACKAGE' ? 'PACKAGE' : item.category === 'CUSTOM' ? 'CUSTOM' : 'SERVICE', description: item.description.trim(), packageMasterId: item.category === 'PACKAGE' ? packageMaster?.id : undefined, patientPackageId: item.category === 'PACKAGE' ? patientPackageId : undefined, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), discount: Number(item.discount), taxPercent: activeTaxPercent, sortOrder: (index + 1) * 10 })) }) });
      await apiRequest(`/billing/invoices/${created.data.id}/issue`, { method: 'POST', body: JSON.stringify({ terms: terms || undefined }) });
      if (paymentAmount > 0) await apiRequest(`/billing/invoices/${created.data.id}/payments`, { method: 'POST', body: JSON.stringify({ patientId: patient.id, amount: paymentAmount, mode: paymentMode, paidAt, allocations: [{ invoiceId: created.data.id, amount: paymentAmount }] }) });
      return created;
    },
    onSuccess: onSaved,
  });
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true"><Card className="mx-auto w-full max-w-4xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Billing</p><h2 className="text-xl font-semibold">Generate invoice</h2><p className="mt-1 text-sm text-muted-foreground">{patient.fullName} · {patient.patientNo} · {format(paidAt)}</p></div><Button variant="ghost" onClick={onClose}>Close</Button></div>
    <div className="mt-5 grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Invoice for"><Select value={invoiceFor} onChange={(event) => { setInvoiceFor(event.target.value as 'SERVICES' | 'PACKAGE'); setPackageMasterId(''); }}><option value="SERVICES">Consultation / treatment</option><option value="PACKAGE">Package</option></Select></Field><Field label="Tax type"><Select value={gst ? 'GST' : 'NON_GST'} onChange={(event) => setGst(event.target.value === 'GST')}><option value="GST">GST invoice</option><option value="NON_GST">Non-GST invoice</option></Select></Field>{gst && invoiceFor === 'SERVICES' ? <Field label="GST rate"><Select value={gstPercent} onChange={(event) => setGstPercent(event.target.value)}>{['5', '12', '18', '28'].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</Select></Field> : <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{gst && packageMaster ? `Package GST: ${packageMaster.taxPercent}%` : 'No tax will be added.'}</div>}</div>
    {invoiceFor === 'PACKAGE' ? <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]"><Field label="Package"><Select value={packageMasterId} onChange={(event) => setPackageMasterId(event.target.value)} disabled={packagesQuery.isLoading}><option value="">{packagesQuery.isLoading ? 'Loading packages...' : 'Select package'}</option>{availablePackages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.totalSessions} sessions · Rs {Number(item.price).toLocaleString('en-IN')}</option>)}</Select></Field><Field label="Discount (%)"><Input type="number" min="0" max="100" step="0.01" value={packageDiscountPercent} onChange={(event) => setPackageDiscountPercent(event.target.value)} placeholder="0%" /></Field></div> : <div className="mt-5 space-y-3"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Invoice items</h3><p className="text-xs text-muted-foreground">Record each consultation, treatment, product, or custom charge.</p></div><Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, { category: 'TREATMENT', description: '', quantity: '1', unitPrice: '', discount: '0' }])}><Plus className="size-4" />Add item</Button></div>{items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[145px_minmax(190px,1fr)_80px_120px_110px_auto]"><Select aria-label="Charge type" value={item.category} onChange={(event) => updateItem(index, 'category', event.target.value)}><option value="CONSULTATION">Consultation</option><option value="TREATMENT">Treatment</option><option value="CUSTOM">Other</option></Select><Input aria-label={`Item ${index + 1} description`} placeholder="Service or treatment taken" value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} /><Input aria-label="Quantity" type="number" min="0.01" step="0.01" placeholder="Qty" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /><Input aria-label="Unit price" type="number" min="0" step="0.01" placeholder="Rate" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} /><Input aria-label="Discount" type="number" min="0" step="0.01" placeholder="Discount" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} /><Button type="button" variant="ghost" className="w-10 px-0" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove invoice item"><Trash2 className="size-4" /></Button></div>)}</div>}
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><div className="font-semibold">Paid in full</div><div className="mt-1 text-xs">The complete invoice total is collected when this invoice is generated.</div></div><Field label="Payment method"><Select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>{['UPI', 'CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'].map((mode) => <option key={mode} value={mode}>{label(mode)}</option>)}</Select></Field><Field label="Payment date & time"><Input type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></Field></div><Area label="Invoice notes" name="notes" values={{ notes }} set={(_, value) => setNotes(value)} /><Area label="Terms" name="terms" values={{ terms }} set={(_, value) => setTerms(value)} /></div><div className="h-fit rounded-xl border bg-muted/20 p-4 text-sm"><h3 className="mb-3 font-semibold">Invoice summary</h3><div className="flex justify-between"><span>Subtotal</span><span>Rs {subtotal.toLocaleString('en-IN')}</span></div><div className="mt-2 flex justify-between"><span>Discount{invoiceFor === 'PACKAGE' ? ` (${Math.min(100, Math.max(0, Number(packageDiscountPercent || 0)))}%)` : ''}</span><span>- Rs {discount.toLocaleString('en-IN')}</span></div><div className="mt-2 flex justify-between"><span>{gst ? `GST (${activeTaxPercent}%)` : 'Tax'}</span><span>Rs {tax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div><div className="mt-3 flex justify-between border-t pt-3 text-base font-semibold"><span>Total paid</span><span>Rs {paymentAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div><div className="mt-2 flex justify-between text-emerald-700"><span>Balance</span><span>Rs 0</span></div></div></div>{mutation.isError ? <p className="mt-3 text-sm text-red-700">{mutation.error.message}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid || mutation.isPending || paymentAmount <= 0 || Number(packageDiscountPercent) > 100} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Generating...' : 'Generate invoice'}</Button></div></Card></div>;
}

function PaymentModal({ patient, invoice, onClose, onSaved }: { patient: Patient360; invoice: Patient360['invoices'][number]; onClose: () => void; onSaved: () => void }) {
  const outstanding = Number(invoice.outstandingAmount ?? Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount ?? 0)));
  const [amount, setAmount] = useState(String(outstanding));
  const [mode, setMode] = useState('UPI');
  const mutation = useMutation({
    mutationFn: () => apiRequest(`/billing/invoices/${invoice.id}/payments`, { method: 'POST', body: JSON.stringify({ patientId: patient.id, amount: Number(amount), mode, allocations: [{ invoiceId: invoice.id, amount: Number(amount) }] }) }),
    onSuccess: onSaved,
  });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <Card className="w-full max-w-md">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Record payment</h2><p className="mt-1 text-sm text-muted-foreground">{invoice.invoiceNo} - Outstanding Rs {outstanding.toLocaleString('en-IN')}</p></div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="mt-5 grid gap-3">
        <Field label="Amount"><Input type="number" min="1" max={outstanding} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field label="Payment mode"><Select value={mode} onChange={(event) => setMode(event.target.value)}><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></Select></Field>
        {mutation.isError ? <p className="text-sm text-red-700">{mutation.error.message}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending || Number(amount) <= 0 || Number(amount) > outstanding} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving...' : 'Mark paid'}</Button></div>
    </Card>
  </div>;
}
function Detail({ title, value }: { title: string; value?: string | null }) { return <div><dt className="text-xs font-medium text-muted-foreground">{title}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{value || 'Not recorded'}</dd></div>; }
function MedicalProfile({ patient, canEdit, invalidate }: { patient: Patient360; canEdit: boolean; invalidate: () => void }) {
  const profile = patient.medicalProfile; const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ skinConcern: profile?.skinConcern ?? '', hairConcern: profile?.hairConcern ?? '', medicalHistory: profile?.medicalHistory ?? '', surgicalHistory: profile?.surgicalHistory ?? '', currentMedications: profile?.currentMedications ?? '', allergyToDrugs: profile?.allergyToDrugs ?? '', productAllergies: profile?.productAllergies ?? '', foodAllergies: profile?.foodAllergies ?? '', familyHistory: profile?.familyHistory ?? '', smokingStatus: profile?.smokingStatus ?? '', alcoholHistory: profile?.alcoholHistory ?? '', pregnancyStatus: profile?.pregnancyStatus ?? '', breastfeedingStatus: profile?.breastfeedingStatus ?? '', previousAestheticProcedures: profile?.previousAestheticProcedures ?? '', clinicalAlerts: profile?.clinicalAlerts ?? '', criticalAlert: Boolean(profile?.criticalAlert), reasonForChange: '' });
  const mutation = useMutation({ mutationFn: () => apiRequest(`/patients/${patient.id}/medical-profile`, { method: 'PUT', body: JSON.stringify(values) }), onSuccess: () => { setEditing(false); invalidate(); } });
  if (!profile) return <Card className="text-sm text-muted-foreground">Medical profile is unavailable for your role or has not been recorded.</Card>;
  const setProfileValue = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));
  if (editing) return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Clinical record</p><h2 className="text-xl font-semibold">Update medical profile</h2><p className="text-sm text-muted-foreground">Keep safety-critical history current before consultation or treatment.</p></div><Button variant="secondary" onClick={() => setEditing(false)}>Cancel edit</Button></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><ProfileEditor title="Concerns & history"><TextField label="Skin concern" name="skinConcern" values={values} set={setProfileValue} /><TextField label="Hair concern" name="hairConcern" values={values} set={setProfileValue} /><Area label="Medical history" name="medicalHistory" values={values} set={setProfileValue} /><Area label="Surgical history" name="surgicalHistory" values={values} set={setProfileValue} /><Area label="Previous aesthetic procedures" name="previousAestheticProcedures" values={values} set={setProfileValue} /></ProfileEditor><ProfileEditor title="Medicines & allergies"><Area label="Current medicines" name="currentMedications" values={values} set={setProfileValue} /><Area label="Drug allergies" name="allergyToDrugs" values={values} set={setProfileValue} /><Area label="Product allergies" name="productAllergies" values={values} set={setProfileValue} /><Area label="Food allergies" name="foodAllergies" values={values} set={setProfileValue} /></ProfileEditor><ProfileEditor title="Lifestyle & family"><TextField label="Family history" name="familyHistory" values={values} set={setProfileValue} /><TextField label="Smoking status" name="smokingStatus" values={values} set={setProfileValue} /><TextField label="Alcohol history" name="alcoholHistory" values={values} set={setProfileValue} /><TextField label="Pregnancy status" name="pregnancyStatus" values={values} set={setProfileValue} /><TextField label="Breastfeeding status" name="breastfeedingStatus" values={values} set={setProfileValue} /></ProfileEditor><ProfileEditor title="Safety alerts" alert><Area label="Clinical alerts" name="clinicalAlerts" values={values} set={setProfileValue} /><label className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900"><input type="checkbox" checked={values.criticalAlert} onChange={(event) => setValues((current) => ({ ...current, criticalAlert: event.target.checked }))} />Show critical alert throughout the patient record</label><TextField label="Reason for change" name="reasonForChange" values={values} set={setProfileValue} /></ProfileEditor></div>{mutation.isError ? <p className="mt-3 text-sm text-red-700">{mutation.error.message}</p> : null}<div className="mt-5 flex justify-end"><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving...' : 'Save medical profile'}</Button></div></Card>;
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Clinical record</p><h2 className="text-xl font-semibold">Medical profile</h2><p className="text-sm text-muted-foreground">A structured view of concerns, history, medicines, allergies, and safety alerts.</p></div>{canEdit ? <Button variant="secondary" onClick={() => setEditing(true)}>Update profile</Button> : null}</div>{profile.criticalAlert || profile.clinicalAlerts ? <Card className="border-red-200 bg-red-50"><div className="flex gap-3 text-red-900"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><div className="font-semibold">Clinical safety alert</div><p className="mt-1 text-sm">{profile.clinicalAlerts || 'Critical alert is enabled for this patient.'}</p></div></div></Card> : null}<div className="grid gap-4 xl:grid-cols-2"><ProfileCard icon={<HeartPulse className="size-5" />} title="Primary concerns & history" fields={[["Skin concern", profile.skinConcern], ["Hair concern", profile.hairConcern], ["Medical history", profile.medicalHistory], ["Surgical history", profile.surgicalHistory], ["Previous aesthetic procedures", profile.previousAestheticProcedures]]} /><ProfileCard icon={<ShieldAlert className="size-5" />} title="Medicines & allergies" fields={[["Current medicines", profile.currentMedications], ["Drug allergies", profile.allergyToDrugs], ["Product allergies", profile.productAllergies], ["Food allergies", profile.foodAllergies]]} /><ProfileCard title="Lifestyle & family" fields={[["Family history", profile.familyHistory], ["Smoking", profile.smokingStatus], ["Alcohol", profile.alcoholHistory]]} /><ProfileCard title="Reproductive health" fields={[["Pregnancy status", profile.pregnancyStatus], ["Breastfeeding status", profile.breastfeedingStatus], ["Menstrual history", profile.menstrualHistory]]} /></div></div>;
}
function ProfileEditor({ title, alert = false, children }: { title: string; alert?: boolean; children: React.ReactNode }) { return <section className={`space-y-3 rounded-xl border p-4 ${alert ? 'border-red-200 bg-red-50/40' : ''}`}><h3 className="font-semibold">{title}</h3>{children}</section>; }
function ProfileCard({ title, icon, fields }: { title: string; icon?: React.ReactNode; fields: Array<[string, string | null | undefined]> }) { return <Card><div className="flex items-center gap-2 text-primary">{icon}<h3 className="font-semibold text-foreground">{title}</h3></div><dl className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(([field, value]) => <Detail key={field} title={field} value={value} />)}</dl></Card>; }

function Prescriptions({ patient, canCreate, onCreate }: { patient: Patient360; canCreate: boolean; onCreate: () => void }) {
  const pdf = usePdfActions((id) => `/clinical/prescriptions/${id}/pdf`, (id) => `prescription-${id}.pdf`);
  const prescriptions = patient.prescriptions ?? [];
  const sessionPrescriptions = (patient.sessions ?? []).filter((session) => session.prescription?.length);
  const items = [
    ...prescriptions.map((prescription) => <Card key={prescription.id} className="overflow-hidden p-0"><div className="border-b bg-muted/30 p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="flex items-center gap-2"><span className="text-lg font-semibold text-primary">Rx</span><span className="font-semibold">{prescription.prescriptionNo}</span></div><div className="mt-1 text-xs text-muted-foreground">{format(prescription.prescribedAt)} · Dr. {prescription.doctor.name}</div></div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={pdf.preview.isPending} onClick={() => pdf.preview.mutate(prescription.id)}>Preview</Button><Button variant="secondary" disabled={pdf.download.isPending} onClick={() => pdf.download.mutate(prescription.id)}><Download className="size-4" />Download</Button><Button variant="secondary" disabled={pdf.print.isPending} onClick={() => pdf.print.mutate(prescription.id)}><Printer className="size-4" />Print</Button></div></div>{prescription.consultationSummary || prescription.diagnosisSummary ? <dl className="mt-3 grid gap-3 sm:grid-cols-2"><Detail title="Consulted / treated for" value={prescription.consultationSummary} /><Detail title="Diagnosis" value={prescription.diagnosisSummary} /></dl> : null}</div><ol className="divide-y">{prescription.items.map((item, index) => <li key={item.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[28px_1fr]"><span className="font-semibold text-primary">{index + 1}.</span><div><strong>{item.medicineName} {item.strength}</strong><div className="mt-1">{item.dosage} · {item.frequency} · {item.duration}{item.route ? ` · ${item.route}` : ''}{item.timing ? ` · ${item.timing}` : ''}</div>{item.instructions ? <div className="mt-1 text-muted-foreground">{item.instructions}</div> : null}</div></li>)}</ol></Card>),
    ...sessionPrescriptions.map((session) => <Card key={`session-rx-${session.id}`} className="p-4"><div className="font-semibold">Prescription from {label(session.treatmentType)}</div><div className="text-xs text-muted-foreground">{format(session.visitDate)} - {session.doctorConsulted || 'Provider not recorded'}</div><div className="mt-3 space-y-2">{session.prescription?.map((item, index) => <div key={`${session.id}-${index}`} className="rounded bg-muted p-3 text-sm"><strong>{item.medicine}</strong><div>{item.dosage} - {item.frequency} - {item.duration}</div>{item.instructions ? <div className="text-muted-foreground">{item.instructions}</div> : null}</div>)}</div></Card>),
  ];
  return <ListState empty="No prescriptions issued." action={canCreate ? <Button onClick={onCreate}><Plus className="size-4" />New prescription</Button> : undefined} items={items} />;
}

type PrescriptionDraftItem = { medicineId?: string; medicineName: string; strength: string; dosage: string; frequency: string; duration: string; route: string; timing: string; instructions: string };
const emptyPrescriptionItem = (): PrescriptionDraftItem => ({ medicineName: '', strength: '', dosage: '', frequency: '', duration: '', route: '', timing: '', instructions: '' });
function ClinicalComposer({ kind, patient, staff, defaultDoctorId, onClose, onSaved }: { kind: 'encounter' | 'prescription'; patient: Patient360; staff: StaffMember[]; resources: ClinicResource[]; defaultDoctorId?: string; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({ doctorId: defaultDoctorId ?? '', visitDate: nowLocal(), type: 'CONSULTATION', prescribedAt: nowLocal() });
  const [medicineSearch, setMedicineSearch] = useState('');
  const [draftMedicine, setDraftMedicine] = useState<PrescriptionDraftItem>(emptyPrescriptionItem);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionDraftItem[]>([]);
  const set = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const medicineQuery = useQuery({ queryKey: ['clinical-medicines', medicineSearch.trim()], enabled: kind === 'prescription', queryFn: () => apiRequest<{ data: MedicineOption[] }>(`/clinical/medicines${medicineSearch.trim() ? `?search=${encodeURIComponent(medicineSearch.trim())}` : ''}`) });
  const medicines = medicineQuery.data?.data ?? [];
  const selectMedicine = (medicineId: string) => {
    const selected = medicines.find((medicine) => medicine.id === medicineId);
    const topical = /cream|gel|lotion|ointment|solution|serum|wash|shampoo|spray|oil/i.test(selected?.form ?? selected?.name ?? '');
    setDraftMedicine((current) => ({ ...current, medicineId, medicineName: selected?.name ?? '', strength: selected?.strength ?? '', dosage: topical ? 'Apply a thin layer' : current.dosage, route: topical ? 'Topical' : current.route }));
  };
  const addMedicine = () => {
    if (!draftMedicine.medicineName || !draftMedicine.dosage || !draftMedicine.frequency || !draftMedicine.duration) return;
    setPrescriptionItems((current) => [...current, draftMedicine]);
    setDraftMedicine(emptyPrescriptionItem());
    setMedicineSearch('');
  };
  const mutation = useMutation({ mutationFn: async () => {
    if (kind === 'encounter') return apiRequest(`/clinical/patients/${patient.id}/encounters`, { method: 'POST', body: JSON.stringify({ branchId: patient.branchId, doctorId: values.doctorId, type: values.type, visitDate: values.visitDate, chiefComplaint: values.chiefComplaint, diagnosis: values.diagnosis, assessment: values.assessment, treatmentAdvised: values.treatmentAdvised, clinicalNotes: values.clinicalNotes, status: 'DRAFT' }) });
    if (!prescriptionItems.length) throw new Error('Add at least one medicine to the prescription');
    return apiRequest(`/clinical/patients/${patient.id}/prescriptions`, { method: 'POST', body: JSON.stringify({ doctorId: values.doctorId, prescribedAt: values.prescribedAt, consultationSummary: values.consultationSummary, diagnosisSummary: values.diagnosis, instructions: values.instructions, precautions: values.precautions, items: prescriptionItems }) });
  }, onSuccess: onSaved });
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><Card className={`mx-auto w-full ${kind === 'prescription' ? 'max-w-4xl' : 'max-w-2xl'}`}><div className="flex justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{kind === 'prescription' ? 'Clinical prescription' : 'Clinical encounter'}</p><h2 className="text-xl font-semibold">New {kind}</h2><p className="text-sm text-muted-foreground">{patient.fullName} · {patient.patientNo}</p></div><Button variant="ghost" onClick={onClose}>Close</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">
    {kind === 'encounter' ? <><Field label="Encounter type"><Select value={String(values.type)} onChange={(event) => set('type', event.target.value)}>{['CONSULTATION', 'VIDEO_CONSULTATION', 'FOLLOW_UP_CONSULTATION', 'PROCEDURE', 'TREATMENT_SESSION', 'REVIEW', 'EMERGENCY_REVIEW', 'OTHER'].map((item) => <option key={item}>{label(item)}</option>)}</Select></Field><Field label="Visit date"><Input type="datetime-local" value={String(values.visitDate)} onChange={(event) => set('visitDate', event.target.value)} /></Field><TextField label="Chief complaint" name="chiefComplaint" values={values} set={set} /><TextField label="Diagnosis" name="diagnosis" values={values} set={set} /><TextField label="Assessment" name="assessment" values={values} set={set} /><TextField label="Treatment advised" name="treatmentAdvised" values={values} set={set} /><Area label="Clinical notes" name="clinicalNotes" values={values} set={set} /></> : null}
    {kind === 'prescription' ? <><Field label="Prescribing doctor"><Select value={String(values.doctorId)} onChange={(event) => set('doctorId', event.target.value)}><option value="">Select doctor</option>{staff.filter((member) => member.role === 'ADMIN').map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></Field><Field label="Prescription date"><Input type="datetime-local" value={String(values.prescribedAt)} onChange={(event) => set('prescribedAt', event.target.value)} /></Field><TextField label="Consultation / treatment provided" name="consultationSummary" values={values} set={set} /><TextField label="Diagnosis / clinical impression" name="diagnosis" values={values} set={set} /><div className="sm:col-span-2 rounded-xl border p-4"><div><h3 className="font-semibold">Add medicines</h3><p className="text-sm text-muted-foreground">Search the catalogue or enter a medicine manually, then complete its directions.</p></div><div className="relative mt-4"><Field label="Search medicine"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={medicineSearch} onChange={(event) => setMedicineSearch(event.target.value)} placeholder="Type medicine, cream, lotion, tablet..." /></div></Field>{medicineSearch.trim() ? <div className="mt-1 max-h-52 overflow-y-auto rounded-md border bg-surface p-1 shadow-sm">{medicineQuery.isLoading ? <p className="p-3 text-sm text-muted-foreground">Searching medicines...</p> : medicines.length ? medicines.map((medicine) => <button key={medicine.id} type="button" className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { selectMedicine(medicine.id); setMedicineSearch(''); }}><span className="font-medium">{medicine.name}{medicine.strength ? ` · ${medicine.strength}` : ''}</span><span className="text-xs text-muted-foreground">{medicine.form || medicine.genericName || 'Medicine'}</span></button>) : <p className="p-3 text-sm text-muted-foreground">No catalogue medicine found. Use the manual medicine field below.</p>}</div> : null}</div><div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />OR ENTER MANUALLY<span className="h-px flex-1 bg-border" /></div><Field label="Medicine not in catalogue"><Input value={draftMedicine.medicineId ? '' : draftMedicine.medicineName} onChange={(event) => setDraftMedicine((current) => ({ ...current, medicineId: undefined, medicineName: event.target.value }))} placeholder="Write medicine name exactly as it should print" /></Field><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Selected medicine"><Input value={draftMedicine.medicineName} readOnly placeholder="Select or enter medicine" /></Field><Field label="Strength"><Input value={draftMedicine.strength} onChange={(event) => setDraftMedicine((current) => ({ ...current, strength: event.target.value }))} placeholder="e.g. 10 mg or 2%" /></Field><PrescriptionSelect label="Dose / application" value={draftMedicine.dosage} placeholder="Select dose" options={['1 tablet', '1/2 tablet', '1 capsule', '5 ml', '10 ml', 'Apply a thin layer', 'Apply 2-3 drops', 'One fingertip unit', 'Use as face wash', 'Use as shampoo', 'As directed']} onChange={(value) => setDraftMedicine((current) => ({ ...current, dosage: value }))} /><PrescriptionSelect label="Frequency" value={draftMedicine.frequency} placeholder="Select frequency" options={['Once daily', 'Twice daily', 'Three times daily', 'Every morning', 'Every night', 'Morning and evening', 'Alternate days', 'Once weekly', 'As needed', 'As directed']} onChange={(value) => setDraftMedicine((current) => ({ ...current, frequency: value }))} /><PrescriptionSelect label="Duration" value={draftMedicine.duration} placeholder="Select duration" options={['3 days', '5 days', '7 days', '10 days', '14 days', '3 weeks', '1 month', '2 months', '3 months', 'Until next review', 'As directed']} onChange={(value) => setDraftMedicine((current) => ({ ...current, duration: value }))} /><PrescriptionSelect label="Route" value={draftMedicine.route} placeholder="Select route" options={['Oral', 'Topical', 'Scalp', 'Face', 'Body', 'Nail', 'Intralesional', 'As directed']} onChange={(value) => setDraftMedicine((current) => ({ ...current, route: value }))} /><PrescriptionSelect label="Food / time instruction" value={draftMedicine.timing} placeholder="Select timing" options={['Before food', 'After food', 'With food', 'Empty stomach', 'Morning', 'Bedtime', 'Morning and evening', 'After bathing', 'As directed']} onChange={(value) => setDraftMedicine((current) => ({ ...current, timing: value }))} /><label className="grid gap-1 text-sm sm:col-span-2"><span className="font-medium">Special instructions</span><textarea className="min-h-20 rounded-md border border-border bg-surface px-3 py-2" value={draftMedicine.instructions} onChange={(event) => setDraftMedicine((current) => ({ ...current, instructions: event.target.value }))} placeholder="Application area, precautions, quantity, or tapering instructions" /></label></div><Button type="button" className="mt-4" variant="secondary" disabled={!draftMedicine.medicineName || !draftMedicine.dosage || !draftMedicine.frequency || !draftMedicine.duration} onClick={addMedicine}><Plus className="size-4" />Add medicine</Button>{prescriptionItems.length ? <div className="mt-5 space-y-2"><h4 className="text-sm font-semibold">Medicines on prescription ({prescriptionItems.length})</h4>{prescriptionItems.map((item, index) => <div key={`${item.medicineName}-${index}`} className="flex items-start justify-between gap-3 rounded-lg bg-muted p-3 text-sm"><div className="flex gap-3"><span className="font-semibold text-primary">{index + 1}.</span><div><strong>{item.medicineName} {item.strength}</strong><div>{item.dosage} · {item.frequency} · {item.duration}{item.route ? ` · ${item.route}` : ''}{item.timing ? ` · ${item.timing}` : ''}</div>{item.instructions ? <p className="text-muted-foreground">{item.instructions}</p> : null}</div></div><Button type="button" variant="ghost" className="h-8 w-8 px-0" onClick={() => setPrescriptionItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></Button></div>)}</div> : null}</div><Area label="General instructions" name="instructions" values={values} set={set} /><Area label="Precautions" name="precautions" values={values} set={set} /></> : null}
  </div>{mutation.isError ? <p className="mt-3 text-sm text-red-700">{mutation.error.message}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending || (kind === 'prescription' && (!values.doctorId || !prescriptionItems.length))} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving...' : kind === 'prescription' ? 'Create prescription' : 'Save'}</Button></div></Card></div>;
}
function PrescriptionSelect({ label: title, value, placeholder, options, onChange }: { label: string; value: string; placeholder: string; options: string[]; onChange: (value: string) => void }) { return <Field label={title}><Select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option key={option}>{option}</option>)}</Select></Field>; }
function Field({ label: title, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm"><span className="font-medium">{title}</span>{children}</label>; }
function TextField({ label: title, name, values, set, type = 'text' }: { label: string; name: string; values: Record<string, string | boolean>; set: (name: string, value: string) => void; type?: string }) { return <Field label={title}><Input type={type} value={String(values[name] ?? '')} onChange={(event) => set(name, event.target.value)} /></Field>; }
function Area({ label: title, name, values, set }: { label: string; name: string; values: Record<string, string | boolean>; set: (name: string, value: string) => void }) { return <label className="grid gap-1 text-sm sm:col-span-2"><span className="font-medium">{title}</span><textarea className="min-h-24 rounded-md border border-border bg-surface px-3 py-2" value={String(values[name] ?? '')} onChange={(event) => set(name, event.target.value)} /></label>; }
