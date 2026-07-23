import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  // Remove the legacy demonstration accounts. The Dr. Revive account is updated
  // in place below, preserving its ID for any existing development records.
  const legacyEmails = ['doctor@reviveclinic.local', 'therapist@reviveclinic.local'];
  await prisma.staffSchedule.deleteMany({ where: { user: { email: { in: legacyEmails } } } });
  await prisma.user.deleteMany({ where: { email: { in: legacyEmails } } });

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

  await Promise.all(
    [admin, receptionist].flatMap((user) =>
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
    update: { durationMinutes: 60, bufferMinutes: 15, active: true },
    create: { id: 'service_treatment_session', name: 'Treatment Session', category: 'Treatment', durationMinutes: 60, bufferMinutes: 15, resourceType: 'TREATMENT_ROOM' },
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
    { id: 'medicine_cetirizine_10', name: 'Cetirizine', genericName: 'Cetirizine', strength: '10 mg', form: 'Tablet' },
    { id: 'medicine_doxycycline_100', name: 'Doxycycline', genericName: 'Doxycycline', strength: '100 mg', form: 'Capsule' },
    { id: 'medicine_tretinoin_0025', name: 'Tretinoin', genericName: 'Tretinoin', strength: '0.025%', form: 'Cream' },
  ];
  for (const medicine of medicines) await prisma.medicine.upsert({ where: { id: medicine.id }, update: { ...medicine, status: 'ACTIVE' }, create: { ...medicine, status: 'ACTIVE' } });

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
    { id: 'field_registration_marital', key: 'maritalStatus', label: 'Marital status', type: 'TEXT' as const, required: false, sortOrder: 80 },
    { id: 'field_registration_occupation', key: 'occupation', label: 'Occupation', type: 'TEXT' as const, required: false, sortOrder: 90 },
    { id: 'field_registration_referred', key: 'referredBy', label: 'Referred by', type: 'TEXT' as const, required: false, sortOrder: 100 },
    { id: 'field_registration_skin', key: 'skinConcern', label: 'Skin concern', type: 'TEXT' as const, required: false, sortOrder: 110 },
    { id: 'field_registration_hair', key: 'hairConcern', label: 'Hair concern', type: 'TEXT' as const, required: false, sortOrder: 120 },
    { id: 'field_registration_medical', key: 'medicalHistory', label: 'Medical history', type: 'TEXT' as const, required: false, sortOrder: 130 },
    { id: 'field_registration_medications', key: 'currentMedications', label: 'Current medications', type: 'TEXT' as const, required: false, sortOrder: 140 },
    { id: 'field_registration_allergy', key: 'allergyToDrugs', label: 'Drug allergies', type: 'TEXT' as const, required: false, sortOrder: 150 },
    { id: 'field_registration_scar', key: 'keloidOrHypertrophicScar', label: 'Keloid or hypertrophic scar history', type: 'TEXT' as const, required: false, sortOrder: 160 },
    { id: 'field_registration_products', key: 'productsCurrentlyUsed', label: 'Products currently used', type: 'TEXT' as const, required: false, sortOrder: 170 },
    { id: 'field_registration_menstrual', key: 'menstrualHistory', label: 'Menstrual history', type: 'TEXT' as const, required: false, sortOrder: 180 },
    { id: 'field_registration_pregnancy', key: 'pregnancyStatus', label: 'Pregnancy status', type: 'TEXT' as const, required: false, sortOrder: 190 },
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

  const packageMasters = [
    { id: 'package_master_skin_6', name: 'Skin Rejuvenation — 6 Sessions', description: 'Starter package for a six-session skin treatment plan.', includedServices: ['Treatment Session'], totalSessions: 6, validityDays: 180, price: 30000, taxPercent: 18, maximumDiscountPercent: 10 },
    { id: 'package_master_hair_8', name: 'Hair Restoration — 8 Sessions', description: 'Eight-session hair restoration treatment package.', includedServices: ['Consultation', 'Treatment Session'], totalSessions: 8, validityDays: 240, price: 48000, taxPercent: 18, maximumDiscountPercent: 10 },
  ];
  for (const packageMaster of packageMasters) {
    await prisma.packageMaster.upsert({ where: { id: packageMaster.id }, update: { ...packageMaster, active: true }, create: { ...packageMaster, active: true, transferRules: 'Manager approval required.', pauseRules: 'One pause of up to 30 days.', extensionRules: 'Manager approval and documented reason required.', cancellationRules: 'Subject to consumed sessions and signed agreement.', refundRules: 'Refunds require approval and package-ledger entry.' } });
  }

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
