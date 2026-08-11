'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Workflow } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
type Automation = {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  active: boolean;
  testMode: boolean;
  workflow: Array<{ type: string }>;
  _count: { executions: number };
};
const triggers = [
  'LEAD_CREATED',
  'LEAD_ASSIGNED',
  'LEAD_STAGE_CHANGED',
  'FOLLOW_UP_OVERDUE',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_MISSED',
  'APPOINTMENT_COMPLETED',
  'PATIENT_ARRIVED',
  'CONSULTATION_COMPLETED',
  'TREATMENT_PLAN_CREATED',
  'CONSENT_EXPIRED',
];
const actions = [
  'CREATE_TASK',
  'ASSIGN_OWNER',
  'CHANGE_STAGE',
  'UPDATE_FIELD',
  'NOTIFY_ADMIN',
  'TRIGGER_WEBHOOK',
  'SEND_CONVERSION_EVENT',
];
export function AutomationBuilderView() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger: 'LEAD_CREATED',
    action: 'CREATE_TASK',
    actionConfig: '{"title":"Follow up","dueMinutes":60}',
    secondAction: '',
    secondActionConfig: '{}',
    delayMinutes: '0',
    conditionField: '',
    conditionValue: '',
  });
  const query = useQuery({
    queryKey: ['automations'],
    queryFn: () => apiRequest<{ data: Automation[] }>('/automations'),
  });
  const create = useMutation({
    mutationFn: () =>
      apiRequest('/automations', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          trigger: form.trigger,
          conditions: form.conditionField ? [{ field: form.conditionField, operator: 'EQUALS', value: form.conditionValue }] : undefined,
          workflow: [{ type: form.action, delayMinutes: Number(form.delayMinutes), config: JSON.parse(form.actionConfig || '{}') }, ...(form.secondAction ? [{ type: form.secondAction, delayMinutes: 0, config: JSON.parse(form.secondActionConfig || '{}') }] : [])],
          active: false,
          testMode: true,
        }),
      }),
    onSuccess: () => {
      setOpen(false);
      setError('');
      void client.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Could not save automation'),
  });
  const toggle = useMutation({
    mutationFn: (item: Automation) =>
      apiRequest(`/automations/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          active: !item.active,
          testMode: item.active ? item.testMode : false,
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['automations'] }),
  });
  if (query.isLoading) return <PageSkeleton />;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Phase 10</p>
          <h1 className="mt-1 text-2xl font-semibold">Clinic automation builder</h1>
          <p className="text-sm text-muted-foreground">
            Internal CRM, appointment, clinical, and marketing workflows. Patient-facing and billing
            triggers are excluded.
          </p>
        </div>
        <Button onClick={() => setOpen((value) => !value)}>
          <Plus className="size-4" />
          New workflow
        </Button>
      </div>
      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {open ? (
        <Card>
          <h2 className="font-semibold">Workflow definition</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Workflow name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Input
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <label className="space-y-1 text-sm">
              <span>Trigger</span>
              <Select
                value={form.trigger}
                onChange={(event) => setForm({ ...form, trigger: event.target.value })}
              >
                {triggers.map((item) => (
                  <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm"><span>First action config (JSON)</span><Input value={form.actionConfig} onChange={(event) => setForm({ ...form, actionConfig: event.target.value })} /></label>
            <label className="space-y-1 text-sm"><span>Second action (optional)</span><Select value={form.secondAction} onChange={(event) => setForm({ ...form, secondAction: event.target.value })}><option value="">No second action</option>{actions.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</Select></label>
            {form.secondAction ? <label className="space-y-1 text-sm"><span>Second action config (JSON)</span><Input value={form.secondActionConfig} onChange={(event) => setForm({ ...form, secondActionConfig: event.target.value })} /></label> : null}
            <label className="space-y-1 text-sm">
              <span>First action</span>
              <Select
                value={form.action}
                onChange={(event) => setForm({ ...form, action: event.target.value })}
              >
                {actions.map((item) => (
                  <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm"><span>Condition field (optional)</span><Input placeholder="lead.source" value={form.conditionField} onChange={(event) => setForm({ ...form, conditionField: event.target.value })} /></label>
            <label className="space-y-1 text-sm"><span>Condition value</span><Input value={form.conditionValue} onChange={(event) => setForm({ ...form, conditionValue: event.target.value })} /></label>
            <label className="space-y-1 text-sm">
              <span>Delay (minutes)</span>
              <Input
                type="number"
                min="0"
                value={form.delayMinutes}
                onChange={(event) => setForm({ ...form, delayMinutes: event.target.value })}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            New workflows are saved disabled and in test mode so an administrator can validate them
            before activation.
          </p>
          <div className="mt-4 flex justify-end">
            <Button disabled={!form.name || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Saving...' : 'Save workflow'}
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {query.data?.data.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{item.name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                  >
                    {item.active ? 'Active' : item.testMode ? 'Test mode' : 'Disabled'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  When {item.trigger.replaceAll('_', ' ').toLowerCase()}
                </p>
              </div>
              <Workflow className="size-5 text-primary" />
            </div>
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              {item.workflow.map((step, index) => (
                <div key={index}>
                  {index + 1}. {step.type.replaceAll('_', ' ')}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {item._count.executions} executions
              </span>
              <Button
                variant="secondary"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate(item)}
              >
                <Play className="size-4" />
                {item.active ? 'Disable' : 'Activate'}
              </Button>
            </div>
          </Card>
        ))}
        {!query.isLoading && !query.data?.data.length ? (
          <Card className="lg:col-span-2 text-center text-sm text-muted-foreground">
            No workflows yet. Create one from an approved clinic trigger.
          </Card>
        ) : null}
      </div>
    </section>
  );
}
