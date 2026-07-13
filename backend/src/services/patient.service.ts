import type { Role, Sex } from '@prisma/client';
import { LeadStatus, Role as RoleEnum } from '@prisma/client';
import { branchRepository } from '../repositories/branch.repository.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { patientRepository } from '../repositories/patient.repository.js';
import { timelineRepository } from '../repositories/timeline.repository.js';
import { HttpError } from '../utils/http-error.js';

function requireBranchForReceptionist(role: Role, branchId?: string) {
  if (role === RoleEnum.RECEPTIONIST && !branchId) {
    throw new HttpError(400, 'Receptionist requests must include a branchId');
  }
}

async function ensureBranchExists(branchId?: string) {
  if (!branchId) return;
  const branch = await branchRepository.exists(branchId);
  if (!branch) throw new HttpError(404, 'Branch not found');
}

export const patientService = {
  async listPatients(filters: { branchId?: string; search?: string; role: Role }) {
    requireBranchForReceptionist(filters.role, filters.branchId);
    await ensureBranchExists(filters.branchId);
    return patientRepository.list(filters);
  },

  async getPatient(id: string) {
    const patient = await patientRepository.findById(id);
    if (!patient) throw new HttpError(404, 'Patient not found');
    return patient;
  },

  async getPatientTimeline(id: string) {
    await this.getPatient(id);
    return timelineRepository.listForPatient(id);
  },

  async convertLead(input: {
    leadId: string;
    fullName?: string;
    mobile?: string;
    email?: string;
    age?: number;
    sex?: Sex;
    address?: string;
    occupation?: string;
    maritalStatus?: string;
  }) {
    const lead = await leadRepository.findById(input.leadId);
    if (!lead) throw new HttpError(404, 'Lead not found');

    const existingPatient = await patientRepository.findByLeadId(input.leadId);
    if (existingPatient) throw new HttpError(409, 'Patient already exists for this lead');

    const duplicates = await patientRepository.findDuplicates({ mobile: input.mobile ?? lead.mobile, email: input.email ?? lead.email ?? undefined });
    if (duplicates.length) throw new HttpError(409, 'Existing patient found with the same mobile or email');

    const convertibleStatuses: LeadStatus[] = [LeadStatus.ARRIVED, LeadStatus.CONFIRMED, LeadStatus.BOOKED];

    if (!convertibleStatuses.includes(lead.status)) {
      throw new HttpError(409, 'Lead must be booked, confirmed, or arrived before patient conversion');
    }

    const patient = await patientRepository.convertLead({
      leadId: lead.id,
      branchId: lead.branchId,
      patientNo: await patientRepository.nextPatientNo(),
      qrToken: patientRepository.createQrToken(),
      fullName: input.fullName ?? lead.name,
      mobile: input.mobile ?? lead.mobile,
      email: input.email ?? lead.email ?? undefined,
      age: input.age,
      sex: input.sex,
      address: input.address ?? lead.address ?? undefined,
      occupation: input.occupation,
      maritalStatus: input.maritalStatus,
    });
    await timelineRepository.create({
      leadId: lead.id,
      patientId: patient.id,
      type: 'PATIENT_CREATED',
      title: 'Lead converted to patient',
      description: patient.patientNo,
    });
    return patient;
  },

  async createPatient(input: {
    branchId: string;
    referredBy?: string;
    fullName: string;
    email?: string;
    age?: number;
    sex?: Sex;
    mobile: string;
    address?: string;
    maritalStatus?: string;
    occupation?: string;
    skinConcern?: string;
    hairConcern?: string;
    medicalHistory?: string;
    currentMedications?: string;
    allergyToDrugs?: string;
    keloidOrHypertrophicScar?: string;
    productsCurrentlyUsed?: string;
    menstrualHistory?: string;
    pregnancyStatus?: string;
    notes?: string;
  }) {
    await ensureBranchExists(input.branchId);
    const duplicates = await leadRepository.findDuplicates({ mobile: input.mobile, email: input.email });
    if (duplicates.leads.length || duplicates.patients.length) {
      throw new HttpError(409, 'Existing record found with the same mobile or email');
    }

    const patient = await patientRepository.createFromClinicQr({
      branchId: input.branchId,
      patientNo: await patientRepository.nextPatientNo(),
      qrToken: patientRepository.createQrToken(),
      fullName: input.fullName,
      mobile: input.mobile,
      email: input.email,
      age: input.age,
      sex: input.sex,
      address: input.address,
      maritalStatus: input.maritalStatus,
      occupation: input.occupation,
      medicalProfile: {
        referredBy: input.referredBy,
        skinConcern: input.skinConcern,
        hairConcern: input.hairConcern,
        medicalHistory: input.medicalHistory,
        currentMedications: input.currentMedications,
        allergyToDrugs: input.allergyToDrugs,
        keloidOrHypertrophicScar: input.keloidOrHypertrophicScar,
        productsCurrentlyUsed: input.productsCurrentlyUsed,
        menstrualHistory: input.menstrualHistory,
        pregnancyStatus: input.pregnancyStatus,
        notes: input.notes,
      },
    });
    await timelineRepository.create({
      leadId: patient.leadId,
      patientId: patient.id,
      type: 'PATIENT_CREATED',
      title: 'Patient created',
      description: patient.patientNo,
    });
    return patient;
  },

  async updatePatient(
    id: string,
    input: Partial<{
      fullName: string;
      mobile: string;
      email: string;
      age: number;
      sex: Sex;
      address: string;
      occupation: string;
      maritalStatus: string;
    }>,
  ) {
    await this.getPatient(id);
    const patient = await patientRepository.update(id, input);
    await timelineRepository.create({
      leadId: patient.leadId,
      patientId: patient.id,
      type: 'PATIENT_UPDATED',
      title: 'Patient details updated',
    });
    return patient;
  },

  async upsertMedicalProfile(patientId: string, input: Record<string, string | undefined>) {
    await this.getPatient(patientId);
    const profile = await patientRepository.upsertMedicalProfile(patientId, input);
    const patient = await this.getPatient(patientId);
    await timelineRepository.create({
      leadId: patient.leadId,
      patientId,
      type: 'MEDICAL_PROFILE_UPDATED',
      title: 'Medical profile updated',
    });
    return profile;
  },

  async getQrRegistration(qrToken: string) {
    if (qrToken === 'clinic') {
      return {
        patientNo: 'New walk-in patient',
        fullName: '',
        mobile: '',
        branch: null,
        branches: await branchRepository.list(),
        medicalProfile: null,
      };
    }

    const lead = await leadRepository.findByQrToken(qrToken);

    if (lead) {
      return {
        patientNo: lead.patient?.patientNo ?? 'New patient',
        fullName: lead.patient?.fullName ?? lead.name,
        mobile: lead.patient?.mobile ?? lead.mobile,
        branch: lead.branch,
        medicalProfile: null,
      };
    }

    const patient = await patientRepository.findByQrToken(qrToken);
    if (!patient) throw new HttpError(404, 'Registration link not found');

    return {
      patientNo: patient.patientNo,
      fullName: patient.fullName,
      mobile: patient.mobile,
      branch: patient.branch,
      medicalProfile: patient.medicalProfile,
    };
  },

  async submitQrRegistration(
    qrToken: string,
    input: {
      fullName: string;
      mobile: string;
      email?: string;
      age?: number;
      sex?: Sex;
      address?: string;
      maritalStatus?: string;
      occupation?: string;
      referredBy?: string;
      branchId?: string;
      skinConcern?: string;
      hairConcern?: string;
      medicalHistory?: string;
      currentMedications?: string;
      allergyToDrugs?: string;
      keloidOrHypertrophicScar?: string;
      productsCurrentlyUsed?: string;
      menstrualHistory?: string;
      pregnancyStatus?: string;
      notes?: string;
    },
  ) {
    if (qrToken === 'clinic') {
      if (!input.branchId) {
        throw new HttpError(400, 'Branch is required for clinic QR registration');
      }

      await ensureBranchExists(input.branchId);

      const duplicates = await leadRepository.findDuplicates({ mobile: input.mobile, email: input.email });
      if (duplicates.leads.length || duplicates.patients.length) {
        throw new HttpError(409, 'Existing record found with the same mobile or email');
      }

      const patient = await patientRepository.createFromClinicQr({
        branchId: input.branchId,
        patientNo: await patientRepository.nextPatientNo(),
        qrToken: patientRepository.createQrToken(),
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        age: input.age,
        sex: input.sex,
        address: input.address,
        maritalStatus: input.maritalStatus,
        occupation: input.occupation,
        medicalProfile: {
          referredBy: input.referredBy,
          skinConcern: input.skinConcern,
          hairConcern: input.hairConcern,
          medicalHistory: input.medicalHistory,
          currentMedications: input.currentMedications,
          allergyToDrugs: input.allergyToDrugs,
          keloidOrHypertrophicScar: input.keloidOrHypertrophicScar,
          productsCurrentlyUsed: input.productsCurrentlyUsed,
          menstrualHistory: input.menstrualHistory,
          pregnancyStatus: input.pregnancyStatus,
          notes: input.notes,
        },
      });
      await timelineRepository.create({
        leadId: patient.leadId,
        patientId: patient.id,
        type: 'QR_FORM_SUBMITTED',
        title: 'QR form submitted',
        description: patient.patientNo,
      });
      return patient;
    }

    const lead = await leadRepository.findByQrToken(qrToken);

    if (lead) {
      if (lead.patient) {
        const patient = await patientRepository.submitQrProfile(
          lead.patient.qrToken,
          {
            fullName: input.fullName,
            mobile: input.mobile,
            email: input.email,
            age: input.age,
            sex: input.sex,
            address: input.address,
            maritalStatus: input.maritalStatus,
            occupation: input.occupation,
          },
          {
            referredBy: input.referredBy,
            skinConcern: input.skinConcern,
            hairConcern: input.hairConcern,
            medicalHistory: input.medicalHistory,
            currentMedications: input.currentMedications,
            allergyToDrugs: input.allergyToDrugs,
            keloidOrHypertrophicScar: input.keloidOrHypertrophicScar,
            productsCurrentlyUsed: input.productsCurrentlyUsed,
            menstrualHistory: input.menstrualHistory,
            pregnancyStatus: input.pregnancyStatus,
            notes: input.notes,
          },
        );
        await timelineRepository.create({
          leadId: lead.id,
          patientId: patient.id,
          type: 'QR_FORM_SUBMITTED',
          title: 'QR form submitted',
        });
        return patient;
      }

      const convertibleStatuses: LeadStatus[] = [LeadStatus.ARRIVED, LeadStatus.CONFIRMED, LeadStatus.BOOKED];

      if (!convertibleStatuses.includes(lead.status)) {
        throw new HttpError(409, 'Lead must be confirmed or arrived before QR registration creates a patient');
      }

      const patient = await patientRepository.convertLeadWithProfile({
        leadId: lead.id,
        branchId: lead.branchId,
        patientNo: await patientRepository.nextPatientNo(),
        qrToken: patientRepository.createQrToken(),
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        age: input.age,
        sex: input.sex,
        address: input.address,
        maritalStatus: input.maritalStatus,
        occupation: input.occupation,
        medicalProfile: {
          referredBy: input.referredBy,
          skinConcern: input.skinConcern,
          hairConcern: input.hairConcern,
          medicalHistory: input.medicalHistory,
          currentMedications: input.currentMedications,
          allergyToDrugs: input.allergyToDrugs,
          keloidOrHypertrophicScar: input.keloidOrHypertrophicScar,
          productsCurrentlyUsed: input.productsCurrentlyUsed,
          menstrualHistory: input.menstrualHistory,
          pregnancyStatus: input.pregnancyStatus,
          notes: input.notes,
        },
      });
      await timelineRepository.create({
        leadId: lead.id,
        patientId: patient.id,
        type: 'QR_FORM_SUBMITTED',
        title: 'QR form submitted',
        description: patient.patientNo,
      });
      return patient;
    }

    const patient = await patientRepository.findByQrToken(qrToken);
    if (!patient) throw new HttpError(404, 'Registration link not found');

    const updatedPatient = await patientRepository.submitQrProfile(
      qrToken,
      {
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        age: input.age,
        sex: input.sex,
        address: input.address,
        maritalStatus: input.maritalStatus,
        occupation: input.occupation,
      },
      {
        referredBy: input.referredBy,
        skinConcern: input.skinConcern,
        hairConcern: input.hairConcern,
        medicalHistory: input.medicalHistory,
        currentMedications: input.currentMedications,
        allergyToDrugs: input.allergyToDrugs,
        keloidOrHypertrophicScar: input.keloidOrHypertrophicScar,
        productsCurrentlyUsed: input.productsCurrentlyUsed,
        menstrualHistory: input.menstrualHistory,
        pregnancyStatus: input.pregnancyStatus,
        notes: input.notes,
      },
    );
    await timelineRepository.create({
      leadId: updatedPatient.leadId,
      patientId: updatedPatient.id,
      type: 'QR_FORM_SUBMITTED',
      title: 'QR form submitted',
    });
    return updatedPatient;
  },
};
