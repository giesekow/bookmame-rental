import { $BN, $FD, $FM, $PT, $RP, Api, Dialogs, Field, Master, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { downloadCsv } from '../../misc/csv'
import { useAppStore } from '../../store/app'

const PAGINATION_OPTIONS = [5, 10, 20, 50, 100]
let activeRentalFinanceReport: any = null
let rentalFinancePaginationInitialized = false

function summaryCardStyle(label: string) {
  if (label === 'Ready For Payout' || label === 'Ready For Remittance') {
    return {
      background: '#fff8dd',
      border: '#ebd58c',
      text: '#8a6500',
    }
  }

  if (label === 'Net Settlement Position') {
    return {
      background: '#e7f7ef',
      border: '#a8d9be',
      text: '#1f7a4d',
    }
  }

  return {
    background: '#fff',
    border: '#dbe6ef',
    text: '#10263b',
  }
}

function servicePath() {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.')
  }
  return `rental-providers/${rentalProviderId}/settlements/summary`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0)
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD'
  try {
    if (!Number.isFinite(amount) || amount === 0) {
      return '0.00'
    }
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCurrency }).format(amount / 100)
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function buildPaginationState(summary: any) {
  const lines = Array.isArray(summary?.settlements) ? summary.settlements : []
  const totalItems = Number(summary?.settlementTotal ?? lines.length)
  const rawItemsPerPage = Number(summary?.itemsPerPage || 5)
  const itemsPerPage = PAGINATION_OPTIONS.includes(rawItemsPerPage) ? rawItemsPerPage : 5
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const rawPageNumber = Number(summary?.pageNumber || 1)
  const pageNumber = Math.min(Math.max(Number.isFinite(rawPageNumber) ? rawPageNumber : 1, 1), totalPages)
  const startIndex = totalItems === 0 ? 0 : (pageNumber - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + lines.length, totalItems)

  return {
    lines,
    totalItems,
    itemsPerPage,
    pageNumber,
    totalPages,
    startIndex,
    endIndex,
    visibleLines: lines,
  }
}

function renderPaginationControls(pagination: ReturnType<typeof buildPaginationState>) {
  return `
    <div style="font-family:inherit; color:#10263b; background:#fff; border:1px solid #dbe6ef; border-radius:16px; padding:14px 16px;">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:center;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <span style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61768b;">Items per page</span>
          ${PAGINATION_OPTIONS.map((value) => {
            const active = pagination.itemsPerPage === value
            return `<button type="button" data-finance-pagination="rental-finance" data-action="items" data-value="${value}" style="border:1px solid ${active ? '#2f6fed' : '#d5e1eb'}; background:${active ? '#edf4ff' : '#fff'}; color:${active ? '#1f5e9d' : '#274056'}; border-radius:999px; padding:6px 12px; font-size:13px; font-weight:700; cursor:pointer;">${value}</button>`
          }).join('')}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:flex-end;">
          <span style="font-size:13px; color:#476079;">Showing ${pagination.lines.length === 0 ? 0 : pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.totalItems}</span>
          <button type="button" data-finance-pagination="rental-finance" data-action="prev" style="border:1px solid #d5e1eb; background:${pagination.pageNumber <= 1 ? '#f4f7fa' : '#fff'}; color:${pagination.pageNumber <= 1 ? '#9aaaba' : '#274056'}; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:700; cursor:${pagination.pageNumber <= 1 ? 'not-allowed' : 'pointer'};" ${pagination.pageNumber <= 1 ? 'disabled' : ''}>Previous</button>
          <span style="min-width:96px; text-align:center; font-size:13px; font-weight:700; color:#10263b;">Page ${pagination.pageNumber} of ${pagination.totalPages}</span>
          <button type="button" data-finance-pagination="rental-finance" data-action="next" style="border:1px solid #d5e1eb; background:${pagination.pageNumber >= pagination.totalPages ? '#f4f7fa' : '#fff'}; color:${pagination.pageNumber >= pagination.totalPages ? '#9aaaba' : '#274056'}; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:700; cursor:${pagination.pageNumber >= pagination.totalPages ? 'not-allowed' : 'pointer'};" ${pagination.pageNumber >= pagination.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    </div>
  `
}

function renderSummary(summary: any, pagination: ReturnType<typeof buildPaginationState>) {
  const cards: Array<[string, unknown]> = [
    ['Rental Provider', summary?.beneficiaryName || useAppStore().rentalProvider?.name || 'Rental Provider'],
    ['Currency', summary?.currency || 'n/a'],
    ['Reservations', summary?.orderCount ?? 0],
    ['Finance Lines', pagination.totalItems],
    ['Showing', pagination.lines.length === 0 ? '0' : `${pagination.startIndex + 1}-${pagination.endIndex}`],
    ['Gross', money(summary?.grossAmount, summary?.currency)],
    ['Service Charge', money(summary?.feeAmount, summary?.currency)],
    ['Net', money(summary?.netAmount, summary?.currency)],
    ['Collected Directly', money(summary?.directCollectedAmount, summary?.currency)],
    ['Outstanding Payable', money(summary?.outstandingPayableAmount, summary?.currency)],
    ['Outstanding Remittance', money(summary?.outstandingRemittanceAmount, summary?.currency)],
    ['Locked Until Trigger', money(summary?.lockedUntilTriggerAmount, summary?.currency)],
    ['Ready For Payout', money(summary?.readyForManualPayoutAmount, summary?.currency)],
    ['Payout Initiated', money(summary?.payoutInitiatedAmount, summary?.currency)],
    ['Paid Out', money(summary?.paidOutAmount, summary?.currency)],
    ['Payout Failed', money(summary?.payoutFailedAmount, summary?.currency)],
    ['Ready For Remittance', money(summary?.readyForManualRemittanceAmount, summary?.currency)],
    ['Remittance Initiated', money(summary?.remittanceInitiatedAmount, summary?.currency)],
    ['Remittance Received', money(summary?.remittanceReceivedAmount, summary?.currency)],
    ['Net Settlement Position', money(summary?.netSettlementPosition, summary?.currency)],
  ]

  return `
    <div style="font-family:inherit; color:#241a14; background:#fffaf5; border:1px solid #eadfd4; border-radius:16px; padding:16px;">
      <div style="margin-bottom:14px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Rental finance summary</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;">
        ${cards.map(([name, value]) => {
          const tone = summaryCardStyle(String(name))
          return `<div style="background:${tone.background}; border:1px solid ${tone.border}; border-radius:12px; padding:12px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:6px;">${escapeHtml(name)}</div><div style="font-size:16px; font-weight:800; color:${tone.text};">${escapeHtml(value)}</div></div>`
        }).join('')}
      </div>
    </div>
  `
}

function renderLines(summary: any, pagination: ReturnType<typeof buildPaginationState>) {
  if (pagination.totalItems === 0) {
    return '<div style="padding:16px; border:1px solid #e5ddcf; border-radius:12px; background:#fff; color:#7a6a5c;">No reservation finance lines were found.</div>'
  }

  return `
    <div style="font-family:inherit; color:#10263b; background:#fff; border:1px solid #dbe6ef; border-radius:18px; overflow:hidden;">
      <div style="padding:16px 18px; border-bottom:1px solid #dbe6ef; background:#f8fbfe;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61768b;">Rental reservation finance lines</div>
        <div style="margin-top:4px; color:#476079; font-size:13px;">Page ${pagination.pageNumber} of ${pagination.totalPages} · Showing ${pagination.lines.length === 0 ? 0 : pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.totalItems}</div>
      </div>
      <div style="display:grid;">
        ${pagination.visibleLines.map((line: any) => `
          <article style="padding:16px 18px; border-bottom:1px solid #e5edf4; background:#fff;">
            <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-size:16px; font-weight:800; color:#10263b;">${escapeHtml(line?.orderNumber || 'Reservation')}</div>
                <div style="font-size:13px; color:#476079;">Customer: ${escapeHtml(line?.guestName || 'n/a')}</div>
                <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                  <span style="padding:4px 8px; border-radius:999px; background:#f4e6d8; color:#8b5e14; font-size:11px; font-weight:700;">${escapeHtml(label(line?.status))}</span>
                  <span style="padding:4px 8px; border-radius:999px; background:#e6f2ea; color:#24613a; font-size:11px; font-weight:700;">${escapeHtml(label(line?.orderPaymentStatus))}</span>
                  <span style="padding:4px 8px; border-radius:999px; background:#eef4fa; color:#274056; font-size:11px; font-weight:700;">${escapeHtml(label(line?.paymentMethod))}</span>
                  <span style="padding:4px 8px; border-radius:999px; background:#eef4fa; color:#274056; font-size:11px; font-weight:700;">${escapeHtml(label(line?.orderRestaurantStatus))}</span>
                </div>
              </div>
              <div style="flex:1 1 320px; min-width:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; font-size:12px; color:#4a3b31;">
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Reservation Total</div><div style="font-weight:700;">${escapeHtml(money(line?.totalAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Fees</div><div style="font-weight:700;">${escapeHtml(money(line?.feeAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Net</div><div style="font-weight:700;">${escapeHtml(money(line?.netAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Outstanding</div><div style="font-weight:700;">${escapeHtml(money(line?.outstandingPayableAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Outstanding Remittance</div><div style="font-weight:700;">${escapeHtml(money(line?.outstandingRemittanceAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Net Position</div><div style="font-weight:700;">${escapeHtml(money(Number(line?.outstandingPayableAmount ?? 0) - Number(line?.outstandingRemittanceAmount ?? 0), summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Created</div><div style="font-weight:700;">${escapeHtml(dateTime(line?.createdAt))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Eligible At</div><div style="font-weight:700;">${escapeHtml(dateTime(line?.eligibleAt))}</div></div>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `
}

function refreshFinanceDetail(report: any) {
  const master = report?.$master
  if (!master) {
    return
  }
  const detailState = master.$get('detailState', master.$data || {}) || {}
  const pagination = buildPaginationState(detailState)
  master.$set('itemsPerPage', pagination.itemsPerPage)
  master.$set('pageNumber', pagination.pageNumber)
  master.$set('summaryView', renderSummary(detailState, pagination))
  master.$set('paginationControlsView', renderPaginationControls(pagination))
  master.$set('linesView', renderLines(detailState, pagination))
}

function initializeFinancePagination() {
  if (rentalFinancePaginationInitialized || typeof document === 'undefined') {
    return
  }
  rentalFinancePaginationInitialized = true

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest?.('[data-finance-pagination="rental-finance"]') as HTMLElement | null

    if (!button || !activeRentalFinanceReport?.$master) {
      return
    }

    event.preventDefault()

    const action = button.getAttribute('data-action')
    const master = activeRentalFinanceReport.$master
    const summary = master.$get('detailState', master.$data || {}) || {}
    const pagination = buildPaginationState(summary)

    if (action === 'items') {
      const value = Number(button.getAttribute('data-value') || 5)
      master.$set('itemsPerPage', PAGINATION_OPTIONS.includes(value) ? value : 5)
      master.$set('pageNumber', 1)
    } else if (action === 'prev' && pagination.pageNumber > 1) {
      master.$set('pageNumber', pagination.pageNumber - 1)
    } else if (action === 'next' && pagination.pageNumber < pagination.totalPages) {
      master.$set('pageNumber', pagination.pageNumber + 1)
    } else {
      return
    }

    void loadFinanceDetail(activeRentalFinanceReport)
  })
}

async function loadFinanceDetail(report: any) {
  const master = report?.$master
  if (!master) {
    return
  }

  const currentState = master.$get('detailState', master.$data || {}) || {}
  const itemsPerPage = PAGINATION_OPTIONS.includes(Number(master.$get('itemsPerPage', currentState.itemsPerPage || 5)))
    ? Number(master.$get('itemsPerPage', currentState.itemsPerPage || 5))
    : 5
  const pageNumber = Math.max(1, Number(master.$get('pageNumber', currentState.pageNumber || 1)) || 1)
  const currency = String(master.$get('currency') || useAppStore().rentalProvider?.defaultCurrencyCode || '').trim().toUpperCase()

  try {
    const summary = await Api.instance.service(servicePath()).find({
      query: {
        $limit: itemsPerPage,
        $skip: (pageNumber - 1) * itemsPerPage,
        ...(currency ? { currency } : {}),
      },
    })
    master.$set('currency', summary?.currency || currency || '')
    master.$set('detailState', { ...summary, itemsPerPage, pageNumber })
  } catch (error: any) {
    Dialogs.$error(error?.message || 'Unable to load rental finance summary.')
    master.$set('detailState', {
      ...currentState,
      beneficiaryName: useAppStore().rentalProvider?.name || 'Rental Provider',
      currency: currency || currentState?.currency,
      itemsPerPage,
      pageNumber,
      settlements: [],
      settlementTotal: 0,
    })
  }

  refreshFinanceDetail(report)
}

async function exportFinanceSummaryCsv(master: any) {
  const detailState = master?.$get('detailState', master?.$data || {}) || {}
  const settlements = Array.isArray(detailState?.settlements) ? detailState.settlements : []

  if (settlements.length === 0) {
    Dialogs.$error('Open finance summary data before exporting.')
    return
  }

  const rows = settlements.map((item: any) => ({
    rentalProvider: detailState?.beneficiaryName || useAppStore().rentalProvider?.name || '',
    currency: detailState?.currency || '',
    reservationNumber: item?.orderNumber || '',
    customerName: item?.guestName || '',
    paymentMethod: item?.paymentMethod || '',
    paymentStatus: item?.orderPaymentStatus || '',
    reservationStatus: item?.orderRestaurantStatus || '',
    sourceStatus: item?.status || '',
    totalAmount: money(item?.totalAmount, detailState?.currency),
    feeAmount: money(item?.feeAmount, detailState?.currency),
    netAmount: money(item?.netAmount, detailState?.currency),
    collectedDirectly: money(item?.directCollectedAmount, detailState?.currency),
    outstandingPayable: money(item?.outstandingPayableAmount, detailState?.currency),
    outstandingRemittance: money(item?.outstandingRemittanceAmount, detailState?.currency),
    eligibleAt: dateTime(item?.eligibleAt),
    createdAt: dateTime(item?.createdAt),
  }))

  downloadCsv(`rental-finance-summary-${detailState?.currency || 'export'}.csv`, rows)
}

export const rentalFinanceSummaryReport = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Summary', storage: 'summaryView', type: 'htmlview', readonly: true, cols: 12, minHeight: 300 }, {
      default(field) {
        const summary = field.$master?.$data || {}
        return renderSummary(summary, buildPaginationState(summary))
      },
    }),
    $FD({ label: 'Pagination', storage: 'paginationControlsView', type: 'htmlview', readonly: true, cols: 12 }, {
      default(field) {
        return renderPaginationControls(buildPaginationState(field.$master?.$data || {}))
      },
    }),
    $FD({ label: 'Reservation Finance', storage: 'linesView', type: 'htmlview', readonly: true, cols: 12, minHeight: 560 }, {
      default(field) {
        const summary = field.$master?.$data || {}
        return renderLines(summary, buildPaginationState(summary))
      },
    }),
  ]

  return $RP({ title: 'Finance Summary' }, {
    form: () => $FM({ title: 'Rental Finance Summary' }, {
      children: () => [
        $PT({}, { children: () => fields }),
      ],
      saved: async (form) => {
        await loadFinanceDetail({ $master: form.$master })
      },
      access: rentalAccess('rental.finance.view'),
    }),
    sideButtons: (_props, _context, report) => [
      $BN({ text: 'Export CSV', color: 'secondary' }, {
        async onClicked() {
          await exportFinanceSummaryCsv(report?.$master)
        },
      }),
    ],
    setup(report) {
      activeRentalFinanceReport = report
      initializeFinancePagination()
      const master = report.$master as Master | undefined
      if (!master) {
        return
      }
      master.$set('itemsPerPage', 5)
      master.$set('pageNumber', 1)
      void loadFinanceDetail(report)
    },
    loaded(report) {
      activeRentalFinanceReport = report
      void loadFinanceDetail(report)
    },
    access: rentalAccess('rental.finance.view'),
  })
}
