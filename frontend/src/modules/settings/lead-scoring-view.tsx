'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RowsSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';

type Rule = {
  id: string;
  name: string;
  description?: string | null;
  field: string;
  operator: 'EQUALS' | 'CONTAINS' | 'EXISTS' | 'GREATER_THAN' | 'LESS_THAN';
  value?: string | null;
  points: number;
  active: boolean;
  branch?: { name: string } | null;
};

const emptyForm = {
  name: '',
  field: 'source',
  operator: 'EQUALS',
  value: '',
  points: '10',
};

export function LeadScoringView() {
  const client = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const rules = useQuery({
    queryKey: ['lead-scoring-rules'],
    queryFn: () => apiRequest<{ data: Rule[] }>('/lead-scoring-rules'),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest('/lead-scoring-rules', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          points: Number(form.points),
          value: form.operator === 'EXISTS' ? undefined : form.value,
          active: true,
        }),
      }),
    onSuccess: () => {
      setForm(emptyForm);
      setMessage('Rule created and all affected leads rescored.');
      client.invalidateQueries({ queryKey: ['lead-scoring-rules'] });
      client.invalidateQueries({ queryKey: ['leads'] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest(`/lead-scoring-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      setMessage('Rule updated and affected leads rescored.');
      client.invalidateQueries({ queryKey: ['lead-scoring-rules'] });
      client.invalidateQueries({ queryKey: ['leads'] });
    },
  });
  const recalculate = useMutation({
    mutationFn: () =>
      apiRequest<{ data: { recalculated: number } }>('/lead-scoring-rules/recalculate-all', {
        method: 'POST',
      }),
    onSuccess: (response) => {
      setMessage(`${response.data.recalculated} leads recalculated successfully.`);
      client.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const needsValue = form.operator !== 'EXISTS';
  const canCreate =
    form.name.trim().length >= 2 &&
    Number.isFinite(Number(form.points)) &&
    (!needsValue || form.value.trim().length > 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lead Scoring</h1>
          <p className="text-sm text-muted-foreground">
            Automatic, explainable lead priority based on enquiry quality and engagement.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={recalculate.isPending}
          onClick={() => recalculate.mutate()}
        >
          <RefreshCcw className={`size-4 ${recalculate.isPending ? 'animate-spin' : ''}`} />
          Recalculate all leads
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Band label="Hot" range="60 points or more" tone="bg-red-50 text-red-700" />
        <Band label="Warm" range="30-59 points" tone="bg-amber-50 text-amber-700" />
        <Band label="Cold" range="0-29 points" tone="bg-blue-50 text-blue-700" />
        <Band label="Unqualified" range="Below 0" tone="bg-slate-100 text-slate-700" />
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            <h2 className="font-semibold">New scoring rule</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Positive points improve priority; negative points reduce it.
          </p>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Rule name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Select
              value={form.field}
              onChange={(event) => setForm({ ...form, field: event.target.value })}
            >
              <option value="source">Lead source</option>
              <option value="priority">Priority</option>
              <option value="interestedTreatment">Treatment interest</option>
              <option value="lastContactedAt">Response received</option>
              <option value="appointmentCount">Appointment count</option>
              <option value="personLeadCount">Returning enquiry count</option>
              <option value="daysInactive">Days inactive</option>
            </Select>
            <Select
              value={form.operator}
              onChange={(event) => setForm({ ...form, operator: event.target.value })}
            >
              <option value="EQUALS">Equals</option>
              <option value="CONTAINS">Contains</option>
              <option value="EXISTS">Exists</option>
              <option value="GREATER_THAN">Greater than</option>
              <option value="LESS_THAN">Less than</option>
            </Select>
            {needsValue ? (
              <Input
                placeholder="Comparison value"
                value={form.value}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
              />
            ) : null}
            <Input
              type="number"
              min="-100"
              max="100"
              placeholder="Points"
              value={form.points}
              onChange={(event) => setForm({ ...form, points: event.target.value })}
            />
            {create.isError || toggle.isError || recalculate.isError ? (
              <p className="text-sm text-red-600">
                {create.error?.message ??
                  toggle.error?.message ??
                  recalculate.error?.message ??
                  'Scoring operation failed'}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={!canCreate || create.isPending}
              onClick={() => {
                setMessage('');
                create.mutate();
              }}
            >
              Create rule
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Scoring rules</h2>
            <p className="text-xs text-muted-foreground">
              Rule changes immediately recalculate affected leads.
            </p>
          </div>
          {rules.isLoading ? (
            <State text="Loading rules..." />
          ) : rules.isError ? (
            <State text="Scoring rules could not be loaded." />
          ) : (rules.data?.data.length ?? 0) === 0 ? (
            <State text="No scoring rules configured." />
          ) : (
            <div className="divide-y">
              {rules.data?.data.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${!rule.active ? 'opacity-55' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                        {rule.active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {rule.branch?.name ?? 'All branches'} - {rule.field} -{' '}
                      {rule.operator.replaceAll('_', ' ')} {rule.value ?? ''}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span
                      className={`text-lg font-semibold ${rule.points >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {rule.points >= 0 ? '+' : ''}
                      {rule.points}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: rule.id, active: !rule.active })}
                    >
                      {rule.active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function Band({ label, range, tone }: { label: string; range: string; tone: string }) {
  return (
    <Card className={tone}>
      <div className="font-semibold">{label}</div>
      <div className="text-xs opacity-80">{range}</div>
    </Card>
  );
}

function State({ text }: { text: string }) {
  if (text.startsWith('Loading')) return <RowsSkeleton rows={5} />;
  return <div className="p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
