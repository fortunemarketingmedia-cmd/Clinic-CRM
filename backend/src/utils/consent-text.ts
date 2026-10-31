// Consent text is stored as versioned plain text; see src/data/procedure-consent-catalog.ts for the line format.
export type ConsentBlock = { kind: 'heading' | 'paragraph' | 'statement'; text: string };

export function parseConsentText(consentText: string): ConsentBlock[] {
  return consentText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    if (line.startsWith('# ')) return { kind: 'heading', text: line.slice(2).trim() };
    if (line.startsWith('> ')) return { kind: 'paragraph', text: line.slice(2).trim() };
    return { kind: 'statement', text: line };
  });
}
