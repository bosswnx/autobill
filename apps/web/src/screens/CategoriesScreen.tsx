import type { Category, Entry, TagKind } from '@autobill/shared'
import { TAG_COLOR_PALETTE } from '@autobill/shared'
import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { ColorPicker } from '../components/ColorPicker'
import { IconPicker } from '../components/IconPicker'
import { Overlay } from '../components/Overlay'
import { resolveTagIcon, TagIcon } from '../components/TagIcon'
import { createCategory, deleteCategory, updateCategory } from '../db/mutations'
import { useBookEntries } from '../hooks/useLedger'
import { useI18n } from '../i18n'
import { categoryChildren, categoryColor } from '../lib/categories'
import { formatYuan } from '../lib/money'
import { inMonth, monthKey } from '../lib/time'

type Props = {
  bookId: string
  categories: Category[]
  usage: Record<string, number>
  onFilterCategory: (id: string) => void
}

type Editing = {
  category?: Category
  kind: TagKind
  parentId: string | null
}

type SortKey = 'amount' | 'name'

type Totals = {
  cents: number
  count: number
}

export function CategoriesScreen({ bookId, categories, usage, onFilterCategory }: Props) {
  const { t } = useI18n()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [sort, setSort] = useState<SortKey>('amount')
  const entries = useBookEntries(bookId)
  const month = monthKey()
  const monthEntries = entries.filter((entry) => inMonth(entry.occurredAt, month))
  const totals = buildTotals(monthEntries, categories)

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-end gap-2 text-xs text-muted">
        <span>{t.categories.sortBy}</span>
        <SortButton active={sort === 'amount'} onClick={() => setSort('amount')}>
          {t.categories.sortAmount}
        </SortButton>
        <SortButton active={sort === 'name'} onClick={() => setSort('name')}>
          {t.categories.sortName}
        </SortButton>
      </div>

      {(['expense', 'income'] as const).map((kind) => {
        const roots = sortCategories(
          categoryChildren(categories, null).filter((category) => category.kind === kind),
          totals,
          sort,
        )
        const kindEntries = monthEntries.filter((entry) => entry.type === kind)
        const totalCents = kindEntries.reduce((sum, entry) => sum + entry.amountCents, 0)
        const uncategorized = kindEntries.filter((entry) => !entry.categoryId)
        const uncategorizedCents = uncategorized.reduce(
          (sum, entry) => sum + entry.amountCents,
          0,
        )

        return (
          <section key={kind} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-sm font-medium">{t.tagKind[kind]}</h2>
              <span className="text-xs tabular-nums text-faint">
                {t.categories.thisMonth} {formatYuan(totalCents, { sign: 'never' })} ·{' '}
                {t.categories.entryCount(kindEntries.length)}
              </span>
              <button
                type="button"
                onClick={() => setEditing({ kind, parentId: null })}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                <Plus size={13} strokeWidth={1.75} />
                {t.categories.add}
              </button>
            </div>

            {roots.length === 0 && uncategorized.length === 0 ? (
              <p className="px-1 py-4 text-sm text-muted">{t.categories.empty}</p>
            ) : (
              <div className="flex flex-col">
                {roots.map((root) => {
                  const children = sortCategories(
                    categoryChildren(categories, root.id),
                    totals,
                    sort,
                  )
                  const total = totals.get(root.id)
                  return (
                    <div key={root.id} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({ category: root, kind, parentId: null })
                        }
                        className="flex w-full items-center gap-2 border-b border-line px-1 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-hover"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: categoryColor(categories, root) }}
                        />
                        <span className="flex size-4 shrink-0 items-center justify-center text-muted">
                          {root.icon ? <TagIcon name={root.icon} size={14} /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{root.name}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatYuan(total?.cents ?? 0, { sign: 'never' })}
                        </span>
                        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-faint">
                          {t.categories.entryCount(total?.count ?? 0)}
                        </span>
                        <ChevronRight size={14} className="shrink-0 text-faint" />
                      </button>

                      {children.map((child) => {
                        const childTotal = totals.get(child.id)
                        return (
                          <div key={child.id} className="relative">
                            <span
                              aria-hidden
                              className="pointer-events-none absolute bottom-0 left-4 top-0 border-l border-line"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({ category: child, kind, parentId: root.id })
                              }
                              className="flex w-full items-center gap-2 border-b border-line py-2 pl-8 pr-1 text-left text-sm transition-colors duration-150 hover:bg-hover"
                            >
                              <span className="min-w-0 flex-1 truncate">{child.name}</span>
                              <span className="shrink-0 tabular-nums text-muted">
                                {formatYuan(childTotal?.cents ?? 0, { sign: 'never' })}
                              </span>
                              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-faint">
                                {t.categories.entryCount(childTotal?.count ?? 0)}
                              </span>
                              <ChevronRight size={14} className="shrink-0 text-faint" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {uncategorized.length > 0 ? (
                  <div className="flex items-center gap-2 px-1 py-2.5 text-sm text-muted">
                    <span className="size-2 shrink-0 rounded-full bg-faint" />
                    <span className="flex size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {t.categories.uncategorized}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatYuan(uncategorizedCents, { sign: 'never' })}
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-faint">
                      {t.categories.entryCount(uncategorized.length)}
                    </span>
                    <span className="w-3.5 shrink-0" />
                  </div>
                ) : null}
              </div>
            )}
          </section>
        )
      })}

      {editing ? (
        <CategoryForm
          key={editing.category?.id ?? `new:${editing.kind}:${editing.parentId ?? 'root'}`}
          bookId={bookId}
          initial={editing}
          categories={categories}
          usage={usage}
          onClose={() => setEditing(null)}
          onAddChild={(root) => setEditing({ kind: root.kind, parentId: root.id })}
          onView={
            editing.category
              ? () => {
                  onFilterCategory(editing.category!.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 transition-colors duration-150 ${
        active ? 'bg-active text-ink' : 'text-muted hover:bg-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function buildTotals(entries: Entry[], categories: Category[]): Map<string, Totals> {
  const totals = new Map<string, Totals>()
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]))
  const add = (id: string, entry: Entry) => {
    const current = totals.get(id) ?? { cents: 0, count: 0 }
    totals.set(id, {
      cents: current.cents + entry.amountCents,
      count: current.count + 1,
    })
  }
  for (const entry of entries) {
    if (!entry.categoryId) continue
    add(entry.categoryId, entry)
    const parentId = parentOf.get(entry.categoryId)
    if (parentId) add(parentId, entry)
  }
  return totals
}

function sortCategories(
  categories: Category[],
  totals: Map<string, Totals>,
  sort: SortKey,
): Category[] {
  return [...categories].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'zh')
    const byAmount = (totals.get(b.id)?.cents ?? 0) - (totals.get(a.id)?.cents ?? 0)
    return byAmount || a.name.localeCompare(b.name, 'zh')
  })
}

function CategoryForm({
  bookId,
  initial,
  categories,
  usage,
  onClose,
  onAddChild,
  onView,
}: {
  bookId: string
  initial: Editing
  categories: Category[]
  usage: Record<string, number>
  onClose: () => void
  onAddChild: (root: Category) => void
  onView?: () => void
}) {
  const { t } = useI18n()
  const { category } = initial
  const parentId = category?.parentId ?? initial.parentId
  const parent = parentId ? categories.find((item) => item.id === parentId) : undefined
  const isChild = Boolean(parentId)
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(
    parent?.color ?? category?.color ?? nextColor(categories, initial.kind),
  )
  const [icon, setIcon] = useState<string | null>(
    resolveTagIcon(parent?.icon ?? category?.icon ?? null),
  )
  const [picking, setPicking] = useState<null | 'icon' | 'color'>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')

  const children = category ? categoryChildren(categories, category.id) : []
  const subtreeIds = category ? [category.id, ...children.map((child) => child.id)] : []
  const entryCount = subtreeIds.reduce((sum, id) => sum + (usage[id] ?? 0), 0)
  const canAddChild = Boolean(category && category.parentId === null)
  const title = category
    ? t.categories.edit
    : initial.parentId
      ? t.categories.addChild
      : t.categories.add

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t.categories.name)
      return
    }
    setSaving(true)
    setError('')
    try {
      if (category) {
        await updateCategory(
          category.id,
          isChild ? { name: trimmed } : { name: trimmed, color, icon },
        )
      } else {
        await createCategory(bookId, {
          name: trimmed,
          kind: initial.kind,
          parentId: initial.parentId,
          color: parent?.color ?? color,
          icon: parent?.icon ?? icon,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(withEntries: boolean) {
    if (!category) return
    setSaving(true)
    try {
      await deleteCategory(category.id, { withEntries })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Overlay onClose={onClose} className="overlay-pad items-center">
        {(close) => (
          <div
            data-overlay-scroll
            className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{title}</h2>
              {category ? (
                <span className="text-xs text-faint">
                  {t.categories.entryCount(entryCount)}
                </span>
              ) : null}
            </div>

            <label className="mt-4 block text-xs text-faint">{t.categories.name}</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                void submit()
              }}
              placeholder={t.categories.namePlaceholder}
              className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
            />

            {isChild ? null : (
              <div className="mt-4 flex items-start gap-8">
                <div>
                  <div className="text-xs text-faint">{t.categories.icon}</div>
                  <button
                    type="button"
                    onClick={() => setPicking('icon')}
                    className="mt-1 flex size-8 items-center justify-center rounded-md border border-line text-ink transition-colors duration-150 hover:bg-hover"
                    aria-label={t.categories.icon}
                  >
                    {icon ? (
                      <TagIcon name={icon} size={16} />
                    ) : (
                      <span className="text-xs text-faint">{t.common.none}</span>
                    )}
                  </button>
                </div>
                <div>
                  <div className="text-xs text-faint">{t.categories.color}</div>
                  <button
                    type="button"
                    onClick={() => setPicking('color')}
                    className="mt-1 size-8 rounded-full border border-line"
                    style={{ background: color }}
                    aria-label={t.categories.color}
                  />
                </div>
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-expense">{error}</p> : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {category ? (
                  <button
                    type="button"
                    className="rounded-md border border-expense px-3 py-1.5 text-sm text-expense hover:bg-hover"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    {t.common.delete}
                  </button>
                ) : null}
                {canAddChild && category ? (
                  <button
                    type="button"
                    className="rounded-md bg-field px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                    onClick={() => onAddChild(category)}
                  >
                    {t.categories.addChild}
                  </button>
                ) : null}
                {onView ? (
                  <button
                    type="button"
                    className="rounded-md bg-field px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                    onClick={onView}
                  >
                    {t.tags.viewLedger}
                  </button>
                ) : null}
              </div>
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
                  disabled={saving || !name.trim()}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
                  onClick={() => void submit()}
                >
                  {saving ? t.common.saving : t.common.save}
                </button>
              </div>
            </div>
          </div>
        )}
      </Overlay>

      {picking === 'icon' ? (
        <IconPicker value={icon} onClose={() => setPicking(null)} onPick={setIcon} />
      ) : null}
      {picking === 'color' ? (
        <ColorPicker value={color} onClose={() => setPicking(null)} onPick={setColor} />
      ) : null}

      {confirmingDelete && category ? (
        <Overlay
          onClose={() => setConfirmingDelete(false)}
          className="overlay-pad z-[60] items-center"
        >
          {() => (
            <div className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5">
              <h2 className="text-lg font-semibold">{t.categories.deleteTitle}</h2>
              <p className="mt-1 text-sm text-muted">{t.categories.deleteHint}</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void remove(false)}
                  className="rounded-lg border border-line px-3 py-3 text-left transition-colors duration-150 hover:bg-hover disabled:opacity-40"
                >
                  <div className="text-sm font-medium">{t.categories.deleteKeep}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-faint">
                    {t.categories.deleteKeepDetail}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void remove(true)}
                  className="rounded-lg border border-line px-3 py-3 text-left transition-colors duration-150 hover:bg-hover disabled:opacity-40"
                >
                  <div className="text-sm font-medium text-expense">
                    {t.categories.deleteWithEntries}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-faint">
                    {t.categories.deleteWithEntriesDetail(entryCount)}
                  </div>
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="rounded-md bg-field px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}
        </Overlay>
      ) : null}
    </>
  )
}

function nextColor(categories: Category[], kind: TagKind): string {
  const used = new Set(
    categories
      .filter((category) => !category.deletedAt && category.kind === kind)
      .map((category) => category.color),
  )
  return TAG_COLOR_PALETTE.find((color) => !used.has(color)) ?? TAG_COLOR_PALETTE[0]
}
