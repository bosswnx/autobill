import type { Subscription, SubscriptionCadence } from '@tagledger/shared'
import { shiftMonth } from './time'

export type Recurrence = Pick<Subscription, 'cadence' | 'month' | 'day' | 'hour' | 'minute'> & {
  fromEnd?: boolean
}

export type TimeSlot = {
  id: string
  cadence: SubscriptionCadence
  month: number
  day: number
  fromEnd: boolean
  hour: number
  minute: number
}

export function resolveCadence(value?: string): SubscriptionCadence {
  return value === 'yearly' || value === 'weekly' ? value : 'monthly'
}

export function timesOf(sub: Subscription): TimeSlot[] {
  const fallback = resolveCadence(sub.cadence)
  if (sub.times && sub.times.length > 0) {
    return sub.times.map((slot) => ({
      id: slot.id,
      cadence: resolveCadence(slot.cadence ?? fallback),
      month: slot.month,
      day: slot.day,
      fromEnd: Boolean(slot.fromEnd),
      hour: slot.hour,
      minute: slot.minute,
    }))
  }
  return [
    {
      id: 'legacy',
      cadence: fallback,
      month: sub.month,
      day: sub.day,
      fromEnd: Boolean(sub.fromEnd),
      hour: sub.hour,
      minute: sub.minute,
    },
  ]
}

export function recurrencesOf(sub: Subscription): Recurrence[] {
  return timesOf(sub).map((slot) => ({
    cadence: slot.cadence,
    month: slot.month,
    day: slot.day,
    fromEnd: slot.fromEnd,
    hour: slot.hour,
    minute: slot.minute,
  }))
}

export function slotKey(rec: Recurrence): string {
  const cadence = resolveCadence(rec.cadence)
  return `${cadence[0]}-${rec.fromEnd ? 'e' : 's'}-${rec.month}-${rec.day}-${pad2(rec.hour)}${pad2(rec.minute)}`
}

export function scheduledEntryId(subscriptionId: string, period: string, slot?: string): string {
  return slot ? `${subscriptionId}:${period}:${slot}` : `${subscriptionId}:${period}`
}

export function matchesLegacySlot(sub: Subscription, rec: Recurrence): boolean {
  return (
    resolveCadence(rec.cadence) === resolveCadence(sub.cadence) &&
    rec.month === sub.month &&
    rec.day === sub.day &&
    rec.hour === sub.hour &&
    rec.minute === sub.minute &&
    Boolean(rec.fromEnd) === Boolean(sub.fromEnd)
  )
}

export function periodOf(cadence: SubscriptionCadence, date: Date): string {
  if (cadence === 'yearly') return String(date.getFullYear())
  if (cadence === 'weekly') return localDayKey(weekSunday(date))
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function nextPeriod(cadence: SubscriptionCadence, period: string): string {
  if (cadence === 'yearly') return String(Number(period) + 1)
  if (cadence === 'weekly') {
    const [year, month, day] = period.split('-').map(Number)
    return localDayKey(new Date(year, month - 1, day + 7))
  }
  return shiftMonth(period, 1)
}

export function occurrenceAt(rec: Recurrence, period: string): Date {
  const hour = clampInt(rec.hour, 0, 23)
  const minute = clampInt(rec.minute, 0, 59)
  if (rec.cadence === 'yearly') {
    return localDate(Number(period), rec.month, rec.day, hour, minute)
  }
  if (rec.cadence === 'weekly') {
    const [year, month, day] = period.split('-').map(Number)
    const weekday = ((Math.trunc(rec.day) % 7) + 7) % 7
    return new Date(year, month - 1, day + weekday, hour, minute, 0, 0)
  }
  const [year, month] = period.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  const n = Math.min(Math.max(Math.trunc(rec.day) || 1, 1), 31)
  const date = rec.fromEnd ? Math.max(1, last - (n - 1)) : Math.min(n, last)
  return new Date(year, month - 1, date, hour, minute, 0, 0)
}

export function duePeriods(rec: Recurrence, startsAt: Date, now: Date): string[] {
  const startMs = startOfLocalDay(startsAt).getTime()
  const periods: string[] = []
  let period = periodOf(rec.cadence, startsAt)
  for (let i = 0; i < catchUpLimit(rec.cadence); i++) {
    const at = occurrenceAt(rec, period)
    if (at.getTime() > now.getTime()) break
    if (at.getTime() >= startMs) periods.push(period)
    period = nextPeriod(rec.cadence, period)
  }
  return periods
}

export function nextOccurrence(rec: Recurrence, startsAt: Date, now: Date): Date {
  const startMs = startOfLocalDay(startsAt).getTime()
  let period = periodOf(rec.cadence, startsAt.getTime() > now.getTime() ? startsAt : now)
  for (let i = 0; i < catchUpLimit(rec.cadence) + 1; i++) {
    const at = occurrenceAt(rec, period)
    if (at.getTime() >= now.getTime() && at.getTime() >= startMs) return at
    period = nextPeriod(rec.cadence, period)
  }
  return occurrenceAt(rec, period)
}

export function nextOccurrenceOf(sub: Subscription, startsAt: Date, now: Date): Date {
  const recs = recurrencesOf(sub)
  let soonest: Date | null = null
  for (const rec of recs) {
    const at = nextOccurrence(rec, startsAt, now)
    if (!soonest || at.getTime() < soonest.getTime()) soonest = at
  }
  return soonest ?? now
}

function catchUpLimit(cadence: SubscriptionCadence): number {
  if (cadence === 'weekly') return 53
  if (cadence === 'yearly') return 10
  return 36
}

function weekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function localDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const last = new Date(year, month, 0).getDate()
  const d = Math.min(Math.max(Math.trunc(day) || 1, 1), last)
  const mo = Math.min(Math.max(Math.trunc(month) || 1, 1), 12)
  return new Date(year, mo - 1, d, hour, minute, 0, 0)
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value) || 0))
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
