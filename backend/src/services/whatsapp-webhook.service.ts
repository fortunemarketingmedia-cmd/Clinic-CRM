import { createHash } from 'node:crypto';
import type { Prisma, WhatsAppMessageStatus, WhatsAppMessageType } from '@prisma/client';
import { whatsappRepository } from '../repositories/whatsapp.repository.js';
import { decryptIntegrationSecret } from '../utils/integration-crypto.js';
import { HttpError } from '../utils/http-error.js';
import { canAdvanceMessageStatus, isWhatsAppOptOut, normalizeWhatsAppPhone, verifyWhatsAppSignature } from './whatsapp-policy.js';
import { whatsappProviderService } from './whatsapp-provider.service.js';

type MetaStatus = { id?: string; status?: string; timestamp?: string; errors?: Array<{ code?: number; title?: string; message?: string }>; pricing?: unknown };
type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string; payload?: string };
  interactive?: { type?: string; button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string; description?: string } };
  context?: { id?: string };
};
type MetaValue = { metadata?: { phone_number_id?: string }; contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>; messages?: MetaMessage[]; statuses?: MetaStatus[] };
type MetaPayload = { object?: string; entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: MetaValue }> }> };

const statusMap: Record<string, WhatsAppMessageStatus> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
const statusTimestampField: Partial<Record<WhatsAppMessageStatus, 'sentAt' | 'deliveredAt' | 'readAt' | 'failedAt'>> = { SENT: 'sentAt', DELIVERED: 'deliveredAt', READ: 'readAt', FAILED: 'failedAt' };

function contentFor(message: MetaMessage) {
  if (message.text?.body) return message.text.body;
  if (message.image) return message.image.caption ?? '[Image]';
  if (message.document) return message.document.caption ?? message.document.filename ?? '[Document]';
  if (message.audio) return '[Audio]';
  if (message.location) return message.location.name ?? message.location.address ?? '[Location]';
  if (message.button) return message.button.text ?? message.button.payload ?? '[Button response]';
  return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '[Interactive response]';
}

function typeFor(type?: string): WhatsAppMessageType {
  const value = (type ?? 'text').toUpperCase();
  return ['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'LOCATION', 'INTERACTIVE'].includes(value) ? value as WhatsAppMessageType : value === 'BUTTON' ? 'INTERACTIVE' : 'TEXT';
}

function buttonAction(message: MetaMessage) {
  return (message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? message.button?.payload ?? '').trim().toUpperCase();
}

async function applyAppointmentAction(action: string, appointmentId?: string | null) {
  if (!appointmentId) return;
  if (['CONFIRM', 'CONFIRMED', 'APPOINTMENT_CONFIRM'].includes(action)) await whatsappRepository.updateAppointmentFromWhatsApp(appointmentId, { status: 'CONFIRMED', confirmationStatus: 'CONFIRMED_BY_WHATSAPP' });
  if (['ARRIVED', 'I_HAVE_ARRIVED'].includes(action)) await whatsappRepository.updateAppointmentFromWhatsApp(appointmentId, { arrivalAt: new Date(), confirmationStatus: 'ARRIVED_BY_WHATSAPP' });
}

async function processStatus(status: MetaStatus) {
  if (!status.id || !status.status) return;
  const next = statusMap[status.status.toLowerCase()];
  if (!next) return;
  const message = await whatsappRepository.findMessageByProviderId(status.id);
  if (!message || !canAdvanceMessageStatus(message.status, next)) return;
  const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000) : new Date();
  const error = status.errors?.[0];
  const field = statusTimestampField[next];
  await whatsappRepository.updateMessage(message.id, {
    status: next,
    ...(field ? { [field]: timestamp } : {}),
    failureCode: error?.code ? String(error.code) : undefined,
    failureReason: error?.message ?? error?.title,
    costMetadata: status.pricing as Prisma.InputJsonValue | undefined,
    providerPayload: status as Prisma.InputJsonValue,
  });
  if (message.templateId && next !== 'SENT') await whatsappRepository.incrementTemplate(message.templateId, next === 'DELIVERED' ? 'deliveredCount' : next === 'READ' ? 'readCount' : 'failedCount');
  if (message.broadcastRecipient) {
    const recipient = message.broadcastRecipient;
    if (next === 'DELIVERED') { await whatsappRepository.updateRecipient(recipient.id, { status: 'DELIVERED', deliveredAt: timestamp }); await whatsappRepository.incrementBroadcast(recipient.broadcastId, 'deliveredCount'); }
    if (next === 'READ') { await whatsappRepository.updateRecipient(recipient.id, { status: 'READ', readAt: timestamp }); await whatsappRepository.incrementBroadcast(recipient.broadcastId, 'readCount'); }
    if (next === 'FAILED') { await whatsappRepository.updateRecipient(recipient.id, { status: 'FAILED', failedAt: timestamp, failureReason: error?.message ?? error?.title }); await whatsappRepository.incrementBroadcast(recipient.broadcastId, 'failedCount'); }
  }
}

async function processInbound(value: MetaValue, message: MetaMessage) {
  if (!message.id || !message.from || !value.metadata?.phone_number_id) return;
  if (await whatsappRepository.findMessageByProviderId(message.id)) return;
  const phone = await whatsappRepository.findPhoneNumberByProviderId(value.metadata.phone_number_id);
  if (!phone?.active) return;
  const normalizedMobile = normalizeWhatsAppPhone(message.from);
  let conversation = await whatsappRepository.findConversationByPhone(phone.id, normalizedMobile);
  if (!conversation) {
    const contact = await whatsappRepository.findContact(normalizedMobile);
    conversation = await whatsappRepository.createConversation({ phoneNumberId: phone.id, branchId: phone.branchId, normalizedMobile, contactName: value.contacts?.find((item) => normalizeWhatsAppPhone(item.wa_id ?? '') === normalizedMobile)?.profile?.name ?? contact?.fullName, personId: contact?.id, leadId: contact?.leads[0]?.id, patientId: contact?.patient?.id, assignedToId: contact?.leads[0]?.ownerId, status: 'NEW' });
  }
  const content = contentFor(message);
  const replyTo = message.context?.id ? await whatsappRepository.findMessageByProviderId(message.context.id) : null;
  await whatsappRepository.createInboundMessage({
    conversationId: conversation.id,
    phoneNumberId: phone.id,
    direction: 'INBOUND',
    type: typeFor(message.type),
    status: 'RECEIVED',
    providerMessageId: message.id,
    sender: normalizedMobile,
    recipient: phone.normalizedPhone,
    content,
    mediaId: message.image?.id ?? message.document?.id ?? message.audio?.id,
    mimeType: message.image?.mime_type ?? message.document?.mime_type ?? message.audio?.mime_type,
    filename: message.document?.filename,
    latitude: message.location?.latitude,
    longitude: message.location?.longitude,
    replyToId: replyTo?.id,
    interactivePayload: (message.interactive ?? message.button) as Prisma.InputJsonValue | undefined,
    providerPayload: message as Prisma.InputJsonValue,
  });
  if (replyTo?.broadcastRecipient) {
    await whatsappRepository.updateRecipient(replyTo.broadcastRecipient.id, { status: 'REPLIED', repliedAt: new Date() });
    await whatsappRepository.incrementBroadcast(replyTo.broadcastRecipient.broadcastId, 'replyCount');
  }
  if (conversation.leadId) await whatsappRepository.cancelJobs('Lead', conversation.leadId);
  if (conversation.appointmentId) await applyAppointmentAction(buttonAction(message), conversation.appointmentId);
  if (isWhatsAppOptOut(content)) {
    await whatsappRepository.optOutAllPromotional(normalizedMobile, message.from, content, conversation.personId ?? undefined);
    if (conversation.appointmentId) await whatsappRepository.cancelJobs('Appointment', conversation.appointmentId);
  }
}

export const whatsappWebhookService = {
  async verifyChallenge(mode: unknown, verifyToken: unknown, challenge: unknown) {
    if (mode !== 'subscribe' || typeof verifyToken !== 'string' || typeof challenge !== 'string') throw new HttpError(403, 'Webhook verification failed');
    for (const account of await whatsappRepository.listActiveAccounts()) {
      if (decryptIntegrationSecret(account.verifyTokenCiphertext, whatsappProviderService.encryptionKey()) === verifyToken) {
        await whatsappRepository.updateAccount(account.id, { webhookVerifiedAt: new Date() });
        return challenge;
      }
    }
    throw new HttpError(403, 'Webhook verification failed');
  },

  async ingest(rawBody: Buffer | undefined, signature: string | undefined, parsed: unknown) {
    if (!rawBody) throw new HttpError(400, 'Raw webhook body is required');
    const payload = parsed as MetaPayload;
    const businessAccountId = payload.entry?.[0]?.id;
    if (!businessAccountId) throw new HttpError(400, 'WhatsApp business account is missing');
    const account = await whatsappRepository.findAccountByBusinessId(businessAccountId);
    if (!account) throw new HttpError(404, 'WhatsApp account is not configured');
    const valid = verifyWhatsAppSignature(rawBody, signature, decryptIntegrationSecret(account.appSecretCiphertext, whatsappProviderService.encryptionKey()));
    if (!valid) throw new HttpError(401, 'Invalid WhatsApp webhook signature');
    const eventHash = createHash('sha256').update(rawBody).digest('hex');
    const duplicate = await whatsappRepository.findWebhookByHash(eventHash);
    if (duplicate) return { duplicate: true, eventId: duplicate.id };
    const event = await whatsappRepository.createWebhookEvent({ accountId: account.id, eventHash, objectType: payload.object, providerEventId: payload.entry?.[0]?.changes?.[0]?.field, signature: signature ?? '', signatureVerified: true, status: 'QUEUED', payload: payload as Prisma.InputJsonValue });
    await whatsappRepository.createJob({ type: 'WHATSAPP_WEBHOOK_PROCESS', idempotencyKey: `wa-webhook:${eventHash}`, payload: { webhookEventId: event.id }, runAt: new Date() });
    return { duplicate: false, eventId: event.id };
  },

  async process(eventId: string) {
    const event = await whatsappRepository.findWebhookEvent(eventId);
    if (!event || event.status === 'PROCESSED') return;
    await whatsappRepository.updateWebhookEvent(eventId, { status: 'PROCESSING', processingAttempts: { increment: 1 } });
    try {
      const payload = event.payload as MetaPayload;
      for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) await processStatus(status);
        for (const message of change.value?.messages ?? []) await processInbound(change.value ?? {}, message);
      }
      await whatsappRepository.updateWebhookEvent(eventId, { status: 'PROCESSED', processedAt: new Date(), failureReason: null });
    } catch (error) {
      await whatsappRepository.updateWebhookEvent(eventId, { status: 'FAILED', failureReason: error instanceof Error ? error.message : 'Webhook processing failed' });
      throw error;
    }
  },
};
