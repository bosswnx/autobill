import type { Book, Entry, EntryType, Tag } from '@tagledger/shared'
import { ENTRY_TYPE_LABEL } from '@tagledger/shared'
import { useMemo, useState, type ReactNode } from 'react'
import { AmountKeypad } from '../components/AmountKeypad'
import { Overlay } from '../components/Overlay'
import { TagChip } from '../components/TagChip'
import { createEntry, createTag, deleteEntry, updateEntry } from '../db/mutations'
import { amountFromYuan, amountYuan, EMPTY_AMOUNT, type AmountExpr } from '../lib/amountKeypad'
import { entryTitle } from '../lib/entryTitle'
import { centsToYuanInput, yuanToCents } from '../lib/money'
import { firstSortedTagName, sortByUsage, tagsOfKind } from '../lib/tags'
import { fromDateTimeInput, nowIso, toDateInput, toTimeInput } from '../lib/time'

type Props = {
  book: Book
  tags: Tag[]
  usage: Record<string, number>
  entry?: Entry
  onClose: () => void
}

const fieldClass =
  'w-full rounded-md border border-line bg-page px-3 py-2 text-sm hover:bg-hover focus:border-accent'

export function EntrySheet({ book, tags, usage, entry, onClose }: Props) {
  const initial = entry?.occurredAt ?? nowIso()
  const [type, setType] = useState<EntryType>(entry?.type === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState<AmountExpr>(
    entry ? amountFromYuan(centsToYuanInput(entry.amountCents)) : EMPTY_AMOUNT,
  )
  const [tagIds, setTagIds] = useState<string[]>(() => {
    const ids = entry?.tagIds ?? []
    const allowed = new Set(
      tags.filter((tag) => tag.kind === (entry?.type === 'income' ? 'income' : 'expense')).map((tag) => tag.id),
    )
    return ids.filter((id) => allowed.has(id))
  })
  const [note, setNote] = useState(entry?.note ?? '')
  const [date, setDate] = useState(toDateInput(initial))
  const [time, setTime] = useState(toTimeInput(initial))
  const [tagQuery, setTagQuery] = useState('')
  const [tagSearchOpen, setTagSearchOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function save() {
    const yuan = amountYuan(amount)
    if (yuan === null && amount.op) {
      setError('请输入金额')
      return
    }
    const amountCents = yuanToCents(yuan ?? '0')
    if (amountCents === null) {
      setError('请输入金额')
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
      tagIds: tagIds.filter((id) => kindTags.some((tag) => tag.id === id)),
      note: note.trim(),
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
      {(close) => (
      <div className="anim-sheet flex max-h-[92%] w-full max-w-lg flex-col overflow-hidden rounded-t-[20px] bg-page sm:max-h-full sm:rounded-xl sm:border sm:border-line">
        <div className="flex justify-center pt-2 pb-1 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-black/20" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pt-2 sm:pt-4">
          <h2 className="shrink-0 text-lg font-semibold">{entry ? '改一笔' : '记一笔'}</h2>
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <CompactPicker
              type="date"
              value={date}
              display={formatCompactDate(date)}
              ariaLabel="日期"
              onChange={setDate}
            />
            <CompactPicker
              type="time"
              value={time}
              display={time}
              ariaLabel="时间"
              onChange={setTime}
            />
          </div>
        </div>

        <div data-overlay-scroll className="flex-1 overflow-y-auto px-5 py-3">
          <div className="overflow-hidden rounded-md bg-hover p-[3px]">
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
                    const allowed = new Set(tagsOfKind(tags, item).map((tag) => tag.id))
                    setTagIds((current) => current.filter((id) => allowed.has(id)))
                    setTagQuery('')
                  }}
                  className={`relative z-10 py-1.5 text-sm transition-colors duration-200 ${
                    type === item ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {ENTRY_TYPE_LABEL[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-faint">标签</div>
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
                  placeholder="搜索或回车创建"
                  className={fieldClass}
                />
                {tagQuery.trim() && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => void addTagFromQuery()}
                    className="mt-2 text-sm text-accent"
                  >
                    创建 {tagQuery.trim()}
                  </button>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-label="搜索或创建标签"
                aria-expanded={tagSearchOpen}
                onClick={() => {
                  if (tagSearchOpen) setTagQuery('')
                  setTagSearchOpen((open) => !open)
                }}
                className={`flex size-[22px] items-center justify-center rounded transition-colors duration-150 ${
                  tagSearchOpen
                    ? 'bg-[#ebeae6] text-ink'
                    : 'bg-[#f4f3f0] text-muted hover:bg-[#ebeae6] hover:text-ink'
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
          </div>

          <Field label="详细信息（选填）" className="mt-4">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={detailPlaceholder}
              className={fieldClass}
            />
          </Field>

          <div className="mt-4">
            <div className="text-xs text-faint">金额</div>
            <div className="mt-1">
              <AmountKeypad expr={amount} onChange={setAmount} />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-expense">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 pb-[max(0.75rem,var(--sab))]">
          {entry ? (
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-expense hover:bg-hover"
              onClick={async () => {
                await deleteEntry(entry.id)
                close()
              }}
            >
              删除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1">
            <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void save().then((ok) => {
                  if (ok) close()
                })
              }
              className="rounded-md bg-accent px-4 py-1.5 text-sm text-accent-ink hover:brightness-95 disabled:opacity-40"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
      )}
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

function formatCompactDate(value: string): string {
  const [, month, day] = value.split('-')
  if (!month || !day) return value
  return `${Number(month)}月${Number(day)}日`
}

function CompactPicker({
  type,
  value,
  display,
  ariaLabel,
  onChange,
}: {
  type: 'date' | 'time'
  value: string
  display: string
  ariaLabel: string
  onChange: (value: string) => void
}) {
  return (
    <label className="relative inline-flex min-w-0 cursor-pointer items-center overflow-hidden rounded-md bg-[#f4f3f0] px-2 py-1 text-xs text-muted transition-colors duration-150 hover:bg-[#ebeae6] hover:text-ink">
      <span className="pointer-events-none truncate tabular-nums">{display}</span>
      <input
        type={type}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => {
          if (!event.target.value) return
          onChange(event.target.value)
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}
