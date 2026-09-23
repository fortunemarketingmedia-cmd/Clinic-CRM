import { MedicineStatus, Role } from '@prisma/client';
import type { z } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { medicineRepository } from '../repositories/medicine.repository.js';
import type { medicineQuerySchema, medicineSchema, medicineUpdateSchema } from '../validations/medicine.validation.js';
import { auditService, type AuditContext } from './audit.service.js';
import readXlsxFile from 'read-excel-file/node';

type Actor = AuditContext & { id: string; role: Role };

function requireAdmin(actor: Actor) {
  if (actor.role !== Role.ADMIN) throw new HttpError(403, 'Medicine master changes require administrator access');
}

async function assertUnique(name: string, strength: string | undefined, excludeId?: string) {
  const duplicate = await medicineRepository.findByNameStrength(name, strength, excludeId);
  if (duplicate) throw new HttpError(409, 'A medicine with this name and strength already exists');
}

type ImportRow = { name: string; genericName?: string; strength?: string; form?: string; status?: MedicineStatus };
type SpreadsheetCell = string | number | boolean | Date | null;
const aliases = { name: ['name', 'medicine name', 'product name', 'item name'], genericName: ['generic name', 'genericname'], strength: ['strength', 'packing', 'pack'], form: ['form', 'dosage form', 'type'], status: ['status'] } as const;
const clean = (value: unknown) => String(value ?? '').trim();
const normalizeHeader = (value: unknown) => clean(value).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

function parseCsv(buffer: Buffer) {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < buffer.length; index += 1) {
    const character = String.fromCharCode(buffer[index]);
    if (character === '"') { if (quoted && String.fromCharCode(buffer[index + 1] ?? 0) === '"') { cell += '"'; index += 1; } else quoted = !quoted; }
    else if (character === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && String.fromCharCode(buffer[index + 1] ?? 0) === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ''; }
    else cell += character;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

async function parseImport(file: Express.Multer.File): Promise<ImportRow[]> {
  const extension = file.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const rows: SpreadsheetCell[][] = extension === '.csv'
    ? parseCsv(file.buffer)
    : (await readXlsxFile(file.buffer)) as unknown as SpreadsheetCell[][];
  const headerRowIndex = rows.findIndex((row) => row.some((cell) =>
    normalizeHeader(cell).includes('item name') || normalizeHeader(cell).includes('medicine name') || normalizeHeader(cell) === 'name',
  ));
  if (headerRowIndex < 0) throw new HttpError(400, 'The import file needs a Medicine Name, Product Name, Item Name, or Name column');
  const sourceRows = rows.slice(headerRowIndex + 1);
  if (!sourceRows.length) throw new HttpError(400, 'The import file must include at least one medicine row');

  const headerRow = rows[headerRowIndex];
  const reportExport = headerRow.length === 1 && /item name\s+packing/.test(clean(headerRow[0]).toLowerCase());
  if (reportExport) {
    const items = sourceRows.flatMap((row) => {
      const line = clean(row[0]);
      if (!/\d+(?:\.\d{1,2})?\s*$/.test(line)) return [];
      const name = line.slice(0, 35).trim();
      if (!name) return [];
      return [{ name, strength: line.slice(35, 43).trim() || undefined, status: MedicineStatus.ACTIVE }];
    });
    if (!items.length) throw new HttpError(400, 'No medicine rows were found in the pharmacy report export');
    if (items.length > 5_000) throw new HttpError(400, 'A maximum of 5,000 medicines can be imported at once');
    return items;
  }

  const headers = headerRow.map((header) => normalizeHeader(header));
  const indexFor = (field: keyof typeof aliases) => headers.findIndex((header) =>
    (aliases[field] as readonly string[]).includes(header),
  );
  const nameIndex = indexFor('name');
  if (nameIndex < 0) throw new HttpError(400, 'The import file needs a Medicine Name, Product Name, Item Name, or Name column');
  const genericNameIndex = indexFor('genericName'); const strengthIndex = indexFor('strength'); const formIndex = indexFor('form'); const statusIndex = indexFor('status');
  const items: ImportRow[] = [];
  for (const [offset, row] of sourceRows.entries()) {
    const name = clean(row[nameIndex]);
    if (!name) continue;
    if (name.length > 160) throw new HttpError(400, `Medicine name on row ${offset + headerRowIndex + 2} exceeds 160 characters`);
    const rawStatus = clean(statusIndex >= 0 ? row[statusIndex] : 'ACTIVE').toUpperCase();
    if (rawStatus && rawStatus !== 'ACTIVE' && rawStatus !== 'INACTIVE') throw new HttpError(400, `Status on row ${offset + headerRowIndex + 2} must be ACTIVE or INACTIVE`);
    items.push({ name, genericName: clean(genericNameIndex >= 0 ? row[genericNameIndex] : undefined) || undefined, strength: clean(strengthIndex >= 0 ? row[strengthIndex] : undefined) || undefined, form: clean(formIndex >= 0 ? row[formIndex] : undefined) || undefined, status: rawStatus === 'INACTIVE' ? MedicineStatus.INACTIVE : MedicineStatus.ACTIVE });
  }
  if (!items.length) throw new HttpError(400, 'No medicine rows were found in the import file');
  if (items.length > 5_000) throw new HttpError(400, 'A maximum of 5,000 medicines can be imported at once');
  return items;
}

export const medicineService = {
  async list(input: z.infer<typeof medicineQuerySchema>) {
    const result = await medicineRepository.list(input);
    return { ...result, totalPages: Math.ceil(result.total / result.pageSize) };
  },
  async listForms() {
    const forms = await medicineRepository.listForms();
    return forms.flatMap((item) => (item.form ? [item.form] : []));
  },
  async create(input: z.infer<typeof medicineSchema>, actor: Actor) {
    requireAdmin(actor);
    await assertUnique(input.name, input.strength);
    const medicine = await medicineRepository.create(input);
    await auditService.record(actor, { action: 'MEDICINE_CREATED', entity: 'Medicine', entityId: medicine.id, newValue: { name: medicine.name, strength: medicine.strength, status: medicine.status } });
    return medicine;
  },
  async import(file: Express.Multer.File | undefined, actor: Actor) {
    requireAdmin(actor);
    if (!file) throw new HttpError(400, 'Choose a CSV or Excel file to import');
    const parsed = await parseImport(file);
    const unique = new Map<string, ImportRow>();
    for (const item of parsed) unique.set(`${item.name.trim().toLowerCase()}\u0000${(item.strength ?? '').trim().toLowerCase()}`, item);
    const result = await medicineRepository.import([...unique.values()]);
    await auditService.record(actor, { action: 'MEDICINE_IMPORT_COMPLETED', entity: 'Medicine', newValue: { fileName: file.originalname, received: parsed.length, imported: result.count, skipped: parsed.length - result.count } });
    return { received: parsed.length, imported: result.count, skipped: parsed.length - result.count };
  },
  async update(id: string, input: z.infer<typeof medicineUpdateSchema>, actor: Actor) {
    requireAdmin(actor);
    const existing = await medicineRepository.findById(id);
    if (!existing) throw new HttpError(404, 'Medicine not found');
    const name = input.name ?? existing.name;
    const strength = input.strength === undefined ? existing.strength ?? undefined : input.strength;
    await assertUnique(name, strength, id);
    const medicine = await medicineRepository.update(id, input);
    await auditService.record(actor, { action: 'MEDICINE_UPDATED', entity: 'Medicine', entityId: id, previousValue: { name: existing.name, strength: existing.strength, status: existing.status }, newValue: { name: medicine.name, strength: medicine.strength, status: medicine.status } });
    return medicine;
  },
  async remove(id: string, actor: Actor) {
    requireAdmin(actor);
    const existing = await medicineRepository.findById(id);
    if (!existing) throw new HttpError(404, 'Medicine not found');
    const references = await medicineRepository.countPrescriptionItems(id);
    if (references > 0) {
      const medicine = existing.status === MedicineStatus.INACTIVE ? existing : await medicineRepository.update(id, { status: MedicineStatus.INACTIVE });
      await auditService.record(actor, { action: 'MEDICINE_DEACTIVATED', entity: 'Medicine', entityId: id, previousValue: { status: existing.status }, newValue: { status: MedicineStatus.INACTIVE, prescriptionReferences: references } });
      return { medicine, deleted: false, message: 'Medicine is used in prescription history and was marked inactive instead.' };
    }
    await medicineRepository.delete(id);
    await auditService.record(actor, { action: 'MEDICINE_DELETED', entity: 'Medicine', entityId: id, previousValue: { name: existing.name, strength: existing.strength } });
    return { medicine: null, deleted: true, message: 'Medicine deleted.' };
  },
};
