'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { Patient360View } from '@/modules/patients/patient-360-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/services/api';
import type { Patient } from '@/types/patient';

type PatientDirectorySearchProps = {
  branchId: string;
  title: string;
  description: string;
};

export function PatientDirectorySearch({ branchId, title, description }: PatientDirectorySearchProps) {
  const [term, setTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['patient-directory-search', branchId, term.trim()],
    queryFn: () => {
      const params = new URLSearchParams({ search: term.trim() });
      params.set('pageSize', '50');
      if (branchId) params.set('branchId', branchId);
      return apiRequest<{ data: Patient[] }>(`/patients?${params.toString()}`);
    },
    enabled: term.trim().length >= 2,
  });
  const patients = (query.data?.data ?? []).slice(0, 6);

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Search patient directory</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search patient name, mobile, or client number"
          />
        </label>
        {term.trim().length >= 2 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            {query.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Searching Patient Master...</p>
            ) : query.isError ? (
              <p className="p-4 text-sm text-red-700">Patient Master could not be searched. Please try again.</p>
            ) : patients.length ? (
              patients.map((patient) => (
                <div key={patient.id} className="flex flex-col gap-3 border-b border-border p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{patient.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.patientNo} · {patient.mobile} · {patient.branch?.name ?? 'Branch not recorded'}
                    </p>
                  </div>
                  <Button type="button" onClick={() => setSelectedPatientId(patient.id)}>Open patient profile</Button>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No matching patient was found in Patient Master for this branch.</p>
            )}
          </div>
        ) : null}
      </Card>

      {selectedPatientId ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Patient clinical record"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPatientId(null);
          }}
        >
          <Card className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1500px]">
            <div className="sticky top-0 z-10 mb-4 flex justify-end border-b border-border bg-surface py-2">
              <Button
                type="button"
                variant="secondary"
                className="w-10 px-0"
                aria-label="Close patient record"
                onClick={() => setSelectedPatientId(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Patient360View patientId={selectedPatientId} embedded />
          </Card>
        </div>
      ) : null}
    </>
  );
}
