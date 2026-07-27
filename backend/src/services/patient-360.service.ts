import type { Role } from '@prisma/client';
import { Role as RoleEnum } from '@prisma/client';
import type { z } from 'zod';
import { patient360Repository } from '../repositories/patient-360.repository.js';
import { HttpError } from '../utils/http-error.js';
import type {
  encounterSchema,
  encounterUpdateSchema,
  prescriptionSchema,
  procedureSessionSchema,
  treatmentPlanSchema,
  treatmentPlanUpdateSchema,
} from '../validations/patient-360.validation.js';
import { accessService } from './access.service.js';
import { auditService, type AuditContext } from './audit.service.js';
import { assertEncounterEditable, assertEncounterSignable, assertTreatmentPlanTransition } from './clinical-policy.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { inventoryService } from './inventory.service.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import fs from 'node:fs';
import path from 'node:path';

type Actor = AuditContext & { id: string; role: Role };
const clinicalRoles: Role[] = [RoleEnum.ADMIN, RoleEnum.RECEPTIONIST];
const signingRoles: Role[] = [RoleEnum.ADMIN, RoleEnum.RECEPTIONIST];
const logoPath = path.resolve(process.cwd(), '../frontend/public/revive-logo.png');

async function requirePatient(patientId: string, actor: Actor) {
  const patient = await patient360Repository.findPatientAccess(patientId);
  if (!patient) throw new HttpError(404, 'Patient not found');
  await accessService.assertBranchAccess(actor.id, actor.role, patient.branchId);
  return patient;
}

function requireClinicalRole(actor: Actor) {
  if (!clinicalRoles.includes(actor.role)) throw new HttpError(403, 'Clinical information is restricted to authorised clinical staff');
}

async function audit(actor: Actor, event: Parameters<typeof auditService.record>[1]) {
  const { userId, branchId, ipAddress, device, correlationId } = actor;
  await auditService.record({ userId, branchId, ipAddress, device, correlationId }, event);
}

export const patient360Service = {
  async getPatient360(patientId: string, actor: Actor) {
    const access = await requirePatient(patientId, actor);
    const patient = await patient360Repository.getPatient360(patientId);
    if (!patient) throw new HttpError(404, 'Patient not found');

    const outstandingAmount = patient.invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.totalAmount) - invoice.payments.reduce((paid, payment) => paid + Number(payment.amount), 0)), 0);
    const sessionsRemaining = patient.packages.reduce((sum, treatmentPackage) => sum + Math.max(0, treatmentPackage.totalSessions - treatmentPackage.completedSessions), 0);
    const activeTreatmentPlan = patient.treatmentPlans.find((plan) => plan.status === 'ACTIVE' || plan.status === 'ACCEPTED');
    const appointments = patient.lead.appointments;
    const lastVisit = appointments.find((appointment) => ['COMPLETED', 'BILLING_PENDING'].includes(appointment.status));
    const nextAppointment = [...appointments].reverse().find((appointment) => new Date(appointment.appointmentAt) > new Date() && !['CANCELLED', 'NO_SHOW'].includes(appointment.status));

    if (!clinicalRoles.includes(actor.role)) {
      return {
        ...patient,
        medicalProfile: undefined,
        clinicalEncounters: undefined,
        treatmentPlans: undefined,
        procedureSessions: undefined,
        prescriptions: undefined,
        files: [],
        summary: { outstandingAmount, sessionsRemaining, activeTreatmentPlan: null, lastVisit, nextAppointment },
      };
    }

    await audit(actor, { action: 'CLINICAL_RECORD_ACCESSED', entity: 'Patient', entityId: access.id });
    return { ...patient, files: [], summary: { outstandingAmount, sessionsRemaining, activeTreatmentPlan, lastVisit, nextAppointment } };
  },

  async listEncounters(patientId: string, actor: Actor) {
    requireClinicalRole(actor); await requirePatient(patientId, actor);
    await audit(actor, { action: 'CLINICAL_ENCOUNTERS_VIEWED', entity: 'Patient', entityId: patientId });
    return patient360Repository.listEncounters(patientId);
  },
  async createEncounter(patientId: string, input: z.infer<typeof encounterSchema>, actor: Actor) {
    requireClinicalRole(actor); const patient = await requirePatient(patientId, actor);
    if (input.branchId !== patient.branchId) throw new HttpError(400, 'Encounter branch must match the patient registration branch');
    const encounter = await patient360Repository.createEncounter({ patientId, ...input });
    await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId, createdById: actor.id, type: 'CLINICAL_ENCOUNTER_CREATED', title: 'Clinical encounter created', description: input.type });
    await audit(actor, { action: 'CLINICAL_ENCOUNTER_CREATED', entity: 'ClinicalEncounter', entityId: encounter.id, newValue: { type: encounter.type, status: encounter.status } });
    return encounter;
  },
  async updateEncounter(id: string, input: z.infer<typeof encounterUpdateSchema>, actor: Actor) {
    requireClinicalRole(actor); const encounter = await patient360Repository.findEncounter(id);
    if (!encounter) throw new HttpError(404, 'Clinical encounter not found');
    await requirePatient(encounter.patientId, actor); assertEncounterEditable(encounter.status);
    const updated = await patient360Repository.updateEncounter(id, input);
    await audit(actor, { action: 'CLINICAL_ENCOUNTER_UPDATED', entity: 'ClinicalEncounter', entityId: id, previousValue: { status: encounter.status }, newValue: { status: updated.status } });
    return updated;
  },
  async signEncounter(id: string, actor: Actor) {
    if (!signingRoles.includes(actor.role)) throw new HttpError(403, 'Only doctors or clinic administrators can sign clinical notes');
    const encounter = await patient360Repository.findEncounter(id); if (!encounter) throw new HttpError(404, 'Clinical encounter not found');
    await requirePatient(encounter.patientId, actor); assertEncounterSignable(encounter.status);
    if (actor.role === RoleEnum.DOCTOR && encounter.doctorId !== actor.id) throw new HttpError(403, 'Doctors may only sign their own clinical notes');
    const signed = await patient360Repository.signEncounter(id, actor.id);
    await timelineRepository.create({ patientId: encounter.patientId, createdById: actor.id, type: 'CLINICAL_NOTE_SIGNED', title: 'Clinical note signed and locked', description: encounter.type });
    await audit(actor, { action: 'CLINICAL_ENCOUNTER_SIGNED', entity: 'ClinicalEncounter', entityId: id, previousValue: { status: encounter.status }, newValue: { status: 'LOCKED', signedById: actor.id } });
    return signed;
  },
  async addAddendum(id: string, content: string, actor: Actor) {
    if (!signingRoles.includes(actor.role)) throw new HttpError(403, 'Only doctors or clinic administrators can add clinical addendums');
    const encounter = await patient360Repository.findEncounter(id); if (!encounter) throw new HttpError(404, 'Clinical encounter not found');
    await requirePatient(encounter.patientId, actor);
    if (!['SIGNED', 'LOCKED', 'ADDENDUM_ADDED'].includes(encounter.status)) throw new HttpError(409, 'Addendums are only allowed after a note is signed');
    const addendum = await patient360Repository.addEncounterAddendum(id, actor.id, content);
    await audit(actor, { action: 'CLINICAL_ADDENDUM_ADDED', entity: 'ClinicalEncounter', entityId: id, newValue: { addendumId: addendum.id } });
    return addendum;
  },

  async listTreatmentPlans(patientId: string, actor: Actor) { requireClinicalRole(actor); await requirePatient(patientId, actor); return patient360Repository.listTreatmentPlans(patientId); },
  async createTreatmentPlan(patientId: string, input: z.infer<typeof treatmentPlanSchema>, actor: Actor) {
    requireClinicalRole(actor); const patient = await requirePatient(patientId, actor);
    if (input.branchId !== patient.branchId) throw new HttpError(400, 'Treatment-plan branch must match the patient branch');
    const { items, ...plan } = input;
    const created = await patient360Repository.createTreatmentPlan({ patientId, ...plan, items: { create: items } });
    await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId, createdById: actor.id, type: 'TREATMENT_PLAN_CREATED', title: 'Treatment plan created', description: input.concern });
    await audit(actor, { action: 'TREATMENT_PLAN_CREATED', entity: 'TreatmentPlan', entityId: created.id, newValue: { status: created.status, concern: created.concern } });
    return created;
  },
  async updateTreatmentPlan(id: string, input: z.infer<typeof treatmentPlanUpdateSchema>, actor: Actor) {
    requireClinicalRole(actor); const plan = await patient360Repository.findTreatmentPlan(id); if (!plan) throw new HttpError(404, 'Treatment plan not found');
    await requirePatient(plan.patientId, actor); if (input.status) assertTreatmentPlanTransition(plan.status, input.status);
    const updated = await patient360Repository.updateTreatmentPlan(id, input);
    await audit(actor, { action: 'TREATMENT_PLAN_UPDATED', entity: 'TreatmentPlan', entityId: id, previousValue: { status: plan.status }, newValue: { status: updated.status } });
    return updated;
  },

  async listProcedureSessions(patientId: string, actor: Actor) { requireClinicalRole(actor); await requirePatient(patientId, actor); return patient360Repository.listProcedureSessions(patientId); },
  async createProcedureSession(patientId: string, input: z.infer<typeof procedureSessionSchema>, actor: Actor) {
    requireClinicalRole(actor); const patient = await requirePatient(patientId, actor);
    if (input.branchId !== patient.branchId) throw new HttpError(400, 'Procedure branch must match the patient branch');
    if (input.status === 'COMPLETED' && !input.consentVerified) throw new HttpError(409, 'Consent must be verified before completing a procedure');
    if (input.status === 'COMPLETED' && input.packageId) { const treatmentPackage = await patient360Repository.findPatientPackage(input.packageId); if (!treatmentPackage || treatmentPackage.patientId !== patientId || treatmentPackage.status !== 'ACTIVE' || treatmentPackage.completedSessions + treatmentPackage.reservedSessions >= treatmentPackage.totalSessions) throw new HttpError(409, 'An active patient package with remaining sessions is required'); }
    const created = await patient360Repository.createProcedureSession({ patientId, ...input }, actor.id);
    await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId, createdById: actor.id, type: 'PROCEDURE_RECORDED', title: 'Procedure session recorded', description: input.procedureName });
    await audit(actor, { action: 'PROCEDURE_SESSION_CREATED', entity: 'ProcedureSession', entityId: created.id, newValue: { status: created.status, adverseEventFlag: created.adverseEventFlag } });
    if (created.status === 'COMPLETED') {
      try {
        await inventoryService.stageProcedureConsumption(created.id, actor);
      } catch (error) {
        await audit(actor, { action: 'PROCEDURE_CONSUMPTION_REQUIRES_REVIEW', entity: 'ProcedureSession', entityId: created.id, newValue: { reason: error instanceof Error ? error.message : 'Stock deduction could not be completed' } });
      }
    }
    return created;
  },

  async listPrescriptions(patientId: string, actor: Actor) { requireClinicalRole(actor); await requirePatient(patientId, actor); return patient360Repository.listPrescriptions(patientId); },
  async createPrescription(patientId: string, input: z.infer<typeof prescriptionSchema>, actor: Actor) {
    if (!signingRoles.includes(actor.role)) throw new HttpError(403, 'Only doctors or clinic administrators can create prescriptions');
    const patient = await requirePatient(patientId, actor); const { items, ...prescription } = input;
    if (actor.role === RoleEnum.DOCTOR && prescription.doctorId !== actor.id) throw new HttpError(403, 'Doctors may only prescribe as themselves');
    const prescriptionNo = `REV-RX-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const created = await patient360Repository.createPrescription({ patientId, prescriptionNo, ...prescription, items: { create: items } });
    await timelineRepository.create({ personId: patient.personId ?? undefined, leadId: patient.leadId, patientId, createdById: actor.id, type: 'PRESCRIPTION_CREATED', title: 'Prescription issued', description: prescriptionNo });
    await audit(actor, { action: 'PRESCRIPTION_CREATED', entity: 'Prescription', entityId: created.id, newValue: { prescriptionNo, status: created.status } });
    return created;
  },
  async signPrescription(id: string, actor: Actor) {
    if (!signingRoles.includes(actor.role)) throw new HttpError(403, 'Only doctors or clinic administrators can sign prescriptions');
    const prescription = await patient360Repository.findPrescription(id); if (!prescription) throw new HttpError(404, 'Prescription not found');
    await requirePatient(prescription.patientId, actor);
    if (prescription.status !== 'DRAFT') throw new HttpError(409, 'Only draft prescriptions can be signed');
    if (actor.role === RoleEnum.DOCTOR && prescription.doctorId !== actor.id) throw new HttpError(403, 'Doctors may only sign their own prescriptions');
    const signed = await patient360Repository.signPrescription(id, actor.id);
    await audit(actor, { action: 'PRESCRIPTION_SIGNED', entity: 'Prescription', entityId: id, previousValue: { status: prescription.status }, newValue: { status: signed.status } });
    return signed;
  },
  async getPrescriptionPdf(id: string, actor: Actor) {
    requireClinicalRole(actor); const prescription = await patient360Repository.getPrescriptionDocument(id);
    if (!prescription) throw new HttpError(404, 'Prescription not found');
    await requirePatient(prescription.patientId, actor);
    const settings = await settingsRepository.getOrCreate();
    await audit(actor, { action: 'PRESCRIPTION_PDF_VIEWED', entity: 'Prescription', entityId: id });
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 }); const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
      const brandName = settings.clinicName || 'Revive Clinic';
      const phone = settings.businessPhone || prescription.patient.branch?.phone || '+91-0000000000';
      const address = settings.businessAddress || prescription.patient.branch?.address || prescription.patient.branch?.name || 'Clinic address';
      const cityLine = [settings.city, settings.state, settings.postalCode].filter(Boolean).join(', ');
      const hours = settings.openingHours || 'Mon-Sat, 10:00 AM-7:00 PM';
      if (fs.existsSync(logoPath)) doc.image(logoPath, 48, 38, { width: 82 });
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#ef2b32').text(brandName, 145, 40);
      doc.font('Helvetica').fontSize(9).fillColor('#4f3035')
        .text(address, 145, 70, { width: 360 })
        .text(cityLine || 'Nashik, Maharashtra', 145, doc.y + 2, { width: 360 })
        .text(`Phone: ${phone}${settings.clinicEmail ? `  |  Email: ${settings.clinicEmail}` : ''}`, 145, doc.y + 2, { width: 360 })
        .text(`Timings: ${hours}${settings.website ? `  |  ${settings.website}` : ''}`, 145, doc.y + 2, { width: 360 });
      doc.moveTo(48, 132).lineTo(548, 132).lineWidth(1.2).strokeColor('#ef2b32').stroke();
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#2b171a').text('MEDICAL PRESCRIPTION', 48, 148);
      doc.font('Helvetica').fontSize(9).fillColor('#5f464b').text(`Prescription No: ${prescription.prescriptionNo}`, 360, 150, { width: 188, align: 'right' });
      doc.roundedRect(48, 178, 500, 70, 8).strokeColor('#ead6d0').stroke();
      doc.fontSize(10).fillColor('#2b171a')
        .text(`Client: ${prescription.patient.fullName}`, 64, 194)
        .text(`Client No: ${prescription.patient.patientNo}`, 64, 212)
        .text(`Mobile: ${prescription.patient.mobile}`, 64, 230)
        .text(`Doctor: ${prescription.doctor.name}`, 330, 194)
        .text(`Date: ${prescription.prescribedAt.toLocaleDateString('en-IN')}`, 330, 212)
        .text(`Branch: ${prescription.patient.branch?.name ?? '-'}`, 330, 230);
      let y = 270;
      if (prescription.diagnosisSummary) {
        doc.font('Helvetica-Bold').text('Diagnosis', 48, y).font('Helvetica').text(prescription.diagnosisSummary, 120, y, { width: 420 });
        y = doc.y + 16;
      }
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#ef2b32').text('Rx', 48, y);
      y += 34;
      prescription.items.forEach((item, index) => {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#2b171a').text(`${index + 1}. ${item.medicineName}${item.strength ? ` ${item.strength}` : ''}`, 64, y);
        y = doc.y + 4;
        doc.font('Helvetica').fontSize(10).fillColor('#4f3035').text(`${item.dosage} | ${item.frequency} | ${item.duration}${item.route ? ` | ${item.route}` : ''}${item.timing ? ` | ${item.timing}` : ''}`, 82, y);
        y = doc.y + 4;
        if (item.instructions) { doc.fontSize(9).fillColor('#6d565a').text(item.instructions, 82, y, { width: 430 }); y = doc.y + 8; }
        else y += 6;
      });
      if (prescription.instructions) { doc.moveDown().font('Helvetica-Bold').fillColor('#2b171a').text('Instructions').font('Helvetica').fillColor('#4f3035').text(prescription.instructions); }
      if (prescription.precautions) { doc.moveDown(0.5).font('Helvetica-Bold').fillColor('#2b171a').text('Precautions').font('Helvetica').fillColor('#4f3035').text(prescription.precautions); }
      doc.fontSize(9).fillColor('#6d565a').text('This prescription is generated from Revive Clinic CRM and is intended only for the named client.', 48, 690, { width: 300 });
      doc.fontSize(10).fillColor('#2b171a').text(prescription.signedBy ? `Digitally signed by ${prescription.signedBy.name}` : 'Draft - not signed', 350, 675, { width: 198, align: 'right' });
      if (prescription.signedAt) doc.fontSize(8).fillColor('#6d565a').text(prescription.signedAt.toLocaleString('en-IN'), 350, 692, { width: 198, align: 'right' });
      doc.end();
    });
  },

  listMedicines(search?: string) { return patient360Repository.listMedicines(search); },
  listTemplates(branchId?: string) { return patient360Repository.listTemplates(branchId); },
  async doctorWorkspace(actor: Actor, branchId?: string, date = new Date()) {
    requireClinicalRole(actor); await accessService.assertBranchAccess(actor.id, actor.role, branchId);
    const start = new Date(date); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1);
    const workspace = await patient360Repository.doctorWorkspace(actor.id, branchId, start, end);
    return {
      ...workspace,
      waitingPatients: workspace.appointments.filter((item) => ['CHECKED_IN', 'WAITING'].includes(item.status)),
      consultations: workspace.appointments.filter((item) => !['CANCELLED', 'NO_SHOW'].includes(item.status)),
    };
  },
};
