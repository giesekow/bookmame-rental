import { $COL, $FD, $FM, $PT, $RP, $TG, Field, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'

function getServicePath() {
  const rentalProviderId = useAppStore().rentalProvider?.id

  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.')
  }

  return `rental-providers/${rentalProviderId}/ratings`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function renderRatingSummary(rating: any) {
  const cards = [
    ['Reservation', rating?.reservationNumber || 'n/a'],
    ['Overall Rating', rating?.overallRating ? `${rating.overallRating}/5` : 'n/a'],
    ['Provider Rating', rating?.partnerRating ? `${rating.partnerRating}/5` : 'Not scored'],
    ['Delivery Rating', rating?.deliveryRating ? `${rating.deliveryRating}/5` : 'Not scored'],
    ['Fulfillment', label(rating?.fulfillmentMethod)],
    ['Customer', rating?.customerAccountId || 'n/a'],
    ['Delivery Company', rating?.deliveryCompanyName || (rating?.fulfillmentMethod === 'customer_pickup' ? 'Customer pickup' : 'n/a')],
    ['Placed', dateTime(rating?.placedAt)],
    ['Returned', dateTime(rating?.deliveredAt)],
    ['Created', dateTime(rating?.createdAt)],
  ]

  return `
    <div style="font-family:inherit; color:#2e2b46; background:#faf8ff; border:1px solid #e6dcf5; border-radius:18px; padding:18px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#74628f;">Rental rating</div>
        <div style="margin-top:6px; font-size:22px; font-weight:800;">${escapeHtml(rating?.reservationNumber || 'Customer review')}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        ${cards.map(([name, value]) => `<div style="background:#fff; border:1px solid #e6dcf5; border-radius:14px; padding:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#74628f; margin-bottom:6px;">${escapeHtml(name)}</div><div style="font-size:18px; font-weight:800; color:#2e2b46;">${escapeHtml(value)}</div></div>`).join('')}
      </div>
      ${rating?.comment ? `<div style="margin-top:14px; padding:14px; background:#fff; border:1px solid #e6dcf5; border-radius:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#74628f; margin-bottom:6px;">Customer Comment</div><div style="color:#4b4466; white-space:pre-wrap; word-break:break-word;">${escapeHtml(rating.comment)}</div></div>` : ''}
    </div>
  `
}

const trigger = () => $TG({
  title: 'Ratings',
  selectFields: ['reservationNumber', 'overallRating', 'partnerRating', 'deliveryRating', 'fulfillmentMethod', 'customerAccountId', 'createdAt', 'id'],
  headers: [
    { title: 'Reservation', value: 'reservationNumber' },
    { title: 'Overall', value: 'overallRating' },
    { title: 'Provider', value: 'partnerRating' },
    { title: 'Delivery', value: 'deliveryRating' },
    { title: 'Fulfillment', value: 'fulfillmentMethod' },
    { title: 'Customer', value: 'customerAccountId' },
    { title: 'Created', value: 'createdAt' },
  ],
  query: { $sort: { createdAt: -1 } },
}, {})

const report = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Rating', storage: 'summaryView', type: 'htmlview', readonly: true, cols: 12, minHeight: 420 }, {
      default(field) {
        return renderRatingSummary(field.$master?.$data || {})
      },
    }),
  ]

  return $RP({ title: 'Rating' }, {
    form: () => $FM({ title: 'Customer Rating', width: 980 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: rentalAccess('rental.reservations.view'),
    }),
    access: rentalAccess('rental.reservations.view'),
  })
}

export const rentalRatingsCollection = () => $COL({
  objectType: getServicePath(),
}, {
  trigger,
  report,
  access: rentalAccess('rental.reservations.view'),
})
