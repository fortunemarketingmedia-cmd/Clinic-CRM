import type { WhatsAppMessage, WhatsAppTemplate } from '@prisma/client';
import { env } from '../config/env.js';
import { decryptIntegrationSecret } from '../utils/integration-crypto.js';

const encryptionKey = () =>
  env.INTEGRATION_ENCRYPTION_KEY ?? `${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`;
export class WhatsAppProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function baseUrl() {
  const url = new URL(env.WHATSAPP_GRAPH_API_URL);
  if (env.NODE_ENV === 'production' && url.hostname !== 'graph.facebook.com')
    throw new Error('Production WhatsApp API must use graph.facebook.com');
  return url.toString().replace(/\/$/, '');
}

async function metaRequest<T>(
  account: { accessTokenCiphertext: string; apiVersion: string },
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl()}/${account.apiVersion}/${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(env.PROVIDER_REQUEST_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${decryptIntegrationSecret(account.accessTokenCiphertext, encryptionKey())}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_subcode?: number };
    [key: string]: unknown;
  };
  if (!response.ok)
    throw new WhatsAppProviderError(
      body.error?.message ?? `Meta API request failed with ${response.status}`,
      String(body.error?.code ?? response.status),
      response.status === 429 || response.status >= 500,
      body,
    );
  return body as T;
}

function templateComponents(template: WhatsAppTemplate, values: string[]) {
  const components: Array<Record<string, unknown>> = [];
  if (values.length)
    components.push({ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) });
  const buttons = Array.isArray(template.buttons) ? template.buttons : [];
  for (const [index, button] of buttons.entries()) {
    if (
      typeof button === 'object' &&
      button &&
      'type' in button &&
      String(button.type).toUpperCase() === 'URL' &&
      'value' in button
    )
      components.push({
        type: 'button',
        sub_type: 'url',
        index: String(index),
        parameters: [{ type: 'text', text: String(button.value) }],
      });
  }
  return components;
}

export const whatsappProviderService = {
  encryptionKey,
  async testConnection(account: {
    accessTokenCiphertext: string;
    apiVersion: string;
    businessAccountId: string;
  }) {
    return metaRequest<Record<string, unknown>>(
      account,
      `${account.businessAccountId}?fields=id,name`,
    );
  },
  async syncTemplates(account: {
    accessTokenCiphertext: string;
    apiVersion: string;
    businessAccountId: string;
  }) {
    return metaRequest<{
      data: Array<{
        id?: string;
        name: string;
        language: string;
        category: string;
        status: string;
        rejected_reason?: string;
        components?: Array<{ type: string; text?: string; buttons?: unknown[] }>;
      }>;
    }>(account, `${account.businessAccountId}/message_templates?limit=250`);
  },
  async sendMessage(input: {
    account: { accessTokenCiphertext: string; apiVersion: string };
    phoneNumberProviderId: string;
    message: WhatsAppMessage & { template: WhatsAppTemplate | null };
  }) {
    const { message } = input;
    let payload: Record<string, unknown>;
    if (message.template)
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.recipient,
        type: 'template',
        template: {
          name: message.template.name,
          language: { code: message.templateLanguage ?? message.template.language },
          components: templateComponents(
            message.template,
            Array.isArray(message.interactivePayload) ? message.interactivePayload.map(String) : [],
          ),
        },
      };
    else if (message.type === 'INTERACTIVE' && message.interactivePayload)
      payload = {
        messaging_product: 'whatsapp',
        to: message.recipient,
        type: 'interactive',
        interactive: message.interactivePayload,
      };
    else if (message.type === 'IMAGE' || message.type === 'DOCUMENT' || message.type === 'AUDIO')
      payload = {
        messaging_product: 'whatsapp',
        to: message.recipient,
        type: message.type.toLowerCase(),
        [message.type.toLowerCase()]: message.mediaId
          ? { id: message.mediaId, caption: message.content, filename: message.filename }
          : { link: message.mediaUrl, caption: message.content, filename: message.filename },
      };
    else
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: message.recipient,
        type: 'text',
        text: { preview_url: false, body: message.content ?? '' },
      };
    return metaRequest<{ messages: Array<{ id: string; message_status?: string }> }>(
      input.account,
      `${input.phoneNumberProviderId}/messages`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
  },
};
