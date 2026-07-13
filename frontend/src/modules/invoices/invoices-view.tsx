'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FileText } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Branch } from '@/types/branch';
import type { Invoice } from '@/types/billing';
import type { Patient } from '@/types/patient';

const invoiceSchema = z.object({
  patientId: z.string().min(1),
  branchId: z.string().min(1),
  serviceName: z.string().min(2),
  consultationFee: z.coerce.number().min(0).default(0),
  packageFee: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  gstAmount: z.coerce.number().min(0).default(0),
});

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  patientId: z.string().min(1),
  amount: z.coerce.number().positive(),
  mode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER']),
  reference: z.string().optional(),
});

export function InvoicesView() {
  const queryClient = useQueryClient();
  const { selectedBranchId, setSelectedBranchId } = useSessionStore();
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: () => apiRequest<{ data: Branch[] }>('/branches') });
  const branches = branchesQuery.data?.data ?? [];
  const activeBranchId = selectedBranchId ?? branches[0]?.id ?? '';

  useEffect(() => {
    if (!selectedBranchId && branches[0]?.id) setSelectedBranchId(branches[0].id);
  }, [branches, selectedBranchId, setSelectedBranchId]);

  const patientsQuery = useQuery({
    queryKey: ['billing-patients', activeBranchId],
    queryFn: () => apiRequest<{ data: Patient[] }>(`/patients?branchId=${activeBranchId}`),
    enabled: Boolean(activeBranchId),
  });
  const invoicesQuery = useQuery({
    queryKey: ['invoices', activeBranchId],
    queryFn: () => apiRequest<{ data: Invoice[] }>(`/billing/invoices?branchId=${activeBranchId}`),
    enabled: Boolean(activeBranchId),
  });

  const invoiceForm = useForm<z.infer<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { branchId: activeBranchId, serviceName: '', consultationFee: 0, packageFee: 0, discount: 0, gstAmount: 0 },
  });
  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { mode: 'UPI' },
  });

  useEffect(() => {
    if (activeBranchId) invoiceForm.setValue('branchId', activeBranchId);
  }, [activeBranchId, invoiceForm]);

  const createInvoice = useMutation({
    mutationFn: (values: z.infer<typeof invoiceSchema>) =>
      apiRequest<{ data: Invoice }>('/billing/invoices', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      invoiceForm.reset({ branchId: activeBranchId, serviceName: '', consultationFee: 0, packageFee: 0, discount: 0, gstAmount: 0 });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const addPayment = useMutation({
    mutationFn: (values: z.infer<typeof paymentSchema>) =>
      apiRequest(`/billing/invoices/${values.invoiceId}/payments`, { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => {
      paymentForm.reset({ mode: 'UPI', invoiceId: '', patientId: '', amount: 0, reference: '' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Create invoices, track payments, and generate PDFs.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <div className="space-y-5">
          <Card>
            <h2 className="font-semibold">Create Invoice</h2>
            <form className="mt-4 space-y-3" onSubmit={invoiceForm.handleSubmit((values) => createInvoice.mutate(values))}>
              <Select {...invoiceForm.register('patientId')}>
                <option value="">Select patient</option>
                {patientsQuery.data?.data.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}
              </Select>
              <Input placeholder="Service name" {...invoiceForm.register('serviceName')} />
              <Input type="number" placeholder="Consultation fee" {...invoiceForm.register('consultationFee')} />
              <Input type="number" placeholder="Package fee" {...invoiceForm.register('packageFee')} />
              <Input type="number" placeholder="GST amount" {...invoiceForm.register('gstAmount')} />
              <Input type="number" placeholder="Discount" {...invoiceForm.register('discount')} />
              <Button type="submit" disabled={createInvoice.isPending}><FileText className="size-4" />Create Invoice</Button>
            </form>
          </Card>
          <Card>
            <h2 className="font-semibold">Record Payment</h2>
            <form className="mt-4 space-y-3" onSubmit={paymentForm.handleSubmit((values) => addPayment.mutate(values))}>
              <Select
                {...paymentForm.register('invoiceId')}
                onChange={(event) => {
                  const invoice = invoicesQuery.data?.data.find((item) => item.id === event.target.value);
                  paymentForm.setValue('invoiceId', event.target.value);
                  if (invoice) paymentForm.setValue('patientId', invoice.patientId);
                }}
              >
                <option value="">Select invoice</option>
                {invoicesQuery.data?.data.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo} · {invoice.patient?.fullName}</option>)}
              </Select>
              <Input type="number" placeholder="Amount" {...paymentForm.register('amount')} />
              <Select {...paymentForm.register('mode')}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </Select>
              <Input placeholder="Reference" {...paymentForm.register('reference')} />
              <Button type="submit" disabled={addPayment.isPending}><CreditCard className="size-4" />Record Payment</Button>
            </form>
          </Card>
        </div>
        <Card>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoicesQuery.data?.data.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{invoice.invoiceNo}</td>
                    <td className="px-4 py-3">{invoice.patient?.fullName}</td>
                    <td className="px-4 py-3">Rs {invoice.totalAmount}</td>
                    <td className="px-4 py-3">Rs {invoice.paidAmount}</td>
                    <td className="px-4 py-3">{invoice.status}</td>
                    <td className="px-4 py-3">
                      <a className="text-primary" href={`http://localhost:4000/api/billing/invoices/${invoice.id}/pdf`} target="_blank">
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
