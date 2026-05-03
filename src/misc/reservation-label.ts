import QRCode from 'qrcode'

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
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format((Number.isFinite(amount) ? amount : 0) / 100)
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

function formatDate(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  } catch (_error) {
    return date.toISOString().slice(0, 10)
  }
}

function formatDateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown'
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

function rentalDays(reservation: any) {
  const start = reservation?.startDate ? new Date(String(reservation.startDate)) : null
  const end = reservation?.endDate ? new Date(String(reservation.endDate)) : null

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '?'
  }

  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return days > 0 ? String(days) : '?'
}

function buildFlags(reservation: any) {
  const flags: string[] = []
  const fulfillment = String(reservation?.fulfillmentMethod || '').trim().toLowerCase()

  if (fulfillment === 'customer_pickup') {
    flags.push('Customer Pickup')
  } else if (fulfillment === 'delivery') {
    flags.push('Delivery')
  }

  const returnMethod = String(reservation?.returnFulfillmentMethod || '').trim().toLowerCase()
  if (returnMethod === 'return_by_customer') {
    flags.push('Customer Returns')
  } else if (returnMethod === 'provider_collects') {
    flags.push('Provider Collects')
  }

  if (reservation?.securityDepositAmount > 0) {
    flags.push('Deposit held')
  }

  if (reservation?.notes) {
    flags.push('Has notes')
  }

  return Array.from(new Set(flags)).slice(0, 5)
}

function buildQrPayload(reservation: any) {
  const itemName = String(reservation?.itemNameSnapshot || reservation?.rentalInventoryItem?.name || '').trim()
  const variant = String(reservation?.variantNameSnapshot || '').trim()

  const lines = [
    'BOOKMAME RENTAL RESERVATION LABEL',
    `Reservation Number: ${reservation?.reservationNumber || ''}`,
    `Reservation ID: ${reservation?.id || ''}`,
    `Provider: ${reservation?.rentalProvider?.name || ''}`,
    `Customer: ${reservation?.customerDisplayName || ''}`,
    itemName ? `Item: ${itemName}${variant ? ` – ${variant}` : ''}` : '',
    `Start: ${formatDate(reservation?.startDate)}`,
    `End: ${formatDate(reservation?.endDate)}`,
    `Duration: ${rentalDays(reservation)} day(s)`,
    `Total: ${formatMoney(reservation?.totalAmount, reservation?.currency)}`,
    `Created: ${formatDateTime(reservation?.createdAt)}`,
  ].filter(Boolean)

  return lines.join('\n')
}

function buildReservationLabelMarkup(reservation: any, qrCodeDataUrl: string) {
  const customerName = String(reservation?.customerDisplayName || 'Customer').trim()
  const providerName = String(reservation?.rentalProvider?.name || 'Rental Provider').trim()
  const itemName = String(reservation?.itemNameSnapshot || reservation?.rentalInventoryItem?.name || 'Item').trim()
  const variantName = String(reservation?.variantNameSnapshot || '').trim()
  const days = rentalDays(reservation)
  const flags = buildFlags(reservation)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BookMaMe Rental Label ${escapeHtml(reservation?.reservationNumber || '')}</title>
    <style>
      @page {
        size: 4in 6in;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 4in;
        height: 6in;
        overflow: hidden;
        background: #f2eef9;
        color: #1e1830;
        font-family: "Helvetica Neue", Arial, sans-serif;
      }

      .label {
        width: 4in;
        height: 6in;
        padding: 0.12in;
        page-break-after: avoid;
        background:
          radial-gradient(circle at top right, rgba(120, 80, 200, 0.14), transparent 32%),
          linear-gradient(180deg, #f8f5ff 0%, #ede6f9 100%);
      }

      .shell {
        height: 100%;
        border: 1.5px solid #cfc3e8;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.97);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .header {
        padding: 11px 13px 10px;
        background: linear-gradient(135deg, #2e1760 0%, #5630a8 100%);
        color: #f8f5ff;
      }

      .brand {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        opacity: 0.88;
      }

      .provider-name {
        margin-top: 6px;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.15;
      }

      .type-chip {
        display: inline-block;
        margin-top: 8px;
        padding: 5px 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .body {
        padding: 10px 12px 12px;
        display: grid;
        gap: 8px;
      }

      .reservation-number {
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.02em;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .panel {
        padding: 8px 9px;
        border: 1px solid #d8cef0;
        border-radius: 12px;
        background: #f8f5ff;
      }

      .panel-label {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #6648a8;
        margin-bottom: 4px;
      }

      .panel-value {
        font-size: 13px;
        font-weight: 800;
        line-height: 1.2;
      }

      .panel-subvalue {
        margin-top: 3px;
        font-size: 10px;
        color: #4a3878;
        line-height: 1.25;
      }

      .period-block {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 6px;
        align-items: center;
        padding: 8px 9px;
        border: 1px solid #d8cef0;
        border-radius: 12px;
        background: #f3eefc;
      }

      .period-block .date-side {
        text-align: center;
      }

      .period-block .date-label {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #6648a8;
        margin-bottom: 3px;
      }

      .period-block .date-value {
        font-size: 12px;
        font-weight: 800;
        line-height: 1.2;
      }

      .period-block .arrow {
        font-size: 18px;
        color: #5630a8;
        font-weight: 900;
        text-align: center;
      }

      .flags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .flag {
        display: inline-flex;
        align-items: center;
        padding: 4px 7px;
        border-radius: 999px;
        background: #ede8f9;
        color: #2e1760;
        border: 1px solid #cfc3e8;
        font-size: 9px;
        font-weight: 800;
      }

      .footer {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 8px;
        align-items: end;
      }

      .totals {
        display: grid;
        gap: 6px;
      }

      .totals .panel-value {
        font-size: 16px;
      }

      .qr-panel {
        padding: 8px;
        border: 1px solid #d8cef0;
        border-radius: 14px;
        background: #ffffff;
        text-align: center;
      }

      .qr-panel img {
        width: 100%;
        max-width: 88px;
        height: auto;
        display: block;
        margin: 0 auto;
      }

      .qr-caption {
        margin-top: 6px;
        font-size: 9px;
        color: #6648a8;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .support {
        font-size: 9px;
        color: #6648a8;
        text-align: center;
      }

      @media print {
        body { background: #fff; }
        .label { background: #fff; }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="shell">
        <div class="header">
          <div class="brand">BookMaMe Rental Label</div>
          <div class="provider-name">${escapeHtml(providerName)}</div>
          <div class="type-chip">Rental Reservation</div>
        </div>
        <div class="body">
          <div class="reservation-number">${escapeHtml(reservation?.reservationNumber || 'Reservation')}</div>
          <div class="meta-grid">
            <div class="panel">
              <div class="panel-label">Customer</div>
              <div class="panel-value">${escapeHtml(customerName)}</div>
            </div>
            <div class="panel">
              <div class="panel-label">Duration</div>
              <div class="panel-value">${escapeHtml(days)} day${days !== '1' ? 's' : ''}</div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-label">Item</div>
            <div class="panel-value">${escapeHtml(itemName)}</div>
            ${variantName ? `<div class="panel-subvalue">${escapeHtml(variantName)}</div>` : ''}
          </div>
          <div class="period-block">
            <div class="date-side">
              <div class="date-label">Start</div>
              <div class="date-value">${escapeHtml(formatDate(reservation?.startDate))}</div>
            </div>
            <div class="arrow">&#8594;</div>
            <div class="date-side">
              <div class="date-label">End</div>
              <div class="date-value">${escapeHtml(formatDate(reservation?.endDate))}</div>
            </div>
          </div>
          <div class="flags">
            ${flags.map((flag) => `<span class="flag">${escapeHtml(flag)}</span>`).join('')}
          </div>
          <div class="footer">
            <div class="totals">
              <div class="panel">
                <div class="panel-label">Total</div>
                <div class="panel-value">${escapeHtml(formatMoney(reservation?.totalAmount, reservation?.currency))}</div>
                <div class="panel-subvalue">Deposit: ${escapeHtml(formatMoney(reservation?.securityDepositAmount, reservation?.currency))}</div>
              </div>
              <div class="panel">
                <div class="panel-label">Reservation ID</div>
                <div class="panel-subvalue">${escapeHtml(reservation?.id || '')}</div>
              </div>
            </div>
            <div class="qr-panel">
              <img id="reservation-label-qr" src="${qrCodeDataUrl}" alt="Reservation QR code" />
              <div class="qr-caption">Scan details</div>
            </div>
          </div>
          <div class="support">Attach to the item before handoff to the customer.</div>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function printReservationLabel(reservation: any) {
  const printWindow = window.open('', '_blank', 'width=420,height=820')

  if (!printWindow) {
    throw new Error('Unable to open the print window. Please allow pop-ups and try again.')
  }

  printWindow.document.open()
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preparing label...</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "Helvetica Neue", Arial, sans-serif;
        background: #ede6f9;
        color: #1e1830;
      }

      body {
        display: grid;
        place-items: center;
      }

      .status {
        padding: 20px 24px;
        border-radius: 16px;
        background: rgba(255,255,255,0.92);
        border: 1px solid #cfc3e8;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="status">Preparing BookMaMe rental label...</div>
  </body>
</html>`)
  printWindow.document.close()

  const qrCodeDataUrl = await QRCode.toDataURL(buildQrPayload(reservation), {
    margin: 1,
    width: 220,
    color: {
      dark: '#1e1830',
      light: '#ffffff',
    },
  })

  printWindow.document.open()
  printWindow.document.write(buildReservationLabelMarkup(reservation, qrCodeDataUrl))
  printWindow.document.close()

  const waitForQrImage = async () => {
    const qrImage = printWindow.document.getElementById('reservation-label-qr') as HTMLImageElement | null

    if (!qrImage) {
      return
    }

    if (qrImage.complete && qrImage.naturalWidth > 0) {
      return
    }

    await new Promise<void>((resolve) => {
      let settled = false

      const finish = () => {
        if (settled) return
        settled = true
        qrImage.removeEventListener('load', handleLoad)
        qrImage.removeEventListener('error', handleError)
        resolve()
      }

      const handleLoad = () => finish()
      const handleError = () => finish()

      qrImage.addEventListener('load', handleLoad, { once: true })
      qrImage.addEventListener('error', handleError, { once: true })
      window.setTimeout(finish, 1500)
    })
  }

  const triggerPrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  await waitForQrImage()
  window.setTimeout(triggerPrint, 80)
}
