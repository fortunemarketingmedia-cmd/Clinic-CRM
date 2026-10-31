import PDFDocument from 'pdfkit';
import { reviveLogoAspectRatio, reviveLogoPng } from '../assets/revive-logo.js';
import { parseConsentText } from '../utils/consent-text.js';

export type ConsentPdfInput = {
  patientName: string; patientNo: string; patientAge?: number | null; patientSex?: string | null; treatmentName?: string;
  templateName: string; templateVersion: number; consentText: string; signerName: string; signedAt: Date; signature: Buffer;
  doctorName?: string; doctorSignature?: Buffer; guardianName?: string; guardianSignature?: Buffer; witnessName?: string;
};

const ink = '#241417';
const muted = '#6b5a5d';
const brand = '#c8202f';
const rule = '#d9c9c4';
const footerHeight = 20; // space reserved above the page margin for the audit line and "Follow us" band
const timeZone = 'Asia/Kolkata';

const formatDate = (value: Date) => value.toLocaleDateString('en-IN', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateTime = (value: Date) => value.toLocaleString('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' });
const formatSex = (value?: string | null) => value ? value.charAt(0) + value.slice(1).toLowerCase() : 'Not recorded';

// Mirrors the clinic's paper consent: logo, title, patient box, acknowledged statements, patient and doctor signatures.
export function buildConsentPdf(input: ConsentPdfInput) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40 + footerHeight, left: 54, right: 54 }, bufferPages: true, info: { Title: input.templateName, Author: 'Revive Skin & Hair Clinic' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const left = doc.page.margins.left; const width = doc.page.width - left - doc.page.margins.right;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (height: number) => { if (doc.y + height > bottomLimit()) doc.addPage(); };

    const blocks = parseConsentText(input.consentText);
    // Long, sectioned forms (IV infusion, Photo Facial) use tighter spacing so they stay on one A4 page like the paper originals.
    const compact = blocks.length > 14; const bodySize = compact ? 9.5 : 10.5; const statementGap = compact ? 3 : 7;
    const logoWidth = compact ? 150 : 190;
    doc.image(reviveLogoPng, (doc.page.width - logoWidth) / 2, doc.y, { width: logoWidth });
    doc.y += logoWidth / reviveLogoAspectRatio + (compact ? 10 : 18);

    doc.font('Helvetica-Bold').fontSize(15).fillColor(ink).text(input.templateName.toUpperCase(), left + 20, doc.y, { width: width - 40, align: 'center', lineGap: 2 });
    const underlineY = doc.y + 6;
    doc.moveTo(left + width * 0.2, underlineY).lineTo(left + width * 0.8, underlineY).lineWidth(0.8).strokeColor(ink).stroke();
    doc.y = underlineY + (compact ? 10 : 16);

    const boxTop = doc.y; const pad = compact ? 10 : 14; const row = compact ? 30 : 36; const column = (width - pad * 2) / 3;
    const field = (label: string, value: string, x: number, y: number, fieldWidth: number) => {
      doc.font('Helvetica').fontSize(9).fillColor(muted).text(label, x, y, { width: fieldWidth, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ink).text(value, x, y + 12, { width: fieldWidth - 8, ellipsis: true, height: 14 });
    };
    field('Name of Patient', `${input.patientName}  (${input.patientNo})`, left + pad, boxTop + pad, width - pad * 2);
    field('Date', formatDate(input.signedAt), left + pad, boxTop + pad + row, column);
    field('Age', input.patientAge != null ? `${input.patientAge} years` : 'Not recorded', left + pad + column, boxTop + pad + row, column);
    field('Sex', formatSex(input.patientSex), left + pad + column * 2, boxTop + pad + row, column);
    let boxBottom = boxTop + pad + row + 28;
    if (input.treatmentName) {
      doc.moveTo(left + pad, boxBottom).lineTo(left + width - pad, boxBottom).lineWidth(0.5).strokeColor(rule).stroke();
      field('Treatment', input.treatmentName, left + pad, boxBottom + 6, width - pad * 2);
      boxBottom += 6 + 28;
    }
    doc.roundedRect(left, boxTop, width, boxBottom - boxTop + pad - 6, 6).lineWidth(0.9).strokeColor(ink).stroke();
    doc.y = boxBottom + pad + (compact ? 2 : 8);

    for (const block of blocks) {
      if (block.kind === 'heading') {
        ensureSpace(40); doc.y += compact ? 2 : 4;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(brand).text(block.text.toUpperCase(), left, doc.y, { width, characterSpacing: 0.3 });
        doc.y += 2; continue;
      }
      if (block.kind === 'paragraph') {
        ensureSpace(28);
        doc.font('Helvetica').fontSize(bodySize).fillColor(ink).text(block.text, left, doc.y, { width, lineGap: 1.5 });
        doc.y += 3; continue;
      }
      const textX = left + 20; const textWidth = width - 20;
      doc.font('Helvetica').fontSize(bodySize);
      ensureSpace(doc.heightOfString(block.text, { width: textWidth, lineGap: 1.5 }) + statementGap);
      const y = doc.y;
      doc.roundedRect(left + 2, y + 1.5, 9, 9, 1.5).fillColor(brand).fill();
      doc.moveTo(left + 4.2, y + 6).lineTo(left + 6, y + 8).lineTo(left + 9, y + 3.8).lineWidth(1.2).strokeColor('#ffffff').stroke();
      doc.fillColor(ink).text(block.text, textX, y, { width: textWidth, lineGap: 1.5 });
      doc.y += statementGap;
    }

    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(muted);
    ensureSpace(144); // note (28) + signature image and rule (68) + title, name and date lines (48)
    doc.text('Each statement above was read, understood and individually acknowledged by the patient before signing.', left, doc.y + 4, { width });
    doc.y += 14;

    const signatureTop = doc.y; const half = (width - 40) / 2;
    const signatureBlock = (x: number, title: string, name: string | undefined, image: Buffer | undefined, align: 'left' | 'right') => {
      if (image) { try { doc.image(image, align === 'left' ? x : x + half - 170, signatureTop, { fit: [170, 62] }); } catch { doc.font('Helvetica-Oblique').fontSize(9).fillColor(muted).text('[Signature recorded securely]', x, signatureTop + 24, { width: half, align }); } }
      const lineY = signatureTop + 68;
      doc.moveTo(x, lineY).lineTo(x + half, lineY).lineWidth(0.6).dash(1.5, { space: 2 }).strokeColor(muted).stroke().undash();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(title, x, lineY + 6, { width: half, align });
      if (name) doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(name, x, lineY + 20, { width: half, align });
      doc.font('Helvetica').fontSize(9.5).fillColor(muted).text(`Date: ${formatDate(input.signedAt)}`, x, lineY + 34, { width: half, align });
    };
    signatureBlock(left, 'Signature of Patient', input.signerName, input.signature, 'left');
    signatureBlock(left + half + 40, 'Signature of Doctor', input.doctorName, input.doctorSignature, 'right');
    doc.y = signatureTop + 68 + 54;

    if (input.guardianName) {
      ensureSpace(110); const y = doc.y;
      if (input.guardianSignature) { try { doc.image(input.guardianSignature, left, y, { fit: [170, 62] }); } catch { /* stored separately */ } }
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(`Guardian: ${input.guardianName}`, left, y + 70, { width });
      doc.y = y + 90;
    }
    if (input.witnessName) doc.font('Helvetica').fontSize(9.5).fillColor(ink).text(`Staff witness: ${input.witnessName}`, left, doc.y, { width });

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      const bandY = doc.page.height - 30;
      doc.font('Helvetica').fontSize(7).fillColor(muted).text(`Digitally signed ${formatDateTime(input.signedAt)} IST · Consent template v${input.templateVersion} · Immutable record generated by Revive Clinic CRM · Page ${index - range.start + 1} of ${range.count}`, left, bandY - 16, { width, align: 'center', lineBreak: false });
      doc.roundedRect(left + width * 0.18, bandY, width * 0.64, 22, 11).fillColor('#3a3335').fill();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('Follow us: @revive_skinclinic_laser', left, bandY + 6.5, { width, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
