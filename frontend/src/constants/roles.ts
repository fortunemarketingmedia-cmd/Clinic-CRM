export const roles = {
  admin: 'ADMIN',
  receptionist: 'RECEPTIONIST',
  organisationOwner: 'ORGANISATION_OWNER',
  clinicAdmin: 'CLINIC_ADMIN',
  branchManager: 'BRANCH_MANAGER',
  leadCounsellor: 'LEAD_COUNSELLOR',
  doctor: 'DOCTOR',
  therapist: 'THERAPIST',
  billingExecutive: 'BILLING_EXECUTIVE',
  inventoryManager: 'INVENTORY_MANAGER',
  marketingUser: 'MARKETING_USER',
  auditor: 'AUDITOR',
  supportExecutive: 'SUPPORT_EXECUTIVE',
} as const;

export type Role = (typeof roles)[keyof typeof roles];
