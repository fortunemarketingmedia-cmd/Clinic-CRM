import type {
  DurableJob,
  Prisma,
  WhatsAppAutomationTrigger,
  WhatsAppConsentCategory,
} from '@prisma/client';
import { env } from '../config/env.js';
import { whatsappRepository } from '../repositories/whatsapp.repository.js';
import {
  isQuietHour,
  nextQuietHoursEnd,
  normalizeWhatsAppPhone,
  renderWhatsAppTemplate,
} from './whatsapp-policy.js';
import { WhatsAppProviderError, whatsappProviderService } from './whatsapp-provider.service.js';
import { whatsappWebhookService } from './whatsapp-webhook.service.js';

type JobPayload = {
  messageId?: string;
  webhookEventId?: string;
  automationId?: string;
  referenceType?: string;
  referenceId?: string;
  broadcastId?: string;
};

const terminalLeadStatuses = new Set([
  'APPOINTMENT_BOOKED',
  'BOOKED',
  'CONFIRMED',
  'ARRIVED',
  'LOST',
  'DISQUALIFIED',
  'CONVERTED',
  'CANCELLED',
]);
const terminalAppointmentStatuses = new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']);

function payload(job: DurableJob) {
  return job.payload as JobPayload;
}
function consentForTrigger(trigger: WhatsAppAutomationTrigger): WhatsAppConsentCategory {
  if (
    ['PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'INVOICE_GENERATED', 'REFUND_PROCESSED'].includes(
      trigger,
    )
  )
    return 'PAYMENT_REMINDERS';
  if (
    [
      'POST_TREATMENT_FOLLOW_UP',
      'AFTERCARE_INSTRUCTIONS',
      'PRESCRIPTION_AVAILABLE',
      'TREATMENT_FOLLOW_UP_DUE',
    ].includes(trigger)
  )
    return 'TREATMENT_FOLLOW_UPS';
  if (['DORMANT_PATIENT_REACTIVATION', 'FEEDBACK_REQUEST', 'REVIEW_REQUEST'].includes(trigger))
    return 'MARKETING_MESSAGES';
  return trigger.startsWith('APPOINTMENT_') ? 'APPOINTMENT_NOTIFICATIONS' : 'TRANSACTIONAL';
}

async function requireConsent(phone: string, category: WhatsAppConsentCategory) {
  const consent = await whatsappRepository.latestConsent(phone, category);
  return Boolean(consent?.granted && !consent.withdrawnAt);
}

async function sendMessage(messageId: string) {
  const message = await whatsappRepository.findMessage(messageId);
  if (!message || ['SUBMITTED', 'SENT', 'DELIVERED', 'READ', 'CANCELLED'].includes(message.status))
    return;
  try {
    const response = await whatsappProviderService.sendMessage({
      account: message.phoneNumber.account,
      phoneNumberProviderId: message.phoneNumber.phoneNumberId,
      message,
    });
    const providerMessageId = response.messages[0]?.id;
    if (!providerMessageId)
      throw new WhatsAppProviderError(
        'Meta did not return a message id',
        'EMPTY_PROVIDER_ID',
        true,
        response,
      );
    await whatsappRepository.updateMessage(message.id, {
      status: 'SUBMITTED',
      providerMessageId,
      submittedAt: new Date(),
      providerPayload: response as Prisma.InputJsonValue,
    });
    if (message.templateId)
      await whatsappRepository.incrementTemplate(message.templateId, 'sentCount');
    if (message.broadcastRecipient) {
      await whatsappRepository.updateRecipient(message.broadcastRecipient.id, {
        status: 'SUBMITTED',
      });
      await whatsappRepository.incrementBroadcast(
        message.broadcastRecipient.broadcastId,
        'submittedCount',
      );
      const recipients = await whatsappRepository.listBroadcastRecipients(
        message.broadcastRecipient.broadcastId,
      );
      if (!recipients.some((recipient) => ['FILTERED', 'QUEUED'].includes(recipient.status)))
        await whatsappRepository.updateBroadcast(message.broadcastRecipient.broadcastId, {
          status: 'COMPLETED',
          completedAt: new Date(),
        });
    }
  } catch (error) {
    const providerError =
      error instanceof WhatsAppProviderError
        ? error
        : new WhatsAppProviderError(
            error instanceof Error ? error.message : 'WhatsApp send failed',
            'UNKNOWN',
            true,
          );
    await whatsappRepository.updateMessage(message.id, {
      status: 'FAILED',
      failedAt: new Date(),
      failureCode: providerError.code,
      failureReason: providerError.message,
      retryCount: { increment: 1 },
    });
    throw providerError;
  }
}

function appointmentVariables(
  context: NonNullable<Awaited<ReturnType<typeof whatsappRepository.findAppointmentContext>>>,
) {
  return [
    context.lead.name,
    context.branch.name,
    context.appointmentAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    context.doctor?.name ?? 'your care team',
    context.branch.address ?? 'the clinic',
  ];
}

function leadVariables(
  context: NonNullable<Awaited<ReturnType<typeof whatsappRepository.findLeadContext>>>,
) {
  return [
    context.name,
    context.branch.name,
    context.interestedTreatment ?? 'your enquiry',
    context.owner?.name ?? 'our care team',
  ];
}

async function executeAutomation(job: DurableJob) {
  const data = payload(job);
  if (!data.automationId || !data.referenceType || !data.referenceId) return;
  const automation = await whatsappRepository.findAutomation(data.automationId);
  if (
    !automation?.active ||
    automation.template.status !== 'APPROVED' ||
    !automation.template.active
  )
    return;
  const appointment =
    data.referenceType === 'Appointment'
      ? await whatsappRepository.findAppointmentContext(data.referenceId)
      : null;
  const lead =
    data.referenceType === 'Lead'
      ? await whatsappRepository.findLeadContext(data.referenceId)
      : null;
  if (!appointment && !lead) return;
  if (
    appointment &&
    terminalAppointmentStatuses.has(appointment.status) &&
    !['APPOINTMENT_CANCELLED', 'APPOINTMENT_MISSED', 'APPOINTMENT_RESCHEDULED'].includes(
      automation.trigger,
    )
  )
    return;
  if (lead && terminalLeadStatuses.has(lead.status)) return;
  const mobile = normalizeWhatsAppPhone(appointment?.lead.mobile ?? lead?.mobile ?? '');
  if (!mobile || !(await requireConsent(mobile, consentForTrigger(automation.trigger)))) return;
  const branchId = appointment?.branchId ?? lead?.branchId;
  if (!branchId) return;
  const phone = (await whatsappRepository.listPhoneNumbers(branchId))[0];
  if (!phone || phone.account.status !== 'CONNECTED')
    throw new WhatsAppProviderError(
      'No connected WhatsApp number is configured for the branch',
      'NO_BRANCH_PHONE',
      true,
    );
  let conversation = await whatsappRepository.findConversationByPhone(phone.id, mobile);
  if (!conversation) {
    const contextLead = appointment?.lead ?? lead;
    conversation = await whatsappRepository.createConversation({
      phoneNumberId: phone.id,
      branchId,
      normalizedMobile: mobile,
      contactName: contextLead?.name,
      personId: contextLead?.personId,
      leadId: contextLead?.id,
      patientId: contextLead?.patient?.id,
      appointmentId: appointment?.id,
      assignedToId: lead?.ownerId,
      status: 'OPEN',
    });
  }
  const variables = appointment ? appointmentVariables(appointment) : leadVariables(lead!);
  const message = await whatsappRepository.createOutboundMessage({
    conversationId: conversation.id,
    phoneNumberId: phone.id,
    direction: 'OUTBOUND',
    type: 'TEMPLATE',
    status: 'QUEUED',
    sender: phone.normalizedPhone,
    recipient: mobile,
    content: renderWhatsAppTemplate(automation.template.body, variables),
    templateId: automation.template.id,
    templateName: automation.template.name,
    templateLanguage: automation.template.language,
    category: automation.template.category,
    relatedRecordType: data.referenceType,
    relatedRecordId: data.referenceId,
    interactivePayload: variables,
    scheduledAt: new Date(),
  });
  await sendMessage(message.id);
}

async function executeBroadcast(job: DurableJob) {
  const broadcastId = payload(job).broadcastId;
  if (!broadcastId) return;
  const broadcast = await whatsappRepository.findBroadcast(broadcastId);
  if (
    !broadcast ||
    broadcast.status === 'CANCELLED' ||
    !['SCHEDULED', 'SENDING'].includes(broadcast.status)
  )
    return;
  if (isQuietHour(new Date(), broadcast.quietHoursStart, broadcast.quietHoursEnd))
    throw new QuietHoursError(nextQuietHoursEnd(new Date(), broadcast.quietHoursEnd));
  await whatsappRepository.updateBroadcast(broadcastId, {
    status: 'SENDING',
    startedAt: broadcast.startedAt ?? new Date(),
  });
  const recipients = await whatsappRepository.listBroadcastRecipients(broadcastId);
  let index = 0;
  for (const recipient of recipients.filter((item) => item.status === 'FILTERED')) {
    if (!(await requireConsent(recipient.normalizedPhone, 'PROMOTIONAL_BROADCASTS'))) {
      await whatsappRepository.updateRecipient(recipient.id, {
        status: 'OPTED_OUT',
        filterReason: 'Promotional broadcast consent is not active',
      });
      continue;
    }
    let conversation = await whatsappRepository.findConversationByPhone(
      broadcast.phoneNumberId,
      recipient.normalizedPhone,
    );
    if (!conversation)
      conversation = await whatsappRepository.createConversation({
        phoneNumberId: broadcast.phoneNumberId,
        branchId: broadcast.phoneNumber.branchId,
        normalizedMobile: recipient.normalizedPhone,
        personId: recipient.personId,
        leadId: recipient.leadId,
        patientId: recipient.patientId,
        status: 'OPEN',
      });
    const defaults =
      broadcast.variableDefaults &&
      typeof broadcast.variableDefaults === 'object' &&
      !Array.isArray(broadcast.variableDefaults)
        ? Object.values(broadcast.variableDefaults).map(String)
        : [];
    const message = await whatsappRepository.createOutboundMessage({
      conversationId: conversation.id,
      phoneNumberId: broadcast.phoneNumberId,
      direction: 'OUTBOUND',
      type: 'TEMPLATE',
      status: 'QUEUED',
      sender: broadcast.phoneNumber.normalizedPhone,
      recipient: recipient.normalizedPhone,
      content: renderWhatsAppTemplate(broadcast.template.body, defaults),
      templateId: broadcast.templateId,
      templateName: broadcast.template.name,
      templateLanguage: broadcast.template.language,
      category: 'MARKETING',
      relatedRecordType: 'WhatsAppBroadcast',
      relatedRecordId: broadcastId,
      interactivePayload: defaults,
      scheduledAt: new Date(),
    });
    await whatsappRepository.updateRecipient(recipient.id, {
      status: 'QUEUED',
      messageId: message.id,
      queuedAt: new Date(),
    });
    const delayMs = Math.floor(index / broadcast.rateLimitPerMinute) * 60_000;
    await whatsappRepository.createJob({
      type: 'WHATSAPP_SEND',
      idempotencyKey: `wa-send:${message.id}`,
      branchId: broadcast.branchId,
      payload: {
        messageId: message.id,
        referenceType: 'WhatsAppBroadcast',
        referenceId: broadcastId,
      },
      runAt: new Date(Date.now() + delayMs),
    });
    index += 1;
  }
  if (!index)
    await whatsappRepository.updateBroadcast(broadcastId, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });
}

class QuietHoursError extends Error {
  constructor(readonly retryAt: Date) {
    super('Broadcast deferred until quiet hours end');
  }
}

async function execute(job: DurableJob) {
  const data = payload(job);
  if (job.type === 'WHATSAPP_SEND' && data.messageId) return sendMessage(data.messageId);
  if (job.type === 'WHATSAPP_WEBHOOK_PROCESS' && data.webhookEventId)
    return whatsappWebhookService.process(data.webhookEventId);
  if (job.type === 'WHATSAPP_BROADCAST') return executeBroadcast(job);
  if (job.type === 'WHATSAPP_APPOINTMENT_AUTOMATION' || job.type === 'WHATSAPP_LEAD_AUTOMATION')
    return executeAutomation(job);
}

let processing = false;
const whatsappJobTypes = [
  'WHATSAPP_SEND',
  'WHATSAPP_WEBHOOK_PROCESS',
  'WHATSAPP_APPOINTMENT_AUTOMATION',
  'WHATSAPP_LEAD_AUTOMATION',
  'WHATSAPP_BROADCAST',
] as const;
export const whatsappJobService = {
  async processDueJobs(limit = 20) {
    if (processing) return { processed: 0, busy: true };
    processing = true;
    let processed = 0;
    try {
      while (processed < limit) {
        const job = await whatsappRepository.claimJob(env.WHATSAPP_WORKER_ID, [
          ...whatsappJobTypes,
        ]);
        if (!job) break;
        try {
          await execute(job);
          await whatsappRepository.completeJob(job.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Job failed';
          const retryable = error instanceof WhatsAppProviderError ? error.retryable : true;
          const dead = !retryable || job.attempts >= job.maxAttempts;
          const retryAt =
            error instanceof QuietHoursError
              ? error.retryAt
              : new Date(
                  Date.now() + Math.min(60 * 2 ** Math.max(job.attempts - 1, 0), 1440) * 60_000,
                );
          await whatsappRepository.retryJob(job.id, message, retryAt, dead);
          await whatsappRepository.createFailureLog({
            jobId: job.id,
            operation: job.type,
            errorCode: error instanceof WhatsAppProviderError ? error.code : undefined,
            errorMessage: message,
            retryable: !dead,
            payload: job.payload as Prisma.InputJsonValue,
          });
        }
        processed += 1;
      }
      return { processed, busy: false };
    } finally {
      processing = false;
    }
  },
  start() {
    const reportError = (error: unknown) =>
      console.error(
        JSON.stringify({
          level: 'error',
          component: 'whatsapp-worker',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    const timer = setInterval(() => {
      void this.processDueJobs().catch(reportError);
    }, env.WHATSAPP_JOB_POLL_MS);
    timer.unref();
    void this.processDueJobs().catch(reportError);
    return timer;
  },
  stop(timer: NodeJS.Timeout) {
    clearInterval(timer);
  },
  isProcessing() {
    return processing;
  },
};
