'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DeleteRecordButton, EditButton, EditRecordDialog, fromLocalInput, toDateTimeInput } from '@/components/ui/record-actions';
import { apiRequest } from '@/services/api';
import type { FollowUp, Task } from '@/types/foundation';
import type { StaffMember } from '@/types/front-desk';

const priorities = [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }];
const when = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Edit (what, when, priority, notes) and admin Delete for one follow-up. */
export function FollowUpRecordActions({ followUp, onChanged, className }: { followUp: FollowUp; onChanged?: () => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const staffQuery = useQuery({ queryKey: ['work-edit-staff', followUp.branch.id], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(followUp.branch.id)}`), enabled: editing });
  const staff = staffQuery.data?.data ?? [];
  const name = `${followUp.person?.fullName ?? 'Follow-up'} · ${followUp.activityType} · ${when(followUp.dueAt)}`;
  return <div className={className ?? 'flex flex-wrap items-center gap-1.5'} onClick={(event) => event.stopPropagation()}>
    <EditButton onClick={() => setEditing(true)} />
    <DeleteRecordButton kind="follow-up" id={followUp.id} what="follow-up" name={name} onDeleted={onChanged} />
    {editing ? <EditRecordDialog
      title="Edit follow-up"
      subtitle={followUp.person?.fullName}
      initial={{ activityType: followUp.activityType, channel: followUp.channel, dueAt: toDateTimeInput(followUp.dueAt), reminderAt: toDateTimeInput(followUp.reminderAt), priority: followUp.priority, assignedUserId: followUp.assignedUser.id, status: followUp.status, notes: followUp.notes ?? '' }}
      fields={[
        { name: 'activityType', label: 'Follow-up action', required: true },
        { name: 'channel', label: 'Channel', type: 'select', required: true, options: [{ value: 'CALL', label: 'Call' }, { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'IN_PERSON', label: 'In person' }, { value: 'SMS', label: 'SMS' }, { value: 'EMAIL', label: 'Email' }] },
        { name: 'dueAt', label: 'Due date & time', type: 'datetime', required: true },
        { name: 'reminderAt', label: 'Notification date & time', type: 'datetime', hint: 'Leave blank to keep the automatic reminder.' },
        { name: 'priority', label: 'Priority', type: 'select', required: true, options: priorities },
        { name: 'assignedUserId', label: 'Assigned team member', type: 'select', required: true, options: (staff.length ? staff : [followUp.assignedUser]).map((member) => ({ value: member.id, label: member.name })) },
        { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'OVERDUE', label: 'Overdue' }, { value: 'CANCELLED', label: 'Cancelled' }] },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      onSubmit={(values) => apiRequest(`/follow-ups/${followUp.id}`, { method: 'PATCH', body: JSON.stringify({ activityType: values.activityType.trim(), channel: values.channel, dueAt: fromLocalInput(values.dueAt), reminderAt: fromLocalInput(values.reminderAt), priority: values.priority, assignedUserId: values.assignedUserId, status: values.status, notes: values.notes }) })}
      onClose={() => setEditing(false)}
      onSaved={onChanged}
    /> : null}
  </div>;
}

/** Edit (title, description, due, priority) and admin Delete for one task. */
export function TaskRecordActions({ task, onChanged, className }: { task: Task; onChanged?: () => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const staffQuery = useQuery({ queryKey: ['work-edit-staff', task.branch.id], queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(task.branch.id)}`), enabled: editing });
  const staff = staffQuery.data?.data ?? [];
  return <div className={className ?? 'flex flex-wrap items-center gap-1.5'} onClick={(event) => event.stopPropagation()}>
    <EditButton onClick={() => setEditing(true)} />
    <DeleteRecordButton kind="task" id={task.id} what="task" name={`${task.title} · due ${when(task.dueAt)}`} onDeleted={onChanged} />
    {editing ? <EditRecordDialog
      title="Edit task"
      initial={{ title: task.title, type: task.type, description: task.description ?? '', dueAt: toDateTimeInput(task.dueAt), reminderAt: toDateTimeInput(task.reminderAt), priority: task.priority, assignedUserId: task.assignedUser.id, status: task.status, completionNotes: task.completionNotes ?? '' }}
      fields={[
        { name: 'title', label: 'Task', required: true },
        { name: 'type', label: 'Task type', type: 'select', required: true, options: [{ value: 'GENERAL', label: 'General task' }, { value: 'CALL', label: 'Call' }, { value: 'APPOINTMENT', label: 'Appointment' }, { value: 'PATIENT_SUPPORT', label: 'Patient support' }, { value: 'DOCUMENT_REVIEW', label: 'Document review' }] },
        { name: 'dueAt', label: 'Due date & time', type: 'datetime', required: true },
        { name: 'reminderAt', label: 'Notification date & time', type: 'datetime', hint: 'Leave blank to keep the automatic reminder.' },
        { name: 'priority', label: 'Priority', type: 'select', required: true, options: priorities },
        { name: 'assignedUserId', label: 'Assigned team member', type: 'select', required: true, options: (staff.length ? staff : [task.assignedUser]).map((member) => ({ value: member.id, label: member.name })) },
        { name: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'OPEN', label: 'Open' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'OVERDUE', label: 'Overdue' }, { value: 'CANCELLED', label: 'Cancelled' }] },
        { name: 'description', label: 'Details', type: 'textarea' },
        { name: 'completionNotes', label: 'Completion notes', type: 'textarea', hint: 'Required when the status is Completed.' },
      ]}
      onSubmit={(values) => apiRequest(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ title: values.title.trim(), type: values.type, dueAt: fromLocalInput(values.dueAt), reminderAt: fromLocalInput(values.reminderAt), priority: values.priority, assignedUserId: values.assignedUserId, status: values.status, description: values.description, completionNotes: values.completionNotes }) })}
      onClose={() => setEditing(false)}
      onSaved={onChanged}
    /> : null}
  </div>;
}
