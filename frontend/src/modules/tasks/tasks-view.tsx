'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleDot, Clock3, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import { TaskRecordActions } from '@/modules/follow-ups/work-record-actions';
import { useSessionStore } from '@/store/session-store';
import type { Branch } from '@/types/branch';
import type { Task, WorkStatus } from '@/types/foundation';
import type { StaffMember } from '@/types/front-desk';

export function TasksView() {
  const client = useQueryClient();
  const { session, selectedBranchId } = useSessionStore();
  const [status, setStatus] = useState<WorkStatus | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState('ME');
  const [showCreate, setShowCreate] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', type: 'GENERAL', priority: 'MEDIUM', dueAt: '', reminderAt: '', assignedUserId: '' });
  // Branch for the new task: the top-bar branch, or — when "All branches" is selected — chosen in the form.
  const [formBranchId, setFormBranchId] = useState('');
  const taskBranchId = formBranchId || selectedBranchId || '';
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const params = new URLSearchParams();
  if (selectedBranchId) params.set('branchId', selectedBranchId);
  if (assigneeFilter === 'ME' && session?.user.id) params.set('assignedUserId', session.user.id);
  if (assigneeFilter !== 'ME' && assigneeFilter !== 'ALL') params.set('assignedUserId', assigneeFilter);
  if (status) params.set('status', status);

  const staffQuery = useQuery({
    queryKey: ['task-assignees', selectedBranchId],
    queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${selectedBranchId}`),
    enabled: Boolean(session && selectedBranchId),
  });
  const staff = staffQuery.data?.data ?? [];
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: () => apiRequest<{ data: Branch[] }>('/branches'), enabled: Boolean(session && showCreate) });
  const branches = branchesQuery.data?.data ?? [];
  const formStaffQuery = useQuery({
    queryKey: ['task-assignees', taskBranchId],
    queryFn: () => apiRequest<{ data: StaffMember[] }>(`/front-desk/staff?branchId=${encodeURIComponent(taskBranchId)}`),
    enabled: Boolean(session && showCreate && taskBranchId),
  });
  const formStaff = taskBranchId ? formStaffQuery.data?.data ?? [] : [];

  useEffect(() => {
    setTaskForm((current) => {
      if (formStaff.some((member) => member.id === current.assignedUserId)) return current;
      const defaultAssignee = formStaff.find((member) => member.id === session?.user.id)?.id ?? formStaff[0]?.id ?? '';
      return current.assignedUserId === defaultAssignee ? current : { ...current, assignedUserId: defaultAssignee };
    });
  }, [session?.user.id, formStaffQuery.data, taskBranchId]);

  const missing = [
    !taskBranchId && 'branch',
    !taskForm.title.trim() && 'task title',
    !taskForm.dueAt && 'due date and time',
    !taskForm.assignedUserId && 'team member',
  ].filter(Boolean) as string[];

  useEffect(() => {
    setAssigneeFilter('ME');
  }, [selectedBranchId]);

  const query = useQuery({
    queryKey: ['tasks', selectedBranchId, session?.user.id, assigneeFilter, status],
    queryFn: () => apiRequest<{ data: Task[] }>(`/tasks?${params}`),
    enabled: Boolean(session),
  });
  const create = useMutation({
    mutationFn: () => {
      const dueAt = new Date(taskForm.dueAt);
      const defaultReminder = new Date(Math.max(Date.now(), dueAt.getTime() - 15 * 60_000)).toISOString();
      return apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...taskForm,
        description: taskForm.description || undefined,
        reminderAt: taskForm.reminderAt ? new Date(taskForm.reminderAt).toISOString() : defaultReminder,
        assignedUserId: taskForm.assignedUserId,
        branchId: taskBranchId,
        automaticallyCreated: false,
      }),
      });
    },
    onSuccess: () => {
      setTaskForm((current) => ({ title: '', description: '', type: 'GENERAL', priority: 'MEDIUM', dueAt: '', reminderAt: '', assignedUserId: current.assignedUserId }));
      setShowCreate(false);
      client.invalidateQueries({ queryKey: ['tasks'] });
      client.invalidateQueries({ queryKey: ['notification-tasks'] });
      client.invalidateQueries({ queryKey: ['header-reminders'] });
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      nextStatus,
      notes,
    }: {
      id: string;
      nextStatus: WorkStatus;
      notes?: string;
    }) =>
      apiRequest(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, completionNotes: notes }),
      }),
    onSuccess: () => {
      setCompletingTask(null);
      setCompletionNotes('');
      client.invalidateQueries({ queryKey: ['tasks'] });
      client.invalidateQueries({ queryKey: ['notification-tasks'] });
      client.invalidateQueries({ queryKey: ['header-reminders'] });
    },
  });
  const tasks = query.data?.data ?? [];
  const overdue = tasks.filter(
    (task) =>
      !['COMPLETED', 'CANCELLED'].includes(task.status) &&
      new Date(task.dueAt).getTime() < Date.now(),
  ).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Assigned operational work across CRM, appointments, and patient journeys.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            className="w-52"
            aria-label="Task assignee filter"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="ME">My tasks</option>
            <option value="ALL">All branch tasks</option>
            {staff.filter((member) => member.id !== session?.user.id).map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </Select>
          <Select
            className="w-52"
            aria-label="Task status"
            value={status}
            onChange={(event) => setStatus(event.target.value as WorkStatus | '')}
          >
            <option value="">All task statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Button type="button" onClick={() => { if (!showCreate) setFormBranchId(selectedBranchId ?? ''); setShowCreate((value) => !value); }}>
            {showCreate ? <X className="size-4" /> : <Plus className="size-4" />}
            {showCreate ? 'Close' : 'Add task'}
          </Button>
        </div>
      </div>

      {showCreate ? (
        <Card className="border-primary/30 bg-primary/5">
          <div><h2 className="font-semibold">Create a task</h2><p className="mt-1 text-sm text-muted-foreground">Assign work to an active receptionist or team member of the chosen branch. Fields marked <span className="font-semibold text-red-600">*</span> are required.</p></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs text-muted-foreground md:col-span-2">Branch <span className="font-semibold text-red-600">*</span><Select className="mt-1 w-full" aria-label="Task branch" value={taskBranchId} onChange={(event) => { setFormBranchId(event.target.value); setTaskForm((current) => ({ ...current, assignedUserId: '' })); }}><option value="">{branchesQuery.isLoading ? 'Loading branches...' : 'Select branch'}</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select>{!selectedBranchId ? <span className="mt-1 block text-amber-700">You are viewing all branches. Choose which branch this task belongs to.</span> : null}</label>
            <label className="block text-xs text-muted-foreground">Task title <span className="font-semibold text-red-600">*</span><Input className="mt-1" placeholder="e.g. Call patient about HIFU sitting" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="block text-xs text-muted-foreground">Task type<Select className="mt-1 w-full" value={taskForm.type} onChange={(event) => setTaskForm((current) => ({ ...current, type: event.target.value }))}>
              <option value="GENERAL">General task</option>
              <option value="CALL">Call</option>
              <option value="APPOINTMENT">Appointment</option>
              <option value="PATIENT_SUPPORT">Patient support</option>
              <option value="DOCUMENT_REVIEW">Document review</option>
            </Select></label>
            <label className="block text-xs text-muted-foreground md:col-span-2">Description (optional)<Input className="mt-1" placeholder="Details the assignee needs to know" value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="block text-xs text-muted-foreground">Due date and time <span className="font-semibold text-red-600">*</span><Input className="mt-1" type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} /></label>
            <label className="block text-xs text-muted-foreground">Notification time (optional)<Input className="mt-1" type="datetime-local" value={taskForm.reminderAt} onChange={(event) => setTaskForm((current) => ({ ...current, reminderAt: event.target.value }))} /><span className="mt-1 block">Defaults to 15 minutes before the task is due.</span></label>
            <label className="block text-xs text-muted-foreground">Priority<Select className="mt-1 w-full" value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></Select></label>
            <label className="block text-xs text-muted-foreground md:col-span-2">Assign to <span className="font-semibold text-red-600">*</span><Select className="mt-1 w-full" value={taskForm.assignedUserId} disabled={!taskBranchId} onChange={(event) => setTaskForm((current) => ({ ...current, assignedUserId: event.target.value }))}><option value="">{!taskBranchId ? 'Select the branch first' : formStaffQuery.isLoading ? 'Loading team...' : 'Select team member'}</option>{formStaff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></label>
          </div>
          {missing.length ? <p className="mt-3 text-sm text-amber-700">Still needed: {missing.join(', ')}.</p> : null}
          {create.isError ? <p className="mt-3 text-sm text-red-600">{create.error.message}</p> : null}
          <div className="mt-4 flex gap-2"><Button disabled={missing.length > 0 || create.isPending} onClick={() => create.mutate()}>{create.isPending ? 'Creating...' : 'Create task'}</Button><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <TaskMetric icon={CircleDot} label="Visible tasks" value={tasks.length} />
        <TaskMetric
          icon={Clock3}
          label="In progress"
          value={tasks.filter((task) => task.status === 'IN_PROGRESS').length}
        />
        <TaskMetric icon={CheckCircle2} label="Overdue" value={overdue} />
      </div>

      {completingTask ? (
        <Card className="border-primary/30 bg-primary/5">
          <h2 className="font-semibold">Complete: {completingTask.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record what was done so the clinic has a usable handover.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Completion notes"
              value={completionNotes}
              onChange={(event) => setCompletionNotes(event.target.value)}
            />
            <Button
              disabled={completionNotes.trim().length === 0 || update.isPending}
              onClick={() =>
                update.mutate({
                  id: completingTask.id,
                  nextStatus: 'COMPLETED',
                  notes: completionNotes,
                })
              }
            >
              Mark completed
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCompletingTask(null)}>
              Cancel
            </Button>
          </div>
          {update.isError ? (
            <p className="mt-2 text-sm text-red-600">{update.error.message}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <Empty text="Loading tasks..." />
        ) : query.isError ? (
          <Empty text="Tasks could not be loaded." />
        ) : tasks.length === 0 ? (
          <Empty text="You have no assigned tasks in this filter." />
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {task.description || task.type.replaceAll('_', ' ')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Assigned to {task.assignedUser.name} - {task.branch.name}
                    {task.person ? ` - ${task.person.fullName}` : ''}
                    {task.lead ? (
                      <>
                        {' - '}
                        <Link
                          className="text-primary hover:underline"
                          href={`/leads/${task.lead.id}`}
                        >
                          Open lead
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{new Date(task.dueAt).toLocaleString('en-IN')}</span>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {task.status.replaceAll('_', ' ')}
                  </span>
                  {task.status === 'OPEN' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: task.id, nextStatus: 'IN_PROGRESS' })}
                    >
                      Start
                    </Button>
                  ) : null}
                  {!['COMPLETED', 'CANCELLED'].includes(task.status) ? (
                    <Button type="button" onClick={() => setCompletingTask(task)}>
                      Complete
                    </Button>
                  ) : null}
                  <TaskRecordActions task={task} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function TaskMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-3">
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  if (text.startsWith('Loading')) return <RowsSkeleton rows={6} />;
  return <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
