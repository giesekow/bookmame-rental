import { Api } from 'vuetify-extended'

export async function downloadReceiptPdf(pdfUrl: string, filename = 'receipt.pdf') {
  const response = await fetch(pdfUrl, {
    headers: { Authorization: `Bearer ${Api.instance.tokenRef?.value || ''}`},
  })

  if (!response.ok) {
    throw new Error(`Failed to download receipt PDF (${response.status}).`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export async function printReceipt(receiptUrl: string) {
  const printWindow = typeof window !== 'undefined'
    ? window.open('', '_blank', 'width=800,height=1000')
    : null

  if (printWindow) {
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Loading receipt...</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#274056;background:#f5f8fb;display:flex;align-items:center;justify-content:center;min-height:100vh;}
      .status{padding:20px 24px;border-radius:16px;background:#fff;border:1px solid #dbe6ef;text-align:center;font-weight:700;}</style>
      </head><body><div class="status">Preparing receipt...</div></body></html>`)
    printWindow.document.close()
  }

  const response = await fetch(receiptUrl, {
    headers: { Authorization: `Bearer ${Api.instance.tokenRef?.value || ''}` },
  })

  if (!response.ok) {
    if (printWindow && !printWindow.closed) printWindow.close()
    throw new Error(`Failed to load receipt (${response.status}).`)
  }

  const html = await response.text()

  if (printWindow && !printWindow.closed) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    window.setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 300)
  } else if (typeof window !== 'undefined') {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }
}
