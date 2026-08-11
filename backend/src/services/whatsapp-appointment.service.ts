import { env } from '../config/env.js';

type AppointmentConfirmation = {
  appointmentId: string;
  mobile: string;
};

type MetaMessageResponse = {
  messages?: Array<{ id: string }>;
  error?: { message?: string; code?: number; error_subcode?: number };
};

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function safeMetaError(status: number, payload: MetaMessageResponse) {
  const code = payload.error?.code ? ` (Meta code ${payload.error.code})` : '';
  return `WhatsApp confirmation failed with HTTP ${status}${code}`;
}

export function buildAppointmentTemplatePayload(mobile: string) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: whatsappNumber(mobile),
    type: 'template',
    template: {
      name: env.WHATSAPP_APPOINTMENT_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE },
    },
  };
}

export const whatsappAppointmentService = {
  isConfigured() {
    return Boolean(
      env.WHATSAPP_PHONE_NUMBER_ID &&
        env.WHATSAPP_BUSINESS_ACCOUNT_ID &&
        env.WHATSAPP_ACCESS_TOKEN,
    );
  },

  async sendAppointmentBookedConfirmation(input: AppointmentConfirmation) {
    if (!this.isConfigured()) return { status: 'SKIPPED' as const };

    const recipient = whatsappNumber(input.mobile);
    if (recipient.length < 11 || recipient.length > 15) {
      throw new Error('WhatsApp confirmation skipped because the patient mobile is invalid');
    }

    const response = await fetch(
      `${env.META_GRAPH_API_URL}/${env.META_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildAppointmentTemplatePayload(recipient)),
        signal: AbortSignal.timeout(env.PROVIDER_REQUEST_TIMEOUT_MS),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MetaMessageResponse;
    if (!response.ok || !payload.messages?.[0]?.id) {
      throw new Error(safeMetaError(response.status, payload));
    }

    return {
      status: 'SENT' as const,
      messageId: payload.messages[0].id,
      appointmentId: input.appointmentId,
    };
  },
};
