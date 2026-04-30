import { makeConstantOptions } from '@bookmame/web-utils'
import { $SL, $BN, $FD, $FM, $PT, $RP, Api, AppManager, DialogForm, Dialogs, Report, SimpleDate } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'
import { rentalReservationsReport } from '../reservations'

declare global {
  interface Window {
    __bookmameOpenRentalReservationFromCalendar?: (reservationId: string) => void
  }
}

type InventoryDay = {
  date: string
  bookedUnits: number
  offlineReservedUnits: number
  blockedUnits: number
  heldUnits: number
  availableInventory: number
  totalInventory: number
}

type InventoryEvent = {
  id: string
  eventType: string
  status: string
  source?: string | null
  startDate: string
  endDate: string
  quantity: number
  customerName?: string | null
  customerPhoneNumber?: string | null
  reference?: string | null
  notes?: string | null
  releasedReason?: string | null
  rentalInventoryVariantId?: string | null
  variant?: {
    id: string
    name: string
    slug: string
  } | null
  createdAt: string
}

type InventoryReservation = {
  id: string
  reservationNumber: string
  reservationStatus: string
  paymentStatus: string
  startDate: string
  endDate: string
  quantity: number
  customerName: string
  customerPhoneNumber?: string | null
  variantId?: string | null
  variantName?: string | null
}

type InventoryCalendarSummary = {
  itemId: string
  rentalProviderId: string
  itemName: string
  totalInventory: number
  currency?: string
  startDate: string
  endDate: string
  dayCount: number
  variants: Array<{
    id: string
    name: string
    slug: string
    totalInventory: number
  }>
  days: InventoryDay[]
  summary: {
    lowestAvailableInventory: number
    totalBookedUnits: number
    totalOfflineReservedUnits: number
    totalBlockedUnits: number
    activeEventCount: number
    reservationCount: number
  }
  activeEvents: InventoryEvent[]
  upcomingReservations: InventoryReservation[]
}

function getRentalProviderId() {
  const rentalProviderId = useAppStore().rentalProvider?.id
  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.')
  }
  return String(rentalProviderId)
}

function inventoryItemsServicePath() {
  return `rental-providers/${getRentalProviderId()}/inventory-items`
}

function inventoryCalendarServicePath(itemId: string) {
  return `rental-providers/${getRentalProviderId()}/inventory-items/${itemId}/inventory-calendar`
}

function inventoryEventsServicePath(itemId: string) {
  return `rental-providers/${getRentalProviderId()}/inventory-items/${itemId}/inventory-events`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJsString(value: unknown) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

function formatDate(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'n/a'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date)
  } catch (_error) {
    return date.toISOString().slice(0, 10)
  }
}

function formatWeekday(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'n/a'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
    }).format(date)
  } catch (_error) {
    return date.toISOString().slice(0, 3)
  }
}

function formatDateWithYear(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'n/a'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  } catch (_error) {
    return date.toISOString().slice(0, 10)
  }
}

function formatDateRange(from: unknown, to: unknown) {
  return `${formatDate(from)} - ${formatDate(to)}`
}

function formatMoney(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0)
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3
    ? currency.toUpperCase()
    : 'USD'

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format((Number.isFinite(amount) ? amount : 0) / 100)
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function normalizeDateOnly(value: unknown) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null
    }
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    return new SimpleDate(value).toMoment().toISOString()
  }

  if (typeof value === 'object') {
    const candidate = value as { year?: unknown; month?: unknown; day?: unknown }
    const year = Number(candidate.year)
    const month = Number(candidate.month)
    const day = Number(candidate.day)
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      year >= 1000 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
    }
  }

  const raw = String(value).trim()
  const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function normalizeDateTimeForApi(value: unknown) {
  if (!value) {
    return null
  }

  if (typeof value === 'number') {
    return new SimpleDate(value).toMoment().toISOString()
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null
    }
    return value.toISOString()
  }

  const dateOnly = normalizeDateOnly(value)
  if (dateOnly) {
    return `${dateOnly}T00:00:00.000Z`
  }

  return null
}

function shiftDate(dateOnly: string, dayCount: number) {
  const raw = dateOnly.includes('T') ? dateOnly.split('T')[0] : dateOnly
  const base = new Date(`${raw}T00:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + dayCount)
  return base.toISOString().slice(0, 10)
}

function currentCalendarStartDate() {
  const today = new Date()
  const utc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const offset = (utc.getUTCDay() + 6) % 7
  utc.setUTCDate(utc.getUTCDate() - offset)
  return utc.toISOString().slice(0, 10)
}

function eventTypeLabel(eventType: unknown) {
  return String(eventType || '').toLowerCase() === 'block' ? 'Block Units' : 'Offline Reservation'
}

function dayTone(day: InventoryDay) {
  if (day.availableInventory <= 0) {
    return {
      background: '#fff1ef',
      border: '#f2b7af',
      accent: '#b63826',
    }
  }

  if (day.availableInventory <= Math.max(1, Math.floor(day.totalInventory / 3))) {
    return {
      background: '#fff8e8',
      border: '#f2d18e',
      accent: '#9a6500',
    }
  }

  return {
    background: '#f3fbf6',
    border: '#bde2c7',
    accent: '#1d6b3f',
  }
}

function dayStatTone(type: 'platform' | 'offline' | 'blocked', value: number) {
  if (value <= 0) {
    return {
      background: '#f7f4ef',
      border: '#e4dbd1',
      color: '#7a685b',
      strong: '#5f4e43',
    }
  }

  if (type === 'platform') {
    return {
      background: '#eef5ff',
      border: '#bfd4ff',
      color: '#315ea8',
      strong: '#1f4e97',
    }
  }

  if (type === 'offline') {
    return {
      background: '#fff6e6',
      border: '#f1d49a',
      color: '#9a6500',
      strong: '#8f4e08',
    }
  }

  return {
    background: '#fff1ef',
    border: '#edb8ae',
    color: '#a13a27',
    strong: '#8c2f21',
  }
}

function renderDayStatRow(labelText: string, value: number, type: 'platform' | 'offline' | 'blocked') {
  const tone = dayStatTone(type, value)

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:7px 9px; border-radius:10px; background:${tone.background}; border:1px solid ${tone.border};">
      <span style="font-weight:${value > 0 ? 700 : 600}; color:${tone.color};">${escapeHtml(labelText)}</span>
      <span style="font-weight:800; color:${tone.strong};">${escapeHtml(String(value))}</span>
    </div>
  `
}

function renderSummaryCard(labelText: string, value: string, tone: 'primary' | 'warning' | 'success' | 'secondary' = 'primary') {
  const toneMap = {
    primary: { background: '#fff6ec', border: '#f2d0a7', color: '#8f4e08' },
    warning: { background: '#fff1ef', border: '#edb8ae', color: '#a13a27' },
    success: { background: '#f3fbf6', border: '#bde2c7', color: '#1d6b3f' },
    secondary: { background: '#f7f4ef', border: '#ddd3c7', color: '#5f4e43' },
  }[tone]

  return `
    <div style="background:${toneMap.background}; border:1px solid ${toneMap.border}; border-radius:14px; padding:14px;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:6px;">${escapeHtml(labelText)}</div>
      <div style="font-size:24px; font-weight:800; color:${toneMap.color};">${escapeHtml(value)}</div>
    </div>
  `
}

function variantTag(variantName?: string | null) {
  if (!variantName) {
    return ''
  }

  return `<div style="margin-top:4px; color:#7a685b; font-size:12px;">Variant: ${escapeHtml(variantName)}</div>`
}

function renderCalendarHtml(item: any, calendar: InventoryCalendarSummary) {
  const dayCells = calendar.days.map((day) => {
    const tone = dayTone(day)
    return `
      <div style="background:${tone.background}; border:1px solid ${tone.border}; border-radius:14px; padding:12px; min-height:132px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px;">
          <div>
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:4px;">${escapeHtml(formatWeekday(day.date))}</div>
            <div style="font-weight:800; color:#241a14;">${escapeHtml(formatDate(day.date))}</div>
          </div>
          <div style="font-size:12px; font-weight:800; color:${tone.accent};">
            ${escapeHtml(`${day.availableInventory}/${day.totalInventory}`)}
          </div>
        </div>
        <div style="display:grid; gap:6px; font-size:13px; color:#4d3d32;">
          ${renderDayStatRow('Platform', day.bookedUnits, 'platform')}
          ${renderDayStatRow('Offline', day.offlineReservedUnits, 'offline')}
          ${renderDayStatRow('Blocked', day.blockedUnits, 'blocked')}
        </div>
      </div>
    `
  }).join('')

  const activeEventsHtml = calendar.activeEvents.length
    ? calendar.activeEvents.map((event) => `
        <div style="padding:12px 14px; border:1px solid #eadfd4; border-radius:14px; background:#ffffff;">
          <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-weight:800; color:#241a14;">${escapeHtml(eventTypeLabel(event.eventType))}</div>
              <div style="margin-top:4px; color:#5f4e43;">${escapeHtml(formatDateRange(event.startDate, event.endDate))}</div>
              ${variantTag(event.variant?.name)}
            </div>
            <div style="font-weight:800; color:#8f4e08;">${escapeHtml(`${event.quantity} unit(s)`)}</div>
          </div>
          <div style="margin-top:8px; color:#5f4e43; font-size:13px;">
            ${escapeHtml(event.customerName || event.source || event.reference || 'No extra reference')}
          </div>
          ${event.notes ? `<div style="margin-top:6px; color:#7a685b; font-size:12px;">${escapeHtml(event.notes)}</div>` : ''}
        </div>
      `).join('')
    : `<div style="padding:14px; border:1px dashed #d9cfc4; border-radius:14px; color:#7a685b;">No active offline reservations or unit blocks for this window.</div>`

  const reservationsHtml = calendar.upcomingReservations.length
    ? calendar.upcomingReservations.slice(0, 8).map((reservation) => `
        <button
          type="button"
          style="padding:12px 14px; border:1px solid #eadfd4; border-radius:14px; background:#ffffff; width:100%; text-align:left; cursor:pointer;"
          onclick="window.__bookmameOpenRentalReservationFromCalendar && window.__bookmameOpenRentalReservationFromCalendar('${escapeJsString(reservation.id)}')"
        >
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px;">
            <div>
              <div style="font-weight:800; color:#241a14;">${escapeHtml(reservation.reservationNumber)}</div>
              <div style="margin-top:4px; color:#5f4e43;">${escapeHtml(reservation.customerName || 'Customer')}</div>
              ${variantTag(reservation.variantName)}
            </div>
            <div style="text-transform:capitalize; color:#8f4e08; font-weight:700;">
              ${escapeHtml(label(reservation.reservationStatus))}
            </div>
          </div>
          <div style="margin-top:8px; color:#5f4e43; font-size:13px;">
            ${escapeHtml(formatDateRange(reservation.startDate, reservation.endDate))} • ${escapeHtml(`${reservation.quantity} unit(s)`)}
          </div>
        </button>
      `).join('')
    : `<div style="padding:14px; border:1px dashed #d9cfc4; border-radius:14px; color:#7a685b;">No platform reservations overlap this window.</div>`

  const variantSummaryHtml = Array.isArray(calendar.variants) && calendar.variants.length
    ? `
      <div style="margin-top:6px; color:#5f4e43;">
        Variants: ${escapeHtml(calendar.variants.map((variant) => `${variant.name} (${variant.totalInventory})`).join(' • '))}
      </div>
    `
    : ''

  return `
    <div style="font-family:inherit; color:#241a14; background:#fffaf5; border:1px solid #eadfd4; border-radius:18px; padding:18px;">
      <style>
        .rental-calendar-shell * { box-sizing: border-box; }
        .rental-calendar-summary-grid {
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
          gap:12px;
          margin-bottom:18px;
        }
        .rental-calendar-days-grid {
          display:grid;
          grid-template-columns:repeat(7, minmax(0, 1fr));
          gap:10px;
          margin-bottom:18px;
        }
        .rental-calendar-sections-grid {
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));
          gap:16px;
        }
        .rental-calendar-list-grid {
          display:grid;
          gap:10px;
        }
        @media (max-width: 960px) {
          .rental-calendar-days-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 700px) {
          .rental-calendar-summary-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
          .rental-calendar-days-grid { grid-template-columns:1fr; }
          .rental-calendar-sections-grid { grid-template-columns:1fr; }
        }
      </style>
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:flex-start; margin-bottom:18px;">
        <div>
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768;">Rental inventory calendar</div>
          <div style="margin-top:6px; font-size:24px; font-weight:800; color:#241a14;">${escapeHtml(calendar.itemName)}</div>
          <div style="margin-top:6px; color:#5f4e43;">
            ${escapeHtml(item?.categoryLabel || 'Rental inventory item')} •
            ${escapeHtml(`${calendar.totalInventory} unit(s)`)}
          </div>
          ${variantSummaryHtml}
          <div style="margin-top:6px; color:#7a685b;">
            Showing ${escapeHtml(formatDateWithYear(calendar.startDate))} to ${escapeHtml(formatDateWithYear(calendar.endDate))}
          </div>
        </div>
        <div style="padding:10px 14px; border-radius:999px; background:#fff0de; color:#8f4e08; font-weight:800;">
          ${escapeHtml(formatMoney(item?.dailyRateAmount, item?.currency))}
          <span style="font-weight:600; color:#7a685b;"> / day</span>
        </div>
      </div>

      <div class="rental-calendar-summary-grid">
        ${renderSummaryCard('Total Inventory', String(calendar.totalInventory), 'secondary')}
        ${renderSummaryCard('Lowest Available', String(calendar.summary.lowestAvailableInventory), calendar.summary.lowestAvailableInventory > 0 ? 'success' : 'warning')}
        ${renderSummaryCard('Platform Reservations', String(calendar.summary.totalBookedUnits), 'primary')}
        ${renderSummaryCard('Offline Held Units', String(calendar.summary.totalOfflineReservedUnits), 'primary')}
        ${renderSummaryCard('Blocked Units', String(calendar.summary.totalBlockedUnits), 'warning')}
      </div>

      <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Daily capacity</div>
      <div class="rental-calendar-days-grid">
        ${dayCells}
      </div>

      <div class="rental-calendar-sections-grid">
        <div>
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Active holds</div>
          <div class="rental-calendar-list-grid">
            ${activeEventsHtml}
          </div>
        </div>
        <div>
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Platform reservations in view</div>
          <div class="rental-calendar-list-grid">
            ${reservationsHtml}
          </div>
        </div>
      </div>
    </div>
  `
}

async function fetchInventoryCalendar(itemId: string, startDate: string, dayCount: number) {
  return await Api.instance.service(inventoryCalendarServicePath(itemId)).find({
    query: {
      startDate,
      dayCount,
    },
  }) as InventoryCalendarSummary
}

function buildReleaseEventLabel(event: InventoryEvent) {
  const subject = event.customerName || event.reference || event.source || 'hold'
  const variantSuffix = event.variant?.name ? ` • ${event.variant.name}` : ''
  return `${eventTypeLabel(event.eventType)} • ${event.quantity} unit(s) • ${formatDateRange(event.startDate, event.endDate)}${variantSuffix} • ${subject}`
}

function getReportItemId(report: Report) {
  const itemId = report.$master?.$get?.('id')
  if (!itemId) {
    throw new Error('Inventory item is not loaded yet.')
  }
  return String(itemId)
}

function getReportVariants(report: Report) {
  const variants = report.$master?.$get?.('variants')
  return Array.isArray(variants) ? variants : []
}

async function loadInventoryCalendar(report: Report) {
  const itemId = getReportItemId(report)
  const currentStartDate = normalizeDateOnly(report.$master?.$get?.('calendarStartDate')) || currentCalendarStartDate()
  const dayCount = Number(report.$master?.$get?.('calendarDayCount') || 28)
  const calendar = await fetchInventoryCalendar(itemId, currentStartDate, dayCount)
  report.$master?.$set?.('calendarStartDate', normalizeDateOnly(calendar.startDate))
  report.$master?.$set?.('calendarDayCount', calendar.dayCount)
  report.$master?.$set?.('calendarHtml', renderCalendarHtml(report.$master?.$data || {}, calendar))
  report.forceRender()
}

async function createInventoryEvent(itemId: string, payload: Record<string, unknown>) {
  await Api.instance.service(inventoryEventsServicePath(itemId)).create(payload)
}

async function fetchActiveInventoryEvents(itemId: string) {
  const response = await Api.instance.service(inventoryEventsServicePath(itemId)).find({
    query: {
      $paginate: false,
      $sort: { startDate: 1, createdAt: -1 },
    },
  }) as InventoryEvent[] | { data?: InventoryEvent[] }

  const items = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
  return items.filter((item) => String(item.status || '').toLowerCase() === 'active')
}

function buildVariantField(report: Report) {
  const variants = getReportVariants(report)
  if (!variants.length) {
    return []
  }

  return [
    $FD({ label: 'Variant', storage: 'rentalInventoryVariantId', type: 'select', required: true }, {
      selectOptions: () => variants.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
      })),
    }),
  ]
}

async function openAddOfflineReservationDialog(report: Report) {
  const itemId = getReportItemId(report)
  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title: 'Add Offline Reserv.',
        width: 620,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label: 'Start Date', storage: 'startDate', type: 'date', required: true }),
              $FD({ label: 'End Date', storage: 'endDate', type: 'date', required: true }),
              $FD({ label: 'Units', storage: 'quantity', type: 'integer', required: true }),
              ...buildVariantField(report),
              $FD({ label: 'Source', storage: 'source', type: 'select', required: true }, {
                default() {
                  return 'walk_in'
                },
                selectOptions: makeConstantOptions('rental-inventory-event-sources'),
              }),
              $FD({ label: 'Customer Name', storage: 'customerName', type: 'text' }),
              $FD({ label: 'Customer Phone', storage: 'customerPhoneNumber', type: 'text' }),
              $FD({ label: 'Reference', storage: 'reference', type: 'text' }),
              $FD({ label: 'Notes', storage: 'notes', type: 'textarea' }),
            ],
          }),
        ],
        saved: async (form) => {
          try {
            const startDate = normalizeDateTimeForApi(form.$master?.$get?.('startDate'))
            const endDate = normalizeDateTimeForApi(form.$master?.$get?.('endDate'))
            if (!startDate || !endDate) {
              Dialogs.$error('Choose valid start and end dates.')
              return
            }

            await createInventoryEvent(itemId, {
              eventType: 'offline_reservation',
              startDate,
              endDate,
              quantity: Number(form.$master?.$get?.('quantity') || 0),
              rentalInventoryVariantId: form.$master?.$get?.('rentalInventoryVariantId'),
              source: form.$master?.$get?.('source'),
              customerName: form.$master?.$get?.('customerName'),
              customerPhoneNumber: form.$master?.$get?.('customerPhoneNumber'),
              reference: form.$master?.$get?.('reference'),
              notes: form.$master?.$get?.('notes'),
            })
            dialog.forceCancel()
            await loadInventoryCalendar(report)
            Dialogs.$success('Offline reservation recorded successfully.')
          } catch (error) {
            Dialogs.$error(error instanceof Error ? error.message : 'Unable to save offline reservation right now.')
          }
        },
      })
    },
  })

  AppManager.showDialog(dialog)
}

async function openBlockUnitsDialog(report: Report) {
  const itemId = getReportItemId(report)
  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title: 'Block Units',
        width: 620,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label: 'Block From', storage: 'startDate', type: 'date', required: true }),
              $FD({ label: 'Block Until', storage: 'endDate', type: 'date', required: true }),
              $FD({ label: 'Units', storage: 'quantity', type: 'integer', required: true }),
              ...buildVariantField(report),
              $FD({ label: 'Reason Type', storage: 'source', type: 'select', required: true }, {
                default() {
                  return 'manager_hold'
                },
                selectOptions: makeConstantOptions('rental-inventory-event-sources'),
              }),
              $FD({ label: 'Reference', storage: 'reference', type: 'text' }),
              $FD({ label: 'Notes', storage: 'notes', type: 'textarea' }),
            ],
          }),
        ],
        saved: async (form) => {
          try {
            const startDate = normalizeDateTimeForApi(form.$master?.$get?.('startDate'))
            const endDate = normalizeDateTimeForApi(form.$master?.$get?.('endDate'))
            if (!startDate || !endDate) {
              Dialogs.$error('Choose valid block start and end dates.')
              return
            }

            await createInventoryEvent(itemId, {
              eventType: 'block',
              startDate,
              endDate,
              quantity: Number(form.$master?.$get?.('quantity') || 0),
              rentalInventoryVariantId: form.$master?.$get?.('rentalInventoryVariantId'),
              source: form.$master?.$get?.('source'),
              reference: form.$master?.$get?.('reference'),
              notes: form.$master?.$get?.('notes'),
            })
            dialog.forceCancel()
            await loadInventoryCalendar(report)
            Dialogs.$success('Inventory block created successfully.')
          } catch (error) {
            Dialogs.$error(error instanceof Error ? error.message : 'Unable to block units right now.')
          }
        },
      })
    },
  })

  AppManager.showDialog(dialog)
}

async function openReleaseHoldDialog(report: Report) {
  const itemId = getReportItemId(report)
  const activeEvents = await fetchActiveInventoryEvents(itemId)

  if (!activeEvents.length) {
    Dialogs.$error('There are no active inventory holds to release right now.')
    return
  }

  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title: 'Release Hold',
        width: 640,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label: 'Hold', storage: 'inventoryEventId', type: 'select', required: true }, {
                selectOptions: () => activeEvents.map((event) => ({
                  id: event.id,
                  name: buildReleaseEventLabel(event),
                })),
              }),
              $FD({ label: 'Release Reason', storage: 'releasedReason', type: 'textarea', required: true }),
            ],
          }),
        ],
        saved: async (form) => {
          const inventoryEventId = String(form.$master?.$get?.('inventoryEventId') || '')
          const releasedReason = String(form.$master?.$get?.('releasedReason') || '').trim()

          if (!inventoryEventId || !releasedReason) {
            Dialogs.$error('Choose the hold to release and provide a short reason.')
            return
          }

          try {
            await Api.instance.service(inventoryEventsServicePath(itemId)).patch(inventoryEventId, {
              status: 'released',
              releasedReason,
            })
            dialog.forceCancel()
            await loadInventoryCalendar(report)
            Dialogs.$success('Inventory hold released successfully.')
          } catch (error) {
            Dialogs.$error(error instanceof Error ? error.message : 'Unable to release this hold right now.')
          }
        },
      })
    },
  })

  AppManager.showDialog(dialog)
}

export const rentalInventoryCalendarReport = () => $RP({
  title: 'Inventory Calendar',
  objectType: inventoryItemsServicePath(),
  fluid: true,
  sideButtonWidth: 240,
}, {
  form: () => $FM({
    title: 'Inventory calendar',
  }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Calendar Start', storage: 'calendarStartDate', type: 'date', readonly: false }),
          $FD({ label: 'Days Visible', storage: 'calendarDayCount', type: 'integer', readonly: false }),
          $FD({ label: 'Inventory Calendar', storage: 'calendarHtml', type: 'htmlview', readonly: true, minHeight: 720, cols: 12 }),
        ],
      }),
    ],
  }),
  async setup(report) {
    window.__bookmameOpenRentalReservationFromCalendar = (reservationId: string) => {
      const reservationReport = rentalReservationsReport(reservationId)()
      reservationReport.$params.mode = 'display'
      AppManager.showReport(reservationReport)
    }
    report.$master?.$set?.('calendarDayCount', 28)
  },
  async loaded(report) {
    window.__bookmameOpenRentalReservationFromCalendar = (reservationId: string) => {
      const reservationReport = rentalReservationsReport(reservationId)()
      reservationReport.$params.mode = 'display'
      AppManager.showReport(reservationReport)
    }
    await loadInventoryCalendar(report)
  },
  access: rentalAccess('rental.inventory.view'),
  sideButtons: (_props, _context, report) => [
    $BN({ text: 'Previous Period', icon: 'mdi-chevron-left', color: 'secondary' }, {
      onClicked: async () => {
        try {
          const current = normalizeDateOnly(report.$master?.$get?.('calendarStartDate')) || currentCalendarStartDate()
          const calendarDayCount = report.$master?.$get?.('calendarDayCount') || 28
          report.$master?.$set?.('calendarStartDate', shiftDate(current, -calendarDayCount))
          await loadInventoryCalendar(report)
        } catch (error) {
          Dialogs.$error(error instanceof Error ? error.message : 'Unable to load the previous calendar window.')
        }
      },
    }),
    $BN({ text: 'Next Period', icon: 'mdi-chevron-right', color: 'secondary' }, {
      onClicked: async () => {
        try {
          const current = normalizeDateOnly(report.$master?.$get?.('calendarStartDate')) || currentCalendarStartDate()
          const calendarDayCount = report.$master?.$get?.('calendarDayCount') || 28
          report.$master?.$set?.('calendarStartDate', shiftDate(current, calendarDayCount))
          await loadInventoryCalendar(report)
        } catch (error) {
          Dialogs.$error(error instanceof Error ? error.message : 'Unable to load the next calendar window.')
        }
      },
    }),
    $BN({ text: 'Refresh', icon: 'mdi-refresh', color: 'primary' }, {
      onClicked: async () => {
        try {
          await loadInventoryCalendar(report)
        } catch (error) {
          Dialogs.$error(error instanceof Error ? error.message : 'Unable to refresh the calendar right now.')
        }
      },
    }),
    $BN({ text: 'Add Offline Reserv.', icon: 'mdi-account-plus-outline', color: 'success' }, {
      onClicked: async () => {
        await openAddOfflineReservationDialog(report)
      },
    }),
    $BN({ text: 'Block Units', icon: 'mdi-calendar-remove-outline', color: 'warning' }, {
      onClicked: async () => {
        await openBlockUnitsDialog(report)
      },
    }),
    $BN({ text: 'Release Hold', icon: 'mdi-lock-open-outline', color: 'info' }, {
      onClicked: async () => {
        await openReleaseHoldDialog(report)
      },
    }),
  ],
})

export function openRentalInventoryCalendar(itemId: string) {
  const report = rentalInventoryCalendarReport()
  report.$params.objectId = itemId
  report.$params.mode = 'display'
  AppManager.showReport(report)
}

export const rentalInventoryCalendarSelector = () => $SL({
  title: 'Select Inventory Item',
  width: 480,
}, {
  load: () => {
    return Api.instance.service(inventoryItemsServicePath()).findAll({})
  },
  selected(item, selector) {
    selector.forceCancel()
    openRentalInventoryCalendar(String(item))
  },
})
