import type { Book, Category, Entry, EntryType, Tag } from '@autobill/shared'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AmountKeypad } from '../components/AmountKeypad'
import { CompactPicker } from '../components/DateTimePickers'
import { Overlay } from '../components/Overlay'
import { TagChip } from '../components/TagChip'
import { createEntry, createTag, deleteEntry, updateEntry } from '../db/mutations'
import { useI18n } from '../i18n'
import { amountFromYuan, amountYuan, EMPTY_AMOUNT, type AmountExpr } from '../lib/amountKeypad'
import { categoryColor, categoryIcon, flattenCategoryTree } from '../lib/categories'
import { entryTitle } from '../lib/entryTitle'
import { centsToYuanInput, yuanToCents } from '../lib/money'
import { useSwipeToClose } from '../lib/swipeToClose'
import { firstSortedTagName, sortByUsage, tagsOfKind } from '../lib/tags'
import { formatCompactDate, fromDateTimeInput, nowIso, toDateInput, toTimeInput } from '../lib/time'

type Props = {
  book: Book
  tags: Tag[]
  categories: Category[]
  usage: Record<string, number>
  entry?: Entry
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-line bg-page px-3 py-2 text-sm hover:bg-hover focus:border-accent'

export function EntrySheet({ book, tags, categories, usage, entry, onClose }: Props) {
  const { t } = useI18n()
  const initial = entry?.occurredAt ?? nowIso()
  const [type, setType] = useState<EntryType>(entry?.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState<AmountExpr>(
    entry ? amountFromYuan(centsToYuanInput(entry.amountCents)) : EMPTY_AMOUNT,
  )
  const [categoryId, setCategoryId] = useState<string | null>(entry?.categoryId ?? null)
  const [tagIds, setTagIds] = useState<string[]>(() => {
    const ids = entry?.tagIds ?? []
    const allowed = new Set(
      tags.filter((tag) => tag.kind === (entry?.type === 'income' ? 'income' : 'expense')).map((tag) => tag.id),
    )
    return ids.filter((id) => allowed.has(id))
  })
  const [note, setNote] = useState(entry?.note ?? '')
  const [remark, setRemark] = useState(entry?.remark ?? '')
  const [date, setDate] = useState(toDateInput(initial))
  const [time, setTime] = useState(toTimeInput(initial))
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
  const kindCategories = useMemo(
    () => flattenCategoryTree(categories, type === 'income' ? 'income' : 'expense'),
    [categories, type],
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

    setSaving(true)
    setError('')
    const draft = {
      type,
      amountCents,
      currency: book.currency,
      accountId: entry?.accountId ?? '',
      toAccountId: null,
      categoryId,
      tagIds: tagIds.filter((id) => kindTags.some((tag) => tag.id === id)),
      note: note.trim(),
      remark: remark.trim(),
      occurredAt: fromDateTimeInput(date, time),
    }
    try {
      if (entry) await updateEntry(entry.id, draft)
      else await createEntry({ bookId: book.id, ...draft })
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
          <h2 className="shrink-0 text-lg font-semibold">{entry ? t.entry.edit : t.entry.create}</h2>
        </div>

        <div className="flex items-stretch justify-between gap-3 px-5 pt-3">
          <div className="flex min-w-0 items-stretch justify-start gap-1.5">
            <CompactPicker
              type="date"
              value={date}
              display={formatCompactDate(date)}
              ariaLabel={t.entry.date}
              onChange={setDate}
              className="h-full"
            />
            <CompactPicker
              type="time"
              value={time}
              display={time}
              ariaLabel={t.entry.time}
              onChange={setTime}
              className="h-full"
            />
          </div>
          <div className="ml-auto shrink-0 overflow-hidden rounded-md bg-hover p-[3px]">
            <div className="relative grid grid-cols-2">
              <span
                className="pointer-events-none absolute inset-y-0 w-1/2 rounded bg-page transition-transform duration-200 ease-out"
                style={{
                  transform: type === 'income' ? 'translateX(100%)' : 'translateX(0)',
                }}
              />
              {(['expense', 'income'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setType(item)
                    setCategoryId(null)
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
          <div className="text-xs text-faint">{t.categories.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors duration-150 md:text-sm ${
                categoryId === null
                  ? 'bg-active text-ink'
                  : 'text-muted hover:bg-hover hover:text-ink'
              }`}
            >
              {t.categories.none}
            </button>
            {kindCategories.map(({ category, depth }) => (
              <TagChip
                key={category.id}
                tag={
                  depth > 0
                    ? {
                        ...category,
                        name: `· ${category.name}`,
                        color: categoryColor(categories, category),
                        icon: categoryIcon(categories, category) ?? null,
                      }
                    : category
                }
                active={categoryId === category.id}
                onClick={() =>
                  setCategoryId(categoryId === category.id ? null : category.id)
                }
              />
            ))}
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

          <Field label={t.entry.remark} className="mt-4">
            <input
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder={t.entry.remarkPlaceholder}
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
          {entry ? (
            <button
              type="button"
              className="rounded-md border border-expense px-3 py-1.5 text-sm text-expense hover:bg-hover"
              onClick={async () => {
                await deleteEntry(entry.id)
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
