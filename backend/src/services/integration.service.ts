import crypto from 'node:crypto';
import type { IntegrationProvider, Prisma, Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { integrationRepository } from '../repositories/integration.repository.js';
import { HttpError } from '../utils/http-error.js';
import { encryptIntegrationSecret } from '../utils/integration-crypto.js';
import type { AuditContext } from './audit.service.js';
import { auditService } from './audit.service.js';
import { adLeadService } from './ad-lead.service.js';
import { integrationProviderService } from './integration-provider.service.js';
import { whatsappService } from './whatsapp.service.js';

type ConnectionInput = {
  provider: IntegrationProvider;
  name: string;
  externalAccountId?: string;
  managerAccountId?: string;
  branchId?: string;
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  developerToken?: string;
  appSecret?: string;
  verifyToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string[];
  configuration?: Record<string, unknown>;
};

type Actor = { id: string; role: Role };
const secretFields = [
  'accessTokenCiphertext',
  'refreshTokenCiphertext',
  'clientSecretCiphertext',
  'developerTokenCiphertext',
  'appSecretCiphertext',
  'verifyTokenCiphertext',
];
const providerPlatform = (provider: IntegrationProvider) =>
  provider.toString().startsWith('GOOGLE') ? ('GOOGLE' as const) : ('META' as const);
const jsonObject = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const number = (value: unknown) => Number(value ?? 0) || 0;
const integer = (value: unknown) => Math.round(number(value));

function requireAdmin(actor: Actor) {
  if (actor.role !== 'ADMIN') throw new HttpError(403, 'Administrator access is required');
}
function sanitize<T extends object>(connection: T) {
  const copy = { ...connection } as Record<string, unknown>;
  for (const field of secretFields) delete copy[field];
  return copy;
}
function encrypted(input: ConnectionInput) {
  const key = integrationProviderService.encryptionKey();
  const cipher = (value?: string) => (value ? encryptIntegrationSecret(value, key) : undefined);
  return {
    accessTokenCiphertext: cipher(input.accessToken),
    refreshTokenCiphertext: cipher(input.refreshToken),
    clientSecretCiphertext: cipher(input.clientSecret),
    developerTokenCiphertext: cipher(input.developerToken),
    appSecretCiphertext: cipher(input.appSecret),
    verifyTokenCiphertext: cipher(input.verifyToken),
  };
}
function eventHash(raw: Buffer) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function mapLeadFields(
  payload: Record<string, unknown>,
  mapping: Record<string, unknown>,
  defaults: Record<string, unknown>,
) {
  const source: Record<string, unknown> = {};
  const fieldData = Array.isArray(payload.field_data) ? payload.field_data : [];
  for (const item of fieldData) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as { name?: unknown; values?: unknown };
    source[String(entry.name ?? '')] = Array.isArray(entry.values) ? entry.values[0] : entry.values;
  }
  Object.assign(
    source,
    payload.fields && typeof payload.fields === 'object' ? payload.fields : {},
    payload,
  );
  const output: Record<string, unknown> = { ...defaults };
  for (const [externalName, crmName] of Object.entries(mapping))
    if (typeof crmName === 'string' && source[externalName] !== undefined)
      output[crmName] = source[externalName];
  return output;
}
function webhookLeadDescriptor(payload: Record<string, unknown>) {
  const entry = Array.isArray(payload.entry)
    ? (payload.entry[0] as Record<string, unknown> | undefined)
    : undefined;
  const change =
    entry && Array.isArray(entry.changes)
      ? (entry.changes[0] as Record<string, unknown> | undefined)
      : undefined;
  const value =
    change && typeof change.value === 'object'
      ? (change.value as Record<string, unknown>)
      : payload;
  return {
    externalLeadId: String(
      value.leadgen_id ?? value.lead_id ?? payload.lead_id ?? payload.id ?? '',
    ),
    formId: String(value.form_id ?? payload.form_id ?? ''),
    value,
  };
}

export const integrationService = {
  async listConnections(
    actor: Actor,
    filters: { provider?: IntegrationProvider; branchId?: string; status?: string },
  ) {
    if (actor.role === 'RECEPTIONIST' && !filters.branchId)
      throw new HttpError(400, 'Receptionist requests must include a branchId');
    const rows = await integrationRepository.listConnections({
      provider: filters.provider,
      branchId: filters.branchId,
      status: filters.status as never,
    });
    return rows.map(sanitize);
  },
  async createConnection(input: ConnectionInput, actor: Actor, audit: AuditContext) {
    requireAdmin(actor);
    const row = await integrationRepository.createConnection({
      provider: input.provider,
      name: input.name,
      externalAccountId: input.externalAccountId,
      managerAccountId: input.managerAccountId,
      branchId: input.branchId,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes as Prisma.InputJsonValue,
      configuration: input.configuration as Prisma.InputJsonValue,
      createdById: actor.id,
      ...encrypted(input),
    });
    if (
      input.provider.toString().startsWith('GOOGLE') &&
      !input.accessToken &&
      !input.refreshToken
    ) {
      await auditService.record(audit, {
        action: 'GOOGLE_OAUTH_CONFIGURATION_CREATED',
        entity: 'IntegrationConnection',
        entityId: row.id,
      });
      return sanitize(row);
    }
    try {
      await integrationProviderService.test(row);
      const connected = await integrationRepository.updateConnection(row.id, {
        status: 'CONNECTED',
        lastSuccessAt: new Date(),
        consecutiveFailures: 0,
      });
      await auditService.record(audit, {
        action: 'INTEGRATION_CONNECTED',
        entity: 'IntegrationConnection',
        entityId: row.id,
        newValue: { provider: row.provider, name: row.name },
      });
      return sanitize(connected);
    } catch (error) {
      await integrationRepository.updateConnection(row.id, {
        status: 'ERROR',
        lastFailureAt: new Date(),
        lastFailureReason: error instanceof Error ? error.message : 'Connection failed',
        consecutiveFailures: 1,
      });
      throw error;
    }
  },
  async updateConnection(
    id: string,
    input: Partial<ConnectionInput>,
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const existing = await integrationRepository.findConnection(id);
    if (!existing) throw new HttpError(404, 'Integration connection not found');
    const secrets = encrypted(input as ConnectionInput);
    Object.keys(secrets).forEach(
      (key) =>
        secrets[key as keyof typeof secrets] === undefined &&
        delete secrets[key as keyof typeof secrets],
    );
    const row = await integrationRepository.updateConnection(id, {
      name: input.name,
      externalAccountId: input.externalAccountId,
      managerAccountId: input.managerAccountId,
      branchId: input.branchId,
      tokenExpiresAt: input.tokenExpiresAt,
      scopes: input.scopes as Prisma.InputJsonValue,
      configuration: input.configuration as Prisma.InputJsonValue,
      ...secrets,
    });
    await auditService.record(audit, {
      action: 'INTEGRATION_UPDATED',
      entity: 'IntegrationConnection',
      entityId: id,
    });
    return sanitize(row);
  },
  async testConnection(id: string, actor: Actor, audit: AuditContext) {
    requireAdmin(actor);
    const connection = await integrationRepository.findConnection(id);
    if (!connection) throw new HttpError(404, 'Integration connection not found');
    try {
      const result = await integrationProviderService.test(connection);
      await integrationRepository.updateConnection(id, {
        status: 'CONNECTED',
        lastSuccessAt: new Date(),
        lastFailureReason: null,
        consecutiveFailures: 0,
      });
      await auditService.record(audit, {
        action: 'INTEGRATION_TEST_SUCCEEDED',
        entity: 'IntegrationConnection',
        entityId: id,
      });
      return result;
    } catch (error) {
      await integrationRepository.updateConnection(id, {
        status: 'ERROR',
        lastFailureAt: new Date(),
        lastFailureReason: error instanceof Error ? error.message : 'Test failed',
        consecutiveFailures: { increment: 1 },
      });
      throw error;
    }
  },
  async disconnect(id: string, actor: Actor, audit: AuditContext) {
    requireAdmin(actor);
    await integrationRepository.updateConnection(id, {
      status: 'DISCONNECTED',
      accessTokenCiphertext: null,
      refreshTokenCiphertext: null,
      clientSecretCiphertext: null,
      developerTokenCiphertext: null,
      appSecretCiphertext: null,
      verifyTokenCiphertext: null,
    });
    await auditService.record(audit, {
      action: 'INTEGRATION_DISCONNECTED',
      entity: 'IntegrationConnection',
      entityId: id,
    });
  },
  async googleOAuthUrl(id: string, actor: Actor) {
    requireAdmin(actor);
    const connection = await integrationRepository.findConnection(id);
    if (!connection || !connection.provider.toString().startsWith('GOOGLE'))
      throw new HttpError(404, 'Google integration connection not found');
    const configuration = jsonObject(connection.configuration);
    const clientId = String(configuration.clientId ?? '');
    if (!clientId) throw new HttpError(409, 'Google OAuth client ID is missing');
    const payload = Buffer.from(
      JSON.stringify({ connectionId: id, userId: actor.id, expiresAt: Date.now() + 10 * 60_000 }),
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(payload)
      .digest('base64url');
    const redirectUri = `${env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/api/integrations/google/oauth/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/adwords',
      state: `${payload}.${signature}`,
    });
    return { authorizationUrl: `${env.GOOGLE_OAUTH_AUTH_URL}?${params}`, expiresInSeconds: 600 };
  },
  async googleOAuthCallback(code: string, state: string) {
    const [payload, signature] = state.split('.');
    if (!payload || !signature) throw new HttpError(400, 'Invalid OAuth state');
    const expected = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET)
      .update(payload)
      .digest('base64url');
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      throw new HttpError(400, 'Invalid OAuth state');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      connectionId: string;
      userId: string;
      expiresAt: number;
    };
    if (decoded.expiresAt < Date.now()) throw new HttpError(400, 'OAuth state has expired');
    const connection = await integrationRepository.findConnection(decoded.connectionId);
    if (!connection) throw new HttpError(404, 'Integration connection not found');
    const redirectUri = `${env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/api/integrations/google/oauth/callback`;
    try {
      const tokens = await integrationProviderService.exchangeGoogleAuthorizationCode(
        connection,
        code,
        redirectUri,
      );
      await integrationRepository.updateConnection(connection.id, {
        accessTokenCiphertext: encryptIntegrationSecret(
          tokens.access_token,
          integrationProviderService.encryptionKey(),
        ),
        refreshTokenCiphertext: tokens.refresh_token
          ? encryptIntegrationSecret(
              tokens.refresh_token,
              integrationProviderService.encryptionKey(),
            )
          : connection.refreshTokenCiphertext,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: tokens.scope?.split(' '),
        status: 'CONNECTED',
        lastSuccessAt: new Date(),
        lastFailureReason: null,
        consecutiveFailures: 0,
      });
      await auditService.record(
        { userId: decoded.userId, correlationId: `google-oauth:${connection.id}` },
        {
          action: 'GOOGLE_OAUTH_CONNECTED',
          entity: 'IntegrationConnection',
          entityId: connection.id,
        },
      );
      return connection.id;
    } catch (error) {
      await integrationRepository.updateConnection(connection.id, {
        status: 'ERROR',
        lastFailureAt: new Date(),
        lastFailureReason: error instanceof Error ? error.message : 'OAuth failed',
        consecutiveFailures: { increment: 1 },
      });
      throw error;
    }
  },
  async saveMapping(
    input: {
      connectionId: string;
      externalFormId: string;
      externalFormName?: string;
      branchId?: string;
      ownerId?: string;
      mapping: Record<string, string>;
      defaults?: Record<string, unknown>;
      active: boolean;
    },
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const row = await integrationRepository.upsertMapping({
      ...input,
      mapping: input.mapping,
      defaults: input.defaults as Prisma.InputJsonValue,
    });
    await auditService.record(audit, {
      action: 'INTEGRATION_MAPPING_SAVED',
      entity: 'IntegrationFieldMapping',
      entityId: row.id,
    });
    return row;
  },
  listMappings(connectionId?: string) {
    return integrationRepository.listMappings(connectionId);
  },
  listEvents(connectionId?: string) {
    return integrationRepository.listEvents(connectionId);
  },
  listSyncRuns(connectionId?: string) {
    return integrationRepository.listSyncRuns(connectionId);
  },
  async verifyWebhook(id: string, mode?: string, token?: string, challenge?: string) {
    const connection = await integrationRepository.findConnection(id);
    if (
      !connection ||
      mode !== 'subscribe' ||
      token !== integrationProviderService.decryptVerifyToken(connection)
    )
      throw new HttpError(403, 'Webhook verification failed');
    await integrationRepository.updateConnection(id, { webhookVerifiedAt: new Date() });
    return challenge ?? '';
  },
  async receiveWebhook(id: string, raw: Buffer, body: unknown, signature?: string) {
    const connection = await integrationRepository.findConnection(id);
    if (!connection) throw new HttpError(404, 'Integration connection not found');
    const valid = integrationProviderService.verifySignature(
      raw,
      signature,
      integrationProviderService.decryptAppSecret(connection),
    );
    if (!valid) throw new HttpError(401, 'Invalid webhook signature');
    const hash = eventHash(raw);
    const duplicate = await integrationRepository.findEventByHash(hash);
    if (duplicate) return { accepted: true, duplicate: true, eventId: duplicate.id };
    const payload = body && typeof body === 'object' ? (body as Prisma.InputJsonObject) : {};
    const descriptor = webhookLeadDescriptor(payload as Record<string, unknown>);
    const event = await integrationRepository.createEvent({
      connectionId: id,
      providerEventId: descriptor.externalLeadId || undefined,
      eventHash: hash,
      eventType: 'LEAD',
      signature,
      signatureVerified: true,
      status: 'QUEUED',
      payload,
    });
    await integrationRepository.createJob({
      type: 'INTEGRATION_EVENT_PROCESS',
      idempotencyKey: `integration-event:${event.id}`,
      payload: { eventId: event.id },
      runAt: new Date(),
    });
    return { accepted: true, duplicate: false, eventId: event.id };
  },
  async processEvent(id: string) {
    const event = await integrationRepository.findEvent(id);
    if (!event || ['PROCESSED', 'DUPLICATE'].includes(event.status)) return;
    await integrationRepository.updateEvent(id, {
      status: 'PROCESSING',
      processingAttempts: { increment: 1 },
    });
    try {
      const original = jsonObject(event.payload);
      const descriptor = webhookLeadDescriptor(original);
      if (!descriptor.externalLeadId) throw new Error('Webhook does not contain a lead identifier');
      const platform = providerPlatform(event.connection.provider);
      const existing = await integrationRepository.findAdLead(platform, descriptor.externalLeadId);
      if (existing) {
        await integrationRepository.updateEvent(id, {
          status: 'DUPLICATE',
          leadId: existing.leadId,
          processedAt: new Date(),
        });
        return;
      }
      const full =
        platform === 'META'
          ? await integrationProviderService.retrieveMetaLead(
              event.connection,
              descriptor.externalLeadId,
            )
          : original;
      const formId = String(full.form_id ?? descriptor.formId);
      const mapping = await integrationRepository.findMapping(event.connectionId, formId);
      if (!mapping?.active)
        throw new Error(`No active field mapping exists for form ${formId || '(unknown)'}`);
      const mapped = mapLeadFields(full, jsonObject(mapping.mapping), jsonObject(mapping.defaults));
      const name = String(mapped.name ?? mapped.fullName ?? '').trim();
      const mobile = String(mapped.mobile ?? mapped.phone ?? '').trim();
      if (!name || !mobile) throw new Error('Mapped lead must include name and mobile');
      const adLead = await adLeadService.createAdLead({
        platform,
        externalLeadId: descriptor.externalLeadId,
        name,
        mobile,
        email: mapped.email ? String(mapped.email) : undefined,
        campaignId: String(full.campaign_id ?? mapped.campaignId ?? '') || undefined,
        campaignName: mapped.campaignName ? String(mapped.campaignName) : undefined,
        adSetId: String(full.adset_id ?? '') || undefined,
        adId: String(full.ad_id ?? '') || undefined,
        formId,
        formName: mapping.externalFormName ?? undefined,
        branchId: mapping.branchId ?? event.connection.branchId ?? undefined,
        rawPayload: full,
      });
      if (adLead.leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: adLead.leadId } });
        if (lead) {
          const assigned = mapping.ownerId ?? lead.ownerId ?? lead.createdById;
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              ownerId: assigned,
              interestedTreatment: mapped.interestedTreatment
                ? String(mapped.interestedTreatment)
                : undefined,
            },
          });
          await prisma.task.create({
            data: {
              title: 'Contact new advertising lead',
              description: `Follow up with ${name}`,
              type: 'LEAD_FOLLOW_UP',
              priority: 'HIGH',
              assignedUserId: assigned,
              branchId: lead.branchId,
              personId: lead.personId,
              leadId: lead.id,
              dueAt: new Date(Date.now() + 15 * 60_000),
              reminderAt: new Date(Date.now() + 10 * 60_000),
              automaticallyCreated: true,
              createdById: lead.createdById,
            },
          });
          await integrationRepository.createAttribution({
            personId: lead.personId,
            leadId: lead.id,
            branchId: lead.branchId,
            platform,
            touchType: 'LEAD_CAPTURE',
            source: platform === 'META' ? 'Meta Lead Ads' : 'Google Lead Form',
            campaignName: mapped.campaignName ? String(mapped.campaignName) : undefined,
            gclid: mapped.gclid ? String(mapped.gclid) : undefined,
            gbraid: mapped.gbraid ? String(mapped.gbraid) : undefined,
            wbraid: mapped.wbraid ? String(mapped.wbraid) : undefined,
            externalLeadId: descriptor.externalLeadId,
            occurredAt: full.created_time ? new Date(String(full.created_time)) : new Date(),
            metadata: { formId, connectionId: event.connectionId },
          });
          await whatsappService.scheduleReferenceAutomations(
            'LEAD_RECEIVED',
            'Lead',
            lead.id,
            lead.branchId,
          );
          await auditService.record(
            {
              userId: event.connection.createdById,
              branchId: lead.branchId,
              correlationId: `integration:${event.id}`,
            },
            {
              action: 'AD_LEAD_INGESTED',
              entity: 'Lead',
              entityId: lead.id,
              newValue: { platform, externalLeadId: descriptor.externalLeadId, formId },
            },
          );
          await this.trackFunnelEvent('LEAD_CREATED', lead.id, lead.id);
        }
      }
      await integrationRepository.updateEvent(id, {
        status: 'PROCESSED',
        leadId: adLead.leadId,
        processedAt: new Date(),
        failureReason: null,
      });
    } catch (error) {
      await integrationRepository.updateEvent(id, {
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Lead processing failed',
      });
      throw error;
    }
  },
  async startSync(
    connectionId: string,
    input: { type: string; dateFrom?: Date; dateTo?: Date },
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const connection = await integrationRepository.findConnection(connectionId);
    if (!connection) throw new HttpError(404, 'Integration connection not found');
    const run = await integrationRepository.createSyncRun({
      connectionId,
      type: input.type,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
    await integrationRepository.createJob({
      type: 'INTEGRATION_SYNC',
      idempotencyKey: `integration-sync:${run.id}`,
      payload: { syncRunId: run.id },
      runAt: new Date(),
    });
    await auditService.record(audit, {
      action: 'INTEGRATION_SYNC_QUEUED',
      entity: 'IntegrationSyncRun',
      entityId: run.id,
    });
    return run;
  },
  async processSync(id: string) {
    const run = await integrationRepository.findSyncRun(id);
    if (!run || run.status === 'COMPLETED') return;
    await integrationRepository.updateSyncRun(id, { status: 'RUNNING', startedAt: new Date() });
    try {
      if (run.type === 'TOKEN_CHECK') {
        await integrationProviderService.test(run.connection);
        await integrationRepository.updateConnection(run.connectionId, {
          status: 'CONNECTED',
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
        });
      } else if (run.connection.provider === 'META_LEAD_ADS') {
        let retrieved = 0;
        let duplicateCount = 0;
        let createdCount = 0;
        const failures: Array<{ formId: string; message: string }> = [];
        for (const mapping of run.connection.fieldMappings.filter((item) => item.active)) {
          try {
            const response = await integrationProviderService.fetchMetaFormLeads(
              run.connection,
              mapping.externalFormId,
            );
            retrieved += response.data.length;
            for (const lead of response.data) {
              const providerEventId = String(lead.id ?? '');
              if (!providerEventId) continue;
              if (await integrationRepository.findAdLead('META', providerEventId)) {
                duplicateCount += 1;
                continue;
              }
              const serialized = Buffer.from(JSON.stringify(lead));
              const hash = eventHash(serialized);
              if (await integrationRepository.findEventByHash(hash)) {
                duplicateCount += 1;
                continue;
              }
              const event = await integrationRepository.createEvent({
                connectionId: run.connectionId,
                providerEventId,
                eventHash: hash,
                eventType: 'LEAD_RECONCILIATION',
                signatureVerified: true,
                status: 'QUEUED',
                payload: lead as Prisma.InputJsonObject,
              });
              await integrationRepository.createJob({
                type: 'INTEGRATION_EVENT_PROCESS',
                idempotencyKey: `integration-event:${event.id}`,
                payload: { eventId: event.id },
                runAt: new Date(),
              });
              createdCount += 1;
            }
          } catch (error) {
            failures.push({
              formId: mapping.externalFormId,
              message: error instanceof Error ? error.message : 'Form retrieval failed',
            });
          }
        }
        const expectedCount = number(jsonObject(run.connection.configuration).expectedLeadCount);
        await integrationRepository.updateSyncRun(id, {
          retrievedCount: retrieved,
          createdCount,
          duplicateCount,
          failedCount: failures.length,
          expectedCount: expectedCount || undefined,
          missingCount: expectedCount ? Math.max(0, expectedCount - retrieved) : 0,
          details: { forms: run.connection.fieldMappings.length, failures },
        });
        if (failures.length && !retrieved)
          throw new Error('Meta lead reconciliation failed for every configured form');
      } else if (run.connection.provider === 'META_ADS_REPORTING') {
        const response = await integrationProviderService.fetchMetaAds(
          run.connection,
          run.dateFrom ?? undefined,
          run.dateTo ?? undefined,
        );
        let count = 0;
        for (const item of response.data) {
          const externalCampaignId = String(item.campaign_id ?? '');
          if (!externalCampaignId) continue;
          const campaign = await integrationRepository.upsertCampaign({
            connectionId: run.connectionId,
            externalCampaignId,
            platform: 'META',
            name: String(item.campaign_name ?? externalCampaignId),
            status: 'ACTIVE',
            branchId: run.connection.branchId,
            createdById: run.connection.createdById,
          });
          const actions = Array.isArray(item.actions)
            ? (item.actions as Array<Record<string, unknown>>)
            : [];
          const action = (type: string) =>
            number(actions.find((entry) => entry.action_type === type)?.value);
          await integrationRepository.upsertPerformance({
            campaignId: campaign.id,
            branchId: campaign.branchId,
            date: new Date(String(item.date_start)),
            externalAdSetId: String(item.adset_id ?? '') || undefined,
            adSetName: String(item.adset_name ?? '') || undefined,
            externalAdId: String(item.ad_id ?? '') || undefined,
            adName: String(item.ad_name ?? '') || undefined,
            spend: number(item.spend),
            impressions: integer(item.impressions),
            reach: integer(item.reach),
            clicks: integer(item.clicks),
            landingPageViews: integer(action('landing_page_view')),
            leads: integer(action('lead')),
            platformConversions: action('offsite_conversion'),
            rawMetrics: item as Prisma.InputJsonObject,
          });
          count += 1;
        }
        await integrationRepository.updateSyncRun(id, {
          retrievedCount: response.data.length,
          createdCount: count,
        });
      } else if (run.connection.provider === 'GOOGLE_ADS') {
        const streams = await integrationProviderService.fetchGoogleAds(
          run.connection,
          run.dateFrom ?? undefined,
          run.dateTo ?? undefined,
        );
        let count = 0;
        for (const stream of streams)
          for (const row of stream.results ?? []) {
            const campaignData = jsonObject(row.campaign as Prisma.JsonValue);
            const metrics = jsonObject(row.metrics as Prisma.JsonValue);
            const segments = jsonObject(row.segments as Prisma.JsonValue);
            const group = jsonObject(row.adGroup as Prisma.JsonValue);
            const adGroupAd = jsonObject(row.adGroupAd as Prisma.JsonValue);
            const ad = jsonObject(adGroupAd.ad as Prisma.JsonValue);
            const externalCampaignId = String(campaignData.id ?? '');
            if (!externalCampaignId) continue;
            const campaign = await integrationRepository.upsertCampaign({
              connectionId: run.connectionId,
              externalCampaignId,
              platform: 'GOOGLE',
              name: String(campaignData.name ?? externalCampaignId),
              status: String(campaignData.status) === 'ENABLED' ? 'ACTIVE' : 'PAUSED',
              branchId: run.connection.branchId,
              createdById: run.connection.createdById,
            });
            await integrationRepository.upsertPerformance({
              campaignId: campaign.id,
              branchId: campaign.branchId,
              date: new Date(String(segments.date)),
              externalAdSetId: String(group.id ?? '') || undefined,
              adSetName: String(group.name ?? '') || undefined,
              externalAdId: String(ad.id ?? '') || undefined,
              device: String(segments.device ?? '') || undefined,
              network: String(segments.adNetworkType ?? '') || undefined,
              spend: number(metrics.costMicros) / 1_000_000,
              impressions: integer(metrics.impressions),
              clicks: integer(metrics.clicks),
              platformConversions: number(metrics.conversions),
              rawMetrics: row as Prisma.InputJsonObject,
            });
            count += 1;
          }
        await integrationRepository.updateSyncRun(id, {
          retrievedCount: count,
          createdCount: count,
        });
      } else
        throw new Error(
          'This connection supports signed webhook ingestion; use reconciliation after configuring the provider lead export',
        );
      await integrationRepository.updateSyncRun(id, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      await integrationRepository.updateConnection(run.connectionId, {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
        status: 'CONNECTED',
        lastFailureReason: null,
        consecutiveFailures: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      await integrationRepository.updateSyncRun(id, {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      });
      await integrationRepository.updateConnection(run.connectionId, {
        status: 'DEGRADED',
        lastFailureAt: new Date(),
        lastFailureReason: message,
        consecutiveFailures: { increment: 1 },
      });
      throw error;
    }
  },
  async createCampaign(
    input: Prisma.MarketingCampaignUncheckedCreateInput,
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const row = await integrationRepository.upsertCampaign({ ...input, createdById: actor.id });
    await auditService.record(audit, {
      action: 'MARKETING_CAMPAIGN_SAVED',
      entity: 'MarketingCampaign',
      entityId: row.id,
    });
    return row;
  },
  listCampaigns(filters: { branchId?: string; platform?: 'META' | 'GOOGLE' }) {
    return integrationRepository.listCampaigns(filters);
  },
  async createConversion(
    input: {
      connectionId: string;
      platform: 'META' | 'GOOGLE';
      eventType: string;
      eventId: string;
      personId?: string;
      leadId?: string;
      campaignId?: string;
      eventTime: Date;
      conversionAction?: string;
      transactionId?: string;
      value?: number;
      currency: string;
      gclid?: string;
      gbraid?: string;
      wbraid?: string;
      consentGranted: boolean;
    },
    actor: Actor,
    audit: AuditContext,
  ) {
    requireAdmin(actor);
    const status = input.consentGranted ? 'QUEUED' : 'SUPPRESSED';
    const row = await integrationRepository.createConversion({
      ...input,
      idempotencyKey: `${input.platform}:${input.eventId}`,
      status,
    });
    if (input.consentGranted)
      await integrationRepository.createJob({
        type: 'CONVERSION_UPLOAD',
        idempotencyKey: `conversion:${row.id}`,
        payload: { conversionId: row.id },
        runAt: new Date(),
      });
    await auditService.record(audit, {
      action: input.consentGranted ? 'CONVERSION_QUEUED' : 'CONVERSION_SUPPRESSED',
      entity: 'ConversionEvent',
      entityId: row.id,
    });
    return row;
  },
  listConversions(connectionId?: string) {
    return integrationRepository.listConversions(connectionId);
  },
  async trackFunnelEvent(
    eventType:
      | 'LEAD_CREATED'
      | 'LEAD_CONTACTED'
      | 'QUALIFIED_LEAD'
      | 'APPOINTMENT_BOOKED'
      | 'PATIENT_ARRIVED'
      | 'LEAD_CONVERTED',
    leadId: string,
    referenceId: string,
  ) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { person: true, attributionTouches: { orderBy: { occurredAt: 'desc' }, take: 1 } },
    });
    if (!lead?.person) return [];
    const connections = await integrationRepository.listActiveConnections();
    const eligible = connections.filter((connection) =>
      ['META_CONVERSIONS', 'GOOGLE_OFFLINE_CONVERSIONS'].includes(connection.provider),
    );
    const created = [];
    for (const connection of eligible) {
      if (connection.branchId && connection.branchId !== lead.branchId) continue;
      const platform = providerPlatform(connection.provider);
      const touch = lead.attributionTouches[0];
      if (!touch || touch.platform !== platform) continue;
      const consentGranted = lead.person.marketingConsent;
      const eventId = `${eventType}:${referenceId}:${connection.id}`;
      const conversion = await integrationRepository.createConversion({
        connectionId: connection.id,
        platform,
        eventType,
        eventId,
        idempotencyKey: `${platform}:${eventId}`,
        personId: lead.personId,
        leadId,
        eventTime: new Date(),
        conversionAction: jsonObject(connection.configuration).conversionAction
          ? String(jsonObject(connection.configuration).conversionAction)
          : undefined,
        gclid: touch?.gclid,
        gbraid: touch?.gbraid,
        wbraid: touch?.wbraid,
        consentGranted,
        status: consentGranted ? 'QUEUED' : 'SUPPRESSED',
        failureReason: consentGranted ? undefined : 'Marketing consent is not active',
      });
      if (consentGranted)
        await integrationRepository.createJob({
          type: 'CONVERSION_UPLOAD',
          idempotencyKey: `conversion:${conversion.id}`,
          payload: { conversionId: conversion.id },
          runAt: new Date(),
        });
      created.push(conversion);
    }
    return created;
  },
  async uploadConversion(id: string) {
    const row = await integrationRepository.findConversion(id);
    if (!row || ['COMPLETED', 'SUPPRESSED'].includes(row.status)) return;
    if (!row.consentGranted) {
      await integrationRepository.updateConversion(id, {
        status: 'SUPPRESSED',
        failureReason: 'Consent is not active',
      });
      return;
    }
    try {
      await integrationRepository.updateConversion(id, { status: 'SUBMITTED' });
      const response =
        row.platform === 'META'
          ? await integrationProviderService.sendMetaConversion(row.connection, {
              eventName: row.eventType,
              eventId: row.eventId,
              eventTime: row.eventTime,
              phone: row.person?.primaryMobile,
              email: row.person?.email ?? undefined,
              consentGranted: true,
            })
          : await integrationProviderService.sendGoogleConversion(row.connection, {
              conversionAction: row.conversionAction ?? '',
              gclid: row.gclid ?? undefined,
              gbraid: row.gbraid ?? undefined,
              wbraid: row.wbraid ?? undefined,
              conversionDateTime: row.eventTime,
              value: row.value ? Number(row.value) : undefined,
              currency: row.currency,
              transactionId: row.transactionId ?? undefined,
            });
      await integrationRepository.updateConversion(id, {
        status: 'COMPLETED',
        providerResponse: response as Prisma.InputJsonValue,
        failureReason: null,
      });
    } catch (error) {
      await integrationRepository.updateConversion(id, {
        status: 'RETRY',
        retryCount: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + 60_000),
        failureReason: error instanceof Error ? error.message : 'Upload failed',
      });
      throw error;
    }
  },
};
