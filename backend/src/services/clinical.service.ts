import { branchRepository } from '../repositories/branch.repository.js';
import { clinicalRepository } from '../repositories/clinical.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';

async function ensurePatient(id: string) {
  const patient = await patientRepository.findById(id);
  if (!patient) throw new HttpError(404, 'Patient not found');
  return patient;
}

async function ensureBranch(id: string) {
  const branch = await branchRepository.exists(id);
  if (!branch) throw new HttpError(404, 'Branch not found');
}

export const clinicalService = {
  async listSessions(patientId: string) {
    await ensurePatient(patientId);
    return clinicalRepository.listSessions(patientId);
  },

  async createSession(patientId: string, input: Parameters<typeof clinicalRepository.createSession>[1]) {
    const patient = await ensurePatient(patientId);
    if (input.appointmentId) {
      const appointment = patient.lead.appointments.find((item) => item.id === input.appointmentId);
      if (!appointment) throw new HttpError(400, 'Appointment does not belong to this patient');
    }
    if (input.packageId) {
      const packages = await clinicalRepository.listPackages(patientId);
      const treatmentPackage = packages.find((item) => item.id === input.packageId);
      if (!treatmentPackage) throw new HttpError(400, 'Treatment package does not belong to this patient');
      if (treatmentPackage.status !== 'ACTIVE' || treatmentPackage.completedSessions + treatmentPackage.reservedSessions >= treatmentPackage.totalSessions) {
        throw new HttpError(409, 'An active package with remaining sessions is required');
      }
    }
    const session = await clinicalRepository.createSession(patientId, input);
    await timelineRepository.create({
      leadId: patient.leadId,
      patientId,
      type: input.followupDate ? 'FOLLOW_UP_SCHEDULED' : 'SESSION_CREATED',
      title: input.followupDate ? 'Follow-up scheduled' : 'Session added',
      description: input.treatmentTaken ?? input.treatmentSuggested,
    });
    return session;
  },

  async listPackages(patientId: string) {
    await ensurePatient(patientId);
    return clinicalRepository.listPackages(patientId);
  },

  async createPackage(patientId: string, input: Parameters<typeof clinicalRepository.createPackage>[1]) {
    await ensurePatient(patientId);
    await ensureBranch(input.branchId);
    return clinicalRepository.createPackage(patientId, input);
  },

  async listFiles(patientId: string) {
    await ensurePatient(patientId);
    return clinicalRepository.listFiles(patientId);
  },

  async createFile(patientId: string, input: Parameters<typeof clinicalRepository.createFile>[1]) {
    const patient = await ensurePatient(patientId);
    const file = await clinicalRepository.createFile(patientId, input);
    await timelineRepository.create({
      leadId: patient.leadId,
      patientId,
      type: 'FILE_ATTACHED',
      title: 'File attached',
      description: file.name,
    });
    return file;
  },
};
