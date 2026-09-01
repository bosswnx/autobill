import { getLocale, getMessages } from '../i18n'

export function nowIso(): string {
  return new Date().toISOString()
}

export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function yearKey(date = new Date()): string {
  return String(date.getFullYear())
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  return monthKey(next)
}

export function formatMonthTitle(key: string, now = new Date()): string {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  const tag = getMessages().intl
  if (year === yearKey(now)) {
    return date.toLocaleString(tag, { month: 'short' })
  }
  return date.toLocaleString(tag, { month: 'short', year: 'numeric' })
}

export function formatYearTitle(year: string): string {
  if (getLocale() === 'zh') return `${year}年`
  return year
}

export function formatCompactDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleString(getMessages().intl, {
    month: 'short',
    day: 'numeric',
  })
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString(getMessages().intl, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatMonthShort(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString(getMessages().intl, { month: 'short' })
}

export function shiftYear(year: string, delta: number): string {
  return String(Number(year) + delta)
}

export function inMonth(iso: string, key: string): boolean {
  const date = new Date(iso)
  return monthKey(date) === key
}

export function inYear(iso: string, year: string): boolean {
  return new Date(iso).getFullYear() === Number(year)
}

export function daysInMonth(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

export function elapsedMonthsInYear(year: string, now = new Date()): number {
  const value = Number(year)
  if (value < now.getFullYear()) return 12
  if (value > now.getFullYear()) return 0
  return now.getMonth() + 1
}

export function endOfDayMs(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
}

export function endOfMonthMs(year: number, month: number): number {
  return new Date(year, month, 0, 23, 59, 59, 999).getTime()
}

export function dayKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatDayHeading(iso: string): string {
  const t = getMessages()
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const dated = formatDayWithWeek(date)
  if (sameDay(date, today)) return `${t.common.today} ${dated}`
  if (sameDay(date, yesterday)) return `${t.common.yesterday} ${dated}`
  return dated
}

function formatDayWithWeek(date: Date): string {
  const t = getMessages()
  if (getLocale() === 'zh') {
    const week = t.pickers.weekdays[date.getDay()]
    return `${date.getMonth() + 1}月${date.getDate()}日 周${week}`
  }
  return date.toLocaleString(t.intl, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatClock(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function toDateInput(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function toTimeInput(iso: string): string {
  return formatClock(iso)
}

export function fromDateTimeInput(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  const now = new Date()
  if (!year || !month || !day) return now.toISOString()
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0).toISOString()
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
