# Revive Clinic CRM workflow architecture

This document is the product workflow source of truth. User-facing screens should follow this flow even if the database keeps older internal statuses for migration compatibility.

## Core rule

The CRM has two separate pipelines:

1. Sales pipeline: enquiry and lead follow-up only.
2. Clinical pipeline: appointment, client registration, queue, consultation, prescription, treatment, billing, follow-up, retention.

Once an enquiry becomes a real appointment or client record, it must stop behaving like an active sales lead. The lead can remain as history, but it should not appear in daily lead/follow-up work queues.

## Full clinic journey

```text
Patient enquiry
  -> Lead follow-up
  -> Appointment booking
  -> Client registration
  -> Check-in and queue
  -> Doctor consultation
  -> Prescription / investigations
  -> Treatment recommendation
  -> Quotation / consent
  -> Billing and payment
  -> Treatment sessions
  -> Clinical follow-up
  -> Treatment completion
  -> Feedback, retention and recall
```

## Module ownership

| Workflow step | Main screen | Data rule |
| --- | --- | --- |
| Patient enquiry | Leads | Stores only enquiry/sales information: name, mobile, concern, source, branch, owner, priority, and next action. |
| Lead follow-up | Follow-ups | Drag-and-drop sales pipeline. Used only until appointment/client conversion. |
| Appointment booking | Appointments | Creates the appointment record, selected branch, doctor, visit purpose, treatment service/package, room, payment estimate, and reminders. |
| Client registration | Client Directory / Client 360 | Creates one longitudinal client profile. No duplicate client should be created for repeat visits. |
| Check-in and queue | Daily Client Queue | Shows the current day’s branch flow: scheduled, checked-in, waiting, in consultation, completed. |
| Consultation / EMR | Doctor Workspace / Client 360 | Stores clinical complaint, diagnosis, notes, vitals, findings, investigations, and treatment advice. |
| Prescription | Client 360 | Prescriptions are linked to the client and clinical visit, printable with clinic branding. |
| Treatment planning | Client 360 | Treatment/package plan, sessions, consent, doctor/provider, room, and package progress are linked to the client. |
| Billing and payment | Client 360 billing | Invoice items come from consultation, treatment service, package, medicine, or procedure selection. Payments update outstanding balance. |
| Treatment sessions | Client 360 treatments | Each completed session updates package/session usage and client history. |
| Clinical follow-up | Follow-ups / Client 360 | Clinical follow-up is tied to the client after visit/treatment, not the active sales board. |
| Retention | Communication / Reports | Reminders, review requests, renewal prompts, and recall campaigns use client/package history. |
| Reporting | Dashboard / Analytics | Uses module records, not hand-entered dashboard numbers. |

## User-facing lead statuses

Use these labels on lead screens:

- New enquiry
- Contacted
- Follow-up required
- Appointment proposed
- Not interested

Internal statuses may map as follows:

| User label | Internal statuses |
| --- | --- |
| New enquiry | `NEW`, `UNASSIGNED`, `ASSIGNED` |
| Contacted | `ATTEMPTING_CONTACT`, `CONNECTED` |
| Follow-up required | `NURTURING`, `POSTPONED`, `NOT_ARRIVED` |
| Appointment proposed | `QUALIFIED`, `APPOINTMENT_PROPOSED` |
| Not interested | `LOST`, `DISQUALIFIED` |

`APPOINTMENT_BOOKED`, `BOOKED`, `CONFIRMED`, `ARRIVED`, and `CONVERTED` are not active lead-board choices. They belong to the appointment/client pipeline and should be hidden from active lead lists.

## User-facing appointment statuses

Appointment screens should use:

- Scheduled
- Confirmed
- Rescheduled
- Cancelled
- No-show
- Completed

Queue screens can additionally show:

- Checked in
- Waiting
- In consultation
- Treatment in progress
- Billing pending

## Treatment planning statuses

Treatment and package planning should use:

```text
Recommended -> Quotation Shared -> Approved -> Scheduled -> In Progress -> Completed
```

Billing status remains separate:

- Unpaid
- Partially paid
- Paid
- Refunded

## Form design rules

- Use one branch selector per workflow step. Branch-sensitive records must save the selected branch.
- Appointment booking has one treatment/service selector. Consultation should not require a treatment service.
- If a treatment service or package has a configured rate, the bill estimate must calculate automatically.
- Room dropdowns should only show rooms available for the selected branch/date/time.
- Do not show technical API, route, or database messages to clinic users.
- Dropdown names must match across appointment, treatment, billing, prescription, and Client 360.
- Doctor/provider fields should show clinical users only. Receptionist/assistant fields should not appear unless the workflow genuinely needs them.

## Data handoff rules

- Creating an appointment from a lead closes open sales follow-ups for that lead.
- Creating/checking in an appointment should create or link the client profile.
- Clinical treatments, prescriptions, invoices, and payments must always link to the client profile.
- Client Directory should show clients with appointments, consultations, treatments, procedures, prescriptions, invoices, or completed checkups.
- Sales leads should not be mixed into Client Directory unless they have entered the clinical pipeline.
- Billing invoices should be generated from selected consultation/service/package data, not free-floating dummy rows.

## Access model

- Dr. Revive (`ADMIN`) has full clinic access except developer-only system tools.
- Receptionist has operational access: dashboard, leads, follow-ups, tasks, appointments, daily queue, schedules/rooms, client directory, doctor workspace where required for daily operations, and communication.
- Receptionist cannot access Reports/Analytics or Administration.
- Developer (`DEVELOPER`) is hidden from clinic users and only exists for integration/system maintenance.
