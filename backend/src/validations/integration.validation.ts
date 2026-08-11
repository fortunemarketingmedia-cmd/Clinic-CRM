import { AutomationTrigger, IntegrationProvider, MarketingCampaignStatus } from '@prisma/client';
import { z } from 'zod';

const integrationConnectionObjectSchema = z.object({
  provider: z.nativeEnum(IntegrationProvider),
  name: z.string().trim().min(2),
  externalAccountId: z.string().trim().optional(),
  managerAccountId: z.string().trim().optional(),
  branchId: z.string().optional(),
  accessToken: z.string().min(8).optional(),
  refreshToken: z.string().min(8).optional(),
  clientSecret: z.string().min(8).optional(),
  developerToken: z.string().min(8).optional(),
  appSecret: z.string().min(8).optional(),
  verifyToken: z.string().min(8).optional(),
  tokenExpiresAt: z.coerce.date().optional(),
  scopes: z.array(z.string()).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
});
export const integrationConnectionSchema = integrationConnectionObjectSchema.refine(
  (value) =>
    value.accessToken ||
    value.refreshToken ||
    (value.provider.toString().startsWith('GOOGLE') &&
      value.clientSecret &&
      value.configuration?.clientId),
  'Meta requires an access token; Google requires OAuth client credentials',
);
export const integrationConnectionUpdateSchema = integrationConnectionObjectSchema.partial();
export const integrationQuerySchema = z.object({
  provider: z.nativeEnum(IntegrationProvider).optional(),
  branchId: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().optional(),
});
export const fieldMappingSchema = z.object({
  connectionId: z.string(),
  externalFormId: z.string().min(1),
  externalFormName: z.string().optional(),
  branchId: z.string().optional(),
  ownerId: z.string().optional(),
  mapping: z.record(z.string(), z.string()),
  defaults: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().default(true),
});
export const syncSchema = z.object({
  type: z.enum(['MANUAL', 'RECONCILIATION', 'BACKFILL', 'ADS_REPORTING', 'TOKEN_CHECK']),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export const campaignSchema = z.object({
  connectionId: z.string().optional(),
  externalCampaignId: z.string().optional(),
  platform: z.enum(['META', 'GOOGLE']),
  name: z.string().trim().min(2),
  objective: z.string().optional(),
  status: z.nativeEnum(MarketingCampaignStatus).default('DRAFT'),
  branchId: z.string().optional(),
  ownerId: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  audience: z.record(z.string(), z.unknown()).optional(),
});
export const conversionEventSchema = z.object({
  connectionId: z.string(),
  platform: z.enum(['META', 'GOOGLE']),
  eventType: z.enum([
    'LEAD_CREATED',
    'LEAD_CONTACTED',
    'QUALIFIED_LEAD',
    'APPOINTMENT_BOOKED',
    'PATIENT_ARRIVED',
    'LEAD_CONVERTED',
  ]),
  eventId: z.string().min(3),
  personId: z.string().optional(),
  leadId: z.string().optional(),
  campaignId: z.string().optional(),
  eventTime: z.coerce.date(),
  conversionAction: z.string().optional(),
  transactionId: z.string().optional(),
  value: z.coerce.number().optional(),
  currency: z.string().length(3).default('INR'),
  gclid: z.string().optional(),
  gbraid: z.string().optional(),
  wbraid: z.string().optional(),
  consentGranted: z.boolean(),
});

const automationAction = z.object({
  type: z.enum([
    'ASSIGN_OWNER',
    'CREATE_TASK',
    'UPDATE_FIELD',
    'CHANGE_STAGE',
    'NOTIFY_ADMIN',
    'TRIGGER_WEBHOOK',
    'SEND_CONVERSION_EVENT',
    'ADD_TAG',
    'REMOVE_TAG',
  ]),
  config: z.record(z.string(), z.unknown()).default({}),
  delayMinutes: z.coerce.number().int().min(0).default(0),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'EXISTS', 'GT', 'LT']),
        value: z.unknown().optional(),
      }),
    )
    .optional(),
});
export const automationSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().optional(),
  trigger: z.nativeEnum(AutomationTrigger),
  branchId: z.string().optional(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'EXISTS', 'GT', 'LT']),
        value: z.unknown().optional(),
      }),
    )
    .optional(),
  workflow: z.array(automationAction).min(1),
  stopConditions: z.array(z.string()).optional(),
  active: z.boolean().default(false),
  testMode: z.boolean().default(true),
});
export const automationUpdateSchema = automationSchema.partial();
export const automationTestSchema = z.object({
  referenceType: z.enum(['Lead', 'Appointment', 'Patient']),
  referenceId: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});
export const reportQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  campaignId: z.string().optional(),
});
