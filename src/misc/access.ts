import { Api } from 'vuetify-extended';
import { useAppStore } from '../store/app';

type AccessPolicy = {
  strategy: 'allow_all_except' | 'deny_all_except';
  permissions: string[];
};

type RoleAssignment = {
  allowedApps?: string[];
  scopeType?: string | null;
  scopeId?: string | null;
  accessPolicy?: AccessPolicy | null;
};

type CurrentUser = {
  roleAssignments?: RoleAssignment[];
};

export const RENTAL_PERMISSION_OPTIONS = [
  { id: 'rental.dashboard.view', name: 'Dashboard' },
  { id: 'rental.profile.view', name: 'Profile' },
  { id: 'rental.inventory.view', name: 'Inventory' },
  { id: 'rental.delivery_partners.manage', name: 'Delivery Partners' },
  { id: 'rental.reservations.view', name: 'Reservations' },
  { id: 'rental.finance.view', name: 'Finance' },
];

function currentUser(): CurrentUser | null {
  return (Api.instance.userRef?.value as { user?: CurrentUser | null } | null)?.user ?? null;
}

function accessPolicyAllows(policy: AccessPolicy | null | undefined, permissionCode: string) {
  if (!policy) {
    return true;
  }

  const permissions = Array.isArray(policy.permissions) ? policy.permissions : [];
  if (policy.strategy === 'allow_all_except') {
    return !permissions.includes(permissionCode);
  }

  return permissions.includes(permissionCode);
}

export async function rentalHasAccess(permissionCode?: string) {
  if (!permissionCode) {
    return true;
  }

  const rentalProviderId = useAppStore().rentalProvider?.id?.toString?.();
  const user = currentUser();
  const assignments = Array.isArray(user?.roleAssignments) ? user.roleAssignments : [];
  const rentalAssignments = assignments.filter((assignment) =>
    Array.isArray(assignment.allowedApps) &&
    assignment.allowedApps.includes('bookmame-rental') &&
    assignment.scopeType === 'rental_provider' &&
    (!rentalProviderId || assignment.scopeId === rentalProviderId),
  );

  if (rentalAssignments.length === 0) {
    return false;
  }

  return rentalAssignments.some((assignment) => accessPolicyAllows(assignment.accessPolicy, permissionCode));
}

export function rentalAccess(permissionCode?: string) {
  return async () => rentalHasAccess(permissionCode);
}
