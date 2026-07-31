import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

function catalogId(prefix: string, name: string) {
  return `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)}`;
}

async function main() {
  const demoSeedIds = {
    patientIds: ['demo_client_vaishnavi', 'demo_client_rohit', 'demo_client_ananya', 'demo_client_sameer'],
    leadIds: ['demo_lead_vaishnavi', 'demo_lead_rohit', 'demo_lead_ananya', 'demo_lead_sameer'],
    appointmentIds: ['demo_appt_vaishnavi_checkup', 'demo_appt_rohit_hair', 'demo_appt_ananya_laser', 'demo_appt_sameer_review'],
    sessionIds: ['demo_session_vaishnavi_checkup', 'demo_session_rohit_hair', 'demo_session_ananya_laser', 'demo_session_sameer_review'],
  };

  await prisma.timelineEvent.deleteMany({ where: { type: 'CLIENT_DIRECTORY_SEED' } });
  await prisma.session.deleteMany({ where: { id: { in: demoSeedIds.sessionIds } } });
  await prisma.medicalProfile.deleteMany({ where: { patientId: { in: demoSeedIds.patientIds } } });
  await prisma.patient.deleteMany({ where: { id: { in: demoSeedIds.patientIds } } });
  await prisma.appointment.deleteMany({ where: { id: { in: demoSeedIds.appointmentIds } } });
  await prisma.lead.deleteMany({ where: { id: { in: demoSeedIds.leadIds } } });

  const sharanpurBranch = await prisma.branch.upsert({
    where: { name: 'Sharanpur Road' },
    update: {},
    create: {
      name: 'Sharanpur Road',
      address: 'Sharanpur Road, Nashik',
      phone: '+91-0000000000',
    },
  });

  const nashikRoadBranch = await prisma.branch.upsert({
    where: { name: 'Nashik Road' },
    update: {},
    create: {
      name: 'Nashik Road',
      address: 'Nashik Road, Nashik',
      phone: '+91-0000000000',
    },
  });

  const doctorPasswordHash = await bcrypt.hash('DrRevive@12345', 12);
  const receptionistPasswordHash = await bcrypt.hash('Reception@12345', 12);
  const developerPasswordHash = await bcrypt.hash('Developer@12345', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@reviveclinic.local' },
    update: { name: 'Dr. Revive', passwordHash: doctorPasswordHash, role: Role.ADMIN, accessLevel: 'ADMIN', status: 'ACTIVE' },
    create: {
      name: 'Dr. Revive',
      email: 'admin@reviveclinic.local',
      passwordHash: doctorPasswordHash,
      role: Role.ADMIN,
      accessLevel: 'ADMIN',
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { email: 'receptionist@reviveclinic.local' },
    update: { name: 'Receptionist', passwordHash: receptionistPasswordHash, role: Role.RECEPTIONIST, accessLevel: 'RECEPTIONIST', status: 'ACTIVE' },
    create: { name: 'Receptionist', email: 'receptionist@reviveclinic.local', passwordHash: receptionistPasswordHash, role: Role.RECEPTIONIST, accessLevel: 'RECEPTIONIST' },
  });

  // Hidden system-maintenance account. It is excluded from the clinic user list
  // and has access only to developer integration and diagnostic screens.
  const developer = await prisma.user.upsert({
    where: { email: 'developer@reviveclinic.local' },
    update: { name: 'Developer Team', passwordHash: developerPasswordHash, role: Role.DEVELOPER, accessLevel: 'DEVELOPER', status: 'ACTIVE' },
    create: { name: 'Developer Team', email: 'developer@reviveclinic.local', passwordHash: developerPasswordHash, role: Role.DEVELOPER, accessLevel: 'DEVELOPER' },
  });

  await Promise.all(
    [admin, receptionist, developer].flatMap((user) =>
      [sharanpurBranch.id, nashikRoadBranch.id].map((branchId, index) =>
        prisma.userBranch.upsert({
          where: { userId_branchId: { userId: user.id, branchId } },
          update: { isPrimary: index === 0 },
          create: { userId: user.id, branchId, isPrimary: index === 0 },
        }),
      ),
    ),
  );
  const defaultAutomations = [
    { name: 'New lead immediate follow-up', trigger: 'LEAD_CREATED' as const, workflow: [{ type: 'CREATE_TASK', delayMinutes: 0, config: { title: 'Contact new lead', dueMinutes: 15, priority: 'HIGH' } }] },
    { name: 'Missed appointment recovery', trigger: 'APPOINTMENT_MISSED' as const, workflow: [{ type: 'CREATE_TASK', delayMinutes: 5, config: { title: 'Contact missed appointment', dueMinutes: 30, priority: 'HIGH' } }, { type: 'SEND_WHATSAPP', delayMinutes: 0, config: { templatePurpose: 'MISSED_APPOINTMENT' } }] },
    { name: 'Consultation plan follow-up', trigger: 'CONSULTATION_COMPLETED' as const, workflow: [{ type: 'CREATE_TASK', delayMinutes: 1440, config: { title: 'Follow up after consultation', dueMinutes: 60 } }] },
    { name: 'Treatment plan follow-up', trigger: 'TREATMENT_PLAN_CREATED' as const, workflow: [{ type: 'CREATE_TASK', delayMinutes: 1440, config: { title: 'Discuss treatment plan', dueMinutes: 60 } }] },
  ];
  for (const definition of defaultAutomations) {
    const existing = await prisma.automationDefinition.findFirst({ where: { name: definition.name } });
    if (!existing) await prisma.automationDefinition.create({ data: { ...definition, workflow: definition.workflow, active: false, testMode: true, createdById: admin.id, description: 'Clinic-safe default. Review and test before activation.' } });
  }
  for (const user of [admin]) {
    for (const branchId of [sharanpurBranch.id, nashikRoadBranch.id]) {
      for (const weekday of [1, 2, 3, 4, 5, 6]) {
        await prisma.staffSchedule.upsert({
          where: { userId_branchId_weekday_startMinutes_endMinutes: { userId: user.id, branchId, weekday, startMinutes: 600, endMinutes: 1140 } },
          update: { active: true }, create: { userId: user.id, branchId, weekday, startMinutes: 600, endMinutes: 1140 },
        });
      }
    }
  }

  await prisma.clinicService.upsert({
    where: { id: 'service_consultation' },
    update: { durationMinutes: 30, bufferMinutes: 0, active: true },
    create: { id: 'service_consultation', name: 'Consultation', category: 'Consultation', durationMinutes: 30, bufferMinutes: 0 },
  });
  const rateCardServices = [
    { name: 'Skin Consultation', category: 'Consultation', durationMinutes: 30, bufferMinutes: 10, resourceType: 'CONSULTATION' as const },
    { name: 'Hair Consultation', category: 'Consultation', durationMinutes: 30, bufferMinutes: 10, resourceType: 'CONSULTATION' as const },
    { name: 'MNRF / CO2 Fractional', category: 'Acne Scar Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'PRP Face', category: 'Acne Scar Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Exosomes + Dermapen', category: 'Acne Scar Treatment', durationMinutes: 75, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Dermaroller Face', category: 'Acne Scar Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Dermapen Face', category: 'Acne Scar Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'PRP Hair', category: 'Hair Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Growth Factor (GFC)', category: 'Hair Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hair Threads', category: 'Hair Treatment', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Meso Therapy', category: 'Hair Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Voluma / Volift Filler', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Volbella Filler', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Skin Vive Booster', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Profhilo', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Botox', category: 'Skin Tightening Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Photo Facial', category: 'Skin Tightening Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU Lower Face', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU Lower Face & Neck', category: 'Skin Tightening Treatment', durationMinutes: 75, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU Eyes', category: 'Skin Tightening Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU Full Neck', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU Full Face', category: 'Skin Tightening Treatment', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU Arm', category: 'Skin Tightening Treatment', durationMinutes: 75, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Chemical Peel Face', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Chemical Peel Face & Neck', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Charcoal Facial', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Oxygeneo + Q Switch', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Oxygeneo Facial', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hydrafacial', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Skin Glow (Polishing + Peel + Mask)', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Q Switch Glow', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Tattoo Removal', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Deep Peel CO2 Fractional', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hand Peel + Polishing', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Underarms Peel', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Underarms Q Switch + Peel', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Bikini Peel', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Buttock Peel', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Half Back Peel + Polishing', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Full Back Peel + Polishing', category: 'Body Glow Treatment', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Half Legs Peel + Polishing', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Full Legs Peel + Polishing', category: 'Body Glow Treatment', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Glutathione IV Infusion', category: 'Glow Drip', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Reglow Drip', category: 'Glow Drip', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Ageless Drip', category: 'Glow Drip', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Corn Removal', category: 'Surgery', durationMinutes: 60, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Xanthelasma', category: 'Surgery', durationMinutes: 75, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'RF Ablation', category: 'Surgery', durationMinutes: 60, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Baby Ear Piercing', category: 'Surgery', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Adult Ear Piercing', category: 'Surgery', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Ear Lobe Repair', category: 'Surgery', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Nail Surgery Partial Nail Avulsion', category: 'Surgery', durationMinutes: 75, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Intralesional Injections', category: 'Surgery', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Microblading Eyebrow', category: 'Surgery', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Upper Lip', category: 'Laser Hair Reduction Face', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Side Locks', category: 'Laser Hair Reduction Face', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Forehead', category: 'Laser Hair Reduction Face', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Chin', category: 'Laser Hair Reduction Face', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Lower Face', category: 'Laser Hair Reduction Face', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Face', category: 'Laser Hair Reduction Face', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Beard Shaping', category: 'Laser Hair Reduction Face', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Ear Lobe', category: 'Laser Hair Reduction Face', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Mid Brow', category: 'Laser Hair Reduction Face', durationMinutes: 20, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Underarms', category: 'Laser Hair Reduction Body', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Hands', category: 'Laser Hair Reduction Body', durationMinutes: 75, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Half Hands', category: 'Laser Hair Reduction Body', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Legs', category: 'Laser Hair Reduction Body', durationMinutes: 90, bufferMinutes: 20, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Half Legs', category: 'Laser Hair Reduction Body', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Front', category: 'Laser Hair Reduction Body', durationMinutes: 75, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Half Chest', category: 'Laser Hair Reduction Body', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Back', category: 'Laser Hair Reduction Body', durationMinutes: 75, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Half Back', category: 'Laser Hair Reduction Body', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Abdomen', category: 'Laser Hair Reduction Body', durationMinutes: 45, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Mid Abdomen Line', category: 'Laser Hair Reduction Body', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Bikini', category: 'Laser Hair Reduction Body', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Bikini Line', category: 'Laser Hair Reduction Body', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Buttock', category: 'Laser Hair Reduction Body', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Periareola', category: 'Laser Hair Reduction Body', durationMinutes: 30, bufferMinutes: 10, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Body Five Parts', category: 'Laser Hair Reduction Body', durationMinutes: 150, bufferMinutes: 30, resourceType: 'TREATMENT_ROOM' as const },
  ].map((service) => ({ id: catalogId('service', service.name), ...service }));
  for (const service of rateCardServices) {
    await prisma.clinicService.upsert({ where: { id: service.id }, update: { ...service, active: true }, create: { ...service, active: true } });
  }

  const latestRateCardServices = [
    { name: 'MNRF (Microneedling RF) / Co2 Fractional', category: 'Acne Scar Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 6000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'PRP (Face)', category: 'Acne Scar Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Exosomes + Dermapen', category: 'Acne Scar Treatment', durationMinutes: 75, bufferMinutes: 15, basePrice: 7500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Dermaroller (Face)', category: 'Acne Scar Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Dermapen Face', category: 'Acne Scar Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'PRP (Hair)', category: 'Hair Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Growth Factor (GFC)', category: 'Hair Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 7000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hair Threads (onwards)', category: 'Hair Treatment', durationMinutes: 90, bufferMinutes: 20, basePrice: 20000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Meso Therapy', category: 'Hair Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 3000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Voluma / Volift (Filler) - 1 ML syringe', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 27000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Volbella (Filler) - 1 ML syringe', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 25000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Skin Vive (Skin Booster) - 1 ML', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 15000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Profilo - 2 syringes', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 60000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Botox - 1 unit', category: 'Skin Tightening Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 300, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Photo Facial', category: 'Skin Tightening Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 3500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU - Lower Face', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 15000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU - Lower Face and Neck', category: 'Skin Tightening Treatment', durationMinutes: 75, bufferMinutes: 15, basePrice: 20000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU - Eyes', category: 'Skin Tightening Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU - Full Neck', category: 'Skin Tightening Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 7000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU - Full Face', category: 'Skin Tightening Treatment', durationMinutes: 90, bufferMinutes: 20, basePrice: 20000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'HIFU - Arm', category: 'Skin Tightening Treatment', durationMinutes: 75, bufferMinutes: 15, basePrice: 15000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Chemical Peel Face', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Chemical Peel Face and Neck', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Charcoal Facial', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 4500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Oxygeneo + Q Switch', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 4500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Oxygeneo Facial', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 3500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hydrafacial', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 3500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Skin Glow - Polishing + Peel + Mask', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Q Switch Glow', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 3500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Tattoo (onwards)', category: 'Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 1200, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Deep Peel (Co2 Fractional)', category: 'Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hand Peel', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Hand Polishing', category: 'Body Glow Treatment', durationMinutes: 30, bufferMinutes: 10, basePrice: 1500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Underarms Peel', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Underarms Q Switch + Peel', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 3500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Bikini Peel', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Buttock Peel', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Half Back Peel', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 3000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Half Back Polishing', category: 'Body Glow Treatment', durationMinutes: 30, bufferMinutes: 10, basePrice: 1500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Full Back Peel', category: 'Body Glow Treatment', durationMinutes: 75, bufferMinutes: 15, basePrice: 6000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Full Back Polishing', category: 'Body Glow Treatment', durationMinutes: 45, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Half Legs Peel', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Half Legs Polishing', category: 'Body Glow Treatment', durationMinutes: 30, bufferMinutes: 10, basePrice: 1500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Full Legs Peel', category: 'Body Glow Treatment', durationMinutes: 75, bufferMinutes: 15, basePrice: 6000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Full Legs Polishing', category: 'Body Glow Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: 3000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Gluthathione IV Infusion - 4 vials', category: 'Glow Drip', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Reglow Drip', category: 'Glow Drip', durationMinutes: 60, bufferMinutes: 15, basePrice: 6500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Ageless Drip', category: 'Glow Drip', durationMinutes: 45, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Corn Removal (onwards)', category: 'Surgery', durationMinutes: 60, bufferMinutes: 20, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Xanthelasma - minimum rate', category: 'Surgery', durationMinutes: 75, bufferMinutes: 20, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Baby Ear Piercing', category: 'Surgery', durationMinutes: 45, bufferMinutes: 15, basePrice: 3000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Adult Ear Piercing', category: 'Surgery', durationMinutes: 45, bufferMinutes: 15, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Ear Lobe Repair - 1 ear', category: 'Surgery', durationMinutes: 60, bufferMinutes: 20, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Ear Lobe Repair - 2 ears', category: 'Surgery', durationMinutes: 90, bufferMinutes: 20, basePrice: 10000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Nail Surgery Partial Nail Avulsion - minimum rate', category: 'Surgery', durationMinutes: 75, bufferMinutes: 20, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Intralesional Injections (onwards)', category: 'Surgery', durationMinutes: 30, bufferMinutes: 10, basePrice: 1000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Microblading (Eyebrow) - minimum rate', category: 'Surgery', durationMinutes: 90, bufferMinutes: 20, basePrice: 8000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Upper Lip', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Side Locks', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Forhead', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Chin', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Lower Face', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 45, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Face', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 60, bufferMinutes: 15, basePrice: 6500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Beard Shaping', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 45, bufferMinutes: 15, basePrice: 3200, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Ear Lobe', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Mid Brow', category: 'Permanant Laser Hair Reduction (Face)', durationMinutes: 20, bufferMinutes: 10, basePrice: 1000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Underams', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2500, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Hands (Full)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 75, bufferMinutes: 15, basePrice: 7000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Hands (Half)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Legs (Full)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 90, bufferMinutes: 20, basePrice: 9000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Legs (Half)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Full Front', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 75, bufferMinutes: 15, basePrice: 8000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Chest (Half)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 45, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Back (Full)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 75, bufferMinutes: 15, basePrice: 8000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Back (Half)', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 45, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Abdomen', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 45, bufferMinutes: 15, basePrice: 4000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Mid Abdomen Line', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Bikini', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Bikini Line', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Buttock', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 60, bufferMinutes: 15, basePrice: 5000, resourceType: 'TREATMENT_ROOM' as const },
    { name: 'Laser Hair Reduction - Periareola', category: 'Permanant Laser Hair Reduction (Body)', durationMinutes: 30, bufferMinutes: 10, basePrice: 2000, resourceType: 'TREATMENT_ROOM' as const },
  ].map((service) => ({ id: catalogId('service', service.name), ...service }));
  await prisma.clinicService.updateMany({
    where: { id: { notIn: ['service_consultation', ...latestRateCardServices.map((service) => service.id)] } },
    data: { active: false },
  });
  for (const service of latestRateCardServices) {
    await prisma.clinicService.upsert({
      where: { id: service.id },
      update: { ...service, active: true },
      create: { ...service, active: true },
    });
  }

  const inventoryProducts = [
    { id: 'product_gloves_nitrile', sku: 'CON-NG-M', name: 'Nitrile Examination Gloves — M', category: 'Clinical Consumables', brand: 'Generic', unit: 'pair', type: 'CONSUMABLE' as const, taxPercent: 18, purchasePrice: 12, sellingPrice: 0, reorderLevel: 50 },
    { id: 'product_gauze_4x4', sku: 'CON-GZ-4X4', name: 'Sterile Gauze 4×4', category: 'Clinical Consumables', brand: 'Generic', unit: 'piece', type: 'DISPOSABLE' as const, taxPercent: 12, purchasePrice: 4, sellingPrice: 0, reorderLevel: 100 },
    { id: 'product_salicylic_peel', sku: 'CON-SP-30', name: 'Salicylic Peel 30%', category: 'Procedure Supplies', brand: 'Clinic Grade', unit: 'ml', type: 'CONSUMABLE' as const, taxPercent: 18, purchasePrice: 40, sellingPrice: 0, reorderLevel: 100 },
    { id: 'product_sunscreen_retail', sku: 'RTL-SPF50', name: 'Broad Spectrum Sunscreen SPF 50', category: 'Retail Skincare', brand: 'Revive Care', unit: 'tube', type: 'RETAIL_PRODUCT' as const, taxPercent: 18, purchasePrice: 450, sellingPrice: 799, reorderLevel: 10 },
  ];
  for (const product of inventoryProducts) await prisma.product.upsert({ where: { id: product.id }, update: { ...product, active: true }, create: { ...product, active: true } });
  await prisma.vendor.upsert({ where: { name: 'Revive Clinical Supplies Demo' }, update: { active: true }, create: { name: 'Revive Clinical Supplies Demo', contactPerson: 'Configure before use', paymentTerms: '30 days', productCategories: ['Clinical Consumables', 'Procedure Supplies'], active: true } });
  await prisma.clinicService.upsert({
    where: { id: 'service_treatment_session' },
    update: { durationMinutes: 60, bufferMinutes: 15, basePrice: null, active: false },
    create: { id: 'service_treatment_session', name: 'Treatment Session', category: 'Treatment', durationMinutes: 60, bufferMinutes: 15, basePrice: null, resourceType: 'TREATMENT_ROOM', active: false },
  });
  for (const productId of ['product_gloves_nitrile', 'product_gauze_4x4']) await prisma.procedureConsumableConfig.upsert({ where: { serviceId_productId: { serviceId: 'service_treatment_session', productId } }, update: { quantity: productId === 'product_gloves_nitrile' ? 1 : 2, requiresConfirmation: true, active: true }, create: { serviceId: 'service_treatment_session', productId, quantity: productId === 'product_gloves_nitrile' ? 1 : 2, requiresConfirmation: true, active: true } });

  for (const branch of [sharanpurBranch, nashikRoadBranch]) {
    for (const roomNumber of [1, 2, 3, 4]) {
      await prisma.clinicResource.upsert({
        where: { branchId_name: { branchId: branch.id, name: `Treatment Room ${roomNumber}` } },
        update: { active: true },
        create: { branchId: branch.id, name: `Treatment Room ${roomNumber}`, type: 'ROOM' },
      });
    }
    await prisma.clinicResource.upsert({
      where: { branchId_name: { branchId: branch.id, name: 'Laser Device 1' } },
      update: { active: true, serialNumber: 'CONFIGURE-BEFORE-USE' },
      create: { branchId: branch.id, name: 'Laser Device 1', type: 'EQUIPMENT', serialNumber: 'CONFIGURE-BEFORE-USE' },
    });
  }

  const templates = [
    { id: 'clinical_template_soap', name: 'SOAP Note', key: 'soap-note', category: 'ENCOUNTER', schema: { sections: ['subjective', 'objective', 'assessment', 'plan'] } },
    { id: 'clinical_template_dermatology', name: 'Dermatology Consultation', key: 'dermatology-consultation', category: 'ENCOUNTER', schema: { sections: ['chiefComplaint', 'history', 'skinExamination', 'assessment', 'diagnosis', 'plan'] } },
    { id: 'clinical_template_laser', name: 'Laser Procedure', key: 'laser-procedure', category: 'PROCEDURE', schema: { parameters: ['device', 'handpiece', 'mode', 'spotSize', 'energy', 'fluence', 'pulseWidth', 'frequency', 'passes', 'coolingMethod', 'testPatchResult'] } },
  ];
  for (const template of templates) await prisma.clinicalTemplate.upsert({ where: { id: template.id }, update: { ...template, active: true }, create: { ...template, active: true } });

  const medicines = [
    { name: 'Cetirizine', genericName: 'Cetirizine', strength: '10 mg', form: 'Tablet' },
    { name: 'Levocetirizine', genericName: 'Levocetirizine', strength: '5 mg', form: 'Tablet' },
    { name: 'Doxycycline', genericName: 'Doxycycline', strength: '100 mg', form: 'Capsule' },
    { name: 'Azithromycin', genericName: 'Azithromycin', strength: '500 mg', form: 'Tablet' },
    { name: 'Amoxicillin + Clavulanate', genericName: 'Amoxicillin clavulanate', strength: '625 mg', form: 'Tablet' },
    { name: 'Isotretinoin', genericName: 'Isotretinoin', strength: '10 mg', form: 'Capsule' },
    { name: 'Isotretinoin', genericName: 'Isotretinoin', strength: '20 mg', form: 'Capsule' },
    { name: 'Tretinoin', genericName: 'Tretinoin', strength: '0.025%', form: 'Cream' },
    { name: 'Adapalene', genericName: 'Adapalene', strength: '0.1%', form: 'Gel' },
    { name: 'Clindamycin', genericName: 'Clindamycin', strength: '1%', form: 'Gel' },
    { name: 'Benzoyl Peroxide', genericName: 'Benzoyl Peroxide', strength: '2.5%', form: 'Gel' },
    { name: 'Benzoyl Peroxide', genericName: 'Benzoyl Peroxide', strength: '5%', form: 'Gel' },
    { name: 'Kojic Acid + Vitamin C', genericName: 'Kojic Acid Combination', strength: 'As directed', form: 'Cream' },
    { name: 'Hydroquinone', genericName: 'Hydroquinone', strength: '2%', form: 'Cream' },
    { name: 'Mometasone', genericName: 'Mometasone', strength: '0.1%', form: 'Cream' },
    { name: 'Fusidic Acid', genericName: 'Fusidic Acid', strength: '2%', form: 'Cream' },
    { name: 'Mupirocin', genericName: 'Mupirocin', strength: '2%', form: 'Ointment' },
    { name: 'Ketoconazole', genericName: 'Ketoconazole', strength: '2%', form: 'Shampoo' },
    { name: 'Minoxidil', genericName: 'Minoxidil', strength: '5%', form: 'Solution' },
    { name: 'Finasteride', genericName: 'Finasteride', strength: '1 mg', form: 'Tablet' },
    { name: 'Biotin', genericName: 'Biotin', strength: '10 mg', form: 'Tablet' },
    { name: 'Vitamin D3', genericName: 'Cholecalciferol', strength: '60000 IU', form: 'Sachet' },
    { name: 'Iron + Folic Acid', genericName: 'Iron folic acid', strength: 'As directed', form: 'Tablet' },
    { name: 'Sunscreen SPF 50', genericName: 'Broad spectrum sunscreen', strength: 'SPF 50', form: 'Gel/Cream' },
    { name: 'Moisturizer', genericName: 'Barrier repair moisturizer', strength: 'As directed', form: 'Cream' },
  ].map((medicine) => ({ id: catalogId('medicine', `${medicine.name}_${medicine.strength}_${medicine.form}`), ...medicine }));
  for (const medicine of medicines) await prisma.medicine.upsert({ where: { name_strength: { name: medicine.name, strength: medicine.strength } }, update: { ...medicine, status: 'ACTIVE' }, create: { ...medicine, status: 'ACTIVE' } });

  const registrationForm = await prisma.formTemplate.upsert({
    where: { id: 'form_patient_registration' },
    update: { status: 'PUBLISHED', currentVersion: 1 },
    create: { id: 'form_patient_registration', key: 'patient-registration', name: 'Patient Registration & Medical Intake', type: 'PATIENT_REGISTRATION', description: 'Versioned replacement for the QR registration intake.', status: 'PUBLISHED', currentVersion: 1, createdById: admin.id, publishedAt: new Date() },
  });
  const registrationFields = [
    { id: 'field_registration_name', key: 'fullName', label: 'Full name', type: 'TEXT' as const, required: true, sortOrder: 10 },
    { id: 'field_registration_mobile', key: 'mobile', label: 'Mobile number', type: 'TEXT' as const, required: true, sortOrder: 20 },
    { id: 'field_registration_email', key: 'email', label: 'Email', type: 'TEXT' as const, required: false, sortOrder: 30 },
    { id: 'field_registration_age', key: 'age', label: 'Age', type: 'NUMBER' as const, required: false, sortOrder: 40 },
    { id: 'field_registration_dob', key: 'dateOfBirth', label: 'Date of birth', type: 'DATE' as const, required: false, sortOrder: 50 },
    { id: 'field_registration_sex', key: 'sex', label: 'Sex', type: 'DROPDOWN' as const, required: false, options: ['MALE', 'FEMALE', 'OTHER'], sortOrder: 60 },
    { id: 'field_registration_address', key: 'address', label: 'Address', type: 'TEXT' as const, required: false, sortOrder: 70 },
    { id: 'field_registration_marital', key: 'maritalStatus', label: 'Marital status', type: 'DROPDOWN' as const, required: false, options: ['Single', 'Married', 'Separated', 'Divorced', 'Widowed', 'Prefer not to say'], sortOrder: 80 },
    { id: 'field_registration_occupation', key: 'occupation', label: 'Occupation', type: 'TEXT' as const, required: false, sortOrder: 90 },
    { id: 'field_registration_referred', key: 'referredBy', label: 'Referred by', type: 'TEXT' as const, required: false, sortOrder: 100 },
    { id: 'field_registration_skin', key: 'skinConcern', label: 'Skin concern', type: 'TEXT' as const, required: false, sortOrder: 110 },
    { id: 'field_registration_hair', key: 'hairConcern', label: 'Hair concern', type: 'TEXT' as const, required: false, sortOrder: 120 },
    { id: 'field_registration_medical', key: 'medicalHistory', label: 'Medical history', type: 'TEXT' as const, required: false, sortOrder: 130 },
    { id: 'field_registration_medications', key: 'currentMedications', label: 'Current medications', type: 'TEXT' as const, required: false, sortOrder: 140 },
    { id: 'field_registration_allergy', key: 'allergyToDrugs', label: 'Drug allergies', type: 'TEXT' as const, required: false, sortOrder: 150 },
    { id: 'field_registration_scar', key: 'keloidOrHypertrophicScar', label: 'Keloid or hypertrophic scar history', type: 'DROPDOWN' as const, required: false, options: ['No known history', 'Yes', 'Unsure'], sortOrder: 160 },
    { id: 'field_registration_products', key: 'productsCurrentlyUsed', label: 'Products currently used', type: 'TEXT' as const, required: false, sortOrder: 170 },
    { id: 'field_registration_menstrual', key: 'menstrualHistory', label: 'Menstrual history', type: 'DROPDOWN' as const, required: false, options: ['Not applicable', 'Regular', 'Irregular', 'Post-menopausal', 'Prefer not to say'], sortOrder: 180 },
    { id: 'field_registration_pregnancy', key: 'pregnancyStatus', label: 'Pregnancy status', type: 'DROPDOWN' as const, required: false, options: ['Not applicable', 'Not pregnant', 'Pregnant', 'Breastfeeding', 'Planning pregnancy', 'Unsure', 'Prefer not to say'], sortOrder: 190 },
    { id: 'field_registration_notes', key: 'notes', label: 'Other notes', type: 'TEXT' as const, required: false, sortOrder: 200 },
    { id: 'field_registration_declaration', key: 'declaration', label: 'I confirm this information is accurate.', type: 'DECLARATION' as const, required: true, sortOrder: 210 },
  ];
  for (const field of registrationFields) await prisma.formField.upsert({ where: { id: field.id }, update: field, create: { ...field, templateId: registrationForm.id } });
  await prisma.formTemplateVersion.upsert({ where: { templateId_version: { templateId: registrationForm.id, version: 1 } }, update: {}, create: { templateId: registrationForm.id, version: 1, snapshot: { key: registrationForm.key, name: registrationForm.name, type: registrationForm.type, language: registrationForm.language, version: 1, fields: registrationFields } } });

  const consentSeeds = [
    { id: 'consent_general_treatment', key: 'general-treatment-consent', name: 'General Treatment Consent', type: 'GENERAL_TREATMENT_CONSENT' as const, consentText: 'I voluntarily consent to the proposed consultation or treatment. The nature, expected benefits, material risks, alternatives, and opportunity to ask questions have been explained to me.', requiresWitness: true },
    { id: 'consent_photography', key: 'clinical-photography-consent', name: 'Clinical Photography Consent', type: 'PHOTOGRAPHY_CONSENT' as const, consentText: 'I consent to clinical photographs being captured and stored securely for clinical documentation. Marketing use requires a separate explicit permission.', requiresWitness: false },
    { id: 'consent_marketing', key: 'marketing-use-consent', name: 'Marketing Use Consent', type: 'MARKETING_USE_CONSENT' as const, consentText: 'I explicitly permit selected, approved photographs or testimonials to be used for clinic marketing. I understand that I may withdraw this permission for future use.', requiresWitness: false },
  ];
  for (const consent of consentSeeds) {
    const template = await prisma.consentTemplate.upsert({ where: { id: consent.id }, update: { status: 'PUBLISHED', consentText: consent.consentText, requiresWitness: consent.requiresWitness }, create: { ...consent, status: 'PUBLISHED', currentVersion: 1, createdById: admin.id, publishedAt: new Date() } });
    await prisma.consentTemplateVersion.upsert({ where: { templateId_version: { templateId: template.id, version: 1 } }, update: {}, create: { templateId: template.id, version: 1, consentText: template.consentText, snapshot: { key: template.key, name: template.name, type: template.type, language: template.language, consentText: template.consentText, requiresGuardian: template.requiresGuardian, requiresWitness: template.requiresWitness, version: 1 } } });
  }

  await prisma.packageMaster.updateMany({ where: { id: { in: ['package_master_skin_6', 'package_master_hair_8'] } }, data: { active: false } });
  const packageMasters = [
    { name: 'MNRF / CO2 Fractional - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['MNRF / CO2 Fractional'], totalSessions: 3, price: 16200 },
    { name: 'PRP Face - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['PRP Face'], totalSessions: 3, price: 12500 },
    { name: 'Exosomes + Dermapen - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['Exosomes + Dermapen'], totalSessions: 3, price: 20000 },
    { name: 'Dermaroller Face - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['Dermaroller Face'], totalSessions: 3, price: 10200 },
    { name: 'Dermapen Face - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['Dermapen Face'], totalSessions: 3, price: 10200 },
    { name: 'PRP Hair - 3 Sessions', category: 'Hair Treatment', includedServices: ['PRP Hair'], totalSessions: 3, price: 12500 },
    { name: 'Growth Factor (GFC) - 3 Sessions', category: 'Hair Treatment', includedServices: ['Growth Factor (GFC)'], totalSessions: 3, price: 18900 },
    { name: 'Meso Therapy - 4 Sessions', category: 'Hair Treatment', includedServices: ['Meso Therapy'], totalSessions: 4, price: 10000 },
    { name: 'Photo Facial - 6 Sessions', category: 'Skin Tightening Treatment', includedServices: ['Photo Facial'], totalSessions: 6, price: 18900 },
    { name: 'Voluma / Volift Filler - 2 Syringes', category: 'Skin Tightening Treatment', includedServices: ['Voluma / Volift Filler'], totalSessions: 2, price: 50000 },
    { name: 'Chemical Peel Face - 4 Sessions', category: 'Glow Treatment', includedServices: ['Chemical Peel Face'], totalSessions: 4, price: 7200 },
    { name: 'Chemical Peel Face & Neck - 4 Sessions', category: 'Glow Treatment', includedServices: ['Chemical Peel Face & Neck'], totalSessions: 4, price: 9000 },
    { name: 'Charcoal Facial - 4 Sessions', category: 'Glow Treatment', includedServices: ['Charcoal Facial'], totalSessions: 4, price: 16200 },
    { name: 'Oxygeneo + Q Switch - 4 Sessions', category: 'Glow Treatment', includedServices: ['Oxygeneo + Q Switch'], totalSessions: 4, price: 16200 },
    { name: 'Oxygeneo Facial - 4 Sessions', category: 'Glow Treatment', includedServices: ['Oxygeneo Facial'], totalSessions: 4, price: 12600 },
    { name: 'Hydrafacial - 4 Sessions', category: 'Glow Treatment', includedServices: ['Hydrafacial'], totalSessions: 4, price: 12600 },
    { name: 'Skin Glow - 4 Sessions', category: 'Glow Treatment', includedServices: ['Skin Glow (Polishing + Peel + Mask)'], totalSessions: 4, price: 9000 },
    { name: 'Q Switch Glow - 4 Sessions', category: 'Glow Treatment', includedServices: ['Q Switch Glow'], totalSessions: 4, price: 12600 },
    { name: 'Deep Peel CO2 Fractional - 3 Sessions', category: 'Glow Treatment', includedServices: ['Deep Peel CO2 Fractional'], totalSessions: 3, price: 10800 },
    { name: 'Hand Peel + Polishing - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Hand Peel + Polishing'], totalSessions: 4, price: 14400 },
    { name: 'Underarms Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Underarms Peel'], totalSessions: 4, price: 9000 },
    { name: 'Underarms Q Switch + Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Underarms Q Switch + Peel'], totalSessions: 4, price: 12600 },
    { name: 'Bikini Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Bikini Peel'], totalSessions: 4, price: 9000 },
    { name: 'Buttock Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Buttock Peel'], totalSessions: 4, price: 14400 },
    { name: 'Half Back Peel + Polishing - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Half Back Peel + Polishing'], totalSessions: 4, price: 10800 },
    { name: 'Full Back Peel + Polishing - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Full Back Peel + Polishing'], totalSessions: 4, price: 21600 },
    { name: 'Half Legs Peel + Polishing - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Half Legs Peel + Polishing'], totalSessions: 4, price: 14400 },
    { name: 'Full Legs Peel + Polishing - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Full Legs Peel + Polishing'], totalSessions: 4, price: 21600 },
    { name: 'Glutathione IV Infusion - 4 Sessions', category: 'Glow Drip', includedServices: ['Glutathione IV Infusion'], totalSessions: 4, price: 18000 },
    { name: 'Reglow Drip - 4 Sessions', category: 'Glow Drip', includedServices: ['Reglow Drip'], totalSessions: 4, price: 23400 },
    { name: 'Ageless Drip - 4 Sessions', category: 'Glow Drip', includedServices: ['Ageless Drip'], totalSessions: 4, price: 9000 },
    { name: 'Laser Upper Lip - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Upper Lip'], totalSessions: 6, price: 10000 },
    { name: 'Laser Side Locks - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Side Locks'], totalSessions: 6, price: 10000 },
    { name: 'Laser Forehead - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Forehead'], totalSessions: 6, price: 10000 },
    { name: 'Laser Chin - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Chin'], totalSessions: 6, price: 12750 },
    { name: 'Laser Lower Face - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Lower Face'], totalSessions: 6, price: 25500 },
    { name: 'Laser Full Face - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Full Face'], totalSessions: 6, price: 33150 },
    { name: 'Laser Beard Shaping - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Beard Shaping'], totalSessions: 6, price: 16320 },
    { name: 'Laser Ear Lobe - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Ear Lobe'], totalSessions: 6, price: 10000 },
    { name: 'Laser Mid Brow - 6 Sessions', category: 'Laser Hair Reduction Face', includedServices: ['Laser Hair Reduction - Mid Brow'], totalSessions: 6, price: 5000 },
    { name: 'Laser Underarms - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Underarms'], totalSessions: 6, price: 12500 },
    { name: 'Laser Full Hands - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Full Hands'], totalSessions: 6, price: 35700 },
    { name: 'Laser Half Hands - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Half Hands'], totalSessions: 6, price: 25500 },
    { name: 'Laser Full Legs - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Full Legs'], totalSessions: 6, price: 45900 },
    { name: 'Laser Half Legs - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Half Legs'], totalSessions: 6, price: 25500 },
    { name: 'Laser Full Front - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Full Front'], totalSessions: 6, price: 40800 },
    { name: 'Laser Half Chest - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Half Chest'], totalSessions: 6, price: 20400 },
    { name: 'Laser Full Back - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Full Back'], totalSessions: 6, price: 40800 },
    { name: 'Laser Half Back - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Half Back'], totalSessions: 6, price: 20400 },
    { name: 'Laser Abdomen - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Abdomen'], totalSessions: 6, price: 20400 },
    { name: 'Laser Mid Abdomen Line - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Mid Abdomen Line'], totalSessions: 6, price: 10000 },
    { name: 'Laser Bikini - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Bikini'], totalSessions: 6, price: 25500 },
    { name: 'Laser Bikini Line - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Bikini Line'], totalSessions: 6, price: 10000 },
    { name: 'Laser Buttock - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Buttock'], totalSessions: 6, price: 25500 },
    { name: 'Laser Periareola - 6 Sessions', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Periareola'], totalSessions: 6, price: 10000 },
    { name: 'Laser Full Body Five Parts', category: 'Laser Hair Reduction Body', includedServices: ['Laser Hair Reduction - Lower Face', 'Laser Hair Reduction - Underarms', 'Laser Hair Reduction - Full Hands', 'Laser Hair Reduction - Full Legs', 'Laser Hair Reduction - Bikini'], totalSessions: 6, price: 120000 },
  ].map((packageMaster) => ({ id: catalogId('package_master', packageMaster.name), ...packageMaster, validityDays: packageMaster.totalSessions >= 6 ? 365 : 180, taxPercent: 18, maximumDiscountPercent: 10 }));
  for (const packageMaster of packageMasters) {
    const { category, ...data } = packageMaster;
    await prisma.packageMaster.upsert({ where: { id: data.id }, update: { ...data, description: `${category} package from latest Revive rate list.`, active: true }, create: { ...data, description: `${category} package from latest Revive rate list.`, active: true, transferRules: 'Manager approval required.', pauseRules: 'One pause of up to 30 days.', extensionRules: 'Manager approval and documented reason required.', cancellationRules: 'Subject to consumed sessions and signed agreement.', refundRules: 'Refunds require approval and package-ledger entry.' } });
  }

  const latestPackageMasters = [
    { name: 'MNRF (Microneedling RF) / Co2 Fractional - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['MNRF (Microneedling RF) / Co2 Fractional'], totalSessions: 3, price: 16200 },
    { name: 'PRP (Face) - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['PRP (Face)'], totalSessions: 3, price: 12500 },
    { name: 'Exosomes + Dermapen - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['Exosomes + Dermapen'], totalSessions: 3, price: 20000 },
    { name: 'Dermaroller (Face) - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['Dermaroller (Face)'], totalSessions: 3, price: 10200 },
    { name: 'Dermapen Face - 3 Sessions', category: 'Acne Scar Treatment', includedServices: ['Dermapen Face'], totalSessions: 3, price: 10200 },
    { name: 'PRP (Hair) - 3 Sessions', category: 'Hair Treatment', includedServices: ['PRP (Hair)'], totalSessions: 3, price: 12500 },
    { name: 'Growth Factor (GFC) - 3 Sessions', category: 'Hair Treatment', includedServices: ['Growth Factor (GFC)'], totalSessions: 3, price: 18900 },
    { name: 'Meso Therapy - 4 Sessions', category: 'Hair Treatment', includedServices: ['Meso Therapy'], totalSessions: 4, price: 10000 },
    { name: 'Voluma / Volift (Filler) - 2 Syringes', category: 'Skin Tightening Treatment', includedServices: ['Voluma / Volift (Filler) - 1 ML syringe'], totalSessions: 2, price: 50000 },
    { name: 'Photo Facial - 6 Sessions', category: 'Skin Tightening Treatment', includedServices: ['Photo Facial'], totalSessions: 6, price: 18900 },
    { name: 'Chemical Peel Face - 4 Sessions', category: 'Glow Treatment', includedServices: ['Chemical Peel Face'], totalSessions: 4, price: 7200 },
    { name: 'Chemical Peel Face and Neck - 4 Sessions', category: 'Glow Treatment', includedServices: ['Chemical Peel Face and Neck'], totalSessions: 4, price: 9000 },
    { name: 'Charcoal Facial - 4 Sessions', category: 'Glow Treatment', includedServices: ['Charcoal Facial'], totalSessions: 4, price: 16200 },
    { name: 'Oxygeneo + Q Switch - 4 Sessions', category: 'Glow Treatment', includedServices: ['Oxygeneo + Q Switch'], totalSessions: 4, price: 16200 },
    { name: 'Oxygeneo Facial - 4 Sessions', category: 'Glow Treatment', includedServices: ['Oxygeneo Facial'], totalSessions: 4, price: 12600 },
    { name: 'Hydrafacial - 4 Sessions', category: 'Glow Treatment', includedServices: ['Hydrafacial'], totalSessions: 4, price: 12600 },
    { name: 'Skin Glow - 4 Sessions', category: 'Glow Treatment', includedServices: ['Skin Glow - Polishing + Peel + Mask'], totalSessions: 4, price: 9000 },
    { name: 'Q Switch Glow - 4 Sessions', category: 'Glow Treatment', includedServices: ['Q Switch Glow'], totalSessions: 4, price: 12600 },
    { name: 'Deep Peel (Co2 Fractional) - 3 Sessions', category: 'Glow Treatment', includedServices: ['Deep Peel (Co2 Fractional)'], totalSessions: 3, price: 10800 },
    { name: 'Hand Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Hand Peel'], totalSessions: 4, price: 14400 },
    { name: 'Underarms Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Underarms Peel'], totalSessions: 4, price: 9000 },
    { name: 'Underarms Q Switch + Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Underarms Q Switch + Peel'], totalSessions: 4, price: 12600 },
    { name: 'Bikini Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Bikini Peel'], totalSessions: 4, price: 9000 },
    { name: 'Buttock Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Buttock Peel'], totalSessions: 4, price: 14400 },
    { name: 'Half Back Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Half Back Peel'], totalSessions: 4, price: 10800 },
    { name: 'Full Back Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Full Back Peel'], totalSessions: 4, price: 21600 },
    { name: 'Half Legs Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Half Legs Peel'], totalSessions: 4, price: 14400 },
    { name: 'Full Legs Peel - 4 Sessions', category: 'Body Glow Treatment', includedServices: ['Full Legs Peel'], totalSessions: 4, price: 21600 },
    { name: 'Gluthathione IV Infusion - 4 Sessions', category: 'Glow Drip', includedServices: ['Gluthathione IV Infusion - 4 vials'], totalSessions: 4, price: 18000 },
    { name: 'Reglow Drip - 4 Sessions', category: 'Glow Drip', includedServices: ['Reglow Drip'], totalSessions: 4, price: 23400 },
    { name: 'Ageless Drip - 4 Sessions', category: 'Glow Drip', includedServices: ['Ageless Drip'], totalSessions: 4, price: 9000 },
    { name: 'Laser Upper Lip - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Upper Lip'], totalSessions: 6, price: 10000 },
    { name: 'Laser Side Locks - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Side Locks'], totalSessions: 6, price: 10000 },
    { name: 'Laser Forhead - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Forhead'], totalSessions: 6, price: 10000 },
    { name: 'Laser Chin - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Chin'], totalSessions: 6, price: 12750 },
    { name: 'Laser Lower Face - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Lower Face'], totalSessions: 6, price: 25500 },
    { name: 'Laser Full Face - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Full Face'], totalSessions: 6, price: 33150 },
    { name: 'Laser Beard Shaping - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Beard Shaping'], totalSessions: 6, price: 16320 },
    { name: 'Laser Ear Lobe - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Ear Lobe'], totalSessions: 6, price: 10000 },
    { name: 'Laser Mid Brow - 6 Sessions', category: 'Permanant Laser Hair Reduction (Face)', includedServices: ['Laser Hair Reduction - Mid Brow'], totalSessions: 6, price: 5000 },
    { name: 'Laser Underams - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Underams'], totalSessions: 6, price: 12500 },
    { name: 'Laser Hands (Full) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Hands (Full)'], totalSessions: 6, price: 35700 },
    { name: 'Laser Hands (Half) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Hands (Half)'], totalSessions: 6, price: 25500 },
    { name: 'Laser Legs (Full) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Legs (Full)'], totalSessions: 6, price: 45900 },
    { name: 'Laser Legs (Half) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Legs (Half)'], totalSessions: 6, price: 25500 },
    { name: 'Laser Full Front - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Full Front'], totalSessions: 6, price: 40800 },
    { name: 'Laser Chest (Half) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Chest (Half)'], totalSessions: 6, price: 20400 },
    { name: 'Laser Back (Full) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Back (Full)'], totalSessions: 6, price: 40800 },
    { name: 'Laser Back (Half) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Back (Half)'], totalSessions: 6, price: 20400 },
    { name: 'Laser Abdomen - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Abdomen'], totalSessions: 6, price: 20400 },
    { name: 'Laser Mid Abdomen Line - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Mid Abdomen Line'], totalSessions: 6, price: 10000 },
    { name: 'Laser Bikini - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Bikini'], totalSessions: 6, price: 25500 },
    { name: 'Laser Bikini Line - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Bikini Line'], totalSessions: 6, price: 10000 },
    { name: 'Laser Buttock - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Buttock'], totalSessions: 6, price: 25500 },
    { name: 'Laser Periareola - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Periareola'], totalSessions: 6, price: 10000 },
    { name: 'Laser Full Body (Five Parts) - 6 Sessions', category: 'Permanant Laser Hair Reduction (Body)', includedServices: ['Laser Hair Reduction - Lower Face', 'Laser Hair Reduction - Underams', 'Laser Hair Reduction - Hands (Full)', 'Laser Hair Reduction - Legs (Full)', 'Laser Hair Reduction - Bikini'], totalSessions: 6, price: 120000 },
  ].map((packageMaster) => ({ id: catalogId('package_master', packageMaster.name), ...packageMaster, validityDays: packageMaster.totalSessions >= 6 ? 365 : 180, taxPercent: 18, maximumDiscountPercent: 10 }));
  await prisma.packageMaster.updateMany({
    where: { id: { notIn: latestPackageMasters.map((packageMaster) => packageMaster.id) } },
    data: { active: false },
  });
  for (const packageMaster of latestPackageMasters) {
    const { category, ...data } = packageMaster;
    await prisma.packageMaster.upsert({
      where: { id: data.id },
      update: { ...data, description: `${category} package from attached Revive rate list.`, active: true },
      create: { ...data, description: `${category} package from attached Revive rate list.`, active: true, transferRules: 'Manager approval required.', pauseRules: 'One pause of up to 30 days.', extensionRules: 'Manager approval and documented reason required.', cancellationRules: 'Subject to consumed sessions and signed agreement.', refundRules: 'Refunds require approval and package-ledger entry.' },
    });
  }

  const appointmentBackfillRecords = await prisma.appointment.findMany({
    where: { status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    include: {
      lead: {
        include: {
          patient: true,
          person: { include: { patient: true } },
        },
      },
    },
    orderBy: { appointmentAt: 'desc' },
  });
  const appointmentsByLead = new Map<string, typeof appointmentBackfillRecords>();
  for (const appointment of appointmentBackfillRecords) {
    if (appointment.lead.patient || appointment.lead.person?.patient) continue;
    const current = appointmentsByLead.get(appointment.leadId) ?? [];
    current.push(appointment);
    appointmentsByLead.set(appointment.leadId, current);
  }

  let backfilledClients = 0;
  const backfilledPersonIds = new Set<string>();
  for (const [leadId, leadAppointments] of appointmentsByLead.entries()) {
    const latestAppointment = leadAppointments[0];
    const lead = latestAppointment.lead;
    if (lead.personId && backfilledPersonIds.has(lead.personId)) continue;
    const firstAppointment = leadAppointments[leadAppointments.length - 1];
    const patient = await prisma.patient.upsert({
      where: { leadId },
      update: {
        branchId: latestAppointment.branchId,
        fullName: lead.name,
        mobile: lead.mobile,
        email: lead.email,
        address: lead.address,
        personId: lead.personId,
        primaryConcern: lead.interestedTreatment ?? latestAppointment.notes,
        lastVisitAt: latestAppointment.appointmentAt,
        nextVisitAt: latestAppointment.appointmentAt > new Date() ? latestAppointment.appointmentAt : undefined,
      },
      create: {
        patientNo: `REV-P-BACKFILL-${lead.id.slice(-8).toUpperCase()}`,
        qrToken: `client-backfill-${lead.qrToken}`,
        leadId,
        personId: lead.personId,
        branchId: latestAppointment.branchId,
        fullName: lead.name,
        mobile: lead.mobile,
        email: lead.email,
        address: lead.address,
        registeredAt: firstAppointment.appointmentAt,
        registrationSource: 'APPOINTMENT_BACKFILL',
        primaryConcern: lead.interestedTreatment ?? latestAppointment.notes,
        status: 'ACTIVE',
        lastVisitAt: latestAppointment.appointmentAt,
        nextVisitAt: latestAppointment.appointmentAt > new Date() ? latestAppointment.appointmentAt : undefined,
      },
    });
    if (lead.personId) backfilledPersonIds.add(lead.personId);

    await prisma.medicalProfile.upsert({
      where: { patientId: patient.id },
      update: {
        skinConcern: lead.interestedTreatment ?? undefined,
        notes: latestAppointment.notes ?? undefined,
      },
      create: {
        patientId: patient.id,
        skinConcern: lead.interestedTreatment ?? undefined,
        notes: latestAppointment.notes ?? undefined,
      },
    });
    backfilledClients += 1;
  }
  if (backfilledClients) console.log(`Backfilled ${backfilledClients} existing appointment client(s) into Client Directory.`);

  const scoringRules = [
    { id: 'score_response', name: 'Response received', field: 'lastContactedAt', operator: 'EXISTS' as const, points: 15 },
    { id: 'score_appointment', name: 'Appointment booked', field: 'appointmentCount', operator: 'GREATER_THAN' as const, value: '0', points: 30 },
    { id: 'score_returning', name: 'Returning person', field: 'personLeadCount', operator: 'GREATER_THAN' as const, value: '1', points: 10 },
    { id: 'score_high_priority', name: 'High priority', field: 'priority', operator: 'EQUALS' as const, value: 'HIGH,URGENT', points: 20 },
    { id: 'score_inactive', name: 'Inactive for seven days', field: 'daysInactive', operator: 'GREATER_THAN' as const, value: '7', points: -15 },
  ];
  for (const rule of scoringRules) {
    await prisma.leadScoringRule.upsert({ where: { id: rule.id }, update: { ...rule, active: true }, create: { ...rule, active: true } });
  }

  // Managed WhatsApp template drafts. They remain inactive until an administrator
  // connects Meta Cloud API and synchronises the provider-approved versions.
  const testWhatsAppAccount = await prisma.whatsAppAccount.upsert({
    where: { businessAccountId: 'LOCAL_TEST_WABA' },
    update: { name: 'Local testing account', status: 'DISCONNECTED' },
    create: {
      name: 'Local testing account',
      businessAccountId: 'LOCAL_TEST_WABA',
      accessTokenCiphertext: 'LOCAL-TEST-ONLY',
      appSecretCiphertext: 'LOCAL-TEST-ONLY',
      verifyTokenCiphertext: 'LOCAL-TEST-ONLY',
      status: 'DISCONNECTED',
    },
  });
  for (const [index, branch] of [sharanpurBranch, nashikRoadBranch].entries()) {
    await prisma.whatsAppPhoneNumber.upsert({
      where: { phoneNumberId: `LOCAL_TEST_PHONE_${index + 1}` },
      update: { accountId: testWhatsAppAccount.id, branchId: branch.id, active: true, isDefault: true },
      create: {
        accountId: testWhatsAppAccount.id,
        branchId: branch.id,
        phoneNumberId: `LOCAL_TEST_PHONE_${index + 1}`,
        displayPhoneNumber: `+91 00000 0000${index + 1}`,
        normalizedPhone: `91000000000${index + 1}`,
        verifiedName: `Revive ${branch.name} (Test)`,
        active: true,
        isDefault: true,
      },
    });
  }

  const whatsappTemplates = [
    { id: 'wa_template_lead_received', name: 'lead_received', displayName: 'New lead acknowledgement', category: 'UTILITY' as const, group: 'NEW_LEAD' as const, body: 'Hello {{1}}, thank you for contacting {{2}} about {{3}}. {{4}} will assist you shortly.' },
    { id: 'wa_template_lead_followup', name: 'lead_follow_up', displayName: 'Lead follow-up', category: 'UTILITY' as const, group: 'LEAD_FOLLOW_UP' as const, body: 'Hello {{1}}, would you like help booking a consultation at {{2}} for {{3}}?' },
    { id: 'wa_template_appointment_booked', name: 'appointment_booked', displayName: 'Appointment booked', category: 'UTILITY' as const, group: 'APPOINTMENT' as const, body: 'Hello {{1}}, your appointment at {{2}} is booked for {{3}} with {{4}}.', buttons: [{ type: 'QUICK_REPLY', text: 'Confirm', id: 'APPOINTMENT_CONFIRM' }, { type: 'QUICK_REPLY', text: 'Reschedule', id: 'APPOINTMENT_RESCHEDULE' }, { type: 'QUICK_REPLY', text: 'Cancel', id: 'APPOINTMENT_CANCEL' }] },
    { id: 'wa_template_appointment_tomorrow', name: 'appointment_tomorrow', displayName: '24-hour appointment reminder', category: 'UTILITY' as const, group: 'APPOINTMENT' as const, body: 'Reminder: {{1}}, your appointment at {{2}} is tomorrow at {{3}}. Address: {{5}}.', buttons: [{ type: 'QUICK_REPLY', text: 'Confirm', id: 'APPOINTMENT_CONFIRM' }, { type: 'QUICK_REPLY', text: 'Directions', id: 'DIRECTIONS' }] },
    { id: 'wa_template_appointment_hour', name: 'appointment_in_one_hour', displayName: 'One-hour appointment reminder', category: 'UTILITY' as const, group: 'APPOINTMENT' as const, body: 'Hello {{1}}, your appointment at {{2}} starts in one hour ({{3}}).', buttons: [{ type: 'QUICK_REPLY', text: 'I have arrived', id: 'ARRIVED' }] },
    { id: 'wa_template_appointment_rescheduled', name: 'appointment_rescheduled', displayName: 'Appointment rescheduled', category: 'UTILITY' as const, group: 'APPOINTMENT' as const, body: 'Hello {{1}}, your appointment at {{2}} has been rescheduled to {{3}}.' },
    { id: 'wa_template_appointment_cancelled', name: 'appointment_cancelled', displayName: 'Appointment cancelled', category: 'UTILITY' as const, group: 'APPOINTMENT' as const, body: 'Hello {{1}}, your appointment at {{2}} for {{3}} has been cancelled. Reply here if you need help.' },
    { id: 'wa_template_payment_reminder', name: 'payment_reminder', displayName: 'Payment reminder', category: 'UTILITY' as const, group: 'PAYMENT' as const, body: 'Hello {{1}}, this is a payment reminder from {{2}}. Please contact us if you need assistance.' },
  ];
  for (const template of whatsappTemplates) await prisma.whatsAppTemplate.upsert({ where: { id: template.id }, update: { ...template, status: 'DRAFT', active: false }, create: { ...template, language: 'en', status: 'DRAFT', active: false, createdById: admin.id } });
  await prisma.whatsAppTemplate.upsert({
    where: { id: 'wa_template_test_marketing' },
    update: { accountId: testWhatsAppAccount.id, status: 'APPROVED', active: true },
    create: {
      id: 'wa_template_test_marketing',
      accountId: testWhatsAppAccount.id,
      providerTemplateId: 'LOCAL_TEST_MARKETING_TEMPLATE',
      name: 'revive_test_offer',
      displayName: 'Revive test marketing message',
      language: 'en',
      category: 'MARKETING',
      group: 'GENERAL',
      status: 'APPROVED',
      body: 'Hello {{1}}, this is a test campaign from Revive Clinic. No message will be delivered until a real Meta account is connected.',
      active: true,
      createdById: admin.id,
    },
  });

  const whatsappAutomations = [
    { id: 'wa_auto_lead_received', name: 'Lead received acknowledgement', trigger: 'LEAD_RECEIVED' as const, templateId: 'wa_template_lead_received', delayMinutes: 0, sequenceStep: 1 },
    { id: 'wa_auto_lead_followup_1', name: 'Lead follow-up — day 1', trigger: 'LEAD_FOLLOW_UP' as const, templateId: 'wa_template_lead_followup', delayMinutes: 1440, sequenceStep: 1 },
    { id: 'wa_auto_lead_followup_2', name: 'Lead follow-up — day 3', trigger: 'LEAD_FOLLOW_UP' as const, templateId: 'wa_template_lead_followup', delayMinutes: 4320, sequenceStep: 2 },
    { id: 'wa_auto_appointment_booked', name: 'Appointment booked confirmation', trigger: 'APPOINTMENT_BOOKED' as const, templateId: 'wa_template_appointment_booked', delayMinutes: 0, sequenceStep: 1 },
    { id: 'wa_auto_appointment_tomorrow', name: 'Appointment reminder — 24 hours', trigger: 'APPOINTMENT_TOMORROW' as const, templateId: 'wa_template_appointment_tomorrow', delayMinutes: 0, sequenceStep: 1 },
    { id: 'wa_auto_appointment_hour', name: 'Appointment reminder — 1 hour', trigger: 'APPOINTMENT_IN_ONE_HOUR' as const, templateId: 'wa_template_appointment_hour', delayMinutes: 0, sequenceStep: 1 },
    { id: 'wa_auto_appointment_rescheduled', name: 'Appointment rescheduled notice', trigger: 'APPOINTMENT_RESCHEDULED' as const, templateId: 'wa_template_appointment_rescheduled', delayMinutes: 0, sequenceStep: 1 },
    { id: 'wa_auto_appointment_cancelled', name: 'Appointment cancellation notice', trigger: 'APPOINTMENT_CANCELLED' as const, templateId: 'wa_template_appointment_cancelled', delayMinutes: 0, sequenceStep: 1 },
  ];
  for (const automation of whatsappAutomations) await prisma.whatsAppAutomation.upsert({ where: { id: automation.id }, update: { ...automation, active: false }, create: { ...automation, active: false, stopConditions: ['response_received', 'appointment_booked', 'converted', 'lost', 'disqualified', 'opt_out', 'invalid_number'] } });

  const existingSettings = await prisma.clinicSettings.findFirst();
  if (!existingSettings) {
    await prisma.clinicSettings.create({
      data: {
        clinicName: 'Revive Clinic',
        invoicePrefix: 'REV',
        businessAddress: 'Nashik',
        businessPhone: '+91-0000000000',
        appointmentTemplate: 'Your appointment with Revive Clinic is confirmed for [date] at [time], at [branch].',
        reminderTemplate: 'Reminder: Your appointment is scheduled tomorrow at [time] at [branch].',
        invoiceTemplate: 'Thank you for visiting Revive Clinic. Your invoice has been generated.',
        followupTemplate: 'This is a follow-up reminder from Revive Clinic.',
      },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
