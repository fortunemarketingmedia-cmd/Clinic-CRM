# Revive Clinic CRM Architecture

## Roles

### Admin

- Access both branches.
- Manage users.
- View analytics.
- Manage settings and system configuration.

### Receptionist

- Use the daily operations dashboard.
- Toggle between Sharanpur Road and Nashik Road.
- Create and manage leads and appointments.
- Cannot access analytics, settings, users, or system configuration.

## Backend Layering

```text
Route -> Controller -> Service -> Repository -> Database
```

Controllers should validate request shape, call services, and return responses. They should not call Prisma directly.

## Branch Logic

Receptionists work inside one selected branch at a time. Admins can view all branches or filter by a branch.

Branch records are seeded initially:

- Sharanpur Road
- Nashik Road

## Lead To Patient Rule

Every enquiry starts as a lead. Patient records are created only when a lead arrives, completes consultation, or submits the QR profile form.

