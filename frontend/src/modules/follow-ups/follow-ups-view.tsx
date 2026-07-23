'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { FollowUp } from '@/types/foundation';

type Resolution =
  'NEXT_ACTION' | 'APPOINTMENT_BOOKED' | 'CONVERTED' | 'LOST' | 'DISQUALIFIED' | 'CLOSED';

export function FollowUpsView() {
  const client = useQueryClient();
  const { selectedBranchId } = useSessionStore();
  const [selected, setSelected] = useState<FollowUp | null>(null);
  const [outcome, setOutcome] = useState('');
  const [resolution, setResolution] = useState<Resolution>('CLOSED');
  const [nextAction, setNextAction] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const query = useQuery({
    queryKey: ['follow-ups', selectedBranchId],
    queryFn: () =>
      apiRequest<{ data: FollowUp[] }>(
        `/follow-ups${selectedBranchId ? `?branchId=${selectedBranchId}` : ''}`,
      ),
  });
  const complete = useMutation({
    mutationFn: () =>
      apiRequest(`/follow-ups/${selected?.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          outcome,
          resolution,
          nextAction: resolution === 'NEXT_ACTION' ? nextAction : undefined,
          nextFollowUpAt:
            resolution === 'NEXT_ACTION' && nextFollowUpAt ? nextFollowUpAt : undefined,
        }),
      }),
    onSuccess: () => {
      setSelected(null);
      setOutcome('');
      setResolution('CLOSED');
      setNextAction('');
      setNextFollowUpAt('');
      client.invalidateQueries({ queryKey: ['follow-ups'] });
      client.invalidateQueries({ queryKey: ['leads'] });
    },
  });
  const records = query.data?.data ?? [];
  const now = Date.now();
  const overdue = records.filter(
    (item) => item.status !== 'COMPLETED' && new Date(item.dueAt).getTime() < now,
  ).length;
  const completed = records.filter((item) => item.status === 'COMPLETED').length;
  const valid =
    outcome.trim().length > 0 &&
    (resolution !== 'NEXT_ACTION' || (nextAction.trim().length > 0 && nextFollowUpAt.length > 0));

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">
          Calls, messages, reminders, outcomes, and the next action for every enquiry or patient.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={Clock3} label="Open" value={records.length - completed} />
        <Metric icon={AlertTriangle} label="Overdue" value={overdue} />
        <Metric icon={CheckCircle2} label="Completed" value={completed} />
      </div>

      {selected ? (
        <Card className="border-primary/30 bg-primary/5">
          <h2 className="font-semibold">Complete follow-up · {selected.person.fullName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record the result and either close the activity or schedule the next action.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Input
              placeholder="Outcome, for example: Patient confirmed consultation"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
            <Select
              aria-label="Follow-up resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value as Resolution)}
            >
              <option value="CLOSED">Closed</option>
              <option value="NEXT_ACTION">Schedule next action</option>
              <option value="APPOINTMENT_BOOKED">Appointment booked</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
              <option value="DISQUALIFIED">Disqualified</option>
            </Select>
            {resolution === 'NEXT_ACTION' ? (
              <>
                <Input
                  placeholder="Next action"
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                />
                <Input
                  aria-label="Next follow-up date"
                  type="datetime-local"
                  value={nextFollowUpAt}
                  onChange={(event) => setNextFollowUpAt(event.target.value)}
                />
              </>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!valid || complete.isPending} onClick={() => complete.mutate()}>
              Save outcome
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
          {complete.isError ? (
            <p className="mt-2 text-sm text-red-600">{complete.error.message}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        {query.isLoading ? (
          <State text="Loading follow-ups…" />
        ) : query.isError ? (
          <State text="Follow-ups could not be loaded." error />
        ) : records.length === 0 ? (
          <State text="No follow-ups in this branch yet. Schedule a follow-up while creating or updating a lead." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.person.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.person.primaryMobile}
                      </div>
                      {item.lead ? (
                        <Link
                          className="text-xs text-primary hover:underline"
                          href={`/leads/${item.lead.id}`}
                        >
                          Open lead
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {item.activityType}
                      <div className="text-xs text-muted-foreground">{item.channel}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {new Date(item.dueAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">{item.assignedUser.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                        {item.status.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!['COMPLETED', 'CANCELLED'].includes(item.status) ? (
                        <Button type="button" variant="secondary" onClick={() => setSelected(item)}>
                          Record outcome
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item.outcome ?? 'Done'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function Metric({
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
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function State({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <div className={`p-10 text-center text-sm ${error ? 'text-red-600' : 'text-muted-foreground'}`}>
      {text}
    </div>
  );
}
