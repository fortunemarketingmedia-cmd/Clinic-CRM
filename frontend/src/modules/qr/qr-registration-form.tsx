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
import { SignaturePad } from '@/components/ui/signature-pad';
import { publicApiRequest } from '@/services/public-api';
import type { FormField, FormTemplate } from '@/types/forms';

const qrSchema = z.object({
  branchId: z.string().optional(),
  referredBy: z.string().optional(),
  fullName: z.string().min(2, 'Full name is required'),
  age: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().int().positive().optional()),
  sex: z.preprocess((value) => value === '' ? undefined : value, z.enum(['MALE', 'FEMALE', 'OTHER']).optional()),
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
}).catchall(z.unknown());

type QrFormValues = z.infer<typeof qrSchema>;

type RegistrationPreview = {
  patientNo: string;
  fullName: string;
  mobile: string;
  branch: { name: string } | null;
  branches?: Array<{ id: string; name: string }>;
  formTemplate?: FormTemplate | null;
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

  const template = registrationQuery.data?.data.formTemplate;
  const currentValues = form.watch();
  const fields = (template?.fields ?? []).filter((field) => isVisible(field, currentValues)).sort((a, b) => a.sortOrder - b.sortOrder);

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
        {fields.length ? fields.map((field) => (
          <QrTemplateField
            key={field.id ?? field.key}
            field={field}
            register={form.register}
            setValue={(value) => form.setValue(field.key, value, { shouldDirty: true, shouldValidate: true })}
          />
        )) : <LegacyRegistrationFields register={form.register} />}
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

type Register = ReturnType<typeof useForm<QrFormValues>>['register'];

function QrTemplateField({ field, register, setValue }: { field: FormField; register: Register; setValue: (value: unknown) => void }) {
  const input = register(field.key);
  const label = <span className="text-sm font-medium">{field.label}{field.required ? ' *' : ''}</span>;
  if (field.type === 'CHECKBOX' || field.type === 'DECLARATION') return <label className="flex items-start gap-2 rounded-md border p-3 md:col-span-2"><input type="checkbox" disabled={field.readOnly} {...input} /><span>{label}{field.helpText ? <span className="mt-1 block text-xs text-muted-foreground">{field.helpText}</span> : null}</span></label>;
  if (field.type === 'DROPDOWN' || field.type === 'RADIO') return <label className="grid gap-1.5">{label}<Select disabled={field.readOnly} {...input}><option value="">Select</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</Select></label>;
  if (field.type === 'MULTI_SELECT') return <label className="grid gap-1.5">{label}<select multiple disabled={field.readOnly} className="min-h-24 rounded-md border bg-background p-2 text-sm" {...input}>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  if (field.type === 'SIGNATURE') return <div className="grid gap-1.5 md:col-span-2">{label}<SignaturePad onChange={setValue} disabled={field.readOnly} /></div>;
  if (field.type === 'FILE_UPLOAD' || field.type === 'IMAGE_UPLOAD') return <label className="grid gap-1.5">{label}<Input type="file" accept={field.type === 'IMAGE_UPLOAD' ? 'image/*' : undefined} disabled={field.readOnly} onChange={(event) => setValue(event.target.files?.[0]?.name ?? '')} /></label>;
  return <label className="grid gap-1.5">{label}<Input type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'} placeholder={field.placeholder ?? undefined} readOnly={field.readOnly} {...input} />{field.helpText ? <span className="text-xs text-muted-foreground">{field.helpText}</span> : null}</label>;
}

function isVisible(field: FormField, values: Record<string, unknown>) {
  if (field.hidden) return false;
  if (!field.condition) return true;
  const actual = values[field.condition.field];
  if (field.condition.operator === 'EQUALS') return actual === field.condition.value;
  if (field.condition.operator === 'NOT_EQUALS') return actual !== field.condition.value;
  return String(actual ?? '').includes(String(field.condition.value ?? ''));
}

function LegacyRegistrationFields({ register }: { register: Register }) {
  return <><Input placeholder="Referred by" {...register('referredBy')} /><Input placeholder="Full name" {...register('fullName')} /><Input type="number" placeholder="Age" {...register('age')} /><Select {...register('sex')}><option value="">Sex</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select><Input placeholder="Contact number" {...register('mobile')} /><Input placeholder="Address" {...register('address')} /><Input placeholder="Marital status" {...register('maritalStatus')} /><Input placeholder="Occupation" {...register('occupation')} /><Input placeholder="Skin concern" {...register('skinConcern')} /><Input placeholder="Hair concern" {...register('hairConcern')} /><Input placeholder="Medical history" {...register('medicalHistory')} /><Input placeholder="Current medications" {...register('currentMedications')} /><Input placeholder="Allergy to drugs" {...register('allergyToDrugs')} /><Input placeholder="Keloid / hypertrophic scar history" {...register('keloidOrHypertrophicScar')} /><Input placeholder="Products currently used" {...register('productsCurrentlyUsed')} /><Input placeholder="Menstrual history" {...register('menstrualHistory')} /><Input placeholder="Pregnancy status" {...register('pregnancyStatus')} /><Input placeholder="Other notes" {...register('notes')} /></>;
}
