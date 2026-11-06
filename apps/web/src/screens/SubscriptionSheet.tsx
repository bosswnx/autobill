import type { Book, Subscription, SubscriptionCadence, Tag } from '@tagbill/shared'
import { Plus } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AmountKeypad } from '../components/AmountKeypad'
import { calendarGridStyle, CompactPicker } from '../components/DateTimePickers'
import { Overlay } from '../components/Overlay'
import { TagChip } from '../components/TagChip'
import { createSubscription, createTag, deleteSubscription, updateSubscription } from '../db/mutations'
import { useI18n } from '../i18n'
import { amountFromYuan, amountYuan, EMPTY_AMOUNT, type AmountExpr } from '../lib/amountKeypad'
import { entryTitle } from '../lib/entryTitle'
import { nid } from '../lib/id'
import { centsToYuanInput, yuanToCents } from '../lib/money'
import { timesOf, type TimeSlot } from '../lib/subscriptionSchedule'
import { useSwipeToClose } from '../lib/swipeToClose'
import { firstSortedTagName, sortByUsage, tagsOfKind } from '../lib/tags'
import { daysInMonth, formatMonthShort, formatMonthYear } from '../lib/time'

type Props = {
  book: Book
  tags: Tag[]
  usage: Record<string, number>
  subscription?: Subscription
  onClose: () => void
  onSaved: () => void
}

type Picking = null | 'day' | 'monthDay' | 'weekday'

const fieldClass =
  'w-full rounded-md border border-line bg-page px-3 py-2 text-sm hover:bg-hover focus:border-accent'

const pickerBtnClass =
  'inline-flex h-[38px] min-w-0 items-center rounded-md bg-field px-3 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink'

function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number)
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

function defaultSlot(cadence: SubscriptionCadence, now: Date): TimeSlot {
  return {
    id: nid(),
    cadence,
    month: now.getMonth() + 1,
    day: cadence === 'weekly' ? now.getDay() : now.getDate(),
    fromEnd: false,
    hour: now.getHours(),
    minute: now.getMinutes(),
  }
}

function adaptSlot(next: SubscriptionCadence, prev: SubscriptionCadence, slot: TimeSlot, now: Date): TimeSlot {
  if (next === 'weekly') {
    return {
      ...slot,
      cadence: next,
      fromEnd: false,
      day: prev === 'weekly' && slot.day <= 6 ? slot.day : now.getDay(),
    }
  }
  if (prev === 'weekly') {
    return { ...slot, cadence: next, fromEnd: false, day: now.getDate() }
  }
  if (next !== 'monthly') return { ...slot, cadence: next, fromEnd: false }
  return { ...slot, cadence: next }
}

function cadenceLabel(cadence: SubscriptionCadence, t: ReturnType<typeof useI18n>['t']): string {
  if (cadence === 'yearly') return t.sub.yearly
  if (cadence === 'weekly') return t.sub.weekly
  return t.sub.monthly
}

function timeSlotLabel(slot: TimeSlot, t: ReturnType<typeof useI18n>['t']): string {
  const time = hhmm(slot.hour, slot.minute)
  const prefix = cadenceLabel(slot.cadence, t)
  if (slot.cadence === 'weekly') return `${prefix} ${t.sub.weekdayName(slot.day)} ${time}`
  if (slot.cadence === 'yearly') return `${prefix} ${t.sub.monthDayLabel(formatMonthShort(slot.month), slot.day)} ${time}`
  if (slot.fromEnd) return `${prefix} ${t.sub.lastNthDay(slot.day)} ${time}`
  return `${prefix} ${t.sub.nthDay(slot.day)} ${time}`
}

function sameClock(a: TimeSlot, b: TimeSlot): boolean {
  return (
    a.cadence === b.cadence &&
    a.month === b.month &&
    a.day === b.day &&
    Boolean(a.fromEnd) === Boolean(b.fromEnd) &&
    a.hour === b.hour &&
    a.minute === b.minute
  )
}

export function SubscriptionSheet({ book, tags, usage, subscription, onClose, onSaved }: Props) {
  const { t } = useI18n()
  const now = new Date()
  const [type, setType] = useState<'expense' | 'income'>(subscription?.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState<AmountExpr>(
    subscription ? amountFromYuan(centsToYuanInput(subscription.amountCents)) : EMPTY_AMOUNT,
  )
  const [tagIds, setTagIds] = useState<string[]>(() => {
    const ids = subscription?.tagIds ?? []
    const allowed = new Set(
      tags.filter((tag) => tag.kind === (subscription?.type === 'income' ? 'income' : 'expense')).map((tag) => tag.id),
    )
    return ids.filter((id) => allowed.has(id))
  })
  const [note, setNote] = useState(subscription?.note ?? '')
  const [times, setTimes] = useState<TimeSlot[]>(() =>
    subscription ? timesOf(subscription) : [defaultSlot('monthly', now)],
  )
  const [enabled, setEnabled] = useState(subscription?.enabled ?? true)
  const [editingTime, setEditingTime] = useState<TimeSlot | 'new' | null>(null)
  const [tagQuery, setTagQuery] = useState('')
  const [tagSearchOpen, setTagSearchOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<() => void>(() => {})
  const swipe = useSwipeToClose(() => closeRef.current())

  const kindTags = useMemo(
    () => sortByUsage(tagsOfKind(tags, type === 'income' ? 'income' : 'expense'), usage),
    [tags, usage, type],
  )
  const visibleTags = useMemo(() => {
    const needle = tagQuery.trim().toLowerCase()
    if (!needle) return kindTags
    return kindTags.filter((tag) => tag.name.toLowerCase().includes(needle))
  }, [kindTags, tagQuery])

  const exactMatch = kindTags.some((tag) => tag.name === tagQuery.trim())
  const detailPlaceholder = entryTitle('', type, firstSortedTagName(tagIds, kindTags, usage))
  const yuan = amountYuan(amount)
  const amountCents = yuan === null ? (amount.op ? null : yuanToCents('0')) : yuanToCents(yuan)
  const amountNegative = amountCents !== null && amountCents < 0

  function upsertTime(slot: TimeSlot) {
    setTimes((rows) => {
      const existing = rows.findIndex((row) => row.id === slot.id)
      if (existing >= 0) {
        const next = [...rows]
        next[existing] = slot
        return next
      }
      if (rows.some((row) => sameClock(row, slot))) return rows
      return [...rows, slot]
    })
  }

  async function save() {
    if (amountNegative) {
      setError(t.entry.amountNegative)
      return
    }
    if (yuan === null && amount.op) {
      setError(t.entry.amountRequired)
      return
    }
    if (amountCents === null) {
      setError(t.entry.amountRequired)
      return
    }
    if (times.length === 0) {
      setError(t.sub.timeRequired)
      return
    }

    setSaving(true)
    setError('')
    const draft = {
      type,
      amountCents,
      currency: book.currency,
      tagIds: tagIds.filter((id) => kindTags.some((tag) => tag.id === id)),
      note: note.trim(),
      times,
      enabled,
    }
    try {
      if (subscription) await updateSubscription(subscription.id, draft)
      else await createSubscription({ bookId: book.id, ...draft })
      onSaved()
      return true
    } finally {
      setSaving(false)
    }
  }

  async function addTagFromQuery() {
    const name = tagQuery.trim()
    if (!name) return
    const tag = await createTag(book.id, name, undefined, null, type === 'income' ? 'income' : 'expense')
    setTagIds((current) => (current.includes(tag.id) ? current : [...current, tag.id]))
    setTagQuery('')
  }

  return (
    <>
    <Overlay onClose={onClose} exitMs={320} className="items-end sm:items-center sm:overlay-pad">
      {(close) => {
        closeRef.current = close
        return (
          <div
            ref={swipe.sheetRef}
            {...swipe.pointerProps}
            className="anim-sheet flex max-h-[92%] w-full max-w-lg touch-pan-y flex-col overflow-hidden rounded-t-[20px] bg-page sm:max-h-full sm:rounded-xl sm:border sm:border-line"
          >
            <div className="flex justify-center pt-2 pb-1 sm:hidden" aria-hidden>
              <span className="h-1 w-9 rounded-full bg-handle" />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 pt-2 sm:pt-4">
              <h2 className="shrink-0 text-lg font-semibold">{subscription ? t.sub.edit : t.sub.add}</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">{enabled ? t.sub.enabled : t.sub.disabled}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={enabled ? t.sub.enabled : t.sub.disabled}
                  onClick={() => setEnabled((value) => !value)}
                  className={`relative h-6 w-10 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors duration-150 ${
                    enabled ? 'bg-accent' : 'bg-switch-off'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-knob shadow-sm ${
                      enabled ? 'right-0.5 left-auto' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-stretch justify-start px-5 pt-3">
              <div className="shrink-0 overflow-hidden rounded-md bg-hover p-[3px]">
                <div className="relative grid grid-cols-2">
                  <span
                    className="pointer-events-none absolute inset-y-0 w-1/2 rounded bg-page transition-transform duration-200 ease-out"
                    style={{ transform: type === 'income' ? 'translateX(100%)' : 'translateX(0)' }}
                  />
                  {(['expense', 'income'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setType(item)
                        const allowed = new Set(tagsOfKind(tags, item).map((tag) => tag.id))
                        setTagIds((current) => current.filter((id) => allowed.has(id)))
                        setTagQuery('')
                      }}
                      className={`relative z-10 whitespace-nowrap px-3 py-1.5 text-sm transition-colors duration-200 ${
                        type === item ? 'text-ink' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {t.entryType[item]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div data-overlay-scroll className="flex-1 overflow-y-auto px-5 py-3">
              <div className="text-xs text-faint">{t.sub.times}</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {times.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setEditingTime(slot)}
                    className="flex h-[38px] items-center justify-between rounded-md bg-field px-3 text-left text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                  >
                    <span className="truncate tabular-nums">{timeSlotLabel(slot, t)}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditingTime('new')}
                  className="flex h-[38px] items-center justify-center gap-1.5 rounded-md bg-field px-3 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  {t.sub.addTime}
                </button>
              </div>

              <div className="mt-4 text-xs text-faint">{t.entry.tags}</div>
              {tagSearchOpen && (
                <div className="anim-page mt-2">
                  <input
                    autoFocus
                    value={tagQuery}
                    onChange={(event) => setTagQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addTagFromQuery()
                      }
                      if (event.key === 'Escape') {
                        setTagSearchOpen(false)
                        setTagQuery('')
                      }
                    }}
                    placeholder={t.entry.tagSearchPlaceholder}
                    className={fieldClass}
                  />
                  {tagQuery.trim() && !exactMatch && (
                    <button
                      type="button"
                      onClick={() => void addTagFromQuery()}
                      className="mt-2 inline-flex h-[22px] items-center rounded bg-field px-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                    >
                      {t.entry.createNamed(tagQuery.trim())}
                    </button>
                  )}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-label={t.entry.tagSearchAria}
                  aria-expanded={tagSearchOpen}
                  onClick={() => {
                    if (tagSearchOpen) setTagQuery('')
                    setTagSearchOpen((open) => !open)
                  }}
                  className={`flex size-[22px] items-center justify-center rounded transition-colors duration-150 ${
                    tagSearchOpen
                      ? 'bg-field-hover text-ink'
                      : 'bg-field text-muted hover:bg-field-hover hover:text-ink'
                  }`}
                >
                  <SearchIcon />
                </button>
                {visibleTags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    tag={tag}
                    active={tagIds.includes(tag.id)}
                    onClick={() =>
                      setTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((id) => id !== tag.id)
                          : [...current, tag.id],
                      )
                    }
                  />
                ))}
              </div>

              <Field label={t.entry.note} className="mt-4">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={detailPlaceholder}
                  className={fieldClass}
                />
              </Field>

              <div className="mt-4">
                <div className="text-xs text-faint">{t.entry.amount}</div>
                <div className="mt-1">
                  <AmountKeypad expr={amount} onChange={setAmount} />
                </div>
              </div>

              {error && !amountNegative ? (
                <p className="mt-4 text-sm text-expense">{error}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,var(--sab))]">
              {subscription ? (
                <button
                  type="button"
                  className="rounded-md border border-expense px-3 py-1.5 text-sm text-expense hover:bg-hover"
                  onClick={async () => {
                    await deleteSubscription(subscription.id)
                    close()
                  }}
                >
                  {t.common.delete}
                </button>
              ) : (
                <span />
              )}
              <div className="relative flex gap-1">
                {amountNegative ? (
                  <p className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap text-sm text-expense">
                    {t.entry.amountNegative}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="rounded-md bg-field px-4 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                  onClick={close}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  disabled={saving || amountNegative}
                  onClick={() =>
                    void save().then((ok) => {
                      if (ok) close()
                    })
                  }
                  className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95 disabled:opacity-40"
                >
                  {saving ? t.common.saving : t.common.save}
                </button>
              </div>
            </div>
          </div>
        )
      }}
    </Overlay>
      {editingTime && (
        <TimeEditorOverlay
          initial={editingTime === 'new' ? defaultSlot('monthly', now) : editingTime}
          isNew={editingTime === 'new'}
          onClose={() => setEditingTime(null)}
          onSave={(slot) => {
            upsertTime(slot)
          }}
          onDelete={
            editingTime === 'new'
              ? undefined
              : () => {
                  setTimes((rows) => rows.filter((row) => row.id !== editingTime.id))
                  setEditingTime(null)
                }
          }
        />
      )}
    </>
  )
}

function TimeEditorOverlay({
  initial,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  initial: TimeSlot
  isNew: boolean
  onClose: () => void
  onSave: (slot: TimeSlot) => void
  onDelete?: () => void
}) {
  const { t } = useI18n()
  const now = new Date()
  const [cadence, setCadence] = useState<SubscriptionCadence>(initial.cadence)
  const [month, setMonth] = useState(initial.month)
  const [day, setDay] = useState(initial.day)
  const [fromEnd, setFromEnd] = useState(Boolean(initial.fromEnd))
  const [time, setTime] = useState(hhmm(initial.hour, initial.minute))
  const [picking, setPicking] = useState<Picking>(null)

  const dayButtonLabel =
    cadence === 'weekly' ? t.sub.weekdayName(day) : t.sub.monthDayLabel(formatMonthShort(month), day)

  function changeCadence(next: SubscriptionCadence) {
    if (next === cadence) return
    setPicking(null)
    const adapted = adaptSlot(next, cadence, {
      ...initial,
      cadence,
      month,
      day,
      fromEnd,
    }, now)
    setCadence(next)
    setDay(adapted.day)
    setFromEnd(adapted.fromEnd)
  }

  function confirm() {
    const clock = parseTime(time)
    onSave({
      ...initial,
      cadence,
      month,
      day,
      fromEnd: cadence === 'monthly' && fromEnd,
      hour: clock.hour,
      minute: clock.minute,
    })
  }

  return (
    <>
      <Overlay onClose={onClose} className="overlay-pad z-[60] items-center">
        {(close) => (
          <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
            <h2 className="text-lg font-semibold">{isNew ? t.sub.addTime : t.sub.editTime}</h2>
            <div className="mt-4">
              <Segmented
                value={cadence}
                options={[
                  { id: 'weekly', label: t.sub.weekly },
                  { id: 'monthly', label: t.sub.monthly },
                  { id: 'yearly', label: t.sub.yearly },
                ]}
                onChange={changeCadence}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-stretch justify-start gap-1.5">
              {cadence === 'monthly' ? (
                <Segmented
                  value={fromEnd ? 'end' : 'start'}
                  options={[
                    { id: 'start', label: t.sub.fromStart },
                    { id: 'end', label: t.sub.fromEnd },
                  ]}
                  onChange={(next) => setFromEnd(next === 'end')}
                />
              ) : null}
              {cadence === 'monthly' ? (
                <div className="flex min-w-0 items-stretch gap-1">
                  {t.sub.nthPrefix ? (
                    <span className="self-center text-sm text-muted">{t.sub.nthPrefix}</span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t.sub.pickDay}
                    onClick={() => setPicking('day')}
                    className={pickerBtnClass}
                  >
                    <span className="tabular-nums">{day}</span>
                  </button>
                  {t.sub.nthSuffix ? (
                    <span className="self-center text-sm text-muted">{t.sub.nthSuffix}</span>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={cadence === 'weekly' ? t.sub.pickWeekday : t.sub.pickDay}
                  onClick={() => setPicking(cadence === 'weekly' ? 'weekday' : 'monthDay')}
                  className={pickerBtnClass}
                >
                  {dayButtonLabel}
                </button>
              )}
              <CompactPicker
                type="time"
                value={time}
                display={time}
                ariaLabel={t.entry.time}
                onChange={setTime}
                className="h-[38px]"
                overlayClassName="overlay-pad z-[70] items-center"
              />
            </div>
            <div className={`mt-6 flex items-center ${onDelete ? 'justify-between' : 'justify-end'}`}>
              {onDelete ? (
                <button
                  type="button"
                  className="rounded-md border border-expense px-3 py-1.5 text-sm text-expense hover:bg-hover"
                  onClick={onDelete}
                >
                  {t.common.delete}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded-md bg-field px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                  onClick={close}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink hover:brightness-95"
                  onClick={() => {
                    confirm()
                    close()
                  }}
                >
                  {t.common.confirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </Overlay>
      {picking === 'day' && (
        <DayPickerOverlay
          value={day}
          title={fromEnd ? t.sub.fromEnd : t.sub.fromStart}
          overlayClassName="overlay-pad z-[70] items-center"
          onClose={() => setPicking(null)}
          onPick={(next) => {
            setDay(next)
            setPicking(null)
          }}
        />
      )}
      {picking === 'monthDay' && (
        <MonthDayPickerOverlay
          month={month}
          day={day}
          overlayClassName="overlay-pad z-[70] items-center"
          onClose={() => setPicking(null)}
          onPick={(nextMonth, nextDay) => {
            setMonth(nextMonth)
            setDay(nextDay)
            setPicking(null)
          }}
        />
      )}
      {picking === 'weekday' && (
        <WeekdayPickerOverlay
          value={day}
          overlayClassName="overlay-pad z-[70] items-center"
          onClose={() => setPicking(null)}
          onPick={(next) => {
            setDay(next)
            setPicking(null)
          }}
        />
      )}
    </>
  )
}

function DayPickerOverlay({
  value,
  title,
  overlayClassName = 'overlay-pad z-[60] items-center',
  onClose,
  onPick,
}: {
  value: number
  title: string
  overlayClassName?: string
  onClose: () => void
  onPick: (day: number) => void
}) {
  const { t } = useI18n()
  const [picked, setPicked] = useState(value)
  return (
    <Overlay onClose={onClose} className={overlayClassName}>
      {(close) => (
        <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: 31 }, (_, index) => {
              const day = index + 1
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setPicked(day)}
                  className={`rounded py-1.5 text-sm tabular-nums transition-colors duration-150 ${
                    day === picked ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-5 flex justify-end gap-1">
            <button
              type="button"
              className="rounded-md bg-field px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-field-hover"
              onClick={close}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95"
              onClick={() => {
                onPick(picked)
                close()
              }}
            >
              {t.common.confirm}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

function MonthDayPickerOverlay({
  month,
  day,
  overlayClassName = 'overlay-pad z-[60] items-center',
  onClose,
  onPick,
}: {
  month: number
  day: number
  overlayClassName?: string
  onClose: () => void
  onPick: (month: number, day: number) => void
}) {
  const { t } = useI18n()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(month)
  const [pickedMonth, setPickedMonth] = useState(month)
  const [pickedDay, setPickedDay] = useState(day)
  const days = daysInMonth(`${viewYear}-${String(viewMonth).padStart(2, '0')}`)
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay()

  function shift(delta: number) {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth() + 1)
  }

  return (
    <Overlay onClose={onClose} className={overlayClassName}>
      {(close) => (
        <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
          <h2 className="text-lg font-semibold">{t.sub.pickMonthDay}</h2>
          <div className="mt-4 mb-2 flex items-center justify-between">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
              onClick={() => shift(-1)}
              aria-label={t.pickers.prevMonth}
            >
              ‹
            </button>
            <div className="text-sm font-semibold tabular-nums">{formatMonthYear(viewYear, viewMonth)}</div>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded text-lg text-muted hover:bg-hover"
              onClick={() => shift(1)}
              aria-label={t.pickers.nextMonth}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {t.pickers.weekdays.map((item) => (
              <div key={item} className="py-1 text-[11px] text-faint">
                {item}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-x-1 text-center" style={calendarGridStyle(firstWeekday, days)}>
            {Array.from({ length: firstWeekday }, (_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const value = index + 1
              const active = viewMonth === pickedMonth && value === pickedDay
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPickedMonth(viewMonth)
                    setPickedDay(value)
                  }}
                  className={`flex h-full w-full items-center justify-center rounded text-sm tabular-nums transition-colors duration-150 ${
                    active ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                  }`}
                >
                  {value}
                </button>
              )
            })}
          </div>
          <div className="mt-5 flex justify-end gap-1">
            <button
              type="button"
              className="rounded-md bg-field px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-field-hover"
              onClick={close}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95"
              onClick={() => {
                onPick(pickedMonth, pickedDay)
                close()
              }}
            >
              {t.common.confirm}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

function WeekdayPickerOverlay({
  value,
  overlayClassName = 'overlay-pad z-[60] items-center',
  onClose,
  onPick,
}: {
  value: number
  overlayClassName?: string
  onClose: () => void
  onPick: (day: number) => void
}) {
  const { t } = useI18n()
  const [picked, setPicked] = useState(value)
  return (
    <Overlay onClose={onClose} className={overlayClassName}>
      {(close) => (
        <div className="anim-panel w-full max-w-sm rounded-xl border border-line bg-page p-5">
          <h2 className="text-lg font-semibold">{t.sub.pickWeekday}</h2>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: 7 }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPicked(index)}
                className={`rounded py-2 text-sm transition-colors duration-150 ${
                  index === picked ? 'bg-accent text-accent-ink' : 'text-ink hover:bg-hover'
                }`}
              >
                {t.pickers.weekdays[index]}
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-1">
            <button
              type="button"
              className="rounded-md bg-field px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:bg-field-hover"
              onClick={close}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95"
              onClick={() => {
                onPick(picked)
                close()
              }}
            >
              {t.common.confirm}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  )
  return (
    <div className="overflow-hidden rounded-md bg-hover p-[3px]">
      <div
        className="relative"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <span
          className="pointer-events-none absolute inset-y-0 rounded bg-page transition-transform duration-200 ease-out"
          style={{
            width: `${100 / options.length}%`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative z-10 whitespace-nowrap px-2.5 py-1.5 text-sm transition-colors duration-200 ${
              value === option.id ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`block min-w-0 ${className ?? ''}`}>
      <span className="block text-xs text-faint">{label}</span>
      <div className="mt-1 min-w-0 overflow-hidden">{children}</div>
    </label>
  )
}
