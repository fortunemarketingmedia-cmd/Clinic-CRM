import type { AutomationTrigger, Prisma, Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { integrationRepository } from '../repositories/integration.repository.js';
import { HttpError } from '../utils/http-error.js';
import type { AuditContext } from './audit.service.js';
import { auditService } from './audit.service.js';
import { integrationService } from './integration.service.js';

type Actor = { id: string; role: Role };
type Condition = {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'EXISTS' | 'GT' | 'LT';
  value?: unknown;
};
type Action = {
  type: string;
  config?: Record<string, unknown>;
  delayMinutes?: number;
  conditions?: Condition[];
};
const object = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const array = <T>(value: Prisma.JsonValue | null | undefined) =>
  Array.isArray(value) ? (value as T[]) : [];
function requireAdmin(actor: Actor) {
  if (actor.role !== 'ADMIN') throw new HttpError(403, 'Administrator access is required');
}
function get(data: Record<string, unknown>, path: string) {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      data,
    );
}
function matches(data: Record<string, unknown>, conditions: Condition[]) {
  return conditions.every((condition) => {
    const current = get(data, condition.field);
    if (condition.operator === 'EXISTS')
      return current !== undefined && current !== null && current !== '';
    if (condition.operator === 'EQUALS') return String(current) === String(condition.value);
    if (condition.operator === 'NOT_EQUALS') return String(current) !== String(condition.value);
    if (condition.operator === 'CONTAINS')
      return String(current ?? '')
        .toLowerCase()
        .includes(String(condition.value ?? '').toLowerCase());
    if (condition.operator === 'GT') return Number(current) > Number(condition.value);
    return Number(current) < Number(condition.value);
  });
}
function safeWebhook(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Automation webhooks must use HTTPS');
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    throw new Error('Private network webhook targets are not allowed');
  return parsed.toString();
}

export const automationService = {
  list(branchId?: string) {
    return integrationRepository.listAutomations(branchId);
  },
  get(id: string) {
    return integrationRepository.findAutomation(id);
  },
  executions(filters: { automationId?: string; status?: never }) {
    return integrationRepository.listExecutions(filters);
  },
  async create(
    input: {
      name: string;
      description?: string;
      trigger: AutomationTrigger;
      branchId?: string;
      conditions?: Condition[];
      workflow: Action[];
      stopConditions?: string[];
      active: boolean;
      testMode: boolean;
    },
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const row = await integrationRepository.createAutomation({
      ...input,
      conditions: input.conditions as unknown as Prisma.InputJsonValue,
      workflow: input.workflow as unknown as Prisma.InputJsonValue,
      stopConditions: input.stopConditions as Prisma.InputJsonValue,
      createdById: actor.id,
    });
    await auditService.record(audit, {
      action: 'AUTOMATION_CREATED',
      entity: 'AutomationDefinition',
      entityId: row.id,
    });
    return row;
  },
  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      trigger: AutomationTrigger;
      branchId: string;
      conditions: Condition[];
      workflow: Action[];
      stopConditions: string[];
      active: boolean;
      testMode: boolean;
    }>,
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const row = await integrationRepository.updateAutomation(id, {
      ...input,
      conditions: input.conditions as unknown as Prisma.InputJsonValue,
      workflow: input.workflow as unknown as Prisma.InputJsonValue,
      stopConditions: input.stopConditions as Prisma.InputJsonValue,
      version: { increment: 1 },
    });
    await auditService.record(audit, {
      action: 'AUTOMATION_UPDATED',
      entity: 'AutomationDefinition',
      entityId: id,
    });
    return row;
  },
  async trigger(
    trigger: AutomationTrigger,
    input: {
      branchId?: string;
      leadId?: string;
      referenceType: string;
      referenceId: string;
      payload?: Record<string, unknown>;
      actorId?: string;
    },
  ) {
    const definitions = await integrationRepository.findActiveAutomations(trigger, input.branchId);
    const created = [];
    for (const definition of definitions) {
      const payload = input.payload ?? {};
      if (!matches(payload, array<Condition>(definition.conditions))) continue;
      const execution = await integrationRepository.createExecution({
        automationId: definition.id,
        branchId: input.branchId,
        leadId: input.leadId,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        triggerPayload: payload as Prisma.InputJsonValue,
        actorId: input.actorId,
        status: 'QUEUED',
      });
      const first = array<Action>(definition.workflow)[0];
      const runAt = new Date(Date.now() + Number(first?.delayMinutes ?? 0) * 60_000);
      await integrationRepository.createJob({
        type: 'AUTOMATION_EXECUTION',
        idempotencyKey: `automation:${execution.id}:0`,
        payload: { executionId: execution.id },
        runAt,
      });
      created.push(execution);
    }
    return created;
  },
  async test(
    id: string,
    input: { referenceType: string; referenceId: string; payload?: Record<string, unknown> },
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const definition = await integrationRepository.findAutomation(id);
    if (!definition) throw new HttpError(404, 'Automation not found');
    const execution = await integrationRepository.createExecution({
      automationId: id,
      branchId: definition.branchId,
      leadId: input.referenceType === 'Lead' ? input.referenceId : undefined,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      triggerPayload: (input.payload ?? {}) as Prisma.InputJsonValue,
      actorId: actor.id,
      status: 'TESTED',
      executionLog: [
        {
          at: new Date().toISOString(),
          message: 'Validation-only test completed; no actions were applied',
          matched: matches(input.payload ?? {}, array<Condition>(definition.conditions)),
        },
      ],
    });
    await auditService.record(audit, {
      action: 'AUTOMATION_TESTED',
      entity: 'AutomationDefinition',
      entityId: id,
    });
    return execution;
  },
  async execute(id: string) {
    const execution = await integrationRepository.findExecution(id);
    if (!execution || ['COMPLETED', 'STOPPED', 'TESTED'].includes(execution.status)) return;
    const workflow = array<Action>(execution.automation.workflow);
    const action = workflow[execution.currentStep];
    if (!action) {
      await integrationRepository.updateExecution(id, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      return;
    }
    const context = {
      ...object(execution.triggerPayload),
      lead: execution.lead ?? undefined,
      referenceType: execution.referenceType,
      referenceId: execution.referenceId,
    } as Record<string, unknown>;
    if (!matches(context, action.conditions ?? [])) {
      await integrationRepository.updateExecution(id, {
        currentStep: { increment: 1 },
        executionLog: [
          {
            at: new Date().toISOString(),
            step: execution.currentStep,
            action: action.type,
            result: 'skipped',
          },
        ],
      });
      return this.queueNext(id, execution.currentStep + 1, workflow);
    }
    await integrationRepository.updateExecution(id, {
      status: 'RUNNING',
      startedAt: execution.startedAt ?? new Date(),
    });
    const config = action.config ?? {};
    const lead = execution.lead;
    if (action.type === 'ASSIGN_OWNER' && lead)
      await prisma.lead.update({
        where: { id: lead.id },
        data: { ownerId: String(config.ownerId) },
      });
    else if (action.type === 'CHANGE_STAGE' && lead)
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: String(config.status) as never },
      });
    else if (action.type === 'UPDATE_FIELD' && lead) {
      const allowed = new Set([
        'priority',
        'nextAction',
        'nextActionDueAt',
        'qualificationStatus',
        'interestedTreatment',
      ]);
      const field = String(config.field ?? '');
      if (!allowed.has(field)) throw new Error(`Automation field ${field} is not allowed`);
      const value = field.endsWith('At') ? new Date(String(config.value)) : config.value;
      await prisma.lead.update({ where: { id: lead.id }, data: { [field]: value } });
    } else if ((action.type === 'CREATE_TASK' || action.type === 'NOTIFY_ADMIN') && lead) {
      const admin =
        action.type === 'NOTIFY_ADMIN'
          ? await prisma.user.findFirst({ where: { accessLevel: 'ADMIN', status: 'ACTIVE' } })
          : null;
      const assignedUserId = String(
        config.assignedUserId ?? admin?.id ?? lead.ownerId ?? lead.createdById,
      );
      await prisma.task.create({
        data: {
          title: String(
            config.title ??
              (action.type === 'NOTIFY_ADMIN' ? 'Automation alert' : 'Automated follow-up'),
          ),
          description: config.description ? String(config.description) : undefined,
          type: String(config.taskType ?? 'AUTOMATION'),
          priority: String(config.priority ?? 'MEDIUM') as never,
          assignedUserId,
          branchId: lead.branchId,
          personId: lead.personId,
          leadId: lead.id,
          dueAt: new Date(Date.now() + Number(config.dueMinutes ?? 60) * 60_000),
          automaticallyCreated: true,
          createdById: execution.automation.createdById,
        },
      });
    } else if (action.type === 'TRIGGER_WEBHOOK') {
      const url = safeWebhook(String(config.url));
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(env.PROVIDER_REQUEST_TIMEOUT_MS),
        headers: { 'content-type': 'application/json', 'x-revive-event-id': execution.id },
        body: JSON.stringify({
          eventId: execution.id,
          referenceType: execution.referenceType,
          referenceId: execution.referenceId,
          trigger: execution.automation.trigger,
        }),
      });
      if (!response.ok) throw new Error(`Automation webhook failed (${response.status})`);
    } else if (action.type === 'SEND_CONVERSION_EVENT' && lead)
      await integrationService.createConversion(
        {
          connectionId: String(config.connectionId),
          platform: String(config.platform) as 'META' | 'GOOGLE',
          eventType: String(config.eventType ?? 'LEAD_CREATED'),
          eventId: `${execution.id}:${execution.currentStep}`,
          personId: lead.personId ?? undefined,
          leadId: lead.id,
          eventTime: new Date(),
          conversionAction: config.conversionAction ? String(config.conversionAction) : undefined,
          currency: 'INR',
          consentGranted: config.consentGranted === true,
        },
        { id: execution.automation.createdById, role: 'ADMIN' },
        { userId: execution.automation.createdById, correlationId: `automation:${execution.id}` },
      );
    else if (['ADD_TAG', 'REMOVE_TAG', 'SEND_WHATSAPP'].includes(action.type) && lead)
      await prisma.timelineEvent.create({
        data: {
          leadId: lead.id,
          personId: lead.personId,
          createdById: execution.automation.createdById,
          type: action.type,
          title:
            action.type === 'SEND_WHATSAPP'
              ? 'WhatsApp action requested'
              : `Tag ${action.type === 'ADD_TAG' ? 'added' : 'removed'}`,
          description:
            action.type === 'SEND_WHATSAPP'
              ? 'Queued for the clinic WhatsApp workflow after consent checks'
              : String(config.tag ?? ''),
          metadata: config as Prisma.InputJsonObject,
        },
      });
    const next = execution.currentStep + 1;
    await integrationRepository.updateExecution(id, {
      currentStep: next,
      executionLog: [
        {
          at: new Date().toISOString(),
          step: execution.currentStep,
          action: action.type,
          result: 'completed',
        },
      ],
    });
    return this.queueNext(id, next, workflow);
  },
  async queueNext(id: string, step: number, workflow: Action[]) {
    const next = workflow[step];
    if (!next)
      return integrationRepository.updateExecution(id, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });
    const runAt = new Date(Date.now() + Number(next.delayMinutes ?? 0) * 60_000);
    await integrationRepository.updateExecution(id, {
      status: next.delayMinutes ? 'WAITING' : 'QUEUED',
      nextRunAt: runAt,
    });
    return integrationRepository.createJob({
      type: 'AUTOMATION_EXECUTION',
      idempotencyKey: `automation:${id}:${step}`,
      payload: { executionId: id },
      runAt,
    });
  },
};
