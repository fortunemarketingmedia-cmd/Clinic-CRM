import { RoleGate } from '@/components/layout/role-gate';
import { MedicinesView } from '@/modules/medicines/medicines-view';

export default function MedicinesPage() {
  return (
    <RoleGate allowed={['ADMIN', 'RECEPTIONIST']}>
      <MedicinesView />
    </RoleGate>
  );
}
