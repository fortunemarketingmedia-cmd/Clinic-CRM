// Maps a treatment service (Schedules & Rooms catalogue) to the clinic's paper consent forms.
// Keys match backend/src/data/procedure-consent-catalog.ts. A combined service (e.g. "Underarms Q Switch + Peel")
// needs every matching form; services with no paper form fall back to the general treatment consent.
export const generalConsentKey = 'procedure-general-treatment';

const rules: Array<{ key: string; test: (name: string) => boolean }> = [
  { key: 'procedure-laser-hair-reduction', test: (name) => /laser hair reduction|\bdiode\b/.test(name) },
  { key: 'procedure-hifu', test: (name) => /\bhifu\b/.test(name) },
  { key: 'procedure-iv-infusion', test: (name) => /\bdrip\b|\biv\b|infusion|glut(a|ha|ah)thione/.test(name) },
  { key: 'procedure-intralesional-injections', test: (name) => /intralesional/.test(name) },
  { key: 'procedure-prp-mesotherapy', test: (name) => /\bprp\b|platelet|meso ?therapy|growth factor|\bgfc\b/.test(name) },
  { key: 'procedure-photo-facial', test: (name) => /photo ?facial|\bipl\b/.test(name) },
  { key: 'procedure-dermaroller', test: (name) => /dermaroller|dermapen/.test(name) },
  { key: 'procedure-minor-skin-surgery', test: (name) => /tattoo|cyst|biopsy|ear ?lobe repair|milia|molluscum|corn removal|nail (surgery|avulsion)|xanthelasma/.test(name) },
  { key: 'procedure-filler', test: (name) => /filler|volbella|voluma|volift|hyaluronic|profh?ilo|skin ?vive|skin booster/.test(name) },
  { key: 'procedure-botox', test: (name) => /botox|\bbtx|botulinum/.test(name) },
  // A CO2 "deep peel" is laser resurfacing, not a chemical peel.
  { key: 'procedure-chemical-peel', test: (name) => /\bpeel\b/.test(name) && !/co2|fractional/.test(name) },
  { key: 'procedure-radiofrequency-ablation', test: (name) => /radiofrequency ablation|\brfa\b/.test(name) },
  { key: 'procedure-q-switch-nd-yag', test: (name) => /q[ -]?switch|nd[ :-]?yag|laser toning/.test(name) },
  { key: 'procedure-laser-scars-stretch-marks', test: (name) => /scar|stretch mark|fractional|\bmnrf\b|\bco2\b/.test(name) },
];

export function consentKeysForTreatment(serviceName: string) {
  const name = serviceName.toLowerCase();
  const keys = rules.filter((rule) => rule.test(name)).map((rule) => rule.key);
  return keys.length ? keys : [generalConsentKey];
}

export type ConsentBlock = { kind: 'heading' | 'paragraph' | 'statement'; text: string; statementIndex?: number };

// Same line format as backend/src/utils/consent-text.ts: "# " heading, "> " paragraph, otherwise an acknowledged statement.
export function parseConsentText(consentText: string): ConsentBlock[] {
  let statementIndex = 0;
  return consentText.split('\n').map((line) => line.trim()).filter(Boolean).map((line): ConsentBlock => {
    if (line.startsWith('# ')) return { kind: 'heading', text: line.slice(2).trim() };
    if (line.startsWith('> ')) return { kind: 'paragraph', text: line.slice(2).trim() };
    return { kind: 'statement', text: line, statementIndex: statementIndex++ };
  });
}
