'use client';

import { useMutation } from '@tanstack/react-query';
import { CalendarClock, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiRequest } from '@/services/api';
import type { Branch } from '@/types/branch';

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const sourceOptions = [
  { label: 'Phone call', value: 'PHONE_CALL' },
  { label: 'Website', value: 'WEBSITE' },
  { label: 'Walk-in', value: 'WALK_IN' },
];

const appointmentTypeOptions = [
  { label: 'In-clinic consultancy', value: 'CLINIC_VISIT' },
  { label: 'Video consultancy', value: 'VIDEO_CONSULTATION' },
] as const;

const STANDARD_CONSULTATION_MINUTES = 30;
const STANDARD_CONSULTATION_BUFFER_MINUTES = 10;

// The same consultation booking form used in the Appointments section (source, name,
// mobile, address, branch, appointment type, date/time), reused inline wherever a
// consultation appointment needs to be booked for an already-known patient.
export function ConsultationBookingDialog({
  branches,
  initialBranchId,
  initialName = '',
  initialMobile = '',
  initialAddress = '',
  initialSource = 'PHONE_CALL',
  initialDate = new Date(),
  onClose,
  onBooked,
}: {
  branches: Branch[];
  initialBranchId: string;
  initialName?: string;
  initialMobile?: string;
  initialAddress?: string;
  initialSource?: string;
  initialDate?: Date;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [branchId, setBranchId] = useState(initialBranchId);
  const [name, setName] = useState(initialName);
  const [mobile, setMobile] = useState(initialMobile);
  const [address, setAddress] = useState(initialAddress);
  const [source, setSource] = useState(initialSource);
  const [appointmentType, setAppointmentType] = useState<'CLINIC_VISIT' | 'VIDEO_CONSULTATION'>('CLINIC_VISIT');
  const [appointmentAt, setAppointmentAt] = useState(`${localDateKey(initialDate)}T10:00`);

  const booking = useMutation({
    mutationFn: () =>
      apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          mobile: mobile.trim(),
          address: address.trim() || undefined,
          source,
          branchId,
          appointmentAt,
          appointmentType,
          resourceType: 'CONSULTATION',
          durationMinutes: STANDARD_CONSULTATION_MINUTES,
          bufferMinutes: STANDARD_CONSULTATION_BUFFER_MINUTES,
        }),
      }),
    onSuccess: onBooked,
  });

  const valid = branchId && name.trim().length >= 2 && mobile.trim().length >= 8 && appointmentAt;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-booking-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 id="consultation-booking-title" className="text-xl font-semibold">
              Book appointment
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consultation / video-consultation booking - the same form used in the Appointments section.
            </p>
          </div>
          <Button type="button" variant="secondary" className="w-10 px-0" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) booking.mutate();
          }}
        >
          <label className="space-y-2 text-sm font-medium">
            Branch
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Source
            <Select value={source} onChange={(event) => setSource(event.target.value)}>
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Client name
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Mobile
            <Input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Mobile number" />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Address
            <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Address" />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Appointment type
            <Select value={appointmentType} onChange={(event) => setAppointmentType(event.target.value as typeof appointmentType)}>
              {appointmentTypeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-2 text-sm font-medium sm:col-span-2">
            Date and time
            <Input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} />
          </label>
          {booking.isError ? (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
              {booking.error.message}
            </p>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={!valid || booking.isPending}>
              <CalendarClock className="size-4" />
              {booking.isPending ? 'Booking...' : 'Schedule'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
