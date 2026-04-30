import { makeConstantOptions, resolveIdToImage, resolveImageToId } from '@bookmame/web-utils';
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Field, Part } from 'vuetify-extended';
import { rentalAccess } from '../../misc/access';
import { rentalInventoryImagesCollection } from '../inventory-images';
import { rentalInventoryVariantsCollection } from '../inventory-variants';
import { openRentalInventoryCalendar } from '../inventory-calendar';
import { useAppStore } from '../../store/app';
import { makeCollectionMenu } from '../../misc/menu';

function rentalAttributesField(storage = 'attributes', label = 'Item Attributes') {
  return $FD({ label, storage, type: 'collection', cols: 12, hint: 'Structured label and value rows shown to customers before the description section.' }, {
    headers() {
      return [
        { title: 'Label', value: 'label' },
        { title: 'Value', value: 'value' },
        { title: 'Sort Order', value: 'sortOrder' },
      ]
    },
    form() {
      return $FM({}, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label: 'Label', storage: 'label', type: 'text', required: true }),
              $FD({ label: 'Value', storage: 'value', type: 'text', required: true }),
              $FD({ label: 'Sort Order', storage: 'sortOrder', type: 'integer' }),
            ],
          }),
        ],
      })
    },
  })
}

function rentalDepositTiersField(storage = 'securityDepositTiers', label = 'Deposit Tiers') {
  return $FD({ label, storage, type: 'collection', cols: 12, hint: 'Use ascending "up to quantity" rows. Leave "Up To Quantity" empty on the final row to mean any quantity above the previous tier.' }, {
    headers() {
      return [
        { title: 'Up To Quantity', value: 'quantityUpTo' },
        { title: 'Deposit Amount', value: 'depositAmount' },
      ]
    },
    form() {
      return $FM({}, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label: 'Up To Quantity', storage: 'quantityUpTo', type: 'integer', hint: 'Leave empty on the last row for any quantity above the previous tier.' }),
              $FD({ label: 'Deposit Amount', storage: 'depositAmount', type: 'integer', required: true, hint: 'Minor unit amount.' }),
            ],
          }),
        ],
      })
    },
  })
}

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

async function configuredDeliveryPartnerOptions() {
  const response = await Api.instance.service(`rental-providers/${getRentalProviderId()}/delivery-partners`).find({
    query: {
      $paginate: false,
      $select: ['deliveryCompanyId', 'deliveryCompany.name'],
    },
  }) as any

  const items = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
  return items.map((item: any) => ({
    id: item.deliveryCompanyId,
    name: item.deliveryCompany?.name || item.deliveryCompanyId,
  }))
}

const trigger = () => $TG({
  title: 'Inventory',
  selectFields: ['id', 'name', 'categoryLabel', 'dailyRateAmount', 'currency', 'totalInventory', 'minimumRentalDays', 'maximumRentalDays', 'status', 'enabled', 'isAvailable', 'createdAt'],
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
    rentalDepositTiersField(),
    $FD({ label: 'Minimum Rental Days', type: 'integer', storage: 'minimumRentalDays' }),
    $FD({ label: 'Maximum Rental Days', type: 'integer', storage: 'maximumRentalDays' }),
    $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
    $FD({ label: 'Status', type: 'select', storage: 'status' }, {
      selectOptions: makeConstantOptions('rental-item-statuses'),
    }),
    $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
    $FD({ label: 'Available', type: 'boolean', storage: 'isAvailable' }),
    $FD({ label: 'Supports Customer Pickup', type: 'boolean', storage: 'supportsCustomerPickup' }, {
      default: () => useAppStore().rentalProvider?.supportsCustomerPickup ?? true,
    }),
    $FD({ label: 'Supports Self Delivery', type: 'boolean', storage: 'supportsSelfDelivery' }, {
      default: () => useAppStore().rentalProvider?.supportsSelfDelivery ?? false,
    }),
    $FD({ label: 'Supports Third-Party Delivery', type: 'boolean', storage: 'supportsThirdPartyDelivery' }, {
      default: () => useAppStore().rentalProvider?.supportsThirdPartyDelivery ?? false,
    }),
    $FD({ label: 'Supports Return Collection', type: 'boolean', storage: 'supportsReturnCollection' }, {
      default: () => useAppStore().rentalProvider?.supportsReturnCollection ?? false,
    }),
    $FD({ label: 'Applicable Delivery Partners', type: 'select', storage: 'applicableDeliveryCompanyIds', multiple: true, cols: 12, hint: 'Leave empty to inherit all active rental delivery partners. Select specific partners only when an item needs delivery restrictions.' }, {
      selectOptions: configuredDeliveryPartnerOptions,
    }),
    $FD({ label: 'Image', type: 'image', storage: 'image' }),
    rentalAttributesField(),
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
  sideButtonWidth: 260,
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
  sideButtons: (_props, _context, report) => {
    if (report.$params.mode === 'create') {
      return []
    }

    const itemId = report.$master?.$get('id')
    const rentalProviderId = useAppStore().rentalProvider?.id
    if (!itemId || !rentalProviderId) {
      return []
    }

    return [
      $BN({ text: 'Inventory Calendar', icon: 'mdi-calendar-blank-outline', color: 'primary' }, {
        onClicked() {
          openRentalInventoryCalendar(String(itemId))
        },
      }),
      $BN({ text: 'Manage Variants', icon: 'mdi-shape-outline', color: 'secondary' }, {
        onClicked() {
          const coll = rentalInventoryVariantsCollection(String(rentalProviderId), String(itemId))
          coll.$params.mode = report.$params.mode
          AppManager.showCollection(coll)
        },
      }),
      $BN({ text: 'Manage Gallery', icon: 'mdi-image-multiple-outline', color: 'info' }, {
        onClicked() {
          const coll = rentalInventoryImagesCollection(String(rentalProviderId), String(itemId))
          coll.$params.mode = report.$params.mode
          AppManager.showCollection(coll)
        },
      }),
    ]
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

export const rentalInventoryMenu = () => makeCollectionMenu({
  title: 'Catalog',
  collection: rentalInventoryCollection,
  access: rentalAccess('rental.inventory.view'),
})
