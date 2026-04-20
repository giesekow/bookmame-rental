import { makeConstantOptions, resolveIdToImage, resolveImageToId } from '@bookmame/web-utils';
import { $COL, $FD, $FM, $PT, $RP, $TG, Field, Part } from 'vuetify-extended';
import { rentalAccess } from '../../misc/access';
import { useAppStore } from '../../store/app';

function getRentalProviderId() {
  const rentalProviderId = useAppStore().rentalProvider?.id;
  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.');
  }
  return rentalProviderId;
}

function getServicePath() {
  return `rental-providers/${getRentalProviderId()}/inventory-items`;
}

const trigger = () => $TG({
  title: 'Inventory',
  selectFields: ['name', 'categoryLabel', 'dailyRateAmount', 'currency', 'totalInventory', 'minimumRentalDays', 'maximumRentalDays', 'status', 'enabled', 'isAvailable', 'createdAt'],
  headers: [
    { title: 'Name', value: 'name' },
    { title: 'Category', value: 'categoryLabel' },
    { title: 'Daily Rate', value: 'dailyRateAmount' },
    { title: 'Currency', value: 'currency' },
    { title: 'Inventory', value: 'totalInventory' },
    { title: 'Min Days', value: 'minimumRentalDays' },
    { title: 'Max Days', value: 'maximumRentalDays' },
    { title: 'Status', value: 'status' },
    { title: 'Enabled', value: 'enabled' },
    { title: 'Available', value: 'isAvailable' },
    { title: 'Created', value: 'createdAt' },
  ],
}, {});

const createForm = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
    $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
    $FD({ label: 'Category', type: 'text', storage: 'categoryLabel' }),
    $FD({ label: 'Daily Rate Amount', type: 'integer', storage: 'dailyRateAmount', required: true, hint: 'Minor unit amount.' }),
    $FD({ label: 'Security Deposit Amount', type: 'integer', storage: 'securityDepositAmount' }),
    $FD({ label: 'Currency', type: 'select', storage: 'currency', required: true }, {
      selectOptions: makeConstantOptions('currencies'),
      default: () => useAppStore().rentalProvider?.defaultCurrencyCode,
    }),
    $FD({ label: 'Total Inventory', type: 'integer', storage: 'totalInventory', required: true }),
    $FD({ label: 'Minimum Rental Days', type: 'integer', storage: 'minimumRentalDays' }),
    $FD({ label: 'Maximum Rental Days', type: 'integer', storage: 'maximumRentalDays' }),
    $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
    $FD({ label: 'Status', type: 'select', storage: 'status' }, {
      selectOptions: makeConstantOptions('rental-item-statuses'),
    }),
    $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
    $FD({ label: 'Available', type: 'boolean', storage: 'isAvailable' }),
    $FD({ label: 'Image', type: 'image', storage: 'image' }),
  ];

  return $FM({
    title: 'Inventory Item',
  }, {
    children: () => [
      $PT({}, {
        children: () => fields,
      }),
    ],
    bottomChildren: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Description', type: 'textarea', storage: 'description' }),
        ],
      }),
    ],
  });
};

export const rentalInventoryReport = () => $RP({
  title: 'Inventory Item',
}, {
  form: createForm,
  setup(report) {
    resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report);
  },
  loaded(report) {
    resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report);
  },
  saved: async (report) => {
    await resolveImageToId({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
      meta: {
        purpose: 'rental-inventory-item-image',
        isPublic: true,
      },
    })(report);
  },
  access: rentalAccess('rental.inventory.view'),
});

export const rentalInventoryCollection = () => $COL({
  objectType: getServicePath(),
}, {
  report: rentalInventoryReport,
  trigger,
  access: rentalAccess('rental.inventory.view'),
});
