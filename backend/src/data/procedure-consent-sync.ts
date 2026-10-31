import type { PrismaClient } from '@prisma/client';
import { procedureConsentCatalog } from './procedure-consent-catalog.js';

// Publishes the procedure consent catalogue. Changed wording always creates a new template version so that
// previously signed records keep pointing at the exact text the patient signed.
export async function syncProcedureConsents(prisma: PrismaClient, createdById: string) {
  let created = 0;
  let updated = 0;
  for (const consent of procedureConsentCatalog) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.consentTemplate.findUnique({ where: { id: consent.id } });
      if (!existing) {
        const template = await tx.consentTemplate.create({ data: { ...consent, status: 'PUBLISHED', currentVersion: 1, createdById, publishedAt: new Date() } });
        await tx.consentTemplateVersion.create({ data: { templateId: template.id, version: 1, consentText: template.consentText, snapshot: { ...consent, language: template.language, version: 1 } } });
        created += 1;
        return;
      }

      const changed = existing.name !== consent.name || existing.consentText !== consent.consentText || existing.status !== 'PUBLISHED';
      if (!changed) return;
      const version = existing.currentVersion + 1;
      const template = await tx.consentTemplate.update({
        where: { id: existing.id },
        data: { name: consent.name, type: consent.type, consentText: consent.consentText, requiresGuardian: consent.requiresGuardian, requiresWitness: consent.requiresWitness, status: 'PUBLISHED', currentVersion: version, publishedAt: new Date() },
      });
      await tx.consentTemplateVersion.create({ data: { templateId: template.id, version, consentText: template.consentText, snapshot: { ...consent, language: template.language, version } } });
      updated += 1;
    });
  }
  return { created, updated, total: procedureConsentCatalog.length };
}
