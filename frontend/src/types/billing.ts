import type { Branch } from '@/types/branch';
import type { Patient } from '@/types/patient';

export type Invoice = {
  id: string;
  invoiceNo: string;
  patientId: string;
  branchId: string;
  invoiceDate: string;
  serviceName: string;
  consultationFee: string;
  packageFee: string;
  discount: string;
  gstAmount: string;
  totalAmount: string;
  paidAmount: string;
  status: 'DRAFT' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  patient?: Patient;
  branch?: Branch;
};
