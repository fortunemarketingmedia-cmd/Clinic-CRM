import { PersonRecordStatus, PreferredChannel, Sex } from '@prisma/client';
import { z } from 'zod';

export const personFieldsSchema = z.object({
  fullName: z.string().min(2),
  primaryMobile: z.string().min(8),
  alternateMobile: z.string().min(8).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  sex: z.nativeEnum(Sex).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactMobile: z.string().optional(),
  guardianName: z.string().optional(),
  guardianMobile: z.string().optional(),
  guardianRelationship: z.string().optional(),
  preferredLanguage: z.string().optional(),
  preferredChannel: z.nativeEnum(PreferredChannel).optional(),
  preferredBranchId: z.string().optional(),
  marketingConsent: z.boolean().optional(),
  transactionalConsent: z.boolean().optional(),
  appointmentNotificationConsent: z.boolean().optional(),
  dataProcessingConsent: z.boolean().optional(),
});

export const personQuerySchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(PersonRecordStatus).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export const duplicatePersonQuerySchema = z.object({
  mobile: z.string().optional(),
  email: z.string().email().optional(),
}).refine((value) => Boolean(value.mobile || value.email), 'Mobile or email is required');

export const mergePersonSchema = z.object({ duplicatePersonId: z.string().min(1) });

