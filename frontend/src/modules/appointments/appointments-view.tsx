'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ApiError, apiRequest } from '@/services/api';
import { useSessionStore } from '@/store/session-store';
import type { Appointment, ClinicService } from '@/types/appointment';
import type { Branch } from '@/types/branch';
import type { AppointmentStatus } from '@/types/appointment';
import type { Lead } from '@/types/lead';

type PackageMaster = {
  id: string;
  branchId?: string | null;
  name: string;
  description?: string | null;
  includedServices: string[];
  totalSessions: number;
  validityDays: number;
  price: string;
  taxPercent: string;
  active: boolean;
};

const appointmentStatuses: Array<{ label: string; value: AppointmentStatus }> = [
  { label: 'Requested', value: 'REQUESTED' },
  { label: 'Slot proposed', value: 'SLOT_PROPOSED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Confirmation pending', value: 'CONFIRMATION_PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Checked in', value: 'CHECKED_IN' },
  { label: 'Waiting', value: 'WAITING' },
  { label: 'In consultation', value: 'IN_CONSULTATION' },
  { label: 'Treatment in progress', value: 'TREATMENT_IN_PROGRESS' },
  { label: 'Billing pending', value: 'BILLING_PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Rescheduled', value: 'RESCHEDULED' },
  { label: 'No show', value: 'NO_SHOW' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const sourceOptions = [
  { label: 'Phone call', value: 'PHONE_CALL' },
  { label: 'Website', value: 'WEBSITE' },
  { label: 'Walk-in', value: 'WALK_IN' },
];

const visitPurposeOptions = [
  { label: 'Consultation', value: 'CONSULTATION' },
  { label: 'Treatment room', value: 'TREATMENT_ROOM' },
] as const;

const appointmentTypeOptions = [
  { label: 'Clinic visit', value: 'CLINIC_VISIT' },
  { label: 'Video consultation', value: 'VIDEO_CONSULTATION' },
] as const;

const bookingPlanOptions = [
  { label: 'Consultation / checkup only', value: 'CONSULTATION' },
  { label: 'Single treatment session', value: 'SINGLE_TREATMENT' },
  { label: 'Treatment package', value: 'PACKAGE' },
] as const;

const STANDARD_CONSULTATION_MINUTES = 30;
const STANDARD_CONSULTATION_BUFFER_MINUTES = 10;
const STANDARD_CONSULTATION_RATE = 500;

function moneyNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function packageMatchesService(packageMaster: PackageMaster, serviceName: string) {
  const normalizedService = normalizedName(serviceName);
  return packageMaster.includedServices.some((includedService) => {
    const normalizedIncluded = normalizedName(includedService);
    return normalizedService.includes(normalizedIncluded) || normalizedIncluded.includes(normalizedService);
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function optionLabel<T extends string>(options: ReadonlyArray<{ label: string; value: T }>, value?: T | null) {
  return options.find((item) => item.value === value)?.label ?? value?.replaceAll('_', ' ').toLowerCase() ?? '-';
}

function appointmentSourceFromLead(source: Lead['source']) {
  if (source === 'WEBSITE' || source === 'WALK_IN' || source === 'PHONE_CALL') return source;
  return 'PHONE_CALL';
}

function appointmentProblem(error: unknown) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Appointment could not be booked.';
  const status = error instanceof ApiError ? error.status : undefined;
  const lower = message.toLowerCase();

  if (status === 409 || lower.includes('not available') || lower.includes('interval')) {
    return {
      title: 'Selected slot is not available',
      reason: 'Another booking, room, or resource is already using this time.',
      guidance: 'Try a different time or select another available room.',
      kind: 'availability' as const,
    };
  }

  if (lower.includes('branch')) {
    return {
      title: 'Branch needs attention',
      reason: 'This appointment cannot be saved with the selected branch.',
      guidance: 'Select the correct branch and then book the appointment again.',
      kind: 'branch' as const,
    };
  }

  if (lower.includes('service')) {
    return {
      title: 'Treatment service is not available',
      reason: 'The selected treatment service could not be found for this branch.',
      guidance: 'Choose another treatment service or switch to consultation.',
      kind: 'service' as const,
    };
  }

  if (status === 400 || lower.includes('required')) {
    return {
      title: 'Some appointment details are missing',
      reason: message,
      guidance: 'Check name, mobile, branch, date/time, and room selection before saving.',
      kind: 'validation' as const,
    };
  }

  return {
    title: 'Appointment could not be booked',
    reason: message,
    guidance: 'Please review the appointment details and try again.',
    kind: 'unknown' as const,
  };
}

function quickStatuses(status: AppointmentStatus) {
  const allowed: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
    REQUESTED: ['SLOT_PROPOSED', 'SCHEDULED'],
    SLOT_PROPOSED: ['SCHEDULED'],
    SCHEDULED: ['CONFIRMATION_PENDING', 'CONFIRMED', 'CHECKED_IN'],
    CONFIRMATION_PENDING: ['CONFIRMED', 'CHECKED_IN'],
    CONFIRMED: ['CHECKED_IN'],
    CHECKED_IN: ['WAITING', 'IN_CONSULTATION'],
    WAITING: ['IN_CONSULTATION'],
    IN_CONSULTATION: ['TREATMENT_IN_PROGRESS', 'COMPLETED'],
    TREATMENT_IN_PROGRESS: ['COMPLETED'],
    RESCHEDULED: ['SCHEDULED', 'CONFIRMED'],
  };
  return appointmentStatuses.filter(
    (item) => item.value === status || allowed[status]?.includes(item.value),
  );
}

const appointmentSchema = z
  .object({
    name: z.string().min(2, 'Name is required'),
    leadId: z.string().optional(),
    mobile: z.string().min(8, 'Mobile number is required'),
    address: z.string().optional(),
    source: z.string().min(1, 'Source is required'),
    branchId: z.string().min(1, 'Branch is required'),
    appointmentAt: z.string().min(1, 'Appointment time is required'),
    appointmentType: z.enum(['CLINIC_VISIT', 'VIDEO_CONSULTATION']),
    resourceType: z.enum(['CONSULTATION', 'TREATMENT_ROOM']),
    roomNumber: z.coerce.number().int().min(1).max(4).optional(),
    notes: z.string().optional(),
    serviceId: z.string().optional(),
    durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
    bufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
    doctorId: z.string().optional(),
    resourceId: z.string().optional(),
    equipmentId: z.string().optional(),
    bookingPlan: z.enum(['CONSULTATION', 'SINGLE_TREATMENT', 'PACKAGE']).default('CONSULTATION'),
    packageMasterId: z.string().optional(),
    paymentStatus: z.enum(['NOT_PAID', 'PAID']).default('NOT_PAID'),
    paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']).optional(),
  })
  .refine((value) => value.resourceType !== 'TREATMENT_ROOM' || Boolean(value.roomNumber), {
    message: 'Select a treatment room',
    path: ['roomNumber'],
  });

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthRange(monthDate: Date) {
  return {
    start: new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    end: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0),
  };
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function intervalsOverlap(first: { start: Date; end: Date }, second: { start: Date; end: Date }) {
  return first.start < second.end && second.start < first.end;
}

function buildMonthDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function statusClass(status: AppointmentStatus) {
  if (status === 'CHECKED_IN' || status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'NO_SHOW' || status === 'CANCELLED') return 'bg-red-50 text-red-700';
  if (status === 'RESCHEDULED') return 'bg-amber-50 text-amber-700';
  return 'bg-primary/10 text-primary';
}

export function AppointmentsView() {
  const queryClient = useQueryClient();
  const { session, selectedBranchId, setSelectedBranchId } = useSessionStore();
  const isAdmin = session?.user.role === 'ADMIN';
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'day' | 'list'>('calendar');

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<{ data: Branch[] }>('/branches'),
  });

  const branches = branchesQuery.data?.data ?? [];
  const activeBranchId = isAdmin
    ? (selectedBranchId ?? '')
    : selectedBranchId || branches[0]?.id || '';
  useEffect(() => {
    if (!branches.length) return;
    if (isAdmin && selectedBranchId === null) {
      setSelectedBranchId('');
      return;
    }
    if (
      !isAdmin &&
      (!selectedBranchId || !branches.some((branch) => branch.id === selectedBranchId))
    ) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, isAdmin, selectedBranchId, setSelectedBranchId]);

  const range = useMemo(() => monthRange(calendarMonth), [calendarMonth]);
  const appointmentQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (!isAdmin || activeBranchId) params.set('branchId', activeBranchId);
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    params.set('dateFrom', new Date(`${localDateKey(range.start)}T00:00:00`).toISOString());
    params.set('dateTo', new Date(`${localDateKey(range.end)}T23:59:59`).toISOString());
    return params.toString();
  }, [activeBranchId, isAdmin, range.end, range.start, search, status]);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', appointmentQueryString],
    queryFn: () => apiRequest<{ data: Appointment[] }>(`/appointments?${appointmentQueryString}`),
    enabled: Boolean(isAdmin || activeBranchId),
  });

  const appointments = useMemo(
    () =>
      [...(appointmentsQuery.data?.data ?? [])].sort(
        (first, second) =>
          new Date(first.appointmentAt).getTime() - new Date(second.appointmentAt).getTime(),
      ),
    [appointmentsQuery.data],
  );

  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const appointmentsByDate = useMemo(() => {
    return appointments.reduce<Record<string, Appointment[]>>((groups, appointment) => {
      const key = localDateKey(new Date(appointment.appointmentAt));
      groups[key] = [...(groups[key] ?? []), appointment];
      return groups;
    }, {});
  }, [appointments]);

  const selectedDayAppointments = appointmentsByDate[selectedDate] ?? [];
  const selectedDateLabel = formatDate(selectedDate);
  const appointmentCounts = {
    total: appointments.length,
    confirmed: appointments.filter((appointment) => appointment.status === 'CONFIRMED').length,
    arrived: appointments.filter((appointment) => appointment.status === 'CHECKED_IN').length,
    pending: appointments.filter((appointment) =>
      ['RESCHEDULED', 'NO_SHOW'].includes(appointment.status),
    ).length,
  };
  const defaultMetrics = [
    { label: 'This month', value: appointmentCounts.total },
    { label: 'Confirmed', value: appointmentCounts.confirmed },
    { label: 'Arrived', value: appointmentCounts.arrived },
    { label: 'Action needed', value: appointmentCounts.pending },
  ];

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      name: '',
      leadId: '',
      mobile: '',
      address: '',
      source: '',
      branchId: activeBranchId,
      appointmentAt: '',
      appointmentType: 'CLINIC_VISIT',
      resourceType: 'CONSULTATION',
      roomNumber: undefined,
      notes: '',
      serviceId: '',
      durationMinutes: STANDARD_CONSULTATION_MINUTES,
      bufferMinutes: STANDARD_CONSULTATION_BUFFER_MINUTES,
      doctorId: '',
      resourceId: '',
      equipmentId: '',
      bookingPlan: 'CONSULTATION',
      packageMasterId: '',
      paymentStatus: 'NOT_PAID',
      paymentMode: undefined,
    },
  });
  const formBranchId = form.watch('branchId');
  const formResourceType = form.watch('resourceType');
  const formAppointmentAt = form.watch('appointmentAt');
  const formServiceId = form.watch('serviceId');
  const formPackageMasterId = form.watch('packageMasterId');
  const formBookingPlan = form.watch('bookingPlan');
  const formPaymentStatus = form.watch('paymentStatus');
  const formDurationMinutes = form.watch('durationMinutes') ?? 30;
  const formBufferMinutes = form.watch('bufferMinutes') ?? 0;
  const selectedRoomNumber = form.watch('roomNumber');
  const formDataBranchId = formBranchId || activeBranchId;
  const formAppointmentDate = formAppointmentAt ? new Date(formAppointmentAt) : null;
  const roomAvailabilityRange = useMemo(
    () => (formAppointmentDate && !Number.isNaN(formAppointmentDate.getTime()) ? dayRange(formAppointmentDate) : null),
    [formAppointmentDate],
  );

  const servicesQuery = useQuery({
    queryKey: ['appointment-services', formDataBranchId],
    queryFn: () =>
      apiRequest<{ data: ClinicService[] }>(
        `/front-desk/services${formDataBranchId ? `?branchId=${formDataBranchId}` : ''}`,
      ),
    enabled: Boolean(formDataBranchId),
  });
  const packageMastersQuery = useQuery({
    queryKey: ['appointment-package-masters', formDataBranchId],
    queryFn: () =>
      apiRequest<{ data: PackageMaster[] }>(
        `/billing/package-masters${formDataBranchId ? `?branchId=${formDataBranchId}` : ''}`,
      ),
  });
  const selectedService = servicesQuery.data?.data.find((service) => service.id === formServiceId);
  const activePackageMasters = useMemo(
    () => (packageMastersQuery.data?.data ?? []).filter((item) => item.active),
    [packageMastersQuery.data?.data],
  );
  const availablePackageMasters = useMemo(
    () => {
      const branchMatches = activePackageMasters.filter((item) => !item.branchId || item.branchId === formDataBranchId);
      return branchMatches.length ? branchMatches : activePackageMasters;
    },
    [activePackageMasters, formDataBranchId],
  );
  const matchingPackageMasters = useMemo(
    () => selectedService
      ? availablePackageMasters.filter((item) => {
        return packageMatchesService(item, selectedService.name);
      })
      : availablePackageMasters,
    [availablePackageMasters, selectedService],
  );
  const selectedPackage = availablePackageMasters.find((item) => item.id === formPackageMasterId);
  const selectedServiceBase = selectedService ? moneyNumber(selectedService.basePrice) : 0;
  const selectedPackageBase = selectedPackage ? moneyNumber(selectedPackage.price) : 0;
  const selectedPackageTax = selectedPackage ? Math.round((selectedPackageBase * moneyNumber(selectedPackage.taxPercent)) / 100) : 0;
  const bookingTotal = formResourceType === 'CONSULTATION'
    ? STANDARD_CONSULTATION_RATE
    : formBookingPlan === 'PACKAGE'
      ? selectedPackageBase + selectedPackageTax
      : selectedServiceBase;
  const treatmentBillingOptions = useMemo(() => {
    const serviceOptions = (servicesQuery.data?.data ?? [])
      .filter((service) => service.resourceType === 'TREATMENT_ROOM')
      .map((service) => {
        const matchedPackage = availablePackageMasters.find((item) => packageMatchesService(item, service.name));
        const rate = moneyNumber(service.basePrice);
        const fallbackRate = matchedPackage ? Math.round(moneyNumber(matchedPackage.price) / Math.max(1, matchedPackage.totalSessions)) : 0;
        const displayRate = rate || fallbackRate;
        return { kind: 'service' as const, id: service.id, label: `${service.category ? `${service.category} - ` : ''}${service.name}`, meta: `${service.durationMinutes} min${displayRate ? ` · ${formatCurrency(displayRate)}` : ''}`, rate: displayRate };
      });
    const packageOptions = availablePackageMasters.map((item) => ({ kind: 'package' as const, id: item.id, label: item.name, meta: `${item.totalSessions} sessions · ${formatCurrency(moneyNumber(item.price))}`, rate: moneyNumber(item.price) }));
    return { serviceOptions, packageOptions };
  }, [availablePackageMasters, servicesQuery.data?.data]);
  const selectedTreatmentBillingValue = formPackageMasterId ? `package:${formPackageMasterId}` : formServiceId ? `service:${formServiceId}` : '';
  const proposedLeadQueryString = useMemo(() => {
    const params = new URLSearchParams({ status: 'APPOINTMENT_PROPOSED' });
    if (!isAdmin || activeBranchId) params.set('branchId', activeBranchId);
    return params.toString();
  }, [activeBranchId, isAdmin]);
  const proposedLeadsQuery = useQuery({
    queryKey: ['appointment-proposed-leads', proposedLeadQueryString],
    queryFn: () => apiRequest<{ data: Lead[] }>(`/leads?${proposedLeadQueryString}`),
    enabled: Boolean(isAdmin || activeBranchId),
  });
  const proposedLeads = proposedLeadsQuery.data?.data ?? [];
  const selectedLeadForBooking = proposedLeads.find((lead) => lead.id === form.watch('leadId'));
  const roomAppointmentsQuery = useQuery({
    queryKey: [
      'appointment-room-availability',
      formDataBranchId,
      roomAvailabilityRange?.start.toISOString(),
      roomAvailabilityRange?.end.toISOString(),
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        branchId: formDataBranchId,
        dateFrom: roomAvailabilityRange?.start.toISOString() ?? '',
        dateTo: roomAvailabilityRange?.end.toISOString() ?? '',
      });
      return apiRequest<{ data: Appointment[] }>(`/appointments?${params.toString()}`);
    },
    enabled: Boolean(formDataBranchId && roomAvailabilityRange && formResourceType === 'TREATMENT_ROOM'),
  });
  const availableRoomNumbers = useMemo(() => {
    const rooms = [1, 2, 3, 4];
    if (!formAppointmentDate || Number.isNaN(formAppointmentDate.getTime())) return rooms;
    const requestedInterval = {
      start: formAppointmentDate,
      end: addMinutes(formAppointmentDate, Number(formDurationMinutes) + Number(formBufferMinutes)),
    };
    return rooms.filter((room) => {
      return !(roomAppointmentsQuery.data?.data ?? []).some((appointment) => {
        if (appointment.id === editingAppointment?.id) return false;
        if (appointment.branchId !== formDataBranchId) return false;
        if (appointment.resourceType !== 'TREATMENT_ROOM' || appointment.roomNumber !== room) return false;
        if (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') return false;
        const existingStart = new Date(appointment.appointmentAt);
        const existingEnd = addMinutes(
          appointment.endAt ? new Date(appointment.endAt) : addMinutes(existingStart, appointment.durationMinutes),
          appointment.bufferMinutes,
        );
        return intervalsOverlap(requestedInterval, { start: existingStart, end: existingEnd });
      });
    });
  }, [
    editingAppointment?.id,
    formAppointmentDate,
    formBufferMinutes,
    formDataBranchId,
    formDurationMinutes,
    roomAppointmentsQuery.data,
  ]);

  useEffect(() => {
    if (!editingAppointment && activeBranchId) form.setValue('branchId', activeBranchId);
  }, [activeBranchId, editingAppointment, form]);

  useEffect(() => {
    if (formResourceType !== 'CONSULTATION') return;
    form.setValue('serviceId', '');
    form.setValue('roomNumber', undefined);
    form.setValue('packageMasterId', '');
    form.setValue('bookingPlan', 'CONSULTATION');
    form.setValue('durationMinutes', STANDARD_CONSULTATION_MINUTES);
    form.setValue('bufferMinutes', STANDARD_CONSULTATION_BUFFER_MINUTES);
  }, [form, formResourceType]);

  useEffect(() => {
    if (formResourceType !== 'TREATMENT_ROOM' || !selectedRoomNumber) return;
    if (!availableRoomNumbers.includes(Number(selectedRoomNumber))) {
      form.setValue('roomNumber', undefined);
    }
  }, [availableRoomNumbers, form, formResourceType, selectedRoomNumber]);

  useEffect(() => {
    if (formBookingPlan !== 'PACKAGE') return;
    if (formPackageMasterId && availablePackageMasters.some((item) => item.id === formPackageMasterId)) return;

    const nextPackage = matchingPackageMasters[0] ?? availablePackageMasters[0];
    if (nextPackage) {
      form.setValue('packageMasterId', nextPackage.id, { shouldDirty: true, shouldValidate: true });
    }
  }, [availablePackageMasters, form, formBookingPlan, formPackageMasterId, matchingPackageMasters]);

  const createAppointment = useMutation({
    mutationFn: (values: AppointmentFormValues) => {
      const packageMaster = packageMastersQuery.data?.data.find((item) => item.id === values.packageMasterId);
      const bookingSummary = [
        `Booking plan: ${bookingPlanOptions.find((item) => item.value === values.bookingPlan)?.label ?? values.bookingPlan}`,
        values.resourceType === 'CONSULTATION' ? 'Visit: Standard consultation' : selectedService ? `Treatment: ${selectedService.name}` : null,
        packageMaster ? `Package: ${packageMaster.name}` : null,
        bookingTotal ? `Estimated total: ${formatCurrency(bookingTotal)}` : null,
        values.paymentStatus === 'PAID' ? `Payment: Paid${values.paymentMode ? ` by ${values.paymentMode.replaceAll('_', ' ')}` : ''}` : 'Payment: Not paid',
      ].filter(Boolean).join('\n');
      return apiRequest<{ data: Appointment }>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          leadId: values.leadId || undefined,
          notes: [bookingSummary, values.notes].filter(Boolean).join('\n\n') || undefined,
          serviceId: values.resourceType === 'CONSULTATION' ? undefined : values.serviceId || undefined,
          packageMasterId: values.resourceType === 'TREATMENT_ROOM' && values.bookingPlan === 'PACKAGE' ? values.packageMasterId || undefined : undefined,
          estimatedAmount: bookingTotal || undefined,
          paymentStatus: values.paymentStatus,
          paymentMode: values.paymentMode || undefined,
          doctorId: undefined,
          resourceId: values.resourceId || undefined,
          equipmentId: values.equipmentId || undefined,
        }),
      });
    },
    onSuccess: () => {
      form.reset({
        name: '',
        leadId: '',
        mobile: '',
        address: '',
        source: '',
        branchId: activeBranchId,
        appointmentAt: '',
        appointmentType: 'CLINIC_VISIT',
        resourceType: 'CONSULTATION',
        roomNumber: undefined,
        notes: '',
        serviceId: '',
        durationMinutes: STANDARD_CONSULTATION_MINUTES,
        bufferMinutes: STANDARD_CONSULTATION_BUFFER_MINUTES,
        doctorId: '',
        resourceId: '',
        equipmentId: '',
        bookingPlan: 'CONSULTATION',
        packageMasterId: '',
        paymentStatus: 'NOT_PAID',
        paymentMode: undefined,
      });
      setShowAppointmentForm(false);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-proposed-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Omit<
        Partial<AppointmentFormValues>,
        'roomNumber' | 'serviceId' | 'doctorId' | 'resourceId' | 'equipmentId'
      > & {
        status?: AppointmentStatus;
        roomNumber?: number | null;
        serviceId?: string | null;
        doctorId?: string | null;
        resourceId?: string | null;
        equipmentId?: string | null;
      };
    }) =>
      apiRequest<{ data: Appointment }>(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      setEditingAppointment(null);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });
  const bookingError = createAppointment.error ?? updateAppointment.error;
  const bookingProblem = appointmentProblem(bookingError);

  function startEdit(appointment: Appointment) {
    setEditingAppointment(appointment);
    setShowAppointmentForm(true);
    form.reset({
      name: appointment.lead?.name ?? '',
      leadId: '',
      mobile: appointment.lead?.mobile ?? '',
      address: appointment.lead?.address ?? '',
      source:
        appointment.lead?.source === 'WHATSAPP'
          ? 'PHONE_CALL'
          : (appointment.lead?.source ?? 'PHONE_CALL'),
      branchId: appointment.branchId,
      appointmentAt: toDateTimeLocal(appointment.appointmentAt),
      appointmentType: appointment.appointmentType,
      resourceType: appointment.resourceType ?? 'CONSULTATION',
      roomNumber: appointment.roomNumber ?? undefined,
      notes: appointment.notes ?? '',
      serviceId: appointment.serviceId ?? '',
      durationMinutes: appointment.resourceType === 'CONSULTATION' ? STANDARD_CONSULTATION_MINUTES : appointment.durationMinutes ?? STANDARD_CONSULTATION_MINUTES,
      bufferMinutes: appointment.resourceType === 'CONSULTATION' ? STANDARD_CONSULTATION_BUFFER_MINUTES : appointment.bufferMinutes ?? 0,
      doctorId: appointment.doctorId ?? '',
      resourceId: appointment.resourceId ?? '',
      equipmentId: appointment.equipmentId ?? '',
      bookingPlan: 'CONSULTATION',
      packageMasterId: '',
      paymentStatus: 'NOT_PAID',
      paymentMode: undefined,
    });
  }

  function startLeadBooking(lead: Lead) {
    setEditingAppointment(null);
    setShowAppointmentForm(true);
    form.reset({
      name: lead.name,
      leadId: lead.id,
      mobile: lead.mobile,
      address: lead.address ?? '',
      source: appointmentSourceFromLead(lead.source),
      branchId: lead.branchId,
      appointmentAt: lead.appointmentAt ? toDateTimeLocal(lead.appointmentAt) : '',
      appointmentType: lead.appointmentType,
      resourceType: 'CONSULTATION',
      roomNumber: undefined,
      notes: lead.interestedTreatment ? `Treatment concern: ${lead.interestedTreatment}` : '',
      serviceId: '',
      durationMinutes: STANDARD_CONSULTATION_MINUTES,
      bufferMinutes: STANDARD_CONSULTATION_BUFFER_MINUTES,
      doctorId: '',
      resourceId: '',
      equipmentId: '',
      bookingPlan: 'CONSULTATION',
      packageMasterId: '',
      paymentStatus: 'NOT_PAID',
      paymentMode: undefined,
    });
  }

  function onSubmit(values: AppointmentFormValues) {
    if (editingAppointment) {
      updateAppointment.mutate({
        id: editingAppointment.id,
        values: {
          branchId: values.branchId,
          appointmentAt: values.appointmentAt,
          appointmentType: values.appointmentType,
          resourceType: values.resourceType,
          roomNumber: values.resourceType === 'TREATMENT_ROOM' ? values.roomNumber : null,
          notes: values.notes || undefined,
          serviceId: values.resourceType === 'CONSULTATION' ? null : values.serviceId || null,
          durationMinutes: values.durationMinutes,
          bufferMinutes: values.bufferMinutes,
          doctorId: null,
          resourceId: values.resourceId || null,
          equipmentId: values.equipmentId || null,
        },
      });
      return;
    }
    createAppointment.mutate(values);
  }

  if (appointmentsQuery.isLoading) return <PageSkeleton />;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            Universal clinic calendar with time-wise daily schedule.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" onClick={() => setShowAppointmentForm(true)}>
            <CalendarClock className="size-4" />
            Create New Appointment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {defaultMetrics.map((metric) => (
          <AppointmentMetric key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Lead appointment confirmations</h2>
            <p className="text-sm text-muted-foreground">
              Leads moved to Appointment proposed appear here until reception books the actual slot.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {proposedLeads.length} pending
          </span>
        </div>
        {proposedLeadsQuery.isLoading ? (
          <p className="py-5 text-sm text-muted-foreground">Loading proposed leads...</p>
        ) : proposedLeads.length ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {proposedLeads.map((lead) => (
              <div key={lead.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {lead.mobile} · {lead.branch?.name ?? 'Branch not set'} · {lead.interestedTreatment ?? 'Treatment not specified'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {lead.appointmentAt ? `Preferred slot: ${new Date(lead.appointmentAt).toLocaleString('en-IN')}` : 'No preferred slot recorded'}
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={() => startLeadBooking(lead)}>
                  Book appointment
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-5 text-sm text-muted-foreground">
            No proposed appointments are waiting for confirmation.
          </p>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {viewMode === 'calendar'
                ? 'Universal Calendar'
                : viewMode === 'day'
                  ? 'Day Schedule'
                  : 'List View'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
                calendarMonth,
              )}{' '}
              ·{' '}
              {activeBranchId
                ? branches.find((branch) => branch.id === activeBranchId)?.name
                : 'All branches'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </Button>
            <Button
              type="button"
              variant={viewMode === 'day' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('day')}
            >
              Day schedule
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'primary' : 'secondary'}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name or mobile"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              aria-label="Status filter"
              value={status}
              onChange={(event) => setStatus(event.target.value as AppointmentStatus | '')}
            >
              <option value="">All statuses</option>
              {appointmentStatuses.map((appointmentStatus) => (
                <option key={appointmentStatus.value} value={appointmentStatus.value}>
                  {appointmentStatus.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="w-10 px-0"
              aria-label="Previous month"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const today = new Date();
                setCalendarMonth(today);
                setSelectedDate(localDateKey(today));
              }}
            >
              Current date
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-10 px-0"
              aria-label="Next month"
              onClick={() =>
                setCalendarMonth(
                  new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-md border border-border text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="border-b border-border bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const key = localDateKey(day);
              const dayAppointments = appointmentsByDate[key] ?? [];
              const isCurrentMonth = monthKey(day) === monthKey(calendarMonth);
              const isToday = key === localDateKey(new Date());
              const isSelected = key === selectedDate;

              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${formatDate(key)}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
                  className={[
                    'relative min-h-32 border-b border-r border-border p-2 text-left transition hover:bg-muted/60',
                    !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-surface',
                    isToday && !isSelected ? 'bg-amber-50/70 ring-1 ring-inset ring-amber-400' : '',
                    isSelected ? '!bg-primary/10 ring-2 ring-inset ring-primary shadow-sm' : '',
                  ].join(' ')}
                  onClick={() => setSelectedDate(key)}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={[
                        'inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                        isSelected ? 'bg-primary text-white' : '',
                        isToday && !isSelected ? 'bg-amber-500 text-white' : '',
                      ].join(' ')}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {isToday ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Today
                        </span>
                      ) : null}
                      {dayAppointments.length ? (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                          {dayAppointments.length}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 4).map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`truncate rounded-md px-2 py-1 text-xs ${statusClass(appointment.status)}`}
                      >
                        {formatTime(appointment.appointmentAt)} {appointment.lead?.name}
                        {appointment.resourceType === 'TREATMENT_ROOM'
                          ? ` · R${appointment.roomNumber}`
                          : ''}
                      </div>
                    ))}
                    {dayAppointments.length > 4 ? (
                      <div className="text-xs text-muted-foreground">
                        +{dayAppointments.length - 4} more
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {viewMode === 'day' ? (
          <AppointmentList
            appointments={selectedDayAppointments}
            onSelect={setSelectedAppointment}
            onEdit={startEdit}
            onStatusChange={(appointment, nextStatus) =>
              updateAppointment.mutate({ id: appointment.id, values: { status: nextStatus } })
            }
          />
        ) : null}
        {viewMode === 'list' ? (
          <AppointmentList
            appointments={appointments}
            onSelect={setSelectedAppointment}
            onEdit={startEdit}
            onStatusChange={(appointment, nextStatus) =>
              updateAppointment.mutate({ id: appointment.id, values: { status: nextStatus } })
            }
          />
        ) : null}
      </Card>

      {viewMode === 'calendar' ? (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Schedule for {selectedDateLabel}</h2>
              <p className="text-sm text-muted-foreground">
                All appointments for the selected day, sorted by time.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedDayAppointments.length} appointments
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {selectedDayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="grid cursor-pointer gap-3 rounded-md border border-border p-3 hover:bg-muted/50 lg:grid-cols-[90px_1fr_180px_180px] lg:items-center"
                onClick={() => setSelectedAppointment(appointment)}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="size-4 text-primary" />
                  {formatTime(appointment.appointmentAt)}
                </div>
                <div>
                  <div className="font-medium">{appointment.lead?.name ?? 'Patient'}</div>
                  <div className="text-xs text-muted-foreground">
                    {appointment.lead?.mobile} · {appointment.branch?.name} ·{' '}
                    {appointment.lead?.source?.replace('_', ' ')}
                  </div>
                </div>
                <Select
                  aria-label="Appointment status"
                  value={appointment.status}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    updateAppointment.mutate({
                      id: appointment.id,
                      values: { status: event.target.value as AppointmentStatus },
                    })
                  }
                >
                  {quickStatuses(appointment.status).map((appointmentStatus) => (
                    <option key={appointmentStatus.value} value={appointmentStatus.value}>
                      {appointmentStatus.label}
                    </option>
                  ))}
                  {!appointmentStatuses.some(
                    (appointmentStatus) => appointmentStatus.value === appointment.status,
                  ) ? (
                    <option value={appointment.status}>
                      {appointment.status.replace('_', ' ')}
                    </option>
                  ) : null}
                </Select>
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button type="button" variant="secondary" onClick={() => startEdit(appointment)}>
                    <RotateCcw className="size-4" />
                    Reschedule
                  </Button>
                </div>
              </div>
            ))}
            {!appointmentsQuery.isLoading && selectedDayAppointments.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No appointments on this date.
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {selectedAppointment ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedAppointment.lead?.name ?? 'Appointment'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(localDateKey(new Date(selectedAppointment.appointmentAt)))} ·{' '}
                  {formatTime(selectedAppointment.appointmentAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedAppointment(null)}
              >
                Close
              </Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <AppointmentDetail label="Mobile" value={selectedAppointment.lead?.mobile ?? '-'} />
              <AppointmentDetail label="Branch" value={selectedAppointment.branch?.name ?? '-'} />
              <AppointmentDetail
                label="Status"
                value={optionLabel(appointmentStatuses, selectedAppointment.status)}
              />
              <AppointmentDetail
                label="Type"
                value={optionLabel(appointmentTypeOptions, selectedAppointment.appointmentType)}
              />
              <AppointmentDetail
                label="Resource"
                value={
                  selectedAppointment.resourceType === 'TREATMENT_ROOM'
                    ? `Treatment room ${selectedAppointment.roomNumber}`
                    : optionLabel(visitPurposeOptions, selectedAppointment.resourceType)
                }
              />
              <AppointmentDetail
                label="Source"
                value={optionLabel(sourceOptions, selectedAppointment.lead?.source as 'PHONE_CALL' | 'WEBSITE' | 'WALK_IN' | undefined)}
              />
              <AppointmentDetail label="Notes" value={selectedAppointment.notes ?? '-'} />
            </div>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => startEdit(selectedAppointment)}>
                <RotateCcw className="size-4" />
                Reschedule
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {showAppointmentForm || editingAppointment ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
          <Card className="mx-auto max-w-5xl">
            <h2 className="text-base font-semibold">
              {editingAppointment ? 'Reschedule Appointment' : selectedLeadForBooking ? 'Book Proposed Lead' : 'Create New Appointment'}
            </h2>
            {selectedLeadForBooking ? (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
                Booking appointment for {selectedLeadForBooking.name}. Saving this form will move the lead out of the active lead pipeline.
              </div>
            ) : null}
            <form className="mt-5 grid gap-5 lg:grid-cols-3 [&>*]:min-w-0" onSubmit={form.handleSubmit(onSubmit)}>
              <input type="hidden" {...form.register('leadId')} />
              <label className="order-2 block space-y-2">
                <span className="text-sm font-medium">Source</span>
                <Select {...form.register('source')} disabled={Boolean(editingAppointment)}>
                  <option value="">Select source</option>
                  {sourceOptions.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="order-8 block space-y-2">
                <span className="text-sm font-medium">Visit purpose</span>
                <Select
                  {...form.register('resourceType')}
                  onChange={(event) => {
                    const nextResourceType = event.target.value as AppointmentFormValues['resourceType'];
                    form.setValue('resourceType', nextResourceType);
                    if (nextResourceType === 'CONSULTATION') {
                      form.setValue('serviceId', '');
                      form.setValue('roomNumber', undefined);
                      form.setValue('packageMasterId', '');
                      form.setValue('bookingPlan', 'CONSULTATION');
                      form.setValue('durationMinutes', STANDARD_CONSULTATION_MINUTES);
                      form.setValue('bufferMinutes', STANDARD_CONSULTATION_BUFFER_MINUTES);
                      return;
                    }
                    form.setValue('bookingPlan', 'SINGLE_TREATMENT');
                  }}
                >
                  {visitPurposeOptions.map((purpose) => (
                    <option key={purpose.value} value={purpose.value}>
                      {purpose.label}
                    </option>
                  ))}
                </Select>
              </label>
              {formResourceType === 'TREATMENT_ROOM' ? (
                <label className="order-10 block space-y-2">
                  <span className="text-sm font-medium">Treatment room number</span>
                  <Select {...form.register('roomNumber')} disabled={!formAppointmentAt || roomAppointmentsQuery.isLoading}>
                    <option value="">
                      {!formAppointmentAt
                        ? 'Select date and time first'
                        : roomAppointmentsQuery.isLoading
                          ? 'Checking room availability...'
                          : availableRoomNumbers.length
                            ? 'Select available room'
                            : 'No rooms available'}
                    </option>
                    {availableRoomNumbers.map((room) => (
                      <option key={room} value={room}>
                        Room {room}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.roomNumber ? (
                    <span className="text-xs text-red-600">
                      {form.formState.errors.roomNumber.message}
                    </span>
                  ) : null}
                </label>
              ) : null}
              {formResourceType === 'TREATMENT_ROOM' ? (
                <label className="order-9 block space-y-2">
                  <span className="text-sm font-medium">Treatment service</span>
                  <Select
                    value={selectedTreatmentBillingValue}
                    disabled={!formDataBranchId}
                    onChange={(event) => {
                      const [kind, id] = event.target.value.split(':');
                      if (!kind || !id) {
                        form.setValue('serviceId', '');
                        form.setValue('packageMasterId', '');
                        form.setValue('bookingPlan', 'SINGLE_TREATMENT');
                        return;
                      }
                      if (kind === 'package') {
                        const packageMaster = availablePackageMasters.find((item) => item.id === id);
                        const matchedService = packageMaster
                          ? servicesQuery.data?.data.find((service) => service.resourceType === 'TREATMENT_ROOM' && packageMatchesService(packageMaster, service.name))
                          : undefined;
                        form.setValue('packageMasterId', id);
                        form.setValue('bookingPlan', 'PACKAGE');
                        if (matchedService) {
                          form.setValue('serviceId', matchedService.id);
                          form.setValue('durationMinutes', matchedService.durationMinutes);
                          form.setValue('bufferMinutes', matchedService.bufferMinutes);
                        }
                        return;
                      }
                      const service = servicesQuery.data?.data.find((item) => item.id === id);
                      form.setValue('serviceId', id);
                      form.setValue('packageMasterId', '');
                      form.setValue('bookingPlan', 'SINGLE_TREATMENT');
                      if (service) {
                        form.setValue('durationMinutes', service.durationMinutes);
                        form.setValue('bufferMinutes', service.bufferMinutes);
                        form.setValue('resourceType', service.resourceType);
                      }
                    }}
                  >
                    <option value="">{formDataBranchId ? 'Select treatment service' : 'Select branch first'}</option>
                    {treatmentBillingOptions.serviceOptions.length ? (
                      <optgroup label="Single treatment services">
                        {treatmentBillingOptions.serviceOptions.map((option) => (
                          <option key={option.id} value={`service:${option.id}`}>
                            {option.label} · {option.meta}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {treatmentBillingOptions.packageOptions.length ? (
                      <optgroup label="Treatment packages">
                        {treatmentBillingOptions.packageOptions.map((option) => (
                          <option key={option.id} value={`package:${option.id}`}>
                            {option.label} · {option.meta}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </Select>
                  {packageMastersQuery.isError ? (
                    <span className="text-xs text-red-600">Treatment rates could not be loaded. Please try again.</span>
                  ) : null}
                </label>
              ) : null}
              <label className="order-11 block space-y-2">
                <span className="text-sm font-medium">Duration (minutes)</span>
                <Input type="number" {...form.register('durationMinutes')} />
              </label>
              <label className="order-12 block space-y-2">
                <span className="text-sm font-medium">Buffer (minutes)</span>
                <Input type="number" {...form.register('bufferMinutes')} />
              </label>
              <label className="order-5 block space-y-2">
                <span className="text-sm font-medium">Client name</span>
                <Input
                  placeholder="Full name"
                  {...form.register('name')}
                  disabled={Boolean(editingAppointment)}
                />
              </label>
              <label className="order-6 block space-y-2">
                <span className="text-sm font-medium">Mobile</span>
                <Input
                  placeholder="Mobile number"
                  {...form.register('mobile')}
                  disabled={Boolean(editingAppointment)}
                />
              </label>
              <label className="order-7 block space-y-2">
                <span className="text-sm font-medium">Address</span>
                <Input
                  placeholder="Address"
                  {...form.register('address')}
                  disabled={Boolean(editingAppointment)}
                />
              </label>
              <label className="order-1 block space-y-2">
                <span className="text-sm font-medium">Branch</span>
                <Select
                  {...form.register('branchId')}
                  onChange={(event) => {
                    form.setValue('branchId', event.target.value);
                    form.setValue('serviceId', '');
                    form.setValue('doctorId', '');
                    form.setValue('resourceId', '');
                    form.setValue('equipmentId', '');
                    form.setValue('roomNumber', undefined);
                    form.setValue('packageMasterId', '');
                    form.setValue('paymentStatus', 'NOT_PAID');
                    form.setValue('paymentMode', undefined);
                  }}
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="order-4 block space-y-2">
                <span className="text-sm font-medium">Appointment type</span>
                <Select {...form.register('appointmentType')}>
                  {appointmentTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="order-3 block space-y-2">
                <span className="text-sm font-medium">Date and time</span>
                <Input type="datetime-local" {...form.register('appointmentAt')} />
              </label>
              <label className="order-[17] block space-y-2 lg:col-span-3">
                <span className="text-sm font-medium">Notes</span>
                <Input placeholder="Special instructions or internal note" {...form.register('notes')} />
              </label>
              <div className="order-[18] grid gap-3 rounded-xl border border-border bg-muted/20 p-4 lg:col-span-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="text-sm font-semibold">Booking estimate</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formResourceType === 'CONSULTATION' ? 'Standard consultation' : selectedService ? selectedService.name : 'No treatment selected'}
                    {selectedPackage ? ` · ${selectedPackage.name}` : ''}
                  </div>
                  {formResourceType === 'CONSULTATION' ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {STANDARD_CONSULTATION_MINUTES} min consultation · {STANDARD_CONSULTATION_BUFFER_MINUTES} min buffer
                    </div>
                  ) : selectedPackage ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Base {formatCurrency(selectedPackageBase)}
                      {selectedPackageTax ? ` · GST ${formatCurrency(selectedPackageTax)}` : ''}
                    </div>
                  ) : null}
                </div>
                <div className="text-left lg:text-right">
                  <div className="text-xs text-muted-foreground">Total rate</div>
                  <div className="text-2xl font-semibold">{formatCurrency(bookingTotal)}</div>
                </div>
                {bookingTotal > 0 ? (
                  <div className="grid gap-3 lg:col-span-2 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium">Payment status</span>
                      <Select {...form.register('paymentStatus')}>
                        <option value="NOT_PAID">Not paid</option>
                        <option value="PAID">Paid</option>
                      </Select>
                    </label>
                    {formPaymentStatus === 'PAID' ? (
                      <label className="block space-y-2">
                        <span className="text-sm font-medium">Payment mode</span>
                        <Select {...form.register('paymentMode')}>
                          <option value="">Select mode</option>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">Card</option>
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="OTHER">Other</option>
                        </Select>
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {createAppointment.error || updateAppointment.error ? (
                <div className="order-[19] rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 lg:col-span-3">
                  <div className="font-semibold">{bookingProblem?.title ?? 'Appointment could not be booked'}</div>
                  <p className="mt-1">{bookingProblem?.reason ?? 'Please review the appointment details and try again.'}</p>
                  <p className="mt-1 text-red-700">{bookingProblem?.guidance}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bookingProblem?.kind === 'availability' ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            const current = form.getValues('appointmentAt');
                            const date = current ? new Date(current) : new Date();
                            date.setMinutes(date.getMinutes() + 30);
                            form.setValue('appointmentAt', toDateTimeLocal(date.toISOString()), { shouldDirty: true, shouldValidate: true });
                          }}
                        >
                          Try next 30 min
                        </Button>
                        {formResourceType === 'TREATMENT_ROOM' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => form.setValue('roomNumber', undefined, { shouldDirty: true, shouldValidate: true })}
                          >
                            Choose another room
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {bookingProblem?.kind === 'service' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          form.setValue('resourceType', 'CONSULTATION', { shouldDirty: true, shouldValidate: true });
                          form.setValue('serviceId', '');
                        }}
                      >
                        Switch to consultation
                      </Button>
                    ) : null}
                    {bookingProblem?.kind === 'branch' ? (
                      <Button type="button" variant="secondary" onClick={() => form.setFocus('branchId')}>
                        Select branch
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="order-[20] flex gap-3 lg:col-span-3">
                <Button
                  type="submit"
                  disabled={createAppointment.isPending || updateAppointment.isPending}
                >
                  <CalendarClock className="size-4" />
                  {editingAppointment ? 'Save Changes' : 'Schedule'}
                </Button>
                {editingAppointment ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingAppointment(null);
                      setShowAppointmentForm(false);
                      form.reset({
                        name: '',
                        leadId: '',
                        mobile: '',
                        address: '',
                        source: '',
                        branchId: activeBranchId,
                        appointmentAt: '',
                        appointmentType: 'CLINIC_VISIT',
                        resourceType: 'CONSULTATION',
                        roomNumber: undefined,
                        notes: '',
                        serviceId: '',
                        durationMinutes: 30,
                        bufferMinutes: 0,
                        doctorId: '',
                        resourceId: '',
                        equipmentId: '',
                        bookingPlan: 'CONSULTATION',
                        packageMasterId: '',
                        paymentStatus: 'NOT_PAID',
                        paymentMode: undefined,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                {!editingAppointment ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowAppointmentForm(false);
                      form.reset({
                        name: '',
                        leadId: '',
                        mobile: '',
                        address: '',
                        source: '',
                        branchId: activeBranchId,
                        appointmentAt: '',
                        appointmentType: 'CLINIC_VISIT',
                        resourceType: 'CONSULTATION',
                        roomNumber: undefined,
                        notes: '',
                        serviceId: '',
                        durationMinutes: 30,
                        bufferMinutes: 0,
                        doctorId: '',
                        resourceId: '',
                        equipmentId: '',
                        bookingPlan: 'CONSULTATION',
                        packageMasterId: '',
                        paymentStatus: 'NOT_PAID',
                        paymentMode: undefined,
                      });
                    }}
                  >
                    Close
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </section>
  );
}

function AppointmentMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

function AppointmentList({
  appointments,
  onSelect,
  onEdit,
  onStatusChange,
}: {
  appointments: Appointment[];
  onSelect: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onStatusChange: (appointment: Appointment, status: AppointmentStatus) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      {appointments.map((appointment) => (
        <div
          key={appointment.id}
          className="grid cursor-pointer gap-3 rounded-md border border-border p-3 hover:bg-muted/50 lg:grid-cols-[90px_1fr_180px_180px] lg:items-center"
          onClick={() => onSelect(appointment)}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-primary" />
            {formatTime(appointment.appointmentAt)}
          </div>
          <div>
            <div className="font-medium">{appointment.lead?.name ?? 'Patient'}</div>
            <div className="text-xs text-muted-foreground">
              {appointment.lead?.mobile} · {appointment.branch?.name} ·{' '}
              {appointment.lead?.source?.replace('_', ' ')}
              {appointment.resourceType === 'TREATMENT_ROOM'
                ? ` · Room ${appointment.roomNumber}`
                : ' · Consultation'}
            </div>
          </div>
          <Select
            aria-label="Appointment status"
            value={appointment.status}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              onStatusChange(appointment, event.target.value as AppointmentStatus)
            }
          >
            {quickStatuses(appointment.status).map((appointmentStatus) => (
              <option key={appointmentStatus.value} value={appointmentStatus.value}>
                {appointmentStatus.label}
              </option>
            ))}
            {!appointmentStatuses.some(
              (appointmentStatus) => appointmentStatus.value === appointment.status,
            ) ? (
              <option value={appointment.status}>{appointment.status.replace('_', ' ')}</option>
            ) : null}
          </Select>
          <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
            <Button type="button" variant="secondary" onClick={() => onEdit(appointment)}>
              <RotateCcw className="size-4" />
              Reschedule
            </Button>
          </div>
        </div>
      ))}
      {!appointments.length ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No appointments found.
        </div>
      ) : null}
    </div>
  );
}

function AppointmentDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
