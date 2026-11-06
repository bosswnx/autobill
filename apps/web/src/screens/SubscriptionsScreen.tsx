import type { Book, Subscription, Tag } from '@tagledger/shared'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { TagChip } from '../components/TagChip'
import { fireDueSubscriptions } from '../db/fireSubscriptions'
import { useI18n } from '../i18n'
import { entryTitle } from '../lib/entryTitle'
import { formatYuan } from '../lib/money'
import { firstSortedTagName, sortByUsage } from '../lib/tags'
import { formatCompactDate, formatMonthShort, toDateInput } from '../lib/time'
import { nextOccurrenceOf, timesOf, type TimeSlot } from '../lib/subscriptionSchedule'

import { SubscriptionSheet } from './SubscriptionSheet'

type Props = {
  book: Book
  tags: Tag[]
  usage: Record<string, number>
  subscriptions: Subscription[]
}

export function SubscriptionsScreen({ book, tags, usage, subscriptions }: Props) {
  const { t } = useI18n()
  const [editing, setEditing] = useState<Subscription | null | 'new'>(null)
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setEditing('new')}
          aria-label={t.sub.add}
          className="flex size-8 items-center justify-center rounded-md bg-field text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>
      </div>

      {subscriptions.length === 0 ? (
        <div className="px-2 py-16 text-center">
          <p className="text-base font-medium">{t.sub.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.sub.emptyHint}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {subscriptions.map((sub) => {
            const subTags = sortByUsage(
              sub.tagIds.map((id) => tagMap.get(id)).filter((tag): tag is Tag => Boolean(tag)),
              usage,
            )
            const title = entryTitle(sub.note, sub.type, firstSortedTagName(sub.tagIds, tags, usage))
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setEditing(sub)}
                className={`flex w-full items-start justify-between gap-3 rounded-lg border border-line-strong bg-page px-3.5 py-3 text-left transition-colors duration-150 hover:bg-hover ${
                  sub.enabled ? '' : 'opacity-55'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base md:text-sm">{title}</span>
                    {!sub.enabled ? <span className="shrink-0 text-xs text-faint">{t.sub.paused}</span> : null}
                  </div>
                  {subTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {subTags.map((tag) => (
                        <TagChip key={tag.id} tag={tag} size="sm" />
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-faint">{scheduleLabel(sub, t)}</div>
                  {sub.enabled ? (
                    <div className="mt-0.5 text-xs text-faint">{t.sub.next(nextLabel(sub))}</div>
                  ) : null}
                </div>
                <div
                  className={`shrink-0 text-sm font-medium tabular-nums ${
                    sub.type === 'income' ? 'text-income' : 'text-expense'
                  }`}
                >
                  {sub.type === 'income'
                    ? formatYuan(sub.amountCents, { sign: 'always' })
                    : formatYuan(-sub.amountCents)}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {editing === 'new' && (
        <SubscriptionSheet
          book={book}
          tags={tags}
          usage={usage}
          onClose={() => setEditing(null)}
          onSaved={() => void fireDueSubscriptions()}
        />
      )}
      {editing && editing !== 'new' && (
        <SubscriptionSheet
          book={book}
          tags={tags}
          usage={usage}
          subscription={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void fireDueSubscriptions()}
        />
      )}
    </div>
  )
}

function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function timeSlotLabel(slot: TimeSlot, t: ReturnType<typeof useI18n>['t']): string {
  const time = hhmm(slot.hour, slot.minute)
  const prefix =
    slot.cadence === 'yearly' ? t.sub.yearly : slot.cadence === 'weekly' ? t.sub.weekly : t.sub.monthly
  if (slot.cadence === 'yearly') return `${prefix} ${t.sub.monthDayLabel(formatMonthShort(slot.month), slot.day)} ${time}`
  if (slot.cadence === 'weekly') return `${prefix} ${t.sub.weekdayName(slot.day)} ${time}`
  if (slot.fromEnd) return `${prefix} ${t.sub.lastNthDay(slot.day)} ${time}`
  return `${prefix} ${t.sub.nthDay(slot.day)} ${time}`
}

function scheduleLabel(sub: Subscription, t: ReturnType<typeof useI18n>['t']): string {
  return timesOf(sub)
    .map((slot) => timeSlotLabel(slot, t))
    .join(' · ')
}

function nextLabel(sub: Subscription): string {
  const next = nextOccurrenceOf(sub, new Date(sub.startsAt || sub.createdAt), new Date())
  return `${formatCompactDate(toDateInput(next.toISOString()))} ${hhmm(next.getHours(), next.getMinutes())}`
}
