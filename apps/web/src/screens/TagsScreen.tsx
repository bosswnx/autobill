import type { Tag, TagKind } from '@tagledger/shared'
import { TAG_COLOR_PALETTE } from '@tagledger/shared'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ColorPicker } from '../components/ColorPicker'
import { IconPicker } from '../components/IconPicker'
import { Overlay } from '../components/Overlay'
import { TagChip } from '../components/TagChip'
import { resolveTagIcon, TagIcon } from '../components/TagIcon'
import { createTag, deleteTag, updateTag } from '../db/mutations'
import { useI18n } from '../i18n'

type Props = {
  bookId: string
  tags: Tag[]
  usage: Record<string, number>
  onFilterTag: (id: string) => void
}

type SortKey = 'count' | 'name'
type SortDir = 'asc' | 'desc'

const SELECT_CLASS =
  'rounded-md border border-line bg-page px-3 py-2 text-sm hover:bg-hover focus:border-accent'

export function TagsScreen({ bookId, tags, usage, onFilterTag }: Props) {
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [creating, setCreating] = useState<TagKind | null>(null)
  const [editing, setEditing] = useState<Tag | null>(null)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle
      ? tags.filter((tag) => tag.name.toLowerCase().includes(needle))
      : tags
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'count') {
        const byCount = (usage[a.id] ?? 0) - (usage[b.id] ?? 0)
        if (byCount) return byCount * dir
        return a.name.localeCompare(b.name, locale)
      }
      return a.name.localeCompare(b.name, locale) * dir
    })
  }, [tags, usage, query, sortKey, sortDir, locale])

  const expenseTags = visible.filter((tag) => tag.kind === 'expense')
  const incomeTags = visible.filter((tag) => tag.kind === 'income')

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">{t.tags.title}</h1>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.tags.searchPlaceholder}
          className="flex-1 rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>{t.tags.sortBy}</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className={SELECT_CLASS}
            aria-label={t.tags.sortByAria}
          >
            <option value="count">{t.tags.sortCount}</option>
            <option value="name">{t.tags.sortName}</option>
          </select>
          {t.tags.sortThen ? <span>{t.tags.sortThen}</span> : null}
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as SortDir)}
            className={SELECT_CLASS}
            aria-label={t.tags.sortDirAria}
          >
            <option value="desc">{t.tags.sortDesc}</option>
            <option value="asc">{t.tags.sortAsc}</option>
          </select>
          {t.tags.sortSuffix ? <span>{t.tags.sortSuffix}</span> : null}
        </div>
      </div>

      <TagKindSection
        kind="expense"
        tags={expenseTags}
        empty={tags.every((tag) => tag.kind !== 'expense')}
        usage={usage}
        onAdd={() => setCreating('expense')}
        onEdit={setEditing}
      />
      <TagKindSection
        kind="income"
        tags={incomeTags}
        empty={tags.every((tag) => tag.kind !== 'income')}
        usage={usage}
        onAdd={() => setCreating('income')}
        onEdit={setEditing}
      />

      {creating && (
        <TagFormDialog
          title={t.tags.addKind[creating]}
          submitLabel={t.tags.add}
          initial={{
            name: '',
            color: nextTagColor(tags.filter((tag) => tag.kind === creating)),
            icon: null,
          }}
          requireName
          onClose={() => setCreating(null)}
          onSubmit={async (next) => {
            await createTag(bookId, next.name, next.color, next.icon, creating)
          }}
        />
      )}

      {editing && (
        <TagFormDialog
          title={t.tags.editKind[editing.kind]}
          submitLabel={t.common.save}
          initial={{
            name: editing.name,
            color: editing.color,
            icon: resolveTagIcon(editing.icon),
          }}
          usage={usage[editing.id] ?? 0}
          onClose={() => setEditing(null)}
          onSubmit={async (next) => {
            await updateTag(editing.id, next)
          }}
          onDelete={async () => {
            await deleteTag(editing.id)
          }}
          onView={() => onFilterTag(editing.id)}
        />
      )}
    </div>
  )
}

function TagKindSection({
  kind,
  tags,
  empty,
  usage,
  onAdd,
  onEdit,
}: {
  kind: TagKind
  tags: Tag[]
  empty: boolean
  usage: Record<string, number>
  onAdd: () => void
  onEdit: (tag: Tag) => void
}) {
  const { t } = useI18n()
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{t.tagKind[kind]}</h2>
        <AddTagButton kind={kind} onClick={onAdd} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted">{empty ? t.tags.empty : t.tags.emptyFiltered}</p>
        ) : (
          tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} count={usage[tag.id] ?? 0} onClick={() => onEdit(tag)} />
          ))
        )}
      </div>
    </section>
  )
}

function AddTagButton({ kind, onClick }: { kind: TagKind; onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t.tags.addKind[kind]}
      className="flex size-[22px] items-center justify-center rounded bg-[#f4f3f0] text-muted transition-colors duration-150 hover:bg-[#ebeae6] hover:text-ink"
    >
      <Plus size={14} strokeWidth={1.5} />
    </button>
  )
}

function nextTagColor(tags: Tag[]): string {
  const used = new Set(tags.map((tag) => tag.color))
  return TAG_COLOR_PALETTE.find((item) => !used.has(item)) ?? TAG_COLOR_PALETTE[0]
}

function TagFormDialog({
  title,
  submitLabel,
  initial,
  usage,
  requireName,
  onClose,
  onSubmit,
  onDelete,
  onView,
}: {
  title: string
  submitLabel: string
  initial: { name: string; color: string; icon: string | null }
  usage?: number
  requireName?: boolean
  onClose: () => void
  onSubmit: (value: { name: string; color: string; icon: string | null }) => Promise<void>
  onDelete?: () => Promise<void>
  onView?: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState(initial.color)
  const [icon, setIcon] = useState<string | null>(initial.icon)
  const [picking, setPicking] = useState<null | 'icon' | 'color'>(null)
  const [saving, setSaving] = useState(false)
  const { t } = useI18n()
  const canSubmit = !requireName || Boolean(name.trim())

  async function submit() {
    const trimmed = name.trim()
    if (requireName && !trimmed) return false
    setSaving(true)
    try {
      await onSubmit({ name: trimmed || initial.name, color, icon })
      return true
    } catch {
      return false
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
              {usage !== undefined ? <span className="text-xs text-faint">{t.tags.entryCount(usage)}</span> : null}
            </div>
            <label className="mt-4 block text-xs text-faint">{t.tags.name}</label>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit().then((ok) => {
                    if (ok) close()
                  })
                }
              }}
              placeholder={t.tags.namePlaceholder}
              className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
            />
            <div className="mt-4 flex items-start gap-8">
              <div>
                <div className="text-xs text-faint">{t.tags.icon}</div>
                <button
                  type="button"
                  onClick={() => setPicking('icon')}
                  className="mt-1 flex size-8 items-center justify-center rounded-md border border-line text-ink transition-colors duration-150 hover:bg-hover"
                  aria-label={t.tags.pickIcon}
                >
                  {icon ? <TagIcon name={icon} size={16} /> : <span className="text-xs text-faint">{t.common.none}</span>}
                </button>
              </div>
              <div>
                <div className="text-xs text-faint">{t.tags.color}</div>
                <button
                  type="button"
                  onClick={() => setPicking('color')}
                  className="mt-1 size-8 rounded-full border border-line"
                  style={{ background: color }}
                  aria-label={t.tags.pickColor}
                />
              </div>
            </div>
            <div className={`mt-6 flex items-center ${onDelete || onView ? 'justify-between' : 'justify-end'}`}>
              {onDelete || onView ? (
                <div className="flex gap-1">
                  {onDelete ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm text-expense hover:bg-hover"
                      onClick={() => void onDelete().then(close)}
                    >
                      {t.common.delete}
                    </button>
                  ) : null}
                  {onView ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm text-muted hover:bg-hover"
                      onClick={onView}
                    >
                      {t.tags.viewLedger}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex gap-1">
                <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  disabled={saving || !canSubmit}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
                  onClick={() =>
                    void submit().then((ok) => {
                      if (ok) close()
                    })
                  }
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </Overlay>
      {picking === 'icon' && (
        <IconPicker value={icon} onClose={() => setPicking(null)} onPick={setIcon} />
      )}
      {picking === 'color' && (
        <ColorPicker value={color} onClose={() => setPicking(null)} onPick={setColor} />
      )}
    </>
  )
}
