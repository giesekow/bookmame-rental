import { resolveIdToImage, resolveImageToId } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, AppManager } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'

function servicePath(rentalProviderId: string, itemId: string) {
  return `rental-providers/${rentalProviderId}/inventory-items/${itemId}/images`
}

export const rentalInventoryImagesReport = (rentalProviderId: string, itemId: string) => $RP({
  title: 'Inventory Gallery Image',
  objectType: servicePath(rentalProviderId, itemId),
}, {
  form: () => $FM({
    title: 'Inventory Gallery Image',
  }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Image', type: 'image', storage: 'image', required: true, cols: 12 }),
          $FD({ label: 'Caption', storage: 'caption', type: 'text', cols: 12 }),
          $FD({ label: 'Sort Order', storage: 'sortOrder', type: 'integer' }),
          $FD({ label: 'Use as primary inventory image ?', storage: 'isPrimary', type: 'boolean' }),
        ],
      }),
    ],
    saved: async (form) => {
      form.$master!.$temporary = ['image']
      await resolveImageToId({
        imageField: 'image',
        idField: 'assetId',
        cacheField: 'imageCache',
        meta: {
          purpose: 'rental-inventory-gallery',
          isPublic: true,
        },
      })(form)
    },
  }),
  setup(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'assetId',
      cacheField: 'imageCache',
    })(report)
  },
  loaded(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'assetId',
      cacheField: 'imageCache',
    })(report)
  },
  access: rentalAccess('rental.inventory.view'),
})

export const rentalInventoryImagesCollection = (rentalProviderId: string, itemId: string) => $COL({
  objectType: servicePath(rentalProviderId, itemId),
}, {
  trigger: () => $TG({
    title: 'Inventory Gallery',
    selectFields: ['id', 'assetId', 'caption', 'sortOrder', 'isPrimary', 'createdAt'],
    headers: [
      { title: 'Asset', value: 'assetId' },
      { title: 'Caption', value: 'caption' },
      { title: 'Sort Order', value: 'sortOrder' },
      { title: 'Primary', value: 'isPrimary' },
      { title: 'Created', value: 'createdAt' },
    ],
  }, {
    sideButtons: (_props, _context, trigger) => trigger.$params.mode === 'edit' ? [
      $BN({ text: 'Add Image', icon: 'mdi-plus', color: 'success' }, {
        onClicked() {
          const report = rentalInventoryImagesReport(rentalProviderId, itemId)
          report.$params.mode = 'create'
          AppManager.showReport(report)
        },
      }),
    ] : [],
  }),
  report: () => rentalInventoryImagesReport(rentalProviderId, itemId),
  access: rentalAccess('rental.inventory.view'),
})
