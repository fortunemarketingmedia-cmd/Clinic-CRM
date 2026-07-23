import crypto from 'node:crypto';
import type { IntegrationConnection } from '@prisma/client';
import { env } from '../config/env.js';
import { decryptIntegrationSecret } from '../utils/integration-crypto.js';

const encryptionKey = () =>
  env.INTEGRATION_ENCRYPTION_KEY ?? `${env.JWT_ACCESS_SECRET}:${env.JWT_REFRESH_SECRET}`;
export class IntegrationProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
const decrypt = (value?: string | null) =>
  value ? decryptIntegrationSecret(value, encryptionKey()) : undefined;

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(env.PROVIDER_REQUEST_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
    error_description?: string;
  };
  if (!response.ok)
    throw new IntegrationProviderError(
      body.error?.message ??
        body.error_description ??
        `Provider request failed (${response.status})`,
      String(body.error?.code ?? response.status),
      response.status === 429 || response.status >= 500,
      body,
    );
  return body as T;
}

function metaBase() {
  const url = new URL(env.META_GRAPH_API_URL);
  if (env.NODE_ENV === 'production' && url.hostname !== 'graph.facebook.com')
    throw new Error('Production Meta API must use graph.facebook.com');
  return `${url.toString().replace(/\/$/, '')}/${env.META_GRAPH_API_VERSION}`;
}

async function googleAccessToken(connection: IntegrationConnection) {
  const existing = decrypt(connection.accessTokenCiphertext);
  if (
    existing &&
    (!connection.tokenExpiresAt || connection.tokenExpiresAt > new Date(Date.now() + 60_000))
  )
    return existing;
  const refreshToken = decrypt(connection.refreshTokenCiphertext);
  const clientSecret = decrypt(connection.clientSecretCiphertext);
  const configuration =
    connection.configuration &&
    typeof connection.configuration === 'object' &&
    !Array.isArray(connection.configuration)
      ? (connection.configuration as Record<string, unknown>)
      : {};
  const clientId = String(configuration.clientId ?? '');
  if (!refreshToken || !clientSecret || !clientId)
    throw new IntegrationProviderError(
      'Google OAuth refresh credentials are incomplete',
      'OAUTH_CONFIGURATION',
      false,
    );
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  return (
    await jsonRequest<{ access_token: string }>(env.GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
  ).access_token;
}

async function googleRequest<T>(
  connection: IntegrationConnection,
  path: string,
  body: unknown,
): Promise<T> {
  const token = await googleAccessToken(connection);
  const developerToken = decrypt(connection.developerTokenCiphertext);
  if (!developerToken)
    throw new IntegrationProviderError(
      'Google Ads developer token is missing',
      'DEVELOPER_TOKEN',
      false,
    );
  return jsonRequest<T>(
    `${env.GOOGLE_ADS_API_URL.replace(/\/$/, '')}/${env.GOOGLE_ADS_API_VERSION}/${path}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'developer-token': developerToken,
        'content-type': 'application/json',
        ...(connection.managerAccountId
          ? { 'login-customer-id': connection.managerAccountId }
          : {}),
      },
      body: JSON.stringify(body),
    },
  );
}

export const integrationProviderService = {
  encryptionKey,
  verifySignature(raw: Buffer, signature: string | undefined, secret: string | undefined) {
    if (!signature || !secret) return false;
    const provided = signature.replace(/^sha256=/, '');
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return (
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    );
  },
  async test(connection: IntegrationConnection) {
    if (connection.provider.toString().startsWith('META')) {
      const token = decrypt(connection.accessTokenCiphertext);
      if (!token)
        throw new IntegrationProviderError('Meta access token is missing', 'TOKEN_MISSING', false);
      return jsonRequest(
        `${metaBase()}/me?fields=id,name&access_token=${encodeURIComponent(token)}`,
      );
    }
    if (connection.provider.toString().startsWith('GOOGLE')) {
      if (!connection.externalAccountId)
        throw new IntegrationProviderError(
          'Google Ads customer ID is missing',
          'CUSTOMER_ID',
          false,
        );
      return googleRequest(
        connection,
        `customers/${connection.externalAccountId}/googleAds:search`,
        { query: 'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1' },
      );
    }
    return { connected: true };
  },
  async retrieveMetaLead(connection: IntegrationConnection, leadId: string) {
    const token = decrypt(connection.accessTokenCiphertext);
    if (!token)
      throw new IntegrationProviderError('Meta access token is missing', 'TOKEN_MISSING', false);
    return jsonRequest<Record<string, unknown>>(
      `${metaBase()}/${encodeURIComponent(leadId)}?fields=id,created_time,field_data,form_id,ad_id,adset_id,campaign_id,is_organic,platform&access_token=${encodeURIComponent(token)}`,
    );
  },
  async fetchMetaFormLeads(connection: IntegrationConnection, formId: string) {
    const token = decrypt(connection.accessTokenCiphertext);
    if (!token)
      throw new IntegrationProviderError('Meta access token is missing', 'TOKEN_MISSING', false);
    return jsonRequest<{ data: Array<Record<string, unknown>> }>(
      `${metaBase()}/${encodeURIComponent(formId)}/leads?fields=id,created_time,field_data,form_id,ad_id,adset_id,campaign_id,is_organic,platform&limit=500&access_token=${encodeURIComponent(token)}`,
    );
  },
  async fetchMetaAds(connection: IntegrationConnection, dateFrom?: Date, dateTo?: Date) {
    const token = decrypt(connection.accessTokenCiphertext);
    if (!token || !connection.externalAccountId)
      throw new IntegrationProviderError(
        'Meta Ads credentials are incomplete',
        'CONFIGURATION',
        false,
      );
    const range =
      dateFrom && dateTo
        ? `&time_range=${encodeURIComponent(JSON.stringify({ since: dateFrom.toISOString().slice(0, 10), until: dateTo.toISOString().slice(0, 10) }))}`
        : '';
    return jsonRequest<{ data: Array<Record<string, unknown>> }>(
      `${metaBase()}/act_${connection.externalAccountId.replace(/^act_/, '')}/insights?level=ad&time_increment=1&fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks,actions,date_start,date_stop${range}&limit=500&access_token=${encodeURIComponent(token)}`,
    );
  },
  async fetchGoogleAds(connection: IntegrationConnection, dateFrom?: Date, dateTo?: Date) {
    const where =
      dateFrom && dateTo
        ? ` WHERE segments.date BETWEEN '${dateFrom.toISOString().slice(0, 10)}' AND '${dateTo.toISOString().slice(0, 10)}'`
        : '';
    return googleRequest<Array<{ results?: Array<Record<string, unknown>> }>>(
      connection,
      `customers/${connection.externalAccountId}/googleAds:searchStream`,
      {
        query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ad_group.id, ad_group.name, ad_group_ad.ad.id, segments.date, segments.device, segments.ad_network_type, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM ad_group_ad${where}`,
      },
    );
  },
  async sendMetaConversion(
    connection: IntegrationConnection,
    input: {
      eventName: string;
      eventId: string;
      eventTime: Date;
      phone?: string;
      email?: string;
      consentGranted: boolean;
    },
  ) {
    if (!input.consentGranted)
      throw new IntegrationProviderError(
        'Conversion suppressed because consent is not active',
        'CONSENT_REQUIRED',
        false,
      );
    const token = decrypt(connection.accessTokenCiphertext);
    const datasetId = connection.externalAccountId;
    if (!token || !datasetId)
      throw new IntegrationProviderError(
        'Meta conversion dataset configuration is incomplete',
        'CONFIGURATION',
        false,
      );
    const sha = (value?: string) =>
      value
        ? crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
        : undefined;
    const user_data = { ph: sha(input.phone?.replace(/\D/g, '')), em: sha(input.email) };
    return jsonRequest(
      `${metaBase()}/${datasetId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data: [
            {
              event_name: input.eventName,
              event_time: Math.floor(input.eventTime.getTime() / 1000),
              event_id: input.eventId,
              action_source: 'system_generated',
              user_data,
            },
          ],
        }),
      },
    );
  },
  async sendGoogleConversion(
    connection: IntegrationConnection,
    input: {
      conversionAction: string;
      gclid?: string;
      gbraid?: string;
      wbraid?: string;
      conversionDateTime: Date;
      value?: number;
      currency: string;
      transactionId?: string;
    },
  ) {
    if (!connection.externalAccountId)
      throw new IntegrationProviderError('Google customer ID is missing', 'CUSTOMER_ID', false);
    return googleRequest(
      connection,
      `customers/${connection.externalAccountId}:uploadClickConversions`,
      {
        partialFailure: true,
        conversions: [
          {
            conversionAction: input.conversionAction,
            gclid: input.gclid,
            gbraid: input.gbraid,
            wbraid: input.wbraid,
            conversionDateTime: input.conversionDateTime
              .toISOString()
              .replace('T', ' ')
              .replace('Z', '+00:00'),
            conversionValue: input.value,
            currencyCode: input.currency,
            orderId: input.transactionId,
          },
        ],
      },
    );
  },
  decryptVerifyToken(connection: IntegrationConnection) {
    return decrypt(connection.verifyTokenCiphertext);
  },
  decryptAppSecret(connection: IntegrationConnection) {
    return decrypt(connection.appSecretCiphertext) ?? decrypt(connection.clientSecretCiphertext);
  },
  async exchangeGoogleAuthorizationCode(
    connection: IntegrationConnection,
    code: string,
    redirectUri: string,
  ) {
    const configuration =
      connection.configuration &&
      typeof connection.configuration === 'object' &&
      !Array.isArray(connection.configuration)
        ? (connection.configuration as Record<string, unknown>)
        : {};
    const clientId = String(configuration.clientId ?? '');
    const clientSecret = decrypt(connection.clientSecretCiphertext);
    if (!clientId || !clientSecret)
      throw new IntegrationProviderError(
        'Google OAuth client credentials are incomplete',
        'OAUTH_CONFIGURATION',
        false,
      );
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    return jsonRequest<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    }>(env.GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
  },
};
