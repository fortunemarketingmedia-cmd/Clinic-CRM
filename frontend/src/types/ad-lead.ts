import type { Branch } from '@/types/branch';
import type { Lead } from '@/types/lead';

export type AdPlatform = 'GOOGLE' | 'META';

export type AdLead = {
  id: string;
  platform: AdPlatform;
  externalLeadId?: string | null;
  name: string;
  mobile: string;
  email?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  adSetId?: string | null;
  adSetName?: string | null;
  adId?: string | null;
  adName?: string | null;
  formId?: string | null;
  formName?: string | null;
  branchId?: string | null;
  leadId?: string | null;
  createdAt: string;
  branch?: Branch | null;
  lead?: Lead | null;
};
