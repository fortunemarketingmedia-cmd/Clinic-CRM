'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, CheckSquare, Clock3, Phone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton, RowsSkeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/services/api';
import type { Lead, TimelineEvent } from '@/types/lead';

const profileStageOptions = [
  { label: 'New enquiry', value: 'ASSIGNED' },
  { label: 'Contacted', value: 'CONNECTED' },
  { label: 'Follow-up required', value: 'NURTURING' },
  { label: 'Appointment proposed', value: 'APPOINTMENT_PROPOSED' },
  { label: 'Not interested', value: 'LOST' },
] as const;

export function LeadProfileView({ leadId }: { leadId: string }) {
  const client = useQueryClient();
  const [stage, setStage] = useState(''); const [stageNotes, setStageNotes] = useState(''); const [manualScore, setManualScore] = useState('50');
  const leadQuery = useQuery({ queryKey: ['lead-profile', leadId], queryFn: () => apiRequest<{ data: Lead }>(`/leads/${leadId}`) });
  const timelineQuery = useQuery({ queryKey: ['lead-timeline', leadId], queryFn: () => apiRequest<{ data: TimelineEvent[] }>(`/leads/${leadId}/timeline`) });
  const transition = useMutation({ mutationFn: () => { const body: Record<string, string | number> = { status: stage }; if (stage === 'QUALIFIED') { body.qualificationNotes = stageNotes; body.leadScore = Number(manualScore); } if (stage === 'LOST') body.lostReason = stageNotes; if (stage === 'DISQUALIFIED') body.disqualificationReason = stageNotes; return apiRequest(`/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify(body) }); }, onSuccess: () => { setStage(''); setStageNotes(''); client.invalidateQueries({ queryKey: ['lead-profile', leadId] }); client.invalidateQueries({ queryKey: ['lead-timeline', leadId] }); } });
  if (leadQuery.isLoading) return <PageSkeleton />;
  if (leadQuery.isError || !leadQuery.data) return <State text="Lead profile could not be loaded." />;
  const lead = leadQuery.data.data;
  return <section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/leads" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Leads</Link><h1 className="text-2xl font-semibold">{lead.name}</h1><p className="text-sm text-muted-foreground">{lead.mobile} - {lead.branch?.name}</p></div></div>
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4"><Card><h2 className="font-semibold">Lead summary</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="CRM stage" value={lead.status.replaceAll('_', ' ')} /><Detail label="Owner" value={lead.owner?.name ?? 'Unassigned'} /><Detail label="Priority" value={lead.priority} /><Detail label="Treatment interest" value={lead.interestedTreatment ?? 'Not recorded'} /><Detail label="Source" value={lead.source.replaceAll('_', ' ')} /><Detail label="Created" value={new Date(lead.createdAt).toLocaleString()} /></div></Card>
      <Card><h2 className="font-semibold">Next action</h2><div className="mt-3 flex items-start gap-3"><Clock3 className="mt-0.5 size-5 text-primary" /><div><div className="font-medium">{lead.nextAction ?? 'No next action'}</div><div className="text-sm text-muted-foreground">{lead.nextActionDueAt ? new Date(lead.nextActionDueAt).toLocaleString() : 'No due date'}</div></div></div></Card>
      <Card><h2 className="font-semibold">Journey</h2><div className="mt-4 space-y-4">{timelineQuery.isLoading ? <RowsSkeleton rows={4} /> : (timelineQuery.data?.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : timelineQuery.data?.data.map((event) => <div key={event.id} className="flex gap-3"><div className="mt-1.5 size-2 rounded-full bg-primary" /><div><div className="text-sm font-medium">{event.title}</div><div className="text-xs text-muted-foreground">{event.description ? `${event.description} - ` : ''}{new Date(event.createdAt).toLocaleString()}</div></div></div>)}</div></Card></div>
      <div className="space-y-4"><Card><h2 className="font-semibold">Person</h2><div className="mt-4 space-y-3"><IconRow icon={UserRound} text={lead.name} /><IconRow icon={Phone} text={lead.mobile} /><IconRow icon={CalendarDays} text={`${lead.appointments?.length ?? 0} appointments`} /><IconRow icon={Clock3} text={`${lead.followUps?.length ?? 0} follow-ups`} /><IconRow icon={CheckSquare} text={`${lead.tasks?.length ?? 0} tasks`} /></div></Card>
      <Card><h2 className="font-semibold">Change CRM stage</h2><div className="mt-3 space-y-2"><Select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">Select next stage</option>{profileStageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>{['QUALIFIED', 'LOST'].includes(stage) ? <Input placeholder={stage === 'QUALIFIED' ? 'Qualification notes' : 'Reason or closing note'} value={stageNotes} onChange={(event) => setStageNotes(event.target.value)} /> : null}{stage === 'QUALIFIED' ? <Input type="number" min="0" max="100" value={manualScore} onChange={(event) => setManualScore(event.target.value)} /> : null}{transition.isError ? <p className="text-xs text-red-600">{transition.error.message}</p> : null}<Button className="w-full" disabled={!stage || (['QUALIFIED', 'LOST'].includes(stage) && !stageNotes) || transition.isPending} onClick={() => transition.mutate()}>Apply stage</Button></div></Card>
      <Card><h2 className="font-semibold">Attribution</h2><div className="mt-3 space-y-2 text-sm"><Detail label="Source" value={lead.source.replaceAll('_', ' ')} />{lead.adLeads?.[0] ? <><Detail label="Campaign" value={lead.adLeads[0].campaignName ?? '-'} /><Detail label="Ad" value={lead.adLeads[0].adName ?? '-'} /><Detail label="Form" value={lead.adLeads[0].formName ?? '-'} /></> : <p className="text-muted-foreground">No paid-media attribution.</p>}</div></Card></div>
    </div>
  </section>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>; }
function IconRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) { return <div className="flex items-center gap-2 text-sm"><Icon className="size-4 text-muted-foreground" />{text}</div>; }
function State({ text }: { text: string }) { return <Card className="p-10 text-center text-sm text-muted-foreground">{text}</Card>; }
