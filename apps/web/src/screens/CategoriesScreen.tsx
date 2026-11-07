import type { Category, TagKind } from '@autobill/shared'
import { TAG_COLOR_PALETTE } from '@autobill/shared'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ColorPicker } from '../components/ColorPicker'
import { IconPicker } from '../components/IconPicker'
import { Overlay } from '../components/Overlay'
import { TagChip } from '../components/TagChip'
import { resolveTagIcon, TagIcon } from '../components/TagIcon'
import { createCategory, deleteCategory, updateCategory } from '../db/mutations'
import { useI18n } from '../i18n'
import { categoryChildren } from '../lib/categories'

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

export function CategoriesScreen({ bookId, categories, usage, onFilterCategory }: Props) {
  const { t } = useI18n()
  const [editing, setEditing] = useState<Editing | null>(null)
  const roots = categoryChildren(categories, null)

  return (
    <div className="flex flex-col gap-8">
      {(['expense', 'income'] as const).map((kind) => {
        const group = roots.filter((category) => category.kind === kind)
        return (
          <section key={kind} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">{t.tagKind[kind]}</h2>
              <button
                type="button"
                aria-label={t.categories.add}
                onClick={() => setEditing({ kind, parentId: null })}
                className="flex size-[22px] items-center justify-center rounded bg-field text-muted transition-colors duration-150 hover:bg-field-hover hover:text-ink"
              >
                <Plus size={14} strokeWidth={1.5} />
              </button>
            </div>
            {group.length === 0 ? (
              <p className="text-sm text-muted">{t.categories.empty}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {group.map((root) => {
                  const children = categoryChildren(categories, root.id)
                  return (
                    <div key={root.id} className="flex flex-col gap-1.5">
                      <div>
                        <TagChip
                          tag={root}
                          count={usage[root.id] ?? 0}
                          onClick={() => setEditing({ category: root, kind, parentId: null })}
                        />
                      </div>
                      <div className="ml-2 flex flex-wrap items-center gap-1.5 border-l border-line pl-3">
                        {children.map((child) => (
                          <TagChip
                            key={child.id}
                            tag={child}
                            count={usage[child.id] ?? 0}
                            size="sm"
                            onClick={() =>
                              setEditing({ category: child, kind, parentId: root.id })
                            }
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditing({ kind, parentId: root.id })}
                          className="inline-flex items-center gap-0.5 rounded px-1 py-px text-xs text-muted transition-colors duration-150 hover:bg-hover hover:text-ink"
                        >
                          <Plus size={12} strokeWidth={1.5} />
                          {t.categories.addChild}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {editing ? (
        <CategoryForm
          bookId={bookId}
          initial={editing}
          categories={categories}
          usage={usage}
          onClose={() => setEditing(null)}
          onAddChild={(root) =>
            setEditing({ kind: root.kind, parentId: root.id })
          }
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
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(
    category?.color ?? nextColor(categories, initial.kind),
  )
  const [icon, setIcon] = useState<string | null>(resolveTagIcon(category?.icon ?? null))
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
        await updateCategory(category.id, { name: trimmed, color, icon })
      } else {
        await createCategory(bookId, {
          name: trimmed,
          kind: initial.kind,
          parentId: initial.parentId,
          color,
          icon,
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
                    onClick={() => {
                      onAddChild(category)
                      close()
                    }}
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
        <Overlay onClose={() => setConfirmingDelete(false)} className="overlay-pad z-[60] items-center">
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
