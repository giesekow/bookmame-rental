import { makeConstantOptions, resolveIdToImage, resolveImageToId } from '@bookmame/web-utils';
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Field, Part } from 'vuetify-extended';
import { rentalAccess } from '../../misc/access';
import { rentalInventoryImagesCollection } from '../inventory-images';
import { rentalInventoryVariantsCollection } from '../inventory-variants';
import { openRentalInventoryCalendar } from '../inventory-calendar';
import { useAppStore } from '../../store/app';
import { makeCollectionMenu } from '../../misc/menu';
import {
  hydrateRentalMarketplaceAttributes,
  normalizeRentalMarketplaceAttributes,
  rentalMarketplaceAttributesField,
  resolveRentalCategoryFacetId,
} from '../../misc/marketplace-attributes';

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

function parseTags(value: any) {
  return Array.from(
    new Set(value),
  ).slice(0, 20)
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

async function deliveryClassOptions() {
  const provider = await Api.instance.service('rental-providers').get(getRentalProviderId()) as any
  const items = Array.isArray(provider?.supportedDeliveryClasses) ? provider.supportedDeliveryClasses : []
  return items.map((item: any) => ({
    id: item.id,
    name: item.name || item.code || item.id,
  }))
}

async function rentalCategoryOptions(field?: Field) {
  const response = await Api.instance.service('reference-data/marketplace-categories').find({
    query: { marketplace: 'rental', $paginate: false },
  }) as any
  const items = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
  const options = items.map((item: any) => ({
    id: item.label,
    name: item.parentId ? `${item.label} (subcategory)` : item.label,
  }))
  const current = String(field?.$value || '').trim()
  if (current && !options.some((option: any) => option.id === current)) {
    options.push({ id: current, name: `${current} (inactive or legacy)` })
  }
  return options
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
  const fm = $FM({
    title: 'Inventory Item',
  }, {
    saved(form) {
      const tags = form.$master?.$get?.('tags', [])
      form.$master?.$set?.('tags', parseTags(tags))
      const rows = form.$master?.$get?.('marketplaceAttributes', [])
      form.$master?.$set?.('marketplaceAttributes', normalizeRentalMarketplaceAttributes(rows))
    },
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
  const fields: (Field | Part)[] = [
    $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
    $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
    $FD({ label: 'Category', type: 'select', storage: 'categoryLabel', clearable: true, hint: 'Choose a managed Rental marketplace category. Changing it may make existing structured attributes incompatible.' }, {
      selectOptions: rentalCategoryOptions,
    }),
    $FD({ label: 'Daily Rate Amount', type: 'integer', storage: 'dailyRateAmount', required: true, hint: 'Minor unit amount.' }),
    $FD({ label: 'Security Deposit Amount', type: 'integer', storage: 'securityDepositAmount' }),
    $FD({ label: 'Currency', type: 'select', storage: 'currency', required: true }, {
      selectOptions: makeConstantOptions('currencies'),
      default: () => useAppStore().rentalProvider?.defaultCurrencyCode,
    }),
    $FD({ label: 'Delivery Class', type: 'select', storage: 'deliveryClassId', hint: 'Required once third-party delivery is enabled for this item.' }, {
      selectOptions: deliveryClassOptions,
    }),
    $FD({ label: 'Weight (grams)', type: 'integer', storage: 'weightGrams' }),
    $FD({ label: 'Length (cm)', type: 'integer', storage: 'lengthCm' }),
    $FD({ label: 'Width (cm)', type: 'integer', storage: 'widthCm' }),
    $FD({ label: 'Height (cm)', type: 'integer', storage: 'heightCm' }),
    $FD({ label: 'Declared Value Amount', type: 'integer', storage: 'declaredValueAmount', hint: 'Optional. Collected now for future insurance-related flows.' }),
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
    $FD({
      label: 'Search Tags',
      storage: 'tags',
      type: 'text',
      multiple: true,
      cols: 12,
      hint: 'Optional keywords customers may search for. enter the text and press Enter to add a tag.',
      placeholder: 'drill, makita, home repair, compact',
      validation: {
        maxLen: 20
      }
    }),
    $FD({ label: 'Image', type: 'image', storage: 'image' }),
    rentalMarketplaceAttributesField({
      rentalProviderId: getRentalProviderId,
      facetId: () => resolveRentalCategoryFacetId(fm.$master?.$get('categoryLabel')),
    }),
    rentalAttributesField('attributes', 'Additional Attributes'),
  ];
  return fm;
};

export const rentalInventoryReport = () => $RP({
  title: 'Inventory Item',
  sideButtonWidth: 260,
}, {
  form: createForm,
  setup(report) {
    report.$master!.$temporary = ['image']
    resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report);
  },
  loaded(report) {
    report.$master!.$temporary = ['image']
    resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report);
    const rows = report.$master?.$get('marketplaceAttributes', [])
    report.$master?.$set('marketplaceAttributes', hydrateRentalMarketplaceAttributes(rows))
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
  accessCreate: rentalAccess('rental.inventory.manage'),
  accessEdit: rentalAccess('rental.inventory.manage'),
  accessDisplay: rentalAccess('rental.inventory.view'),
  access: rentalAccess('rental.inventory.view'),
})
