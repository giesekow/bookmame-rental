import QRCode from 'qrcode'
import { $FD, $FM, $PT, Api, AppManager, DialogForm, Dialogs } from 'vuetify-extended'
import { useAppStore } from '../store/app'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMoney(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0)
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCurrency }).format(
      (Number.isFinite(amount) ? amount : 0) / 100,
    )
  } catch {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

type InventoryItem = {
  id: string
  name?: string | null
  categoryLabel?: string | null
  dailyRateAmount?: number | null
  currency?: string | null
  description?: string | null
  totalInventory?: number | null
  minimumRentalDays?: number | null
  maximumRentalDays?: number | null
  status?: string | null
  enabled?: boolean | null
  isAvailable?: boolean | null
}

async function loadInventoryItems(rentalProviderId: string): Promise<InventoryItem[]> {
  const response = await Api.instance.service(`rental-providers/${rentalProviderId}/inventory-items`).find({
    query: {
      $paginate: false,
      $sort: { categoryLabel: 1, sortOrder: 1, name: 1 },
      $select: ['id', 'name', 'categoryLabel', 'dailyRateAmount', 'currency', 'description', 'totalInventory', 'minimumRentalDays', 'maximumRentalDays', 'status', 'enabled', 'isAvailable'],
    },
  }) as any

  return Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
}

function groupByCategory(items: InventoryItem[]): Map<string, InventoryItem[]> {
  const map = new Map<string, InventoryItem[]>()
  for (const item of items) {
    const category = String(item.categoryLabel || 'General').trim()
    if (!map.has(category)) map.set(category, [])
    map.get(category)!.push(item)
  }
  return map
}

function buildRentalDurationNote(item: InventoryItem) {
  const min = item.minimumRentalDays
  const max = item.maximumRentalDays
  if (min && max) return `${min}–${max} day${max !== 1 ? 's' : ''}`
  if (min) return `Min ${min} day${min !== 1 ? 's' : ''}`
  if (max) return `Max ${max} day${max !== 1 ? 's' : ''}`
  return ''
}

function buildItemRow(item: InventoryItem) {
  const durationNote = buildRentalDurationNote(item)
  const statusNote = item.isAvailable === false || item.enabled === false ? ' <span class="unavailable-badge">Unavailable</span>' : ''
  const meta = [
    item.totalInventory ? `${item.totalInventory} unit${Number(item.totalInventory) !== 1 ? 's' : ''}` : '',
    durationNote,
  ]
    .filter(Boolean)
    .join(' · ')

  return `<tr class="item-row">
    <td class="item-name">
      ${escapeHtml(item.name || 'Item')}${statusNote}
      ${meta ? `<div class="item-meta">${escapeHtml(meta)}</div>` : ''}
    </td>
    <td class="item-desc">${escapeHtml(item.description || '')}</td>
    <td class="item-price">${escapeHtml(formatMoney(item.dailyRateAmount, item.currency))}<span class="item-per-day">/day</span></td>
  </tr>`
}

function buildCategorySection(category: string, items: InventoryItem[]) {
  return `<div class="category-section">
    <div class="category-heading">${escapeHtml(category)}</div>
    <table class="item-table">
      <tbody>${items.map(buildItemRow).join('')}</tbody>
    </table>
  </div>`
}

function buildCatalogMarkup(provider: any, items: InventoryItem[], qrCodeDataUrl: string, includeUnavailable: boolean) {
  const visibleItems = includeUnavailable ? items : items.filter((i) => i.enabled !== false && i.isAvailable !== false && String(i.status || '').toLowerCase() !== 'archived')
  const grouped = groupByCategory(visibleItems)

  const sections = [...grouped.entries()]
    .map(([cat, catItems]) => buildCategorySection(cat, catItems))
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(provider?.name || 'Rental')} – Inventory Catalog</title>
    <style>
      @page { size: A4 portrait; margin: 18mm 16mm; }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 11pt;
        color: #1e1830;
        background: #fff;
      }

      .cover {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        page-break-after: always;
        padding: 40px 24px;
        background: linear-gradient(160deg, #2e1760 0%, #5630a8 100%);
        color: #f8f5ff;
      }

      .cover__brand {
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.75;
        margin-bottom: 28px;
      }

      .cover__name {
        font-size: 34pt;
        font-weight: 900;
        line-height: 1.1;
        margin-bottom: 12px;
      }

      .cover__subtitle {
        font-size: 13pt;
        opacity: 0.82;
        margin-bottom: 36px;
      }

      .cover__qr {
        width: 100px;
        height: 100px;
        border-radius: 14px;
        border: 3px solid rgba(255,255,255,0.3);
        overflow: hidden;
        margin: 0 auto 12px;
        background: #fff;
        padding: 6px;
      }

      .cover__qr img { width: 100%; height: 100%; object-fit: contain; }

      .cover__qr-caption {
        font-size: 8pt;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.7;
      }

      .cover__date {
        margin-top: 32px;
        font-size: 9pt;
        opacity: 0.6;
      }

      .content { padding: 0; }

      .category-section { margin-bottom: 24px; break-inside: avoid; }

      .category-heading {
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #5630a8;
        margin-bottom: 6px;
        padding-bottom: 5px;
        border-bottom: 1.5px solid #d8cef0;
      }

      .item-table {
        width: 100%;
        border-collapse: collapse;
      }

      .item-row td {
        padding: 5px 6px;
        border-bottom: 1px solid #f0ecfb;
        vertical-align: top;
      }

      .item-row:last-child td { border-bottom: none; }

      .item-name {
        font-weight: 700;
        font-size: 10pt;
        width: 36%;
        color: #2e1760;
      }

      .item-meta {
        font-size: 8pt;
        font-weight: 600;
        color: #6648a8;
        margin-top: 2px;
      }

      .item-desc {
        font-size: 9pt;
        color: #4a3878;
        width: 48%;
        line-height: 1.4;
      }

      .item-price {
        font-size: 10pt;
        font-weight: 800;
        color: #5630a8;
        text-align: right;
        white-space: nowrap;
        width: 16%;
      }

      .item-per-day {
        font-size: 7pt;
        font-weight: 600;
        color: #8b6ad0;
        margin-left: 1px;
      }

      .unavailable-badge {
        font-size: 7pt;
        font-weight: 700;
        background: #f0ede8;
        color: #8a6040;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
      }

      .footer {
        margin-top: 36px;
        padding-top: 12px;
        border-top: 1px solid #d8cef0;
        font-size: 8pt;
        color: #6648a8;
        text-align: center;
      }

      @media print {
        .cover { background: #2e1760 !important; }
      }
    </style>
  </head>
  <body>
    <div class="cover">
      <div class="cover__brand">BookMaMe Rental Catalog</div>
      <div class="cover__name">${escapeHtml(provider?.name || 'Rental Provider')}</div>
      <div class="cover__subtitle">Inventory &amp; Daily Rates</div>
      <div class="cover__qr">
        <img id="catalog-qr" src="${qrCodeDataUrl}" alt="Provider QR" />
      </div>
      <div class="cover__qr-caption">Scan to rent online</div>
      <div class="cover__date">Generated ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
    </div>

    <div class="content">${sections}</div>

    <div class="footer">
      ${escapeHtml(provider?.name || '')} &nbsp;·&nbsp; Powered by BookMaMe
    </div>
  </body>
</html>`
}

export async function printInventoryCatalog(options: { includeUnavailable: boolean }) {
  const store = useAppStore()
  const provider = store.rentalProvider
  const rentalProviderId = provider?.id

  if (!rentalProviderId) {
    throw new Error('No active rental provider selected.')
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) {
    throw new Error('Unable to open the print window. Please allow pop-ups and try again.')
  }

  printWindow.document.open()
  printWindow.document.write('<html><head><title>Preparing catalog...</title></head><body style="display:grid;place-items:center;min-height:100vh;font-family:sans-serif;background:#ede6f9;">Preparing inventory catalog&hellip;</body></html>')
  printWindow.document.close()

  const [items, qrCodeDataUrl] = await Promise.all([
    loadInventoryItems(rentalProviderId),
    QRCode.toDataURL(`Rental Provider: ${provider?.name || rentalProviderId}\nID: ${rentalProviderId}`, { margin: 1, width: 200, color: { dark: '#2e1760', light: '#ffffff' } }),
  ])

  if (items.length === 0) {
    printWindow.close()
    throw new Error('No inventory items found to print.')
  }

  printWindow.document.open()
  printWindow.document.write(buildCatalogMarkup(provider, items, qrCodeDataUrl, options.includeUnavailable))
  printWindow.document.close()

  await new Promise<void>((resolve) => {
    const img = printWindow.document.getElementById('catalog-qr') as HTMLImageElement | null
    if (!img || (img.complete && img.naturalWidth > 0)) { resolve(); return }
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => resolve(), { once: true })
    window.setTimeout(resolve, 1500)
  })

  window.setTimeout(() => { printWindow.focus(); printWindow.print() }, 80)
}

export function openInventoryCatalogDialog() {
  const dl = new DialogForm({}, {
    form: () => $FM({ title: 'Print Inventory Catalog', width: 520 }, {
      children: () => [$PT({}, {
        children: () => [
          $FD({ label: 'Include Unavailable Items', type: 'boolean', storage: 'includeUnavailable', hint: 'Show inventory items that are currently unavailable or disabled.' }, {
            default: () => false,
          }),
        ],
      })],
      saved: async (form) => {
        try {
          await printInventoryCatalog({
            includeUnavailable: Boolean(form.$master?.$get('includeUnavailable', false)),
          })
          dl.forceCancel()
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Unable to print the catalog right now.')
        }
      },
    }),
  })
  AppManager.showDialog(dl)
}
