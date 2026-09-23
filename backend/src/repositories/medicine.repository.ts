import type { MedicineStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';

type MedicineFilters = {
  search?: string;
  status?: MedicineStatus;
  form?: string;
  sort: 'name_asc' | 'name_desc' | 'created_desc' | 'updated_desc';
  page: number;
  pageSize: number;
};

function where(filters: Pick<MedicineFilters, 'search' | 'status' | 'form'>): Prisma.MedicineWhereInput {
  const search = filters.search?.trim();
  return {
    status: filters.status,
    form: filters.form ? { equals: filters.form, mode: 'insensitive' } : undefined,
    OR: search
      ? [
          { name: { contains: search, mode: 'insensitive' } },
          { genericName: { contains: search, mode: 'insensitive' } },
          { strength: { contains: search, mode: 'insensitive' } },
          { form: { contains: search, mode: 'insensitive' } },
        ]
      : undefined,
  };
}

const orderBy = (sort: MedicineFilters['sort']): Prisma.MedicineOrderByWithRelationInput => {
  if (sort === 'name_desc') return { name: 'desc' };
  if (sort === 'created_desc') return { createdAt: 'desc' };
  if (sort === 'updated_desc') return { updatedAt: 'desc' };
  return { name: 'asc' };
};

export const medicineRepository = {
  async list(filters: MedicineFilters) {
    const query = where(filters);
    const [items, total] = await prisma.$transaction([
      prisma.medicine.findMany({ where: query, orderBy: orderBy(filters.sort), skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
      prisma.medicine.count({ where: query }),
    ]);
    return { items, total, page: filters.page, pageSize: filters.pageSize };
  },
  listForms() {
    return prisma.medicine.findMany({ where: { form: { not: null } }, select: { form: true }, distinct: ['form'], orderBy: { form: 'asc' } });
  },
  findById(id: string) { return prisma.medicine.findUnique({ where: { id } }); },
  findByNameStrength(name: string, strength?: string | null, excludeId?: string) {
    return prisma.medicine.findFirst({ where: { name, strength: strength ?? null, id: excludeId ? { not: excludeId } : undefined } });
  },
  create(data: Prisma.MedicineUncheckedCreateInput) { return prisma.medicine.create({ data }); },
  update(id: string, data: Prisma.MedicineUncheckedUpdateInput) { return prisma.medicine.update({ where: { id }, data }); },
  import(data: Prisma.MedicineCreateManyInput[]) { return prisma.medicine.createMany({ data, skipDuplicates: true }); },
  countPrescriptionItems(id: string) { return prisma.prescriptionItem.count({ where: { medicineId: id } }); },
  delete(id: string) { return prisma.medicine.delete({ where: { id } }); },
};
