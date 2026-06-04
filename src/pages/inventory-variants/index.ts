import { resolveIdToImage, resolveImageToId, makeConstantOptions } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'

function servicePath(rentalProviderId: string, itemId: string) {
  return `rental-providers/${rentalProviderId}/inventory-items/${itemId}/variants`
}

async function fetchDeliveryClassOptions(rentalProviderId: string) {
  const provider = await Api.instance.service('rental-providers').get(rentalProviderId) as any
  const items = Array.isArray(provider?.supportedDeliveryClasses) ? provider.supportedDeliveryClasses : []
  return items.map((item: any) => ({
    id: item.id,
    name: item.name || item.code || item.id,
  }))
}

function variantAttributesField(storage = 'attributes', label = 'Variant Attributes') {
  return $FD({ label, storage, type: 'collection', cols: 12, hint: 'Use structured rows for variant-specific details such as color, size, capacity, or finish.' }, {
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

function variantDepositTiersField(storage = 'securityDepositTiers', label = 'Variant Deposit Tiers') {
  return $FD({ label, storage, type: 'collection', cols: 12, hint: 'Optional override tiers for this variant. Leave "Up To Quantity" empty on the final row to cover any quantity above the previous tier.' }, {
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

export const rentalInventoryVariantsReport = (rentalProviderId: string, itemId: string) => $RP({
  title: 'Inventory Variant',
  objectType: servicePath(rentalProviderId, itemId),
}, {
  form: () => $FM({
    title: 'Inventory Variant',
  }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
          $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
          $FD({ label: 'Status', type: 'select', storage: 'status' }, {
            selectOptions: makeConstantOptions('rental-item-statuses'),
          }),
          $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
          $FD({ label: 'Available', type: 'boolean', storage: 'isAvailable' }),
          $FD({ label: 'Variant Daily Rate Amount', type: 'integer', storage: 'dailyRateAmount', hint: 'Leave empty to inherit the base item daily rate.' }),
          $FD({ label: 'Variant Security Deposit Amount', type: 'integer', storage: 'securityDepositAmount', hint: 'Leave empty to inherit the base item security deposit.' }),
          $FD({ label: 'Delivery Class', type: 'select', storage: 'deliveryClassId', hint: 'Optional override. Leave blank to inherit the base item delivery metadata.' }, {
            selectOptions: async () => fetchDeliveryClassOptions(rentalProviderId),
          }),
          $FD({ label: 'Weight (grams)', type: 'integer', storage: 'weightGrams' }),
          $FD({ label: 'Length (cm)', type: 'integer', storage: 'lengthCm' }),
          $FD({ label: 'Width (cm)', type: 'integer', storage: 'widthCm' }),
          $FD({ label: 'Height (cm)', type: 'integer', storage: 'heightCm' }),
          $FD({ label: 'Declared Value Amount', type: 'integer', storage: 'declaredValueAmount', hint: 'Optional. Collected now for future insurance-related flows.' }),
          variantDepositTiersField(),
          $FD({ label: 'Variant Inventory', type: 'integer', storage: 'totalInventory', required: true }),
          $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
          $FD({ label: 'Variant Image', type: 'image', storage: 'image' }),
          variantAttributesField(),
        ],
      }),
    ],
    bottomChildren: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Description', type: 'textarea', storage: 'description' }),
        ],
      }),
    ],
    saved: async (form) => {
      form.$master!.$temporary = ['image']
      await resolveImageToId({
        imageField: 'image',
        idField: 'imageAssetId',
        cacheField: 'imageCache',
        meta: {
          purpose: 'rental-inventory-variant-image',
          isPublic: true,
        },
      })(form)
    },
  }),
  setup(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report)
  },
  loaded(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report)
  },
  access: rentalAccess('rental.inventory.view'),
})

export const rentalInventoryVariantsCollection = (rentalProviderId: string, itemId: string) => $COL({
  objectType: servicePath(rentalProviderId, itemId),
}, {
  trigger: () => $TG({
    title: 'Inventory Variants',
    selectFields: ['name', 'slug', 'dailyRateAmount', 'securityDepositAmount', 'totalInventory', 'status', 'enabled', 'isAvailable', 'sortOrder', 'createdAt', 'id'],
    headers: [
      { title: 'Name', value: 'name' },
      { title: 'Slug', value: 'slug' },
      { title: 'Daily Rate', value: 'dailyRateAmount' },
      { title: 'Deposit', value: 'securityDepositAmount' },
      { title: 'Inventory', value: 'totalInventory' },
      { title: 'Status', value: 'status' },
      { title: 'Enabled', value: 'enabled' },
      { title: 'Available', value: 'isAvailable' },
      { title: 'Sort Order', value: 'sortOrder' },
      { title: 'Created', value: 'createdAt' },
    ],
    sideButtonWidth: 180,
  }, {
    sideButtons: (_props, _context, trigger) => trigger.$params.mode === 'edit' ? [
      $BN({ text: 'Add Variant', icon: 'mdi-plus', color: 'success' }, {
        onClicked() {
          const report = rentalInventoryVariantsReport(rentalProviderId, itemId)
          report.$params.mode = 'create'
          AppManager.showReport(report)
        },
      }),
    ] : [],
  }),
  report: () => rentalInventoryVariantsReport(rentalProviderId, itemId),
  access: rentalAccess('rental.inventory.view'),
})
