import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConsentText } from '../utils/consent-text.js';
import { consentLinkedServices, procedureConsentCatalog } from './procedure-consent-catalog.js';

test('procedure consent catalogue contains the 14 clinic packet forms, the HPV vaccination form and the general fallback', () => {
  assert.equal(procedureConsentCatalog.length, 16);
  assert.equal(new Set(procedureConsentCatalog.map((item) => item.id)).size, procedureConsentCatalog.length);
  assert.equal(new Set(procedureConsentCatalog.map((item) => item.key)).size, procedureConsentCatalog.length);
  for (const consent of procedureConsentCatalog) {
    assert.equal(consent.type, 'PROCEDURE_SPECIFIC_CONSENT');
    assert.ok(consent.name.length >= 3);
    assert.equal(consent.requiresGuardian, false);
    assert.equal(consent.requiresWitness, false);
  }
});

test('statement counts match the paper forms', () => {
  const expected: Record<string, number> = {
    'procedure-laser-hair-reduction': 11, 'procedure-hifu': 7, 'procedure-iv-infusion': 10, 'procedure-intralesional-injections': 7,
    'procedure-prp-mesotherapy': 8, 'procedure-photo-facial': 11, 'procedure-dermaroller': 8, 'procedure-minor-skin-surgery': 8,
    'procedure-filler': 11, 'procedure-botox': 11, 'procedure-chemical-peel': 8, 'procedure-radiofrequency-ablation': 8,
    'procedure-q-switch-nd-yag': 7, 'procedure-laser-scars-stretch-marks': 8, 'procedure-hpv-vaccination': 13, 'procedure-general-treatment': 6,
  };
  for (const consent of procedureConsentCatalog) {
    const statements = parseConsentText(consent.consentText).filter((block) => block.kind === 'statement');
    assert.equal(statements.length, expected[consent.key], consent.key);
  }
});

test('sectioned forms keep their headings', () => {
  const iv = parseConsentText(procedureConsentCatalog.find((item) => item.key === 'procedure-iv-infusion')!.consentText);
  assert.deepEqual(iv.filter((block) => block.kind === 'heading').map((block) => block.text), ['Procedure description', 'Risks and possible side effects', 'Contraindications', 'Voluntary consent', 'Liability waiver', 'Emergency consent']);
});

test('HPV vaccination form keeps the paper sections and has a linked treatment service', () => {
  const hpv = parseConsentText(procedureConsentCatalog.find((item) => item.key === 'procedure-hpv-vaccination')!.consentText);
  assert.deepEqual(hpv.filter((block) => block.kind === 'heading').map((block) => block.text), ['Vaccine information', 'Benefits explained', 'Possible side effects', 'Contraindications / precautions', 'Consent statement']);
  assert.equal(hpv.filter((block) => block.kind === 'paragraph').length, 1);
  const service = consentLinkedServices.find((item) => item.name === 'HPV Vaccination');
  assert.ok(service);
  assert.equal(service.resourceType, 'TREATMENT_ROOM');
  assert.equal('basePrice' in service, false);
});
