'use client';

import { useQuery } from '@tanstack/react-query';
import { EditRecordDialog, fromLocalInput, toDateTimeInput, withoutEmpty } from '@/components/ui/record-actions';
import { apiRequest } from '@/services/api';
import type { StaffMember } from '@/types/front-desk';
import type { Lead } from '@/types/lead';

/** Quick edit of a lead's details (the full lead form stays on the Leads page). */
export function LeadEditDialog({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved?: () => void }) {
  const staffQuery = useQuery({ queryKey: ['lead-edit-staff', lead.branchId], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(lead.branchId)}`) });
  const staff = staffQuery.data?.data ?? [];
  return <EditRecordDialog
    wide
    title="Edit lead"
    subtitle={`${lead.name} · ${lead.mobile}`}
    initial={{ name: lead.name, mobile: lead.mobile, email: lead.email ?? '', source: lead.source, interestedTreatment: lead.interestedTreatment ?? '', priority: lead.priority ?? 'MEDIUM', address: lead.address ?? '', nextFollowupAt: toDateTimeInput(lead.nextFollowupAt), lastContactedAt: toDateTimeInput(lead.lastContactedAt), followupNotes: lead.followupNotes ?? '', appointmentType: lead.appointmentType ?? 'CLINIC_VISIT', appointmentAt: toDateTimeInput(lead.appointmentAt), ownerId: lead.ownerId ?? '', nextAction: lead.nextAction ?? '', nextActionDueAt: toDateTimeInput(lead.nextActionDueAt) }}
    fields={[
      { name: 'name', label: 'Name', required: true },
      { name: 'mobile', label: 'Mobile', type: 'tel', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'source', label: 'Lead source', type: 'select', required: true, options: [{ value: 'WEBSITE', label: 'Website' }, { value: 'WALK_IN', label: 'Walk-in' }, { value: 'PHONE_CALL', label: 'Phone call' }, { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'GOOGLE_ADS', label: 'Google Ads' }, { value: 'META_ADS', label: 'Meta Ads' }, { value: 'OTHER', label: 'Other' }] },
      { name: 'interestedTreatment', label: 'Interested treatment' },
      { name: 'priority', label: 'Priority', type: 'select', required: true, options: [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }] },
      { name: 'address', label: 'Address' },
      { name: 'ownerId', label: 'Assigned team member', type: 'select', options: staff.map((member) => ({ value: member.id, label: member.name })) },
      { name: 'nextFollowupAt', label: 'Next follow-up', type: 'datetime' },
      { name: 'lastContactedAt', label: 'Last contacted', type: 'datetime' },
      { name: 'followupNotes', label: 'Follow-up notes', type: 'textarea' },
      { name: 'appointmentType', label: 'Appointment type', type: 'select', required: true, options: [{ value: 'CLINIC_VISIT', label: 'Clinic visit' }, { value: 'VIDEO_CONSULTATION', label: 'Video consultation' }] },
      { name: 'appointmentAt', label: 'Appointment date & time', type: 'datetime' },
      { name: 'nextAction', label: 'Next action' },
      { name: 'nextActionDueAt', label: 'Next action due', type: 'datetime' },
    ]}
    onSubmit={(values) => apiRequest(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(withoutEmpty({ ...values, name: values.name.trim(), mobile: values.mobile.trim(), email: values.email.trim(), nextFollowupAt: fromLocalInput(values.nextFollowupAt), lastContactedAt: fromLocalInput(values.lastContactedAt), appointmentAt: fromLocalInput(values.appointmentAt), nextActionDueAt: fromLocalInput(values.nextActionDueAt) })) })}
    onClose={onClose}
    onSaved={onSaved}
  />;
}
