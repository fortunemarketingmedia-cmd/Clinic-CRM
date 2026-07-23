'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleDot, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Task, WorkStatus } from '@/types/foundation';

export function TasksView() {
  const client = useQueryClient();
  const { session, selectedBranchId } = useSessionStore();
  const [status, setStatus] = useState<WorkStatus | ''>('');
  const [completingTask, setCompletingTask] = useState<Task | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const params = new URLSearchParams();
  if (selectedBranchId) params.set('branchId', selectedBranchId);
  if (session?.user.id) params.set('assignedUserId', session.user.id);
  if (status) params.set('status', status);

  const query = useQuery({
    queryKey: ['tasks', selectedBranchId, session?.user.id, status],
    queryFn: () => apiRequest<{ data: Task[] }>(`/tasks?${params}`),
    enabled: Boolean(session),
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
          <h1 className="text-2xl font-semibold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Assigned operational work across CRM, appointments, and patient journeys.
          </p>
        </div>
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
      </div>

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
          <Empty text="Loading tasks…" />
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
                    {task.branch.name}
                    {task.person ? ` · ${task.person.fullName}` : ''}
                    {task.lead ? (
                      <>
                        {' · '}
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
  return <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
