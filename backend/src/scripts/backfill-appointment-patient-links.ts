import { prisma } from '../config/db.js';
import { normalizeMobile } from '../utils/identity.js';

const apply = process.argv.includes('--apply');

type SafeCandidate = {
  leadId: string;
  personId: string;
  patientId: string;
};

async function main() {
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      appointments: { some: { deletedAt: null } },
      patient: { is: null },
    },
    select: {
      id: true,
      mobile: true,
      personId: true,
      person: { select: { id: true, patient: { select: { id: true } } } },
      _count: { select: { appointments: { where: { deletedAt: null } } } },
    },
  });

  const alreadyResolvable = leads.filter((lead) => Boolean(lead.person?.patient)).length;
  const safeCandidates: SafeCandidate[] = [];
  let ambiguous = 0;
  let unresolved = 0;

  for (const lead of leads) {
    if (lead.person?.patient) continue;

    // Never move a lead away from an existing Person. That would be a merge decision.
    if (lead.personId) {
      unresolved += 1;
      continue;
    }

    const normalizedMobile = normalizeMobile(lead.mobile);
    if (!normalizedMobile) {
      unresolved += 1;
      continue;
    }

    const matches = await prisma.person.findMany({
      where: {
        recordStatus: { not: 'MERGED' },
        OR: [
          { normalizedMobile },
          { normalizedAlternateMobile: normalizedMobile },
        ],
        patient: { isNot: null },
      },
      select: { id: true, patient: { select: { id: true } } },
      take: 2,
    });

    if (matches.length !== 1 || !matches[0].patient) {
      if (matches.length > 1) ambiguous += 1;
      else unresolved += 1;
      continue;
    }

    safeCandidates.push({
      leadId: lead.id,
      personId: matches[0].id,
      patientId: matches[0].patient.id,
    });
  }

  let updated = 0;
  if (apply) {
    for (const candidate of safeCandidates) {
      const result = await prisma.lead.updateMany({
        where: { id: candidate.leadId, personId: null, deletedAt: null },
        data: { personId: candidate.personId },
      });
      updated += result.count;
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    leadsWithAppointmentsAndNoDirectPatient: leads.length,
    alreadyResolvableThroughPerson: alreadyResolvable,
    safeBackfillCandidates: safeCandidates.length,
    ambiguousSkipped: ambiguous,
    unresolvedSkipped: unresolved,
    updated,
    candidateIds: safeCandidates.slice(0, 100),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
