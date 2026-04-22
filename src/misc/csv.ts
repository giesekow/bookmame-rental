export type CsvRow = Record<string, unknown>

function escapeCsv(value: unknown) {
  const text = String(value ?? '')

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function buildCsv(rows: CsvRow[]) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach((key) => set.add(key))
    return set
  }, new Set<string>()))

  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ]

  return lines.join('\n')
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const csv = buildCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}
