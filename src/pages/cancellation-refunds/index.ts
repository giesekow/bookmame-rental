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
  if (value === 'pending_channel_choice') return '#b45309'
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

async function initiateHandoff(id: string) {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) {
    Dialogs.$error('No active rental provider selected.')
    return false
  }
  try {
    await Api.instance.service(`rental-providers/${rentalProviderId}/cancellation-refunds/${id}/initiate-handoff`).create({})
    Dialogs.$success('Refund handoff initiated. Ask the customer to show their PIN.')
    return true
  } catch (error: any) {
    Dialogs.$error(error.message || 'Failed to initiate refund handoff.')
    return false
  }
}

async function confirmPin(id: string) {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) {
    Dialogs.$error('No active rental provider selected.')
    return false
  }
  const pin = await Dialogs.$prompt('Enter Customer PIN', 'Ask the customer to show the PIN from their app and enter it below.')
  if (!pin) return false
  try {
    await Api.instance.service(`rental-providers/${rentalProviderId}/cancellation-refunds/${id}/confirm-pin`).create({ pin })
    Dialogs.$success('Refund confirmed successfully.')
    return true
  } catch (error: any) {
    Dialogs.$error(error.message || 'Invalid PIN or refund confirmation failed.')
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
    ['Refund Channel', label(item?.refundChannel)],
    ['Channel Chosen By', label(item?.refundChannelChosenBy)],
    ['Channel Chosen At', dateTime(item?.refundChannelChosenAt)],
    ['Voucher Issued At', dateTime(item?.voucherIssuedAt)],
    ['Created', dateTime(item?.createdAt)],
  ]

  const isGiftVoucher = item?.refundChannel === 'gift_voucher'

  const handoffSection = !isGiftVoucher && item?.refundType === 'partner_direct_refund' && item?.handoffStatus && item?.handoffStatus !== 'not_initiated'
    ? `<div style="margin-top:14px; padding:14px; background:#f0f7ff; border:1px solid #b8d4f0; border-radius:14px;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#61768b; margin-bottom:8px;">Refund Handoff</div>
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div>${chip(label(item.handoffStatus), item.handoffStatus === 'confirmed' ? '#17663c' : '#7c3aed')}</div>
          ${item.handoffStatus === 'pending' ? `<div style="font-size:1.6rem; font-weight:700; letter-spacing:.15em; color:#1a5cb8;">${escapeHtml(item.handoffCode || '')}</div><div style="font-size:13px; color:#61768b;">Customer PIN — enter this after handing over the cash</div>` : ''}
          ${item.handoffConfirmedAt ? `<div style="font-size:13px; color:#61768b;">Confirmed: ${dateTime(item.handoffConfirmedAt)}</div>` : ''}
        </div>
      </div>`
    : ''

  const remittanceNotice = isGiftVoucher
    ? `<div style="margin-top:14px; padding:14px; background:#f0fff4; border:1px solid #6ee7b7; border-radius:14px; color:#065f46;">
        <strong>Gift voucher issued to customer.</strong><br/>The platform has issued a gift voucher on your behalf. You owe the platform <strong>${escapeHtml(money(item?.refundAmount, item?.currency))}</strong> as remittance. Please contact us to arrange payment.
      </div>`
    : ''

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
      ${handoffSection}
      ${remittanceNotice}
      ${item?.voucherId ? `<div style="margin-top:14px; padding:14px; background:#f0fff4; border:1px solid #6ee7b7; border-radius:14px; color:#065f46;">
        <strong>Gift Voucher Issued</strong><br/>
        ${item?.issuedVoucher?.code ? `<span style="font-size:1.4rem; font-weight:700; letter-spacing:.15em; color:#065f46;">${escapeHtml(item.issuedVoucher.code)}</span><br/>` : `<span style="opacity:.72;">ID: ${escapeHtml(item.voucherId)}</span><br/>`}
        ${item?.issuedVoucher?.initialAmount != null ? `<span style="opacity:.72;">Amount: ${escapeHtml(money(item.issuedVoucher.initialAmount, item.issuedVoucher.currency || item.currency))}</span><br/>` : ''}
        ${item?.voucherIssuedAt ? `<span style="opacity:.72;">Issued: ${escapeHtml(dateTime(item.voucherIssuedAt))}</span>` : ''}
      </div>` : ''}
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
    'handoffStatus',
    'handoffCode',
    'handoffMethod',
    'handoffInitiatedAt',
    'handoffConfirmedAt',
    'refundChannel',
    'refundChannelChosenAt',
    'refundChannelChosenBy',
    'voucherId',
    'voucherIssuedAt',
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
      if (item.refundType !== 'partner_direct_refund') return []
      if (!['pending', 'partner_action_required'].includes(item.status)) return []
      if (item.refundChannel === 'gift_voucher') return []

      const buttons = []

      if (item.handoffStatus === 'not_initiated') {
        buttons.push(
          $BN({ text: 'Pay Refund & Get Confirmation', icon: 'mdi-cash-check', color: 'primary' }, {
            async onClicked() {
              const ok = await initiateHandoff(item.id)
              if (ok) {
                rp?.$master?.$set('handoffStatus', 'pending')
                rp?.$master?.refresh?.()
              }
            },
          }),
          $BN({ text: 'Mark Processed (No PIN)', icon: 'mdi-check-circle-outline', color: 'success' }, {
            async onClicked() {
              const ok = await markProcessed(item.id)
              if (ok) rp?.$master?.$set('status', 'processed')
            },
          }),
        )
      } else if (item.handoffStatus === 'pending') {
        buttons.push(
          $BN({ text: 'Confirm with Customer PIN', icon: 'mdi-shield-key-outline', color: 'success' }, {
            async onClicked() {
              const ok = await confirmPin(item.id)
              if (ok) {
                rp?.$master?.$set('status', 'processed')
                rp?.$master?.$set('handoffStatus', 'confirmed')
              }
            },
          }),
        )
      }

      return buttons
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
