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
  if (year === yearKey(now)) return `${Number(month)}月`
  return `${year}年${Number(month)}月`
}

export function formatYearTitle(year: string): string {
  return `${year}年`
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

export function elapsedDaysInMonth(key: string, now = new Date()): number {
  const current = monthKey(now)
  if (key < current) return daysInMonth(key)
  if (key > current) return 0
  return now.getDate()
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
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const dated = formatDayWithWeek(date)
  if (sameDay(date, today)) return `今天 ${dated}`
  if (sameDay(date, yesterday)) return `昨天 ${dated}`
  return dated
}

function formatDayWithWeek(date: Date): string {
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${date.getMonth() + 1}月${date.getDate()}日 周${week}`
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
