import { $COL, $FD, $FM, $PT, $RP, $TG, Field, Part } from 'vuetify-extended';
import { RENTAL_PERMISSION_OPTIONS, rentalAccess } from '../../misc/access';
import { makeCollectionMenu } from '../../misc/menu';
import { useAppStore } from '../../store/app';

const reportTitleSingular = 'Staff Membership';
const reportTitlePlural = 'Staff';
const formTitle = 'Manage rental provider staff';
const triggerTitle = 'Staff';

function getServicePath() {
  const appStore = useAppStore();
  const rentalProviderId = appStore.rentalProvider?.id;

  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.');
  }

  return `rental-providers/${rentalProviderId}/staff-memberships`;
}

const trigger = () => {
  const trg = $TG({
    title: triggerTitle,
    selectFields: ['user.accountId', 'user.displayName', 'title', 'membershipStatus', 'accessPolicyMode', 'isPrimaryContact', 'id'],
    headers: [
      { title: 'Account ID', value: 'user.accountId' },
      { title: 'Name', value: 'user.displayName' },
      { title: 'Title', value: 'title' },
      { title: 'Status', value: 'membershipStatus' },
      { title: 'Access Mode', value: 'accessPolicyMode' },
      { title: 'Primary', value: 'isPrimaryContact' },
    ],
  }, {});
  return trg;
};

const createForm = () => {
  const mainFields: (Field | Part)[] = [
    $FD({ label: 'User Account ID', type: 'text', storage: 'userAccountId', required: true, placeholder: 'CUS-ABCD-1234', hint: 'Enter the Bookmame account ID of the staff member you want to add.' }),
    $FD({ label: 'Title', type: 'text', storage: 'title', placeholder: 'Operations Manager' }),
    $FD({ label: 'Membership Status', type: 'select', storage: 'membershipStatus' }, {
      selectOptions: () => [
        { id: 'active', name: 'Active' },
        { id: 'inactive', name: 'Inactive' },
      ],
    }),
    $FD({ label: 'Primary Contact', type: 'boolean', storage: 'isPrimaryContact', hint: 'Mark this when the member should be the main operational contact for the rental provider.' }),
    $FD({ ref: 'accessPolicyMode', label: 'Access Mode', type: 'select', storage: 'accessPolicyMode', hint: 'Full access keeps the current behavior. Restricted modes let you block a few areas or allow only selected ones.' }, {
      selectOptions: () => [
        { id: 'full_access', name: 'Full Access' },
        { id: 'allow_all_except', name: 'Allow All Except Selected' },
        { id: 'deny_all_except', name: 'Deny All Except Selected' },
      ],
      changed(field) {
        if (field.$refs.accessPermissionCodes) {
          field.$refs.accessPermissionCodes.$params.invisible = field.$value === 'full_access';
        }
      },
    }),
    $FD({ ref: 'accessPermissionCodes', label: 'Permission Codes', type: 'select', storage: 'accessPermissionCodes', multiple: true, cols: 12 }, {
      selectOptions: () => RENTAL_PERMISSION_OPTIONS,
    }),
  ];

  const frm = $FM({
    title: formTitle,
  }, {
    children: () => [
      $PT({}, {
        children: () => mainFields,
      }),
    ],
    setup(form) {
      if (!form.$master?.$get('accessPolicyMode')) {
        form.$master?.$set('accessPolicyMode', 'full_access');
      }
      if (form.$refs.accessPermissionCodes) {
        form.$refs.accessPermissionCodes.$params.invisible =
          form.$master?.$get('accessPolicyMode') === 'full_access';
      }
    },
    access: rentalAccess('rental.staff.manage'),
  });

  return frm;
};

const report = () => {
  const rep = $RP({
    title: reportTitleSingular,
  }, {
    form: createForm,
    access: rentalAccess('rental.staff.manage'),
  });
  return rep;
};

const collection = () => {
  const col = $COL({
    objectType: getServicePath(),
  }, {
    report,
    trigger,
    access: rentalAccess('rental.staff.manage'),
  });

  return col;
};

export const rentalStaffMenu = () => {
  const menu = makeCollectionMenu({
    title: reportTitlePlural,
    collection,
    access: rentalAccess('rental.staff.manage'),
  });
  return menu;
};
