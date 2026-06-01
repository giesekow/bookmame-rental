import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, Dialogs, Field, Master, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { makeCollectionMenu } from '../../misc/menu'
import { downloadReceiptPdf } from '../../misc/print-receipt'
import { useAppStore } from '../../store/app'
import { makeConstantOptions } from '@bookmame/web-utils'

function servicePath() {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) throw new Error('No active rental provider is selected.')
  return `rental-providers/${rentalProviderId}/invoices`
}

function money(amountMinor: unknown, currency = 'USD') {
  const amount = Number(amountMinor || 0) / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) return 'n/a'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch {
    return date.toISOString()
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function renderDetails(data: any) {
  const currency = String(data?.currency || 'USD')
  const accessPin = String(data?.invoiceAccessPin || '').trim()
  const originalPayableMinor = Number(data?.totalAmount || 0)
  const outstandingAmountMinor = Number(data?.amountDue || 0)
  const amountPaidMinor = Math.max(0, originalPayableMinor - outstandingAmountMinor)
  const lines = Array.isArray(data?.lineItems) ? data.lineItems : []
  const lineItemsHtml = lines.length
    ? `<div style="margin-top:14px;padding:14px;border:1px solid #dbe6ef;border-radius:12px;background:#fff;">
        <div style="font-size:11px;color:#61768b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Line Items</div>
        ${lines.map((line: any) => `
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 0;border-bottom:1px solid #eef3f7;">
            <div>
              <div style="font-weight:700;">${String(line?.description || 'Item')}</div>
              <div style="font-size:12px;color:#61768b;">${Number(line?.quantity || 0)} x ${money(line?.unitAmount, currency)}</div>
            </div>
            <div style="font-weight:700;">${money(line?.lineTotalAmount, currency)}</div>
          </div>
        `).join('')}
        <div style="height:10px;"></div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;color:#cbd5e1;"><div>Subtotal</div><div style="font-weight:700;">${money(data?.subtotalAmount, currency)}</div></div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;color:#cbd5e1;"><div>Discount</div><div style="font-weight:700;">${money(data?.discountAmount, currency)}</div></div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;color:#cbd5e1;"><div>Tax</div><div style="font-weight:700;">${money(data?.taxAmount, currency)}</div></div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 0;border-top:1px solid #e2e8f0;color:#f8fafc;"><div style="font-weight:800;">Amount Payable</div><div style="font-weight:800;">${money(originalPayableMinor, currency)}</div></div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;color:#cbd5e1;"><div>Amount Paid</div><div style="font-weight:700;">${money(amountPaidMinor, currency)}</div></div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 0;color:#cbd5e1;"><div>Outstanding Amount</div><div style="font-weight:700;">${money(outstandingAmountMinor, currency)}</div></div>
      </div>`
    : `<div style="margin-top:14px;padding:14px;border:1px dashed #dbe6ef;border-radius:12px;color:#61768b;">No line items.</div>`
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Invoice</div><div style="margin-top:6px;font-weight:700;">${data?.invoiceNumber || 'n/a'}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Recipient</div><div style="margin-top:6px;font-weight:700;">${data?.recipientNameSnapshot || 'n/a'}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Status</div><div style="margin-top:6px;font-weight:700;">${label(data?.status)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Amount Payable</div><div style="margin-top:6px;font-weight:700;">${money(data?.totalAmount, currency)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Amount Due</div><div style="margin-top:6px;font-weight:700;">${money(data?.amountDue, currency)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Issued</div><div style="margin-top:6px;font-weight:700;">${dateTime(data?.issuedAt)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Due Date</div><div style="margin-top:6px;font-weight:700;">${dateTime(data?.dueAt)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Expires At</div><div style="margin-top:6px;font-weight:700;">${dateTime(data?.expiresAt)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Paid At</div><div style="margin-top:6px;font-weight:700;">${dateTime(data?.paidAt)}</div></div>
      <div style="padding:14px;border:1px solid #dbe6ef;border-radius:12px;"><div style="font-size:11px;color:#61768b;text-transform:uppercase;">Access PIN</div><div style="margin-top:6px;font-weight:700;letter-spacing:0.08em;">${accessPin || 'not generated yet'}</div></div>
    </div>
    ${lineItemsHtml}
  `
}

const trigger = () => $TG({
  title: 'Invoices',
  selectFields: ['id', 'invoiceNumber', 'recipientNameSnapshot', 'currency', 'totalAmount', 'amountDue', 'status', 'issuedAt', 'dueAt', 'paidAt', 'createdAt'],
  queryFields: ['invoiceNumber', 'status', 'currency'],
  headers: [
    { title: 'Invoice', value: 'invoiceNumber' },
    { title: 'Recipient', value: 'recipientNameSnapshot' },
    { title: 'Amount', value: 'totalAmountDisplay' },
    { title: 'Due', value: 'amountDueDisplay' },
    { title: 'Status', value: 'status' },
    { title: 'Issued', value: 'issuedAt' },
    { title: 'Due Date', value: 'dueAt' },
  ],
  query: { $sort: { createdAt: -1 } },
}, {
  format: (_trigger, items) => {
    return (items || []).map((item: any) => ({
      ...item,
      totalAmountDisplay: money(item?.totalAmount, item?.currency),
      amountDueDisplay: money(item?.amountDue, item?.currency),
    }))
  },
  topChildren: () => [
    $FD({ label: 'Due Date From', type: 'date', storage: 'dueAtFrom', md: 3 }),
    $FD({ label: 'Due Date To', type: 'date', storage: 'dueAtTo', md: 3 }),
    $FD({ label: 'Issued Date From', type: 'date', storage: 'issuedAtFrom', md: 3 }),
    $FD({ label: 'Issued Date To', type: 'date', storage: 'issuedAtTo', md: 3 }),
    $FD({ label: 'Status', type: 'select', storage: 'statusList', md: 6, lg: 3, multiple: true }, {
      selectOptions: makeConstantOptions('invoice-statuses'),
    }),
  ],
  processQuery(query, trigger, mode, search) {
    const dueAtFrom = String(trigger.$master?.$get('dueAtFrom') || '').trim()
    const dueAtTo = String(trigger.$master?.$get('dueAtTo') || '').trim()
    const issuedAtFrom = String(trigger.$master?.$get('issuedAtFrom') || '').trim()
    const issuedAtTo = String(trigger.$master?.$get('issuedAtTo') || '').trim()
    const statusListRaw = trigger.$master?.$get('statusList') || []
    const statusList = Array.isArray(statusListRaw)
      ? statusListRaw.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : []

    if (query.$or) delete query.$or
    query.q = search ? String(search).trim() : undefined
    if (dueAtFrom) query.dueAtFrom = dueAtFrom
    if (dueAtTo) query.dueAtTo = dueAtTo
    if (issuedAtFrom) query.issuedAtFrom = issuedAtFrom
    if (issuedAtTo) query.issuedAtTo = issuedAtTo
    if (statusList.length > 0) query.status = statusList
    return query
  },
  setup(trigger) {
    trigger.setMaster(new Master({}))
  },
})

const report = () => {
  const fields: (Field | Part)[] = [
    $FD({
      label: 'Invoice Details',
      storage: 'invoiceDetails',
      type: 'htmlview',
      readonly: true,
      cols: 12,
      minHeight: 280,
    }, {
      default(field) {
        return renderDetails(field.$master?.$data || {})
      },
    }),
  ]

  const hydrateInvoiceDetails = async (report: any) => {
    const master = report?.$master
    const invoiceId = String(master?.$id || master?.$get?.('id') || '').trim()
    const rentalProviderId = useAppStore().rentalProvider?.id
    if (!invoiceId || !rentalProviderId) return
    const details = await Api.instance.service(`rental-providers/${rentalProviderId}/invoices`).get(invoiceId)
    const existingPin = String(master?.$get?.('invoiceAccessPin') || '').trim()
    const existingUrl = String(master?.$get?.('invoiceAccessUrl') || '').trim()
    master?.$set?.(null, {
      ...master?.$data,
      ...details,
      invoiceAccessPin: existingPin || String((details as any)?.invoiceAccessPin || ''),
      invoiceAccessUrl: existingUrl || String((details as any)?.invoiceAccessUrl || ''),
    })
    master?.$set?.('invoiceDetails', renderDetails(master?.$data || {}))
  }
  return $RP({ title: 'Invoice', sideButtonWidth: 280, fluid: true }, {
    form: () => $FM({ title: 'Invoice', width: 1000 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: rentalAccess('rental.finance.view'),
    }),
    setup(report) {
      report?.$master?.$set?.('invoiceDetails', renderDetails(report?.$master?.$data || {}))
      hydrateInvoiceDetails(report).catch(() => undefined)
    },
    loaded(report) {
      report?.$master?.$set?.('invoiceDetails', renderDetails(report?.$master?.$data || {}))
      hydrateInvoiceDetails(report).catch(() => undefined)
    },
    sideButtons: (_props, _context, rp) => {
      const item = rp?.$master?.$data || {}
      const status = String(item?.status || '').toLowerCase()
      if (!item?.id) return []
      const rentalProviderId = useAppStore().rentalProvider?.id
      const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

      if (status === 'paid') {
        return [
          $BN({ text: 'Download Invoice', icon: 'mdi-file-download-outline', color: 'info' }, {
            async onClicked() {
              if (!rentalProviderId || !apiBase) return
              try {
                await downloadReceiptPdf(
                  `${apiBase}/rental-providers/${rentalProviderId}/invoices/${item.id}/document/pdf`,
                  `invoice-${item.id}.pdf`,
                )
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Unable to download invoice PDF.')
              }
            },
          }),
          $BN({ text: 'Download Receipt', icon: 'mdi-receipt-text-download-outline', color: 'success' }, {
            async onClicked() {
              if (!rentalProviderId || !apiBase) return
              try {
                await downloadReceiptPdf(
                  `${apiBase}/rental-providers/${rentalProviderId}/invoices/${item.id}/receipt/pdf`,
                  `invoice-receipt-${item.id}.pdf`,
                )
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Unable to download receipt PDF.')
              }
            },
          }),
        ]
      }

      if (!['issued', 'pin_verified', 'payment_pending'].includes(status)) return []
      const fetchAccessCredentials = async () => {
        if (!rentalProviderId) return null
        const res = await Api.instance.service(`rental-providers/${rentalProviderId}/invoices/${item.id}/open-payment-page`).create({})
        const pin = String(res?.pin || '').trim()
        const publicUrl = String(res?.publicUrl || '').trim()
        if (pin) {
          rp?.$master?.$set('invoiceAccessPin', pin)
        }
        if (publicUrl) {
          rp?.$master?.$set('invoiceAccessUrl', publicUrl)
        }
        rp?.$master?.$set?.('invoiceDetails', renderDetails(rp?.$master?.$data || {}))
        return res
      }
      return [
        $BN({ text: 'Generate/Refresh PIN', icon: 'mdi-refresh', color: 'info' }, {
          async onClicked() {
            try {
              const res = await fetchAccessCredentials()
              const pin = String(res?.pin || '').trim()
              if (!pin) {
                Dialogs.$error('PIN was not returned by API.')
                return
              }
              Dialogs.$info('PIN refreshed successfully.')
            } catch (error: any) {
              Dialogs.$error(error.message || 'Unable to refresh PIN.')
            }
          },
        }),
        $BN({ text: 'Open Payment Page', icon: 'mdi-open-in-new', color: 'primary' }, {
          async onClicked() {
            try {
              let publicUrl = String(rp?.$master?.$get('invoiceAccessUrl') || '').trim()
              if (!publicUrl) {
                const res = await fetchAccessCredentials()
                publicUrl = String(res?.publicUrl || '').trim()
              }
              if (publicUrl) {
                window.open(publicUrl, '_blank', 'noopener,noreferrer')
              }
            } catch (error: any) {
              Dialogs.$error(error.message || 'Unable to open payment page.')
            }
          },
        }),
        $BN({ text: 'Copy PIN', icon: 'mdi-content-copy', color: 'secondary' }, {
          async onClicked() {
            const pin = String(rp?.$master?.$get('invoiceAccessPin') || '').trim()
            if (!pin) return
            try {
              await navigator.clipboard.writeText(pin)
              Dialogs.$info(`PIN copied: ${pin}`)
            } catch {
              Dialogs.$error('Unable to copy PIN to clipboard.')
            }
          },
        }),
      ]
    },
    access: rentalAccess('rental.finance.view'),
  })
}

export const rentalInvoicesCollection = () => $COL({ objectType: servicePath() }, {
  trigger,
  report,
  access: rentalAccess('rental.finance.view'),
})

export const rentalInvoicesMenu = () => makeCollectionMenu({
  title: 'Invoices',
  collection: rentalInvoicesCollection,
  allowCreate: false,
  allowEdit: false,
  access: rentalAccess('rental.finance.view'),
})
