import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, Dialogs, Field, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { makeCollectionMenu } from '../../misc/menu'
import { useAppStore } from '../../store/app'

function servicePath() {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) throw new Error('No active rental provider is selected.')
  return `rental-providers/${rentalProviderId}/cancellation-refunds`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(amountMinor: unknown, currency = 'USD') {
  const amount = Number(amountMinor || 0) / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch (_error) {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) return 'n/a'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function statusColor(value: string) {
  if (value === 'processed') return '#17663c'
  if (value === 'processing') return '#1a5cb8'
  if (value === 'pending') return '#8a5a12'
  if (value === 'partner_action_required') return '#7c3aed'
  if (value === 'failed') return '#9f2d2d'
  return '#274056'
}

function chip(text: string, color: string) {
  return `<span style="display:inline-block; padding:3px 10px; border-radius:999px; background:#f4f7fa; border:1px solid #dbe6ef; color:${color}; font-size:12px; font-weight:700;">${escapeHtml(text)}</span>`
}

async function markProcessed(id: string) {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) {
    Dialogs.$error('No active rental provider selected.')
    return false
  }
  try {
    await Api.instance.service(`rental-providers/${rentalProviderId}/cancellation-refunds/${id}/mark-processed`).patch(null, {})
    Dialogs.$success('Refund obligation marked as processed.')
    return true
  } catch (error: any) {
    Dialogs.$error(error.message || 'Failed to mark refund as processed.')
    return false
  }
}

function renderDetails(item: any) {
  const cards = [
    ['Source Type', label(item?.sourceType)],
    ['Currency', item?.currency || 'n/a'],
    ['Refund Amount', money(item?.refundAmount, item?.currency)],
    ['Voucher Reinstatement', money(item?.voucherReinstatementAmount, item?.currency)],
    ['Payment Method', label(item?.originalPaymentMethod)],
    ['Refund Type', label(item?.refundType)],
    ['Responsible Party', label(item?.responsibleParty)],
    ['Partner Remittance Required', item?.partnerRemittanceRequired ? 'Yes' : 'No'],
    ['Status', label(item?.status)],
    ['Processed At', dateTime(item?.processedAt)],
    ['Created', dateTime(item?.createdAt)],
  ]

  return `
    <div style="font-family:inherit; color:#10263b; background:#f7fbff; border:1px solid #d9e5f0; border-radius:18px; padding:18px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61768b;">Cancellation Refund Obligation</div>
        <div style="margin-top:6px;">${chip(label(item?.status), statusColor(String(item?.status || '')))}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
        ${cards.map(([name, value]) => `
          <div style="background:#fff; border:1px solid #dbe6ef; border-radius:14px; padding:14px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#61768b; margin-bottom:6px;">${escapeHtml(name)}</div>
            <div style="font-size:15px; font-weight:700; color:#10263b; word-break:break-all;">${escapeHtml(String(value))}</div>
          </div>
        `).join('')}
      </div>
      ${item?.failureReason ? `<div style="margin-top:14px; padding:14px; background:#fff2f2; border:1px solid #f8c0c0; border-radius:14px; color:#9f2d2d;"><strong>Failure Reason:</strong> ${escapeHtml(item.failureReason)}</div>` : ''}
      ${item?.notes ? `<div style="margin-top:14px; padding:14px; background:#fff; border:1px solid #dbe6ef; border-radius:14px;"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ''}
    </div>
  `
}

const trigger = () => $TG({
  title: 'Cancellation Refunds',
  selectFields: [
    'id',
    'sourceType',
    'sourceId',
    'currency',
    'refundAmount',
    'voucherReinstatementAmount',
    'originalPaymentMethod',
    'refundType',
    'responsibleParty',
    'partnerRemittanceRequired',
    'status',
    'processedAt',
    'failureReason',
    'notes',
    'createdAt',
    'updatedAt',
  ],
  headers: [
    { title: 'Date', value: 'createdAt' },
    { title: 'Type', value: 'refundType' },
    { title: 'Currency', value: 'currency' },
    { title: 'Refund', value: 'refundAmount' },
    { title: 'Status', value: 'status' },
  ],
  query: { $sort: { createdAt: -1 } },
}, {})

const report = () => {
  const fields: (Field | Part)[] = [
    $FD({
      label: 'Cancellation Refund',
      storage: 'detailsView',
      type: 'htmlview',
      readonly: true,
      cols: 12,
      minHeight: 420,
    }, {
      default(field) {
        return renderDetails(field.$master?.$data || {})
      },
    }),
  ]

  return $RP({ title: 'Cancellation Refund' }, {
    form: () => $FM({ title: 'Cancellation Refund Obligation', width: 900 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: rentalAccess('rental.finance.view'),
    }),
    sideButtons: (_props, _context, rp) => {
      const item = rp?.$master?.$data || {}
      if (
        item.refundType !== 'partner_direct_refund' ||
        !['pending', 'partner_action_required'].includes(item.status)
      ) return []
      return [
        $BN({ text: 'Mark Processed', icon: 'mdi-check-circle-outline', color: 'success' }, {
          async onClicked() {
            const ok = await markProcessed(item.id)
            if (ok) rp?.$master?.$set('status', 'processed')
          },
        }),
      ]
    },
    access: rentalAccess('rental.finance.view'),
  })
}

export const rentalCancellationRefundsCollection = () => $COL({
  objectType: servicePath(),
}, {
  trigger,
  report,
  access: rentalAccess('rental.finance.view'),
})

export const rentalCancellationRefundsMenu = () => makeCollectionMenu({
  title: 'Cancellation Refunds',
  collection: rentalCancellationRefundsCollection,
  allowCreate: false,
  allowEdit: false,
  access: rentalAccess('rental.finance.view'),
})
