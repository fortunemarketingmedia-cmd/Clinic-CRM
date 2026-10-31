// Transcribed from the clinic's scanned consent packet ("Consent Form .pdf", 14 forms) supplied on 31 October 2026.
// Wording follows the paper forms; only evident print typos were corrected (e.g. "Melia" -> "Milia", "settings" -> "sittings",
// "local aesthetic" -> "local anaesthetic", Title Case sentences -> sentence case).
//
// consentText is line based so it can be versioned as plain text and rendered identically in the UI and the signed PDF:
//   "# Heading"  section heading (not acknowledged)
//   "> Text"     explanatory paragraph (not acknowledged)
//   any other    a statement the patient must acknowledge before signing
type ProcedureConsentSeed = { id: string; key: string; name: string; lines: string[] };

const explainedIndications = 'I have been explained the indications, mode of action, aftercare to be taken and possible side effects.';
const photographConsent = 'I give consent to photograph myself for clinical assessment.';
const trueHistory = 'I have provided my true medical and surgical history to the treating doctor.';
const aftercareExplained = 'I have been explained the aftercare well.';
const localAnaesthesia = 'I give consent to local anesthesia and I have no known allergy to it.';
const redness48To72 = 'I have been explained that this may give redness, crusting/bruising post procedure for 48–72 hours.';
const sittingsVary = 'The result of the procedure and number of sittings for desired result vary from person to person.';
const peelingUpTo7Days = 'I have been explained that this may cause redness, crusting, visible peeling of skin up to 7 days.';
const topicalAnaesthesia = 'I give consent to use topical anaesthesia on me and inform that I am not allergic to it.';
const sideEffectsExplained = 'I have been explained the probable side effects of the procedure.';
const prePostPhotographs = 'I have given consent for pre and post photographs to be taken.';
const fullHistory = 'I have given all my medical and surgical history from past and present relevant to the procedure.';
const notPregnantNeuro = 'I confirm that I am not pregnant or have any neurological disease.';

const seeds: ProcedureConsentSeed[] = [
  {
    id: 'consent_procedure_laser_hair_reduction', key: 'procedure-laser-hair-reduction', name: 'Informed Consent for Laser Hair Reduction',
    lines: [
      'I have been explained the procedure of laser hair reduction by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      'I have been explained that it does not work on grey hair.',
      'I have been explained that this may give redness, crusting/scabbing post procedure.',
      'I give consent to local anesthetic application and I have no known allergy to its components.',
      photographConsent,
      trueHistory,
      'I do not suffer from asthma/epilepsy/neurologic disorder.',
      'The result of the procedure may vary from person to person and require multiple sittings.',
      'The results of laser hair reduction in case of hirsutism or hormonal imbalance depend on concurrent endocrine treatment.',
      'I agree to do advised medical tests and follow endocrine treatment if need be.',
    ],
  },
  {
    id: 'consent_procedure_hifu', key: 'procedure-hifu', name: 'Informed Consent for HIFU',
    lines: [
      'I have been explained the procedure of high intensity focused ultrasound by the treating doctor in detail and in the language I best understand.',
      'I have been explained the indication, mode of action, aftercare to be taken and possible side effects.',
      'I have been explained that this procedure may cause redness lasting 24–48 hours.',
      'I have been tested for sensitivity to local anaesthetic.',
      photographConsent,
      trueHistory,
      'The results of the procedure and number of sittings for desired results may vary from person to person.',
    ],
  },
  {
    id: 'consent_procedure_iv_infusion', key: 'procedure-iv-infusion', name: 'Informed Consent for IV Nutrient / Cosmetic Infusion Therapy',
    lines: [
      '# Procedure description',
      '> I understand that I will receive an intravenous (IV) infusion therapy, which may include combinations of nutrients and antioxidants such as:',
      'Glutathione ("Reglow" drip), Vitamin C and other vitamins, collagen-support formulations, hair-fall control nutrient blends.',
      'This treatment is administered through a vein under medical supervision.',
      '# Risks and possible side effects',
      '> I understand that possible risks include, but are not limited to:',
      'Pain, swelling, or bruising at injection site; infection or inflammation of the vein (phlebitis).',
      'Allergic reactions (mild to severe), nausea, dizziness, headache; rare complications affecting kidneys, liver, or other organs.',
      'I understand that unforeseen complications may occur.',
      '# Contraindications',
      '> I confirm that I have informed the doctor about:',
      'Any allergies, existing medical conditions (e.g., kidney, liver, heart disease), pregnancy or breastfeeding, current medications or supplements.',
      '# Voluntary consent',
      'I have had the opportunity to ask questions; my questions have been answered satisfactorily.',
      'I understand the risks, benefits, and alternatives; I am voluntarily consenting to this procedure.',
      '# Liability waiver',
      'I understand that results are not guaranteed and I will not hold the clinic or medical staff liable for lack of desired cosmetic outcome, provided standard care is followed.',
      '# Emergency consent',
      'In case of an emergency, I authorize the medical team to provide necessary treatment.',
    ],
  },
  {
    id: 'consent_procedure_intralesional', key: 'procedure-intralesional-injections', name: 'Informed Consent for Intralesional Injections',
    lines: [
      'I have been explained the procedure of intralesional injections by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      redness48To72,
      localAnaesthesia,
      photographConsent,
      trueHistory,
      'I have been explained that results may vary from person to person.',
    ],
  },
  {
    id: 'consent_procedure_prp_mesotherapy', key: 'procedure-prp-mesotherapy', name: 'Informed Consent for Mesotherapy / Platelet Rich Plasma',
    lines: [
      'I have been explained the nature of procedure in detail and in the language I best understand.',
      explainedIndications,
      redness48To72,
      localAnaesthesia,
      photographConsent,
      trueHistory,
      'I have been explained that result may vary from person to person.',
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_photo_facial', key: 'procedure-photo-facial', name: 'Photo Facial Treatment Consent Form',
    lines: [
      '# Procedure information',
      'I understand that I will undergo a Photo Facial, a non-invasive cosmetic procedure that uses light energy to improve skin appearance, including pigmentation, sun damage, acne marks, redness, and uneven skin tone.',
      '# Benefits explained',
      'Improves skin tone and texture; reduces pigmentation and sun spots.',
      'Helps with acne marks and redness; non-surgical with minimal downtime.',
      '# Possible risks & side effects',
      '> I understand that although the procedure is generally safe, possible side effects include:',
      'Temporary redness, swelling, or mild discomfort; skin sensitivity or irritation.',
      'Hyperpigmentation or hypopigmentation (rare); need for multiple sessions for desired results.',
      '# Contraindications / precautions',
      'I have informed the doctor of all medical conditions; I am not pregnant or have disclosed pregnancy status.',
      'I am not taking photosensitizing medications; no recent tanning, sunburn, or active skin infection in treatment area.',
      '# Pre- & post-treatment instructions',
      'I should avoid sun exposure before and after treatment; sunscreen use is mandatory.',
      'Multiple sessions may be required; results vary from person to person.',
      '# Consent statement',
      'The procedure, its benefits, risks, and alternatives have been explained to me.',
      'I have had the opportunity to ask questions. I voluntarily consent to undergo Photo Facial Treatment.',
    ],
  },
  {
    id: 'consent_procedure_dermaroller', key: 'procedure-dermaroller', name: 'Informed Consent for Dermaroller',
    lines: [
      'I have been explained the procedure of dermaroller by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      redness48To72,
      localAnaesthesia,
      photographConsent,
      trueHistory,
      'I have been explained that result may vary from person to person.',
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_minor', key: 'procedure-minor-skin-surgery',
    name: 'Informed Consent for Tattoo Removal / Sebaceous Cyst Excision / Biopsy / Ear Lobe Repair / Milia Extraction / Molluscum Extraction',
    lines: [
      'I have been explained the procedure by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      redness48To72,
      localAnaesthesia,
      'I give consent for use of suture material and I have no known allergy to it.',
      photographConsent,
      trueHistory,
      'I have been explained that results may vary from person to person.',
    ],
  },
  {
    id: 'consent_procedure_filler', key: 'procedure-filler', name: 'Informed Consent for Filler',
    lines: [
      'I have been explained the indication and the procedure of hyaluronic acid injections by the doctor in detail and in the language I best understand.',
      'I have been informed that it helps to boost volume on the part of my face that is treated, giving the skin rejuvenation and hydration.',
      'The results may last up to 9 months to 1 year.',
      'The results may vary from person to person.',
      'I may have redness or temporary bruising and swelling after the session.',
      topicalAnaesthesia,
      sideEffectsExplained,
      prePostPhotographs,
      fullHistory,
      notPregnantNeuro,
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_botox', key: 'procedure-botox', name: 'Informed Consent for BTX-A / Botox',
    lines: [
      'I have been explained the procedure of botulinum toxin injections by the doctor in detail and in the language I best understand.',
      'I have been informed that it helps to reduce dynamic wrinkles on the part of my face that is treated.',
      'It may take 7 days to take effect and the results may last up to 4–6 months.',
      'The results may vary from person to person.',
      'I may have redness or temporary bruising after the session.',
      topicalAnaesthesia,
      sideEffectsExplained,
      prePostPhotographs,
      fullHistory,
      notPregnantNeuro,
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_chemical_peel', key: 'procedure-chemical-peel', name: 'Informed Consent for Chemical Peel',
    lines: [
      'I have been explained the procedure of chemical peel by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      peelingUpTo7Days,
      'I have been tested for sensitivity against ingredients by doing patch test 48 hours ago.',
      photographConsent,
      trueHistory,
      sittingsVary,
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_rfa', key: 'procedure-radiofrequency-ablation', name: 'Informed Consent for Radiofrequency Ablation',
    lines: [
      'I have been explained the procedure of radiofrequency ablation by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      redness48To72,
      localAnaesthesia,
      photographConsent,
      trueHistory,
      'I have been explained that result may vary from person to person.',
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_q_switch', key: 'procedure-q-switch-nd-yag', name: 'Informed Consent for Q-Switch Nd:YAG Laser Treatment',
    lines: [
      'I have been explained the procedure of Q-Switch Nd:YAG laser treatment by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      peelingUpTo7Days,
      photographConsent,
      trueHistory,
      sittingsVary,
      aftercareExplained,
    ],
  },
  {
    id: 'consent_procedure_scars', key: 'procedure-laser-scars-stretch-marks', name: 'Informed Consent of Laser for Scars & Stretch Marks',
    lines: [
      'I have been explained the procedure of laser for scars by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      'I have been explained that this may give redness, crusting/scabbing post procedure for 48–72 hours. Also it may cause post-inflammatory hyperpigmentation in some cases.',
      'I give consent to local anesthetic to be applied on my face and I have no known allergy to its components.',
      photographConsent,
      trueHistory,
      sittingsVary,
      aftercareExplained,
    ],
  },
  {
    // Not in the clinic packet: used only for services with no matching paper form (e.g. Hydrafacial, microblading).
    // Built solely from statements that are common to every form in the packet; confirm with the clinic before go-live.
    id: 'consent_procedure_general', key: 'procedure-general-treatment', name: 'Informed Consent for Treatment',
    lines: [
      'I have been explained the procedure by the treating doctor in detail and in the language I best understand.',
      explainedIndications,
      photographConsent,
      trueHistory,
      'I have been explained that results may vary from person to person.',
      aftercareExplained,
    ],
  },
];

export const procedureConsentCatalog = seeds.map(({ lines, ...item }) => ({
  ...item,
  type: 'PROCEDURE_SPECIFIC_CONSENT' as const,
  consentText: lines.join('\n'),
  requiresGuardian: false,
  requiresWitness: false,
}));
