'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { publicApiRequest } from '@/services/public-api';

const qrSchema = z.object({
  branchId: z.string().optional(),
  referredBy: z.string().optional(),
  fullName: z.string().min(2, 'Full name is required'),
  age: z.coerce.number().int().positive().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  mobile: z.string().min(8, 'Contact number is required'),
  address: z.string().optional(),
  maritalStatus: z.string().optional(),
  occupation: z.string().optional(),
  skinConcern: z.string().optional(),
  hairConcern: z.string().optional(),
  medicalHistory: z.string().optional(),
  currentMedications: z.string().optional(),
  allergyToDrugs: z.string().optional(),
  keloidOrHypertrophicScar: z.string().optional(),
  productsCurrentlyUsed: z.string().optional(),
  menstrualHistory: z.string().optional(),
  pregnancyStatus: z.string().optional(),
  notes: z.string().optional(),
});

type QrFormValues = z.infer<typeof qrSchema>;

type RegistrationPreview = {
  patientNo: string;
  fullName: string;
  mobile: string;
  branch: { name: string } | null;
  branches?: Array<{ id: string; name: string }>;
};

export function QrRegistrationForm({ token }: { token: string }) {
  const registrationQuery = useQuery({
    queryKey: ['qr-registration', token],
    queryFn: () => publicApiRequest<{ data: RegistrationPreview }>(`/public/qr/${token}`),
  });

  const form = useForm<QrFormValues>({
    resolver: zodResolver(qrSchema),
    values: registrationQuery.data
      ? {
          branchId: registrationQuery.data.data.branches?.[0]?.id,
          fullName: registrationQuery.data.data.fullName,
          mobile: registrationQuery.data.data.mobile,
        }
      : undefined,
  });

  const submitRegistration = useMutation({
    mutationFn: (values: QrFormValues) =>
      publicApiRequest(`/public/qr/${token}`, {
        method: 'POST',
        body: JSON.stringify(values),
      }),
  });

  if (registrationQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading registration form...</div>;
  }

  if (registrationQuery.error) {
    return <div className="text-sm text-red-700">This registration link is not valid.</div>;
  }

  if (submitRegistration.isSuccess) {
    return (
      <Card className="w-full max-w-xl text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold">Profile submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">Thank you. Revive Clinic has received your details.</p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Revive Clinic Registration</h1>
        <p className="text-sm text-muted-foreground">
          {registrationQuery.data?.data.patientNo} · {registrationQuery.data?.data.branch?.name ?? 'Select branch'}
        </p>
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => submitRegistration.mutate(values))}>
        {registrationQuery.data?.data.branches?.length ? (
          <Select {...form.register('branchId')}>
            {registrationQuery.data.data.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Input placeholder="Referred by" {...form.register('referredBy')} />
        <Input placeholder="Full name" {...form.register('fullName')} />
        <Input type="number" placeholder="Age" {...form.register('age')} />
        <Select {...form.register('sex')}>
          <option value="">Sex</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </Select>
        <Input placeholder="Contact number" {...form.register('mobile')} />
        <Input placeholder="Address" {...form.register('address')} />
        <Input placeholder="Marital status" {...form.register('maritalStatus')} />
        <Input placeholder="Occupation" {...form.register('occupation')} />
        <Input placeholder="Skin concern" {...form.register('skinConcern')} />
        <Input placeholder="Hair concern" {...form.register('hairConcern')} />
        <Input placeholder="Medical history" {...form.register('medicalHistory')} />
        <Input placeholder="Current medications" {...form.register('currentMedications')} />
        <Input placeholder="Allergy to drugs" {...form.register('allergyToDrugs')} />
        <Input placeholder="Keloid / hypertrophic scar history" {...form.register('keloidOrHypertrophicScar')} />
        <Input placeholder="Products currently used" {...form.register('productsCurrentlyUsed')} />
        <Input placeholder="Menstrual history" {...form.register('menstrualHistory')} />
        <Input placeholder="Pregnancy status" {...form.register('pregnancyStatus')} />
        <Input placeholder="Other notes" {...form.register('notes')} />
        {submitRegistration.error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
            {submitRegistration.error.message}
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" disabled={submitRegistration.isPending}>
            {submitRegistration.isPending ? 'Submitting...' : 'Submit Registration'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
