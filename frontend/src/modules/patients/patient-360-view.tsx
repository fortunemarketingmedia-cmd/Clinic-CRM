'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, FileLock2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiBlob, apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicResource, ClinicService } from '@/types/appointment';
import type { Patient360 } from '@/types/clinical';
import type { StaffMember } from '@/types/front-desk';
import { PatientDocumentsPanel } from './patient-forms-files-panel';

const tabs = ['Overview', 'Appointments', 'Treatments', 'Billing', 'Prescriptions', 'Medical Profile', 'Documents'] as const;
type Tab = typeof tabs[number];
type MedicineOption = { id: string; name: string; genericName?: string | null; strength?: string | null; form?: string | null };
type PackageMasterOption = { id: string; branchId?: string | null; name: string; totalSessions: number; validityDays: number; price: string; taxPercent: string; active: boolean };
const serviceLabel = (service: ClinicService) => `${service.category ? `${label(service.category)} · ` : ''}${service.name}`;
const clinicalRoles = ['ADMIN', 'RECEPTIONIST'];
const prescriberRoles = ['ADMIN', 'RECEPTIONIST'];
const format = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'â€”';
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
const nowLocal = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const addMinutes = (value: Date, minutes: number) => new Date(value.getTime() + minutes * 60_000);
const overlaps = (first: { start: Date; end: Date }, second: { start: Date; end: Date }) => first.start < second.end && second.start < first.end;
function dayRange(value: Date) {
  const start = new Date(value); start.setHours(0, 0, 0, 0);
  const end = new Date(value); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function Patient360View({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const { session } = useSessionStore();
  const [tab, setTab] = useState<Tab>('Overview');
  const [composer, setComposer] = useState<'encounter' | 'plan' | 'procedure' | 'prescription' | null>(null);
  const patientQuery = useQuery({ queryKey: ['patient-360', patientId], queryFn: () => apiRequest<{ data: Patient360 }>(`/clinical/patients/${patientId}/360`) });
  const patient = patientQuery.data?.data;
  const canClinical = Boolean(session && clinicalRoles.includes(session.user.role));
  const canPrescribe = Boolean(session && prescriberRoles.includes(session.user.role));
  const staffQuery = useQuery({ queryKey: ['clinical-staff', patient?.branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${patient?.branchId}`), enabled: Boolean(patient?.branchId && canClinical) });
  const resourcesQuery = useQuery({ queryKey: ['clinical-resources', patient?.branchId], queryFn: () => apiRequest<{ data: ClinicResource[] }>(`/front-desk/resources?branchId=${patient?.branchId}`), enabled: Boolean(patient?.branchId && canClinical) });
  const staff = staffQuery.data?.data ?? [];
  const doctors = staff.filter((member) => member.role === 'ADMIN');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['patient-360', patientId] });

  if (patientQuery.isLoading) return <PageSkeleton />;
  if (patientQuery.isError || !patient) return <Card className="border-red-200 text-sm text-red-700">{patientQuery.error?.message ?? 'Patient record could not be loaded.'}</Card>;

  const allergy = patient.medicalProfile?.allergyToDrugs || patient.medicalProfile?.productAllergies || patient.medicalProfile?.foodAllergies;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href="/patients" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Client directory</Link><h1 className="text-2xl font-semibold">{patient.fullName}</h1><p className="text-sm text-muted-foreground">{patient.patientNo} Â· {patient.mobile} Â· {patient.branch?.name}</p></div>
    </div>

    {patient.medicalProfile?.criticalAlert ? <Card className="border-red-300 bg-red-50 text-red-900"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><div className="font-semibold">Critical medical alert</div><div className="text-sm">{patient.medicalProfile.clinicalAlerts || allergy || 'Review the medical profile before treatment.'}</div></div></div></Card> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric title="Assigned doctor" value={patient.assignedDoctor?.name ?? 'Not assigned'} />
      <Metric title="Allergies" value={allergy ?? 'None recorded'} warning={Boolean(allergy)} />
      <Metric title="Last visit" value={format(patient.summary.lastVisit?.appointmentAt)} />
      <Metric title="Next appointment" value={format(patient.summary.nextAppointment?.appointmentAt)} />
      <Metric title="Sessions remaining" value={String(patient.summary.sessionsRemaining)} />
    </div>

    <div className="overflow-x-auto border-b"><div className="flex min-w-max gap-1">{tabs.map((item) => <button key={item} className={`border-b-2 px-3 py-2 text-sm ${tab === item ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => setTab(item)}>{item}</button>)}</div></div>

    {tab === 'Overview' ? <Overview patient={patient} /> : null}
    {tab === 'Appointments' ? <AppointmentsPanel patient={patient} canEdit={canClinical} invalidate={invalidate} /> : null}
    {tab === 'Treatments' ? <Treatments patient={patient} canClinical={canClinical} onRecord={() => setComposer('procedure')} onPlan={() => setComposer('plan')} /> : null}
    {tab === 'Billing' ? <BillingPanel patient={patient} canBill={canClinical} invalidate={invalidate} /> : null}
    {tab === 'Prescriptions' ? <Prescriptions patient={patient} canSign={canPrescribe} onCreate={() => setComposer('prescription')} invalidate={invalidate} /> : null}
    {tab === 'Medical Profile' ? <MedicalProfile patient={patient} canEdit={canClinical} invalidate={invalidate} /> : null}
    {tab === 'Documents' ? <PatientDocumentsPanel patient={patient} /> : null}

    {composer ? <ClinicalComposer kind={composer} patient={patient} staff={staff} resources={resourcesQuery.data?.data ?? []} defaultDoctorId={session?.user.role === 'DOCTOR' ? session.user.id : doctors[0]?.id} onClose={() => setComposer(null)} onSaved={() => { setComposer(null); invalidate(); }} /> : null}
  </section>;
}

function Metric({ title, value, warning }: { title: string; value: string; warning?: boolean }) { return <Card className="p-4"><div className="text-xs text-muted-foreground">{title}</div><div className={`mt-1 text-sm font-semibold ${warning ? 'text-red-700' : ''}`}>{value}</div></Card>; }
function Record({ title, subtitle, warning }: { title: string; subtitle: string; warning?: boolean }) { return <div className={`rounded-md border p-3 ${warning ? 'border-red-200 bg-red-50' : ''}`}><div className="font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">{subtitle}</div></div>; }
function ListState({ items, empty, action }: { items: React.ReactNode[]; empty: string; action?: React.ReactNode }) { return <Card><div className="mb-3 flex justify-end">{action}</div>{items.length ? <div className="space-y-2">{items}</div> : <div className="py-8 text-center text-sm text-muted-foreground">{empty}</div>}</Card>; }

function AppointmentsPanel({ patient, canEdit, invalidate }: { patient: Patient360; canEdit: boolean; invalidate: () => void }) {
  const [roomEdit, setRoomEdit] = useState<Appointment | null>(null);
  const appointments = patient.lead.appointments ?? [];
  return <>
    <Card>
      {appointments.length ? <div className="space-y-2">
        {appointments.map((appointment) => (
          <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="font-medium">
                {label(appointment.status)} · {appointment.service?.name ?? label(appointment.appointmentType)}
                {appointment.resourceType === 'TREATMENT_ROOM' ? ` · Room ${appointment.roomNumber ?? '-'}` : ''}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {format(appointment.appointmentAt)} · {appointment.doctor?.name ?? 'Practitioner not assigned'}
              </div>
            </div>
            {canEdit && appointment.resourceType === 'TREATMENT_ROOM' ? (
              <Button type="button" variant="secondary" onClick={() => setRoomEdit(appointment)}>
                Change room
              </Button>
            ) : null}
          </div>
        ))}
      </div> : <div className="py-8 text-center text-sm text-muted-foreground">No appointments recorded.</div>}
    </Card>
    {roomEdit ? <ChangeAppointmentRoomModal appointment={roomEdit} onClose={() => setRoomEdit(null)} onSaved={() => { setRoomEdit(null); invalidate(); }} /> : null}
  </>;
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
          <p className="mt-1 text-sm text-muted-foreground">{format(appointment.appointmentAt)} · Current room {appointment.roomNumber ?? '-'}</p>
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
          {mutation.isPending ? 'Saving…' : 'Save room'}
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
          <Detail title="Assigned doctor" value={patient.assignedDoctor?.name} />
          <Detail title="Primary concern" value={patient.primaryConcern ?? profile?.skinConcern ?? profile?.hairConcern} />
          <Detail title="Active treatment" value={patient.summary.activeTreatmentPlan?.concern} />
          <Detail title="Latest visit" value={format(latestAppointment?.appointmentAt ?? patient.lastVisitAt)} />
          <Detail title="Next appointment" value={format(patient.summary.nextAppointment?.appointmentAt ?? patient.nextVisitAt)} />
          <Detail title="Sessions remaining" value={String(patient.summary.sessionsRemaining)} />
          <Detail title="Outstanding amount" value={`₹${patient.summary.outstandingAmount.toLocaleString('en-IN')}`} />
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
function Treatments({ patient, canClinical, onRecord, onPlan }: { patient: Patient360; canClinical: boolean; onRecord: () => void; onPlan: () => void }) {
  const sessions = patient.sessions ?? [];
  const plans = patient.treatmentPlans ?? [];
  const procedures = patient.procedureSessions ?? [];
  const items = [
    ...sessions.map((session) => <Record key={`session-${session.id}`} title={`${session.treatmentTaken || session.treatmentSuggested || label(session.treatmentType)} Â· ${label(session.treatmentType)}`} subtitle={`${format(session.visitDate)} Â· ${session.doctorConsulted || 'Provider not recorded'}${session.prescription?.length ? ` Â· ${session.prescription.length} medicines` : ''}`} />),
    ...procedures.map((procedure) => <Record key={`procedure-${procedure.id}`} title={`${procedure.procedureName} Â· ${label(procedure.status)}`} subtitle={`${format(procedure.performedAt ?? procedure.createdAt)} Â· ${procedure.practitioner.name}${procedure.adverseEventFlag ? ' Â· Alert' : ''}`} warning={procedure.adverseEventFlag} />),
    ...plans.map((plan) => <Record key={`plan-${plan.id}`} title={`${plan.concern} Â· ${label(plan.status)}`} subtitle={`${plan.assignedDoctor.name} Â· ${plan.items.map((item) => `${item.name} ${item.completedSessions}/${item.plannedSessions}`).join(', ') || 'Plan created'}`} />),
  ];
  return <ListState empty="No treatments recorded." action={canClinical ? <div className="flex flex-wrap gap-2"><Button onClick={onRecord}><Plus className="size-4" />Record treatment</Button><Button variant="secondary" onClick={onPlan}>Create plan</Button></div> : undefined} items={items} />;
}

function BillingPanel({ patient, canBill, invalidate }: { patient: Patient360; canBill: boolean; invalidate: () => void }) {
  const [payingInvoice, setPayingInvoice] = useState<Patient360['invoices'][number] | null>(null);
  const [showPackageInvoice, setShowPackageInvoice] = useState(false);
  const packages = patient.packages ?? [];
  const invoices = patient.invoices ?? [];
  return <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <div className="text-sm text-muted-foreground">Total billed</div>
        <div className="mt-1 text-2xl font-semibold">₹{invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount ?? 0), 0).toLocaleString('en-IN')}</div>
      </Card>
      <Card>
        <div className="text-sm text-muted-foreground">Collected</div>
        <div className="mt-1 text-2xl font-semibold">₹{invoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount ?? invoice.payments.reduce((paid, payment) => paid + Number(payment.amount), 0)), 0).toLocaleString('en-IN')}</div>
      </Card>
      <Card>
        <div className="text-sm text-muted-foreground">Outstanding</div>
        <div className="mt-1 text-2xl font-semibold">₹{patient.summary.outstandingAmount.toLocaleString('en-IN')}</div>
      </Card>
    </div>

    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Treatment packages</h2>
        {canBill ? <Button onClick={() => setShowPackageInvoice(true)}><Plus className="size-4" />Create package invoice</Button> : null}
      </div>
      <div className="mt-3 space-y-2">
        {packages.length ? packages.map((item) => {
          const remaining = Math.max(0, item.totalSessions - item.completedSessions);
          return <div key={item.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">{remaining}/{item.totalSessions} sessions remaining</div>
              </div>
              <div className="text-sm font-semibold">₹{Number(item.amount).toLocaleString('en-IN')}</div>
            </div>
          </div>;
        }) : <p className="py-6 text-center text-sm text-muted-foreground">No treatment package purchased yet.</p>}
      </div>
    </Card>

    <Card>
      <h2 className="font-semibold">Invoices and payments</h2>
      <div className="mt-3 space-y-3">
        {invoices.length ? invoices.map((invoice) => {
          const paid = Number(invoice.paidAmount ?? invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
          const outstanding = Number(invoice.outstandingAmount ?? Math.max(0, Number(invoice.totalAmount) - paid));
          return <div key={invoice.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">{invoice.invoiceNo} · {label(invoice.status)}</div>
                <div className="text-xs text-muted-foreground">{format(invoice.invoiceDate)}</div>
                {invoice.items?.length ? <div className="mt-2 space-y-1 text-sm">{invoice.items.map((item) => <div key={item.id}>{item.description} · ₹{Number(item.totalAmount).toLocaleString('en-IN')}</div>)}</div> : null}
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm font-semibold">₹{Number(invoice.totalAmount).toLocaleString('en-IN')}</div>
                <div className={outstanding > 0 ? 'text-xs text-red-700' : 'text-xs text-emerald-700'}>{outstanding > 0 ? `Outstanding ₹${outstanding.toLocaleString('en-IN')}` : 'Paid'}</div>
                {canBill && outstanding > 0 && ['ISSUED', 'PARTIAL', 'OVERDUE'].includes(invoice.status) ? <Button className="mt-2" variant="secondary" onClick={() => setPayingInvoice(invoice)}>Record payment</Button> : null}
              </div>
            </div>
          </div>;
        }) : <p className="py-6 text-center text-sm text-muted-foreground">No invoices generated yet.</p>}
      </div>
    </Card>
    {payingInvoice ? <PaymentModal patient={patient} invoice={payingInvoice} onClose={() => setPayingInvoice(null)} onSaved={() => { setPayingInvoice(null); invalidate(); }} /> : null}
    {showPackageInvoice ? <PackageInvoiceModal patient={patient} onClose={() => setShowPackageInvoice(false)} onSaved={() => { setShowPackageInvoice(false); invalidate(); }} /> : null}
  </div>;
}

function PackageInvoiceModal({ patient, onClose, onSaved }: { patient: Patient360; onClose: () => void; onSaved: () => void }) {
  const [packageMasterId, setPackageMasterId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'NOT_PAID' | 'PAID'>('NOT_PAID');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const packagesQuery = useQuery({ queryKey: ['client-package-masters'], queryFn: () => apiRequest<{ data: PackageMasterOption[] }>('/billing/package-masters') });
  const availablePackageMasters = (packagesQuery.data?.data ?? []).filter((item) => item.active && (!item.branchId || item.branchId === patient.branchId));
  const packageMaster = availablePackageMasters.find((item) => item.id === packageMasterId);
  const base = packageMaster ? Number(packageMaster.price) : 0;
  const tax = packageMaster ? Math.round((base * Number(packageMaster.taxPercent ?? 0)) / 100) : 0;
  const total = base + tax;
  const mutation = useMutation({
    mutationFn: async () => {
      if (!packageMaster) throw new Error('Select a package first');
      const purchased = await apiRequest<{ data: { id: string } }>('/billing/patient-packages', { method: 'POST', body: JSON.stringify({ patientId: patient.id, branchId: patient.branchId, packageMasterId: packageMaster.id, paidAmount: paymentStatus === 'PAID' ? total : 0 }) });
      const invoice = await apiRequest<{ data: { id: string } }>('/billing/invoices', { method: 'POST', body: JSON.stringify({ patientId: patient.id, branchId: patient.branchId, serviceName: packageMaster.name, items: [{ type: 'PACKAGE', description: packageMaster.name, packageMasterId: packageMaster.id, patientPackageId: purchased.data.id, quantity: 1, unitPrice: base, taxPercent: Number(packageMaster.taxPercent ?? 0), discount: 0 }] }) });
      await apiRequest(`/billing/invoices/${invoice.data.id}/issue`, { method: 'POST', body: '{}' });
      if (paymentStatus === 'PAID') {
        await apiRequest(`/billing/invoices/${invoice.data.id}/payments`, { method: 'POST', body: JSON.stringify({ patientId: patient.id, amount: total, mode: paymentMode, allocations: [{ invoiceId: invoice.data.id, amount: total }] }) });
      }
      return invoice;
    },
    onSuccess: onSaved,
  });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <Card className="w-full max-w-lg">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Create package invoice</h2><p className="mt-1 text-sm text-muted-foreground">{patient.fullName} · package, invoice and payment in one flow</p></div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="mt-5 grid gap-3">
        <Field label="Package"><Select value={packageMasterId} onChange={(event) => setPackageMasterId(event.target.value)} disabled={packagesQuery.isLoading}><option value="">{packagesQuery.isLoading ? 'Loading packages...' : availablePackageMasters.length ? 'Select package' : 'No packages found'}</option>{availablePackageMasters.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.totalSessions} sessions · ₹{Number(item.price).toLocaleString('en-IN')}</option>)}</Select></Field>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between text-sm"><span>Package rate</span><span>₹{base.toLocaleString('en-IN')}</span></div>
          <div className="mt-1 flex items-center justify-between text-sm"><span>Tax</span><span>₹{tax.toLocaleString('en-IN')}</span></div>
          <div className="mt-3 flex items-center justify-between border-t pt-3 font-semibold"><span>Total</span><span>₹{total.toLocaleString('en-IN')}</span></div>
        </div>
        <Field label="Payment status"><Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as 'NOT_PAID' | 'PAID')}><option value="NOT_PAID">Not paid</option><option value="PAID">Paid now</option></Select></Field>
        {paymentStatus === 'PAID' ? <Field label="Payment mode"><Select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></Select></Field> : null}
        {mutation.isError ? <p className="text-sm text-red-700">{mutation.error.message}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!packageMaster || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Create invoice'}</Button></div>
    </Card>
  </div>;
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
        <div><h2 className="text-lg font-semibold">Record payment</h2><p className="mt-1 text-sm text-muted-foreground">{invoice.invoiceNo} · Outstanding ₹{outstanding.toLocaleString('en-IN')}</p></div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <div className="mt-5 grid gap-3">
        <Field label="Amount"><Input type="number" min="1" max={outstanding} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field label="Payment mode"><Select value={mode} onChange={(event) => setMode(event.target.value)}><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></Select></Field>
        {mutation.isError ? <p className="text-sm text-red-700">{mutation.error.message}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending || Number(amount) <= 0 || Number(amount) > outstanding} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Mark paid'}</Button></div>
    </Card>
  </div>;
}
function Detail({ title, value }: { title: string; value?: string | null }) { return <div><dt className="text-xs font-medium text-muted-foreground">{title}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{value || 'Not recorded'}</dd></div>; }
function MedicalProfile({ patient, canEdit, invalidate }: { patient: Patient360; canEdit: boolean; invalidate: () => void }) {
  const profile = patient.medicalProfile; const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ medicalHistory: profile?.medicalHistory ?? '', currentMedications: profile?.currentMedications ?? '', allergyToDrugs: profile?.allergyToDrugs ?? '', clinicalAlerts: profile?.clinicalAlerts ?? '', criticalAlert: Boolean(profile?.criticalAlert), reasonForChange: '' });
  const mutation = useMutation({ mutationFn: () => apiRequest(`/patients/${patient.id}/medical-profile`, { method: 'PUT', body: JSON.stringify(values) }), onSuccess: () => { setEditing(false); invalidate(); } });
  if (!profile) return <Card className="text-sm text-muted-foreground">Medical profile is unavailable for your role or has not been recorded.</Card>;
  const fields = [['Skin concern', profile.skinConcern], ['Hair concern', profile.hairConcern], ['Medical history', profile.medicalHistory], ['Surgical history', profile.surgicalHistory], ['Current medicines', profile.currentMedications], ['Drug allergies', profile.allergyToDrugs], ['Product allergies', profile.productAllergies], ['Food allergies', profile.foodAllergies], ['Family history', profile.familyHistory], ['Smoking', profile.smokingStatus], ['Alcohol', profile.alcoholHistory], ['Clinical alerts', profile.clinicalAlerts]];
  return <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Current medical profile</h2>{canEdit ? <Button variant="secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Cancel edit' : 'Update profile'}</Button> : null}</div>{editing ? <div className="grid gap-3 sm:grid-cols-2"><Area label="Medical history" name="medicalHistory" values={values} set={(name, value) => setValues((current) => ({ ...current, [name]: value }))} /><Area label="Current medications" name="currentMedications" values={values} set={(name, value) => setValues((current) => ({ ...current, [name]: value }))} /><Area label="Drug allergies" name="allergyToDrugs" values={values} set={(name, value) => setValues((current) => ({ ...current, [name]: value }))} /><Area label="Clinical alerts" name="clinicalAlerts" values={values} set={(name, value) => setValues((current) => ({ ...current, [name]: value }))} /><TextField label="Reason for change" name="reasonForChange" values={values} set={(name, value) => setValues((current) => ({ ...current, [name]: value }))} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.criticalAlert} onChange={(event) => setValues((current) => ({ ...current, criticalAlert: event.target.checked }))} />Critical alert</label>{mutation.isError ? <p className="text-sm text-red-700 sm:col-span-2">{mutation.error.message}</p> : null}<Button className="sm:col-span-2" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Save versioned update</Button></div> : <div className="grid gap-4 sm:grid-cols-2">{fields.map(([title, value]) => <Detail key={title} title={title ?? ''} value={value as string | null} />)}</div>}</Card><Card><h2 className="font-semibold">Version history</h2><div className="mt-3 space-y-2">{profile.versions?.length ? profile.versions.map((version) => <Record key={version.id} title={version.reason || 'Medical profile updated'} subtitle={`${format(version.createdAt)} Â· ${version.updatedBy?.name ?? 'System'}`} />) : <p className="text-sm text-muted-foreground">No previous versions.</p>}</div></Card></div>;
}

function Prescriptions({ patient, canSign, onCreate, invalidate }: { patient: Patient360; canSign: boolean; onCreate: () => void; invalidate: () => void }) {
  const sign = useMutation({ mutationFn: (id: string) => apiRequest(`/clinical/prescriptions/${id}/sign`, { method: 'POST', body: '{}' }), onSuccess: invalidate });
  const pdf = useMutation({ mutationFn: (id: string) => apiBlob(`/clinical/prescriptions/${id}/pdf`), onSuccess: (blob) => { const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); } });
  const prescriptions = patient.prescriptions ?? [];
  const sessionPrescriptions = (patient.sessions ?? []).filter((session) => session.prescription?.length);
  const items = [
    ...prescriptions.map((prescription) => <Card key={prescription.id} className="p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-semibold">{prescription.prescriptionNo} · {label(prescription.status)}</div><div className="text-xs text-muted-foreground">{format(prescription.prescribedAt)} · Dr. {prescription.doctor.name}</div></div><div className="flex gap-2">{canSign && prescription.status === 'DRAFT' ? <Button disabled={sign.isPending} onClick={() => sign.mutate(prescription.id)}><FileLock2 className="size-4" />Sign</Button> : null}<Button variant="secondary" disabled={pdf.isPending} onClick={() => pdf.mutate(prescription.id)}>PDF</Button></div></div><div className="mt-3 space-y-2">{prescription.items.map((item) => <div key={item.id} className="rounded bg-muted p-3 text-sm"><strong>{item.medicineName} {item.strength}</strong><div>{item.dosage} · {item.frequency} · {item.duration}</div>{item.instructions ? <div className="text-muted-foreground">{item.instructions}</div> : null}</div>)}</div></Card>),
    ...sessionPrescriptions.map((session) => <Card key={`session-rx-${session.id}`} className="p-4"><div className="font-semibold">Prescription from {label(session.treatmentType)}</div><div className="text-xs text-muted-foreground">{format(session.visitDate)} · {session.doctorConsulted || 'Provider not recorded'}</div><div className="mt-3 space-y-2">{session.prescription?.map((item, index) => <div key={`${session.id}-${index}`} className="rounded bg-muted p-3 text-sm"><strong>{item.medicine}</strong><div>{item.dosage} · {item.frequency} · {item.duration}</div>{item.instructions ? <div className="text-muted-foreground">{item.instructions}</div> : null}</div>)}</div></Card>),
  ];
  return <ListState empty="No prescriptions issued." action={canSign ? <Button onClick={onCreate}><Plus className="size-4" />New prescription</Button> : undefined} items={items} />;
}

function ClinicalComposer({ kind, patient, staff, resources, defaultDoctorId, onClose, onSaved }: { kind: 'encounter' | 'plan' | 'procedure' | 'prescription'; patient: Patient360; staff: StaffMember[]; resources: ClinicResource[]; defaultDoctorId?: string; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({ doctorId: defaultDoctorId ?? '', practitionerId: defaultDoctorId ?? staff[0]?.id ?? '', visitDate: nowLocal(), type: 'CONSULTATION', status: kind === 'procedure' ? 'COMPLETED' : 'DRAFT', consentVerified: false, plannedSessions: '1', prescribedAt: nowLocal() });
  const set = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));
  const medicineQuery = useQuery({ queryKey: ['clinical-medicines', kind], enabled: kind === 'prescription', queryFn: () => apiRequest<{ data: MedicineOption[] }>('/clinical/medicines') });
  const servicesQuery = useQuery({ queryKey: ['clinical-procedure-services', patient.branchId], enabled: kind === 'procedure', queryFn: () => apiRequest<{ data: ClinicService[] }>(`/front-desk/services?branchId=${patient.branchId}`) });
  const medicines = medicineQuery.data?.data ?? [];
  const procedureServices = servicesQuery.data?.data ?? [];
  const onProcedureChange = (serviceId: string) => {
    const service = procedureServices.find((item) => item.id === serviceId);
    setValues((current) => ({
      ...current,
      serviceId,
      procedureName: service?.name ?? '',
      treatmentArea: service?.category ? label(service.category) : current.treatmentArea,
    }));
  };
  const mutation = useMutation({ mutationFn: async () => {
    if (kind === 'encounter') return apiRequest(`/clinical/patients/${patient.id}/encounters`, { method: 'POST', body: JSON.stringify({ branchId: patient.branchId, doctorId: values.doctorId, type: values.type, visitDate: values.visitDate, chiefComplaint: values.chiefComplaint, diagnosis: values.diagnosis, assessment: values.assessment, treatmentAdvised: values.treatmentAdvised, clinicalNotes: values.clinicalNotes, status: 'DRAFT' }) });
    if (kind === 'plan') return apiRequest(`/clinical/patients/${patient.id}/treatment-plans`, { method: 'POST', body: JSON.stringify({ branchId: patient.branchId, concern: values.concern, diagnosis: values.diagnosis, goals: values.goals, assignedDoctorId: values.doctorId, estimatedCost: values.estimatedCost || undefined, items: [{ name: values.itemName, plannedSessions: values.plannedSessions, frequency: values.frequency, estimatedAmount: values.itemAmount || undefined }] }) });
    if (kind === 'procedure') return apiRequest(`/clinical/patients/${patient.id}/procedure-sessions`, { method: 'POST', body: JSON.stringify({ branchId: patient.branchId, procedureName: values.procedureName, treatmentArea: values.treatmentArea, practitionerId: values.practitionerId, roomId: values.roomId || undefined, deviceId: values.deviceId || undefined, procedureNotes: values.procedureNotes, postCareInstructions: values.postCareInstructions, consentVerified: values.consentVerified, status: values.status, performedAt: values.status === 'COMPLETED' ? nowLocal() : undefined }) });
    return apiRequest(`/clinical/patients/${patient.id}/prescriptions`, { method: 'POST', body: JSON.stringify({ doctorId: values.doctorId, prescribedAt: values.prescribedAt, diagnosisSummary: values.diagnosis, instructions: values.instructions, precautions: values.precautions, items: [{ medicineName: values.medicineName, strength: values.strength, dosage: values.dosage, frequency: values.frequency, duration: values.duration, route: values.route, timing: values.timing, instructions: values.medicineInstructions }] }) });
  }, onSuccess: onSaved });
  const clinicians = staff.filter((member) => ['ADMIN', 'RECEPTIONIST'].includes(member.role)); const rooms = resources.filter((item) => item.type === 'ROOM'); const devices = resources.filter((item) => item.type === 'EQUIPMENT');
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"><div className="flex justify-between"><div><h2 className="text-lg font-semibold">New {kind.replaceAll('_', ' ')}</h2><p className="text-sm text-muted-foreground">{patient.fullName} Â· {patient.patientNo}</p></div><Button variant="ghost" onClick={onClose}>Close</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">
    {(kind === 'encounter' || kind === 'plan' || kind === 'prescription') ? <Field label="Dr. Revive"><Select value={String(values.doctorId)} onChange={(event) => set('doctorId', event.target.value)}><option value="">Select Dr. Revive</option>{staff.filter((item) => item.role === 'ADMIN').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field> : null}
    {kind === 'encounter' ? <><Field label="Encounter type"><Select value={String(values.type)} onChange={(event) => set('type', event.target.value)}>{['CONSULTATION', 'VIDEO_CONSULTATION', 'FOLLOW_UP_CONSULTATION', 'PROCEDURE', 'TREATMENT_SESSION', 'REVIEW', 'EMERGENCY_REVIEW', 'OTHER'].map((item) => <option key={item}>{label(item)}</option>)}</Select></Field><Field label="Visit date"><Input type="datetime-local" value={String(values.visitDate)} onChange={(event) => set('visitDate', event.target.value)} /></Field><TextField label="Chief complaint" name="chiefComplaint" values={values} set={set} /><TextField label="Diagnosis" name="diagnosis" values={values} set={set} /><TextField label="Assessment" name="assessment" values={values} set={set} /><TextField label="Treatment advised" name="treatmentAdvised" values={values} set={set} /><Area label="Clinical notes" name="clinicalNotes" values={values} set={set} /></> : null}
    {kind === 'plan' ? <><TextField label="Concern" name="concern" values={values} set={set} /><TextField label="Diagnosis" name="diagnosis" values={values} set={set} /><TextField label="Goals" name="goals" values={values} set={set} /><TextField label="Estimated cost" name="estimatedCost" values={values} set={set} type="number" /><TextField label="Plan item / service" name="itemName" values={values} set={set} /><TextField label="Planned sessions" name="plannedSessions" values={values} set={set} type="number" /><TextField label="Frequency" name="frequency" values={values} set={set} /><TextField label="Item amount" name="itemAmount" values={values} set={set} type="number" /></> : null}
    {kind === 'procedure' ? <><Field label="Practitioner"><Select value={String(values.practitionerId)} onChange={(event) => set('practitionerId', event.target.value)}>{clinicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Procedure"><Select value={String(values.serviceId ?? '')} onChange={(event) => onProcedureChange(event.target.value)} disabled={servicesQuery.isLoading}><option value="">{servicesQuery.isLoading ? 'Loading treatments...' : 'Select treatment name'}</option>{procedureServices.map((service) => <option key={service.id} value={service.id}>{serviceLabel(service)}</option>)}</Select></Field><TextField label="Treatment area" name="treatmentArea" values={values} set={set} /><Field label="Room"><Select value={String(values.roomId ?? '')} onChange={(event) => set('roomId', event.target.value)}><option value="">Not selected</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Device"><Select value={String(values.deviceId ?? '')} onChange={(event) => set('deviceId', event.target.value)}><option value="">Not selected</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field><Field label="Status"><Select value={String(values.status)} onChange={(event) => set('status', event.target.value)}>{['PLANNED', 'READY', 'IN_PROGRESS', 'COMPLETED'].map((item) => <option key={item}>{label(item)}</option>)}</Select></Field><Area label="Procedure notes" name="procedureNotes" values={values} set={set} /><Area label="Post-care instructions" name="postCareInstructions" values={values} set={set} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(values.consentVerified)} onChange={(event) => set('consentVerified', event.target.checked)} />Consent verified</label></> : null}
    {kind === 'prescription' ? <><Field label="Prescription date"><Input type="datetime-local" value={String(values.prescribedAt)} onChange={(event) => set('prescribedAt', event.target.value)} /></Field><TextField label="Diagnosis" name="diagnosis" values={values} set={set} /><Field label="Medicine"><Select value={String(values.medicineId ?? '')} onChange={(event) => { const selected = medicines.find((medicine) => medicine.id === event.target.value); setValues((current) => ({ ...current, medicineId: event.target.value, medicineName: selected?.name ?? '', strength: selected?.strength ?? current.strength ?? '' })); }} disabled={medicineQuery.isLoading}><option value="">{medicineQuery.isLoading ? 'Loading medicines...' : 'Select medicine'}</option>{medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}{medicine.strength ? ` · ${medicine.strength}` : ''}{medicine.form ? ` · ${medicine.form}` : ''}</option>)}</Select></Field><TextField label="Strength" name="strength" values={values} set={set} /><TextField label="Dosage" name="dosage" values={values} set={set} /><TextField label="Frequency" name="frequency" values={values} set={set} /><TextField label="Duration" name="duration" values={values} set={set} /><TextField label="Route" name="route" values={values} set={set} /><TextField label="Timing" name="timing" values={values} set={set} /><Area label="Medicine instructions" name="medicineInstructions" values={values} set={set} /><Area label="General instructions" name="instructions" values={values} set={set} /><Area label="Precautions" name="precautions" values={values} set={set} /></> : null}
  </div>{mutation.isError ? <p className="mt-3 text-sm text-red-700">{mutation.error.message}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Savingâ€¦' : 'Save'}</Button></div></Card></div>;
}
function Field({ label: title, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm"><span className="font-medium">{title}</span>{children}</label>; }
function TextField({ label: title, name, values, set, type = 'text' }: { label: string; name: string; values: Record<string, string | boolean>; set: (name: string, value: string) => void; type?: string }) { return <Field label={title}><Input type={type} value={String(values[name] ?? '')} onChange={(event) => set(name, event.target.value)} /></Field>; }
function Area({ label: title, name, values, set }: { label: string; name: string; values: Record<string, string | boolean>; set: (name: string, value: string) => void }) { return <label className="grid gap-1 text-sm sm:col-span-2"><span className="font-medium">{title}</span><textarea className="min-h-24 rounded-md border border-border bg-surface px-3 py-2" value={String(values[name] ?? '')} onChange={(event) => set(name, event.target.value)} /></label>; }

