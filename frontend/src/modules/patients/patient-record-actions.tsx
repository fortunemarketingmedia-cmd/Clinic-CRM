'use client';

import { useQuery } from '@tanstack/react-query';
import { EditRecordDialog, fromLocalInput, toDateInput, toDateTimeInput, withoutEmpty } from '@/components/ui/record-actions';
import { apiRequest } from '@/services/api';
import type { ClinicalEncounter, Patient360 } from '@/types/clinical';
import type { Patient, PatientSession, TreatmentPackage } from '@/types/patient';

// Edit dialogs for the records shown on a patient's file. Delete buttons use DeleteRecordButton directly.

export function PatientEditDialog({ patient, onClose, onSaved }: { patient: Patient; onClose: () => void; onSaved?: () => void }) {
  const detail = useQuery({
    queryKey: ['patient-edit-details', patient.id],
    queryFn: () => apiRequest<{ data: Patient }>(`/patients/${patient.id}`),
    initialData: patient.medicalProfile !== undefined ? { data: patient } : undefined,
  });
  const current = detail.data?.data;
  if (!current) return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"><div className="rounded-xl bg-background px-6 py-5 shadow-xl"><p className="text-sm">{detail.isError ? 'Patient details could not be loaded.' : 'Loading all patient fields…'}</p><button type="button" className="mt-3 text-sm font-semibold text-primary" onClick={onClose}>Close</button></div></div>;
  const profile = current.medicalProfile;
  return <EditRecordDialog
    key={current.updatedAt ?? current.id}
    wide
    title="Edit patient details"
    subtitle={`${current.fullName} · ${current.patientNo} · all registration fields`}
    initial={{
      fullName: current.fullName ?? '', mobile: current.mobile ?? '', email: current.email ?? '', age: current.age != null ? String(current.age) : '', sex: current.sex ?? '', maritalStatus: current.maritalStatus ?? '', occupation: current.occupation ?? '', address: current.address ?? '',
      referredBy: profile?.referredBy ?? '', skinConcern: profile?.skinConcern ?? '', hairConcern: profile?.hairConcern ?? '', medicalHistory: profile?.medicalHistory ?? '', currentMedications: profile?.currentMedications ?? '', allergyToDrugs: profile?.allergyToDrugs ?? '', surgicalHistory: profile?.surgicalHistory ?? '', productAllergies: profile?.productAllergies ?? '', foodAllergies: profile?.foodAllergies ?? '', previousAestheticProcedures: profile?.previousAestheticProcedures ?? '', hairProductsUsed: profile?.hairProductsUsed ?? '', breastfeedingStatus: profile?.breastfeedingStatus ?? '', familyHistory: profile?.familyHistory ?? '', smokingStatus: profile?.smokingStatus ?? '', alcoholHistory: profile?.alcoholHistory ?? '', clinicalAlerts: profile?.clinicalAlerts ?? '', criticalAlert: String(Boolean(profile?.criticalAlert)), keloidOrHypertrophicScar: profile?.keloidOrHypertrophicScar ?? '', productsCurrentlyUsed: profile?.productsCurrentlyUsed ?? '', menstrualHistory: profile?.menstrualHistory ?? '', pregnancyStatus: profile?.pregnancyStatus ?? '', notes: profile?.notes ?? '', reasonForChange: '',
    }}
    fields={[
      { name: 'fullName', label: 'Full name', required: true },
      { name: 'mobile', label: 'Mobile', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'age', label: 'Age', type: 'number', min: 1 },
      { name: 'sex', label: 'Sex', type: 'select', options: [{ value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }, { value: 'OTHER', label: 'Other' }] },
      { name: 'maritalStatus', label: 'Marital status' },
      { name: 'occupation', label: 'Occupation' },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'referredBy', label: 'Referred by' },
      { name: 'skinConcern', label: 'Skin concern', type: 'textarea' },
      { name: 'hairConcern', label: 'Hair concern', type: 'textarea' },
      { name: 'medicalHistory', label: 'Medical history', type: 'textarea' },
      { name: 'currentMedications', label: 'Current medications', type: 'textarea' },
      { name: 'allergyToDrugs', label: 'Drug allergies', type: 'textarea' },
      { name: 'surgicalHistory', label: 'Surgical history', type: 'textarea' },
      { name: 'productAllergies', label: 'Product allergies', type: 'textarea' },
      { name: 'foodAllergies', label: 'Food allergies', type: 'textarea' },
      { name: 'previousAestheticProcedures', label: 'Previous aesthetic procedures', type: 'textarea' },
      { name: 'hairProductsUsed', label: 'Hair products used', type: 'textarea' },
      { name: 'productsCurrentlyUsed', label: 'Products currently used', type: 'textarea' },
      { name: 'keloidOrHypertrophicScar', label: 'Keloid / hypertrophic scar history' },
      { name: 'familyHistory', label: 'Family history', type: 'textarea' },
      { name: 'smokingStatus', label: 'Smoking status' },
      { name: 'alcoholHistory', label: 'Alcohol history' },
      { name: 'menstrualHistory', label: 'Menstrual history', type: 'textarea' },
      { name: 'pregnancyStatus', label: 'Pregnancy status' },
      { name: 'breastfeedingStatus', label: 'Breastfeeding status' },
      { name: 'clinicalAlerts', label: 'Clinical alerts', type: 'textarea' },
      { name: 'criticalAlert', label: 'Show a critical alert throughout the patient record', type: 'checkbox' },
      { name: 'notes', label: 'Registration / medical notes', type: 'textarea' },
      { name: 'reasonForChange', label: 'Reason for this change', placeholder: 'e.g. Patient provided updated history', wide: true },
    ]}
    onSubmit={(values) => Promise.all([
      apiRequest(`/patients/${current.id}`, { method: 'PATCH', body: JSON.stringify({ fullName: values.fullName.trim(), mobile: values.mobile.trim(), email: values.email.trim() || null, age: values.age ? Number(values.age) : null, sex: values.sex || null, maritalStatus: values.maritalStatus || null, occupation: values.occupation || null, address: values.address || null }) }),
      apiRequest(`/patients/${current.id}/medical-profile`, { method: 'PUT', body: JSON.stringify({ referredBy: values.referredBy, skinConcern: values.skinConcern, hairConcern: values.hairConcern, medicalHistory: values.medicalHistory, currentMedications: values.currentMedications, allergyToDrugs: values.allergyToDrugs, surgicalHistory: values.surgicalHistory, productAllergies: values.productAllergies, foodAllergies: values.foodAllergies, previousAestheticProcedures: values.previousAestheticProcedures, hairProductsUsed: values.hairProductsUsed, breastfeedingStatus: values.breastfeedingStatus, familyHistory: values.familyHistory, smokingStatus: values.smokingStatus, alcoholHistory: values.alcoholHistory, clinicalAlerts: values.clinicalAlerts, criticalAlert: values.criticalAlert === 'true', keloidOrHypertrophicScar: values.keloidOrHypertrophicScar, productsCurrentlyUsed: values.productsCurrentlyUsed, menstrualHistory: values.menstrualHistory, pregnancyStatus: values.pregnancyStatus, notes: values.notes, reasonForChange: values.reasonForChange.trim() || 'Patient record edited' }) }),
    ])}
    onClose={onClose}
    onSaved={onSaved}
  />;
}

export function TreatmentRecordEditDialog({ patientId, session, onClose, onSaved }: { patientId: string; session: PatientSession; onClose: () => void; onSaved?: () => void }) {
  return <EditRecordDialog
    wide
    title="Edit treatment record"
    initial={{ treatmentType: session.treatmentType, visitDate: toDateTimeInput(session.visitDate), doctorConsulted: session.doctorConsulted ?? '', chiefComplaint: session.chiefComplaint ?? '', diagnosis: session.diagnosis ?? '', treatmentSuggested: session.treatmentSuggested ?? '', treatmentTaken: session.treatmentTaken ?? '', medicinesPrescribed: session.medicinesPrescribed ?? '', followupDate: toDateInput(session.followupDate), notes: session.notes ?? '' }}
    fields={[
      { name: 'treatmentType', label: 'Record type', type: 'select', required: true, options: ['CONSULTATION', 'VIDEO_CONSULTATION', 'TREATMENT_ROOM', 'PROCEDURE', 'FOLLOW_UP', 'OTHER'].map((value) => ({ value, label: value.replaceAll('_', ' ') })) },
      { name: 'visitDate', label: 'Visit date & time', type: 'datetime', required: true },
      { name: 'doctorConsulted', label: 'Doctor / provider' },
      { name: 'chiefComplaint', label: 'Chief complaint' },
      { name: 'diagnosis', label: 'Diagnosis' },
      { name: 'treatmentSuggested', label: 'Treatment suggested' },
      { name: 'treatmentTaken', label: 'Treatment taken' },
      { name: 'medicinesPrescribed', label: 'Medicines prescribed', type: 'textarea' },
      { name: 'followupDate', label: 'Follow-up date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ]}
    onSubmit={(values) => apiRequest(`/patients/${patientId}/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify(withoutEmpty({ ...values, visitDate: fromLocalInput(values.visitDate), followupDate: fromLocalInput(values.followupDate) })) })}
    onClose={onClose}
    onSaved={onSaved}
  />;
}

export function EncounterEditDialog({ encounter, onClose, onSaved }: { encounter: ClinicalEncounter; onClose: () => void; onSaved?: () => void }) {
  return <EditRecordDialog
    wide
    title="Edit consultation note"
    subtitle={`Dr. ${encounter.doctor.name}`}
    initial={{ type: encounter.type, visitDate: toDateTimeInput(encounter.visitDate), chiefComplaint: encounter.chiefComplaint ?? '', history: encounter.history ?? '', examination: encounter.examination ?? '', assessment: encounter.assessment ?? '', diagnosis: encounter.diagnosis ?? '', treatmentAdvised: encounter.treatmentAdvised ?? '', procedurePerformed: encounter.procedurePerformed ?? '', followUpPlan: encounter.followUpPlan ?? '', clinicalNotes: encounter.clinicalNotes ?? '' }}
    fields={[
      { name: 'type', label: 'Encounter type', type: 'select', required: true, options: ['CONSULTATION', 'VIDEO_CONSULTATION', 'FOLLOW_UP_CONSULTATION', 'PROCEDURE', 'TREATMENT_SESSION', 'REVIEW', 'EMERGENCY_REVIEW', 'OTHER'].map((value) => ({ value, label: value.replaceAll('_', ' ') })) },
      { name: 'visitDate', label: 'Visit date & time', type: 'datetime', required: true },
      { name: 'chiefComplaint', label: 'Chief complaint' },
      { name: 'history', label: 'History', type: 'textarea' },
      { name: 'examination', label: 'Examination', type: 'textarea' },
      { name: 'assessment', label: 'Assessment', type: 'textarea' },
      { name: 'diagnosis', label: 'Diagnosis' },
      { name: 'treatmentAdvised', label: 'Treatment advised' },
      { name: 'procedurePerformed', label: 'Procedure performed' },
      { name: 'followUpPlan', label: 'Follow-up plan' },
      { name: 'clinicalNotes', label: 'Clinical notes', type: 'textarea' },
    ]}
    onSubmit={(values) => apiRequest(`/clinical/encounters/${encounter.id}`, { method: 'PATCH', body: JSON.stringify(withoutEmpty({ ...values, visitDate: fromLocalInput(values.visitDate) })) })}
    onClose={onClose}
    onSaved={onSaved}
  />;
}

export function PackageEditDialog({ item, onClose, onSaved }: { item: TreatmentPackage; onClose: () => void; onSaved?: () => void }) {
  return <EditRecordDialog
    title="Edit package"
    subtitle={`${item.completedSessions} of ${item.totalSessions} sessions used`}
    initial={{ name: item.name, totalSessions: String(item.totalSessions), expiryDate: toDateInput(item.expiryDate), notes: item.notes ?? '' }}
    fields={[
      { name: 'name', label: 'Package name', required: true },
      { name: 'totalSessions', label: 'Total sessions', type: 'number', min: Math.max(1, item.completedSessions), required: true, hint: 'Cannot be lower than the sessions already used.' },
      { name: 'expiryDate', label: 'Valid until', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ]}
    onSubmit={(values) => apiRequest(`/billing/patient-packages/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: values.name.trim(), totalSessions: Number(values.totalSessions), expiryDate: values.expiryDate ? fromLocalInput(values.expiryDate) : null, notes: values.notes }) })}
    onClose={onClose}
    onSaved={onSaved}
  />;
}

export function InvoiceEditDialog({ invoice, onClose, onSaved }: { invoice: Patient360['invoices'][number]; onClose: () => void; onSaved?: () => void }) {
  return <EditRecordDialog
    title="Edit invoice"
    subtitle={`${invoice.invoiceNo} · amounts and items stay as billed`}
    initial={{ invoiceDate: toDateInput(invoice.invoiceDate), dueDate: toDateInput(invoice.dueDate), notes: invoice.notes ?? '', terms: invoice.terms ?? '' }}
    fields={[
      { name: 'invoiceDate', label: 'Invoice date', type: 'date', required: true },
      { name: 'dueDate', label: 'Due date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { name: 'terms', label: 'Terms', type: 'textarea' },
    ]}
    onSubmit={(values) => apiRequest(`/billing/invoices/${invoice.id}`, { method: 'PATCH', body: JSON.stringify({ invoiceDate: fromLocalInput(values.invoiceDate), dueDate: values.dueDate ? fromLocalInput(values.dueDate) : null, notes: values.notes, terms: values.terms }) })}
    onClose={onClose}
    onSaved={onSaved}
  />;
}
