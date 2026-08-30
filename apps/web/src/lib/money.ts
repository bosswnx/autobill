export function yuanToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '').replace(/¥/g, '')
  if (!trimmed || trimmed === '.' || trimmed === '-') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

export function centsToYuanInput(cents: number): string {
  const abs = Math.abs(cents)
  if (abs % 100 === 0) return String(abs / 100)
  return (abs / 100).toFixed(2)
}

export function formatYuan(cents: number, opts?: { sign?: 'auto' | 'never' | 'always' }): string {
  const signMode = opts?.sign ?? 'auto'
  const negative = cents < 0
  const formatted = formatYuanDigits(Math.abs(cents))
  if (signMode === 'never') return `¥${formatted}`
  if (negative) return `-¥${formatted}`
  if (signMode === 'always') return `+¥${formatted}`
  return `¥${formatted}`
}

function formatYuanDigits(cents: number): string {
  const raw =
    cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(/0$/, '').replace(/\.$/, '')
  const [whole, fraction] = raw.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}
