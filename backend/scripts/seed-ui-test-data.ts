/**
 * Synthetic data for UI review only. Refuses to run unless the database name ends in `_uitest`,
 * so it can never touch the development or production databases.
 *   DATABASE_URL=postgresql://.../revive_crm_uitest npx tsx scripts/seed-ui-test-data.ts
 *   (local dev database: DUMMY_DATA_TARGET=dev npx tsx scripts/seed-ui-test-data.ts; remove with delete-ui-test-data.ts)
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaClient, type AppointmentStatus, type EnquirySource, type LeadPriority, type LeadStatus } from '@prisma/client';

import { patientRepository } from '../src/repositories/patient.repository.js';
import { assertDummyDataTarget } from './ui-test-guard.js';

const dbName = assertDummyDataTarget();

const prisma = new PrismaClient();
const day = 86_400_000;
const at = (offsetDays: number, hour: number, minute = 0) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const token = () => crypto.randomBytes(12).toString('hex');
const first = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Isha', 'Vihaan', 'Anaya', 'Arjun', 'Saanvi', 'Reyansh', 'Myra', 'Advait', 'Kiara', 'Ishaan', 'Navya', 'Dev', 'Tara', 'Yash', 'Riya'];
const last = ['Patil', 'Deshmukh', 'Joshi', 'Kulkarni', 'More', 'Shinde', 'Pawar', 'Gaikwad', 'Jadhav', 'Kale'];
const treatments = ['Acne treatment', 'Hair PRP', 'Laser hair reduction', 'HIFU face lift', 'Pigmentation peel', 'Skin consultation', 'Mesotherapy', 'Dandruff care'];
const pick = <T,>(items: T[], index: number) => items[index % items.length];
const name = (i: number) => `${pick(first, i)} ${pick(last, i * 3 + 1)}`;
const mobile = (i: number) => `90000${String(10000 + i).slice(-5)}`;

async function person(i: number, fullName: string, sex: 'MALE' | 'FEMALE') {
  return prisma.person.create({ data: { fullName, primaryMobile: mobile(i), normalizedMobile: mobile(i), email: `synthetic${i}@example.test`, normalizedEmail: `synthetic${i}@example.test`, sex, city: 'Nashik', state: 'Maharashtra' } });
}

async function main() {
  if (await prisma.person.findFirst({ where: { normalizedEmail: 'synthetic1@example.test' } })) throw new Error('Synthetic data is already present in this database. Run delete-ui-test-data.ts first.');
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const hash = await bcrypt.hash(token(), 10);
  const extraAdmin = await prisma.user.upsert({ where: { email: 'dr.kulkarni@example.test' }, update: {}, create: { name: 'Dr. Anjali Kulkarni', email: 'dr.kulkarni@example.test', passwordHash: hash, role: 'ADMIN', accessLevel: 'ADMIN' } });
  const extraReception = await prisma.user.upsert({ where: { email: 'priya.front@example.test' }, update: {}, create: { name: 'Priya Front Desk', email: 'priya.front@example.test', passwordHash: hash, role: 'RECEPTIONIST', accessLevel: 'RECEPTIONIST' } });
  const reception = (await prisma.user.findFirst({ where: { role: 'RECEPTIONIST', email: { not: { endsWith: '@example.test' } } } })) ?? extraReception;
  const owners = [reception, extraReception];

  // Leads across the whole pipeline.
  const statuses: LeadStatus[] = ['NEW', 'NEW', 'ASSIGNED', 'ATTEMPTING_CONTACT', 'CONNECTED', 'QUALIFIED', 'APPOINTMENT_PROPOSED', 'APPOINTMENT_BOOKED', 'NURTURING', 'LOST', 'CONVERTED', 'BOOKED', 'ARRIVED'];
  const sources: EnquirySource[] = ['WEBSITE', 'WALK_IN', 'PHONE_CALL', 'WHATSAPP', 'GOOGLE_ADS', 'META_ADS'];
  const priorities: LeadPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'MEDIUM'];
  const leads = [];
  for (let i = 0; i < 42; i++) {
    const p = await person(i + 1, name(i), i % 2 ? 'FEMALE' : 'MALE');
    const status = pick(statuses, i);
    leads.push(await prisma.lead.create({ data: {
      qrToken: token(), name: p.fullName, mobile: p.primaryMobile, email: p.email, source: pick(sources, i), status, priority: pick(priorities, i),
      interestedTreatment: pick(treatments, i), branchId: pick(branches, i).id, createdById: admin.id, personId: p.id, ownerId: status === 'NEW' ? null : pick(owners, i).id,
      leadScore: 20 + ((i * 17) % 75), scoreCategory: i % 4 === 0 ? 'HOT' : i % 4 === 1 ? 'WARM' : 'COLD',
      nextAction: status === 'NEW' ? 'Make first contact call' : 'Follow up on treatment interest', nextActionDueAt: at((i % 6) - 2, 10 + (i % 7)),
      nextFollowupAt: at((i % 6) - 2, 11 + (i % 6)), createdAt: at(-(i % 25), 9), ...(status === 'LOST' ? { lostReason: 'Price concern', closedAt: at(-2, 12) } : {}), ...(status === 'CONVERTED' ? { convertedAt: at(-3, 12) } : {}),
    } }));
  }

  // Patients (converted leads + a few direct registrations) with profiles and visit history.
  const patients = [];
  for (let i = 0; i < 14; i++) {
    const lead = leads[10 + i];
    const p = await person(100 + i, lead?.name ?? name(i + 50), i % 2 ? 'FEMALE' : 'MALE');
    const patient = await prisma.patient.create({ data: {
      patientNo: await patientRepository.nextPatientNo(), qrToken: token(), leadId: i < 10 ? lead.id : undefined, personId: p.id, branchId: pick(branches, i).id,
      fullName: p.fullName, mobile: p.primaryMobile, email: p.email, age: 22 + ((i * 5) % 30), sex: i % 2 ? 'FEMALE' : 'MALE', address: 'Synthetic Lane, Nashik', occupation: pick(['Teacher', 'Engineer', 'Designer', 'Student'], i),
      maritalStatus: i % 3 ? 'Married' : 'Single', registrationSource: 'Direct patient registration', primaryConcern: pick(treatments, i), lastVisitAt: at(-(i + 2), 12), nextVisitAt: at(i % 5 + 1, 12),
    } });
    await prisma.medicalProfile.create({ data: { patientId: patient.id, skinConcern: pick(['Acne', 'Pigmentation', 'Dull skin'], i), medicalHistory: i % 3 === 0 ? 'Mild hypertension' : 'None reported', allergyToDrugs: i === 2 ? 'Penicillin' : i === 5 ? 'Sulfa drugs' : null, criticalAlert: i === 2, clinicalAlerts: i === 2 ? 'Severe penicillin allergy — confirm before prescribing.' : null } });
    await prisma.session.create({ data: { patientId: patient.id, treatmentType: 'CONSULTATION', visitDate: at(-(i + 2), 12), doctorConsulted: admin.name, chiefComplaint: pick(treatments, i), diagnosis: 'Synthetic diagnosis for UI review', treatmentSuggested: 'Course of 4 sessions', notes: 'Synthetic clinical note.', followupDate: at(i % 5 + 1, 12) } });
    patients.push({ patient, person: p });
  }

  // Appointments: past, today and upcoming across statuses and both resource types.
  const doctors = [admin, extraAdmin];
  const apptStatuses: AppointmentStatus[] = ['COMPLETED', 'COMPLETED', 'CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'CONFIRMED', 'SCHEDULED', 'CONFIRMATION_PENDING', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'];
  const rooms = await prisma.clinicResource.findMany({ where: { type: 'ROOM' }, orderBy: { name: 'asc' } });
  for (let i = 0; i < 34; i++) {
    const lead = leads[i % leads.length];
    const offset = i < 8 ? -(i + 1) : i < 20 ? 0 : i - 19;
    const status = offset < 0 ? pick(['COMPLETED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as AppointmentStatus[], i) : offset === 0 ? pick(['CHECKED_IN', 'WAITING', 'IN_CONSULTATION', 'CONFIRMED', 'COMPLETED', 'SCHEDULED'] as AppointmentStatus[], i) : pick(apptStatuses.slice(5, 8).concat(['RESCHEDULED']), i);
    const room = i % 3 === 0;
    const start = at(offset, 9 + (i % 8), i % 2 ? 30 : 0);
    await prisma.appointment.create({ data: {
      leadId: lead.id, branchId: lead.branchId, appointmentAt: start, endAt: new Date(start.getTime() + 30 * 60_000), durationMinutes: 30,
      appointmentType: i % 7 === 0 ? 'VIDEO_CONSULTATION' : 'CLINIC_VISIT', resourceType: room ? 'TREATMENT_ROOM' : 'CONSULTATION', roomNumber: room ? 1 + (i % 4) : null,
      resourceId: room ? rooms[i % rooms.length]?.id : null, doctorId: pick(doctors, i).id, status, notes: 'Synthetic appointment', bookingSource: 'Reception',
      ...(['CHECKED_IN', 'WAITING', 'IN_CONSULTATION'].includes(status) ? { checkInAt: start, arrivalAt: start, waitingStartedAt: start } : {}),
    } });
  }

  // Tasks and follow-ups (open, in progress, overdue, completed).
  for (let i = 0; i < 14; i++) {
    const lead = leads[i];
    await prisma.task.create({ data: { title: pick(['Call back lead', 'Send price list', 'Confirm appointment', 'Collect consent form', 'Review treatment plan'], i), description: 'Synthetic task for UI review.', type: 'LEAD_FOLLOW_UP', priority: pick(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const, i), assignedUserId: pick([reception, extraReception, admin], i).id, branchId: lead.branchId, leadId: lead.id, dueAt: at((i % 7) - 3, 10 + (i % 6)), status: pick(['OPEN', 'IN_PROGRESS', 'OPEN', 'COMPLETED'] as const, i), createdById: admin.id, ...(i % 4 === 3 ? { completedAt: at(-1, 15), completedById: reception.id } : {}) } });
    await prisma.followUp.create({ data: { personId: lead.personId!, leadId: lead.id, assignedUserId: reception.id, branchId: lead.branchId, activityType: pick(['Call', 'WhatsApp check-in', 'Treatment reminder'], i), channel: pick(['CALL', 'WHATSAPP', 'SMS'] as const, i), dueAt: at((i % 5) - 2, 9 + i % 8), priority: pick(['MEDIUM', 'HIGH', 'LOW'] as const, i), status: i % 5 === 4 ? 'COMPLETED' : 'OPEN', createdById: admin.id, notes: 'Synthetic follow-up', ...(i % 5 === 4 ? { completedAt: at(-1, 14), completedById: reception.id } : {}) } });
  }
  console.log({ leads: leads.length, patients: patients.length, db: dbName });
}

main().finally(() => prisma.$disconnect());
