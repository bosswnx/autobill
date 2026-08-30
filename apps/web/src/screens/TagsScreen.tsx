import type { Tag, TagKind } from '@tagledger/shared'
import { TAG_COLOR_PALETTE, TAG_KIND_LABEL } from '@tagledger/shared'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ColorPicker } from '../components/ColorPicker'
import { IconPicker } from '../components/IconPicker'
import { Overlay } from '../components/Overlay'
import { TagChip } from '../components/TagChip'
import { resolveTagIcon, TagIcon } from '../components/TagIcon'
import { createTag, deleteTag, updateTag } from '../db/mutations'

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
        return a.name.localeCompare(b.name, 'zh')
      }
      return a.name.localeCompare(b.name, 'zh') * dir
    })
  }, [tags, usage, query, sortKey, sortDir])

  const expenseTags = visible.filter((tag) => tag.kind === 'expense')
  const incomeTags = visible.filter((tag) => tag.kind === 'income')

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">标签</h1>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标签"
          className="flex-1 rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>依</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className={SELECT_CLASS}
            aria-label="排序依据"
          >
            <option value="count">数量</option>
            <option value="name">名称</option>
          </select>
          <span>进行</span>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as SortDir)}
            className={SELECT_CLASS}
            aria-label="排序方向"
          >
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
          <span>排序</span>
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
          title={`添加${TAG_KIND_LABEL[creating]}标签`}
          submitLabel="添加"
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
          title={`编辑${TAG_KIND_LABEL[editing.kind]}标签`}
          submitLabel="保存"
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
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">{TAG_KIND_LABEL[kind]}</h2>
        <AddTagButton kind={kind} onClick={onAdd} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted">{empty ? '还没有标签' : '没有匹配的标签'}</p>
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`添加${TAG_KIND_LABEL[kind]}标签`}
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
              {usage !== undefined ? <span className="text-xs text-faint">{usage} 笔</span> : null}
            </div>
            <label className="mt-4 block text-xs text-faint">名称</label>
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
              placeholder="例如：餐饮"
              className="mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent"
            />
            <div className="mt-4 flex items-start gap-8">
              <div>
                <div className="text-xs text-faint">图标</div>
                <button
                  type="button"
                  onClick={() => setPicking('icon')}
                  className="mt-1 flex size-8 items-center justify-center rounded-md border border-line text-ink transition-colors duration-150 hover:bg-hover"
                  aria-label="选择图标"
                >
                  {icon ? <TagIcon name={icon} size={16} /> : <span className="text-xs text-faint">无</span>}
                </button>
              </div>
              <div>
                <div className="text-xs text-faint">颜色</div>
                <button
                  type="button"
                  onClick={() => setPicking('color')}
                  className="mt-1 size-8 rounded-full border border-line"
                  style={{ background: color }}
                  aria-label="选择颜色"
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
                      删除
                    </button>
                  ) : null}
                  {onView ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm text-muted hover:bg-hover"
                      onClick={onView}
                    >
                      查看流水
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex gap-1">
                <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover" onClick={close}>
                  取消
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
