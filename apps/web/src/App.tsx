import { useEffect, useState, type ReactNode } from 'react'
import { SavingsButton, SavingsEditor } from './components/SavingsEditor'
import { seedIfNeeded } from './db/seed'
import { initSync } from './sync/engine'
import {
  useBook,
  useEntries,
  useEntry,
  useMonthStats,
  useSavings,
  useTagUsage,
  useTags,
} from './hooks/useLedger'
import { monthKey } from './lib/time'
import { EntrySheet } from './screens/EntrySheet'
import { LedgerScreen } from './screens/LedgerScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'
import { TagsScreen } from './screens/TagsScreen'

type Screen = 'ledger' | 'tags' | 'stats' | 'settings'

export default function App() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>('ledger')
  const [month, setMonth] = useState(monthKey())
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<null | { entryId?: string }>(null)
  const [editingSavings, setEditingSavings] = useState(false)

  useEffect(() => {
    void seedIfNeeded()
      .then(() => initSync())
      .then(() => setReady(true))
  }, [])

  const book = useBook()
  const tags = useTags(book?.id)
  const entries = useEntries(book?.id, month, filterTagIds, query)
  const stats = useMonthStats(book?.id, month)
  const usage = useTagUsage(book?.id)
  const savings = useSavings(book)

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted">
        正在打开账本…
      </div>
    )
  }

  return (
    <div className="min-h-svh pl-[var(--sal)] pr-[var(--sar)] md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden bg-sidebar px-2 pb-3 pt-[calc(0.75rem+var(--sat))] md:flex md:flex-col">
        <div className="mb-2 flex items-center gap-2 rounded px-2 py-1.5">
          <span className="flex size-5 items-center justify-center rounded bg-ink text-[10px] font-semibold text-page">
            T
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{book?.name ?? 'TagLedger'}</div>
            <div className="truncate text-[11px] text-faint">TagLedger</div>
          </div>
        </div>
        <SavingsButton savings={savings} onClick={() => book && setEditingSavings(true)} />
        <nav className="mt-2 flex flex-col gap-0.5">
          <NavButton current={screen} id="ledger" label="流水" onClick={setScreen} icon={<ListIcon />} />
          <NavButton current={screen} id="stats" label="统计" onClick={setScreen} icon={<ChartIcon />} />
          <NavButton current={screen} id="tags" label="标签" onClick={setScreen} icon={<TagIcon />} />
          <NavButton current={screen} id="settings" label="设置" onClick={setScreen} icon={<GearIcon />} />
        </nav>
        <button
          type="button"
          onClick={() => book && setEditor({})}
          className="mt-2 flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted transition-colors duration-150 hover:bg-hover"
        >
          <PlusIcon />
          记一笔
        </button>
      </aside>

      <div className="flex min-h-svh flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-[calc(7rem+var(--sab))] pt-[calc(2.5rem+var(--sat))] md:px-16 md:pb-16 md:pt-[calc(3rem+var(--sat))]">
          <div key={screen} className="anim-page">
          {screen === 'ledger' && book && (
            <LedgerScreen
              month={month}
              onMonthChange={setMonth}
              stats={stats}
              entries={entries}
              tags={tags}
              usage={usage}
              savings={savings}
              onEditSavings={() => setEditingSavings(true)}
              filterTagIds={filterTagIds}
              onToggleTag={(id) =>
                setFilterTagIds((current) =>
                  current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                )
              }
              onClearTags={() => setFilterTagIds([])}
              query={query}
              onQueryChange={setQuery}
              onOpenEntry={(id) => setEditor({ entryId: id })}
            />
          )}
          {screen === 'ledger' && !book && <MissingBook onSettings={() => setScreen('settings')} />}
          {screen === 'stats' && book && (
            <StatsScreen book={book} tags={tags} savings={savings} />
          )}
          {screen === 'stats' && !book && <MissingBook onSettings={() => setScreen('settings')} />}
          {screen === 'tags' && book && (
            <TagsScreen
              bookId={book.id}
              tags={tags}
              usage={usage}
              onFilterTag={(id) => {
                setFilterTagIds([id])
                setScreen('ledger')
              }}
            />
          )}
          {screen === 'tags' && !book && <MissingBook onSettings={() => setScreen('settings')} />}
          {screen === 'settings' && <SettingsScreen />}
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/95 px-2 pb-[max(0.375rem,var(--sab))] pt-1 md:hidden">
          <div className="grid grid-cols-5">
            <NavButton
              current={screen}
              id="ledger"
              label="流水"
              onClick={setScreen}
              icon={<ListIcon size={22} />}
              stacked
            />
            <NavButton
              current={screen}
              id="stats"
              label="统计"
              onClick={setScreen}
              icon={<ChartIcon size={22} />}
              stacked
            />
            <button
              type="button"
              onClick={() => book && setEditor({})}
              aria-label="记一笔"
              className="flex h-full items-center justify-center rounded-md px-1 py-1 text-accent transition-colors duration-150 hover:bg-hover"
            >
              <TabPlusIcon />
            </button>
            <NavButton
              current={screen}
              id="tags"
              label="标签"
              onClick={setScreen}
              icon={<TagIcon size={22} />}
              stacked
            />
            <NavButton
              current={screen}
              id="settings"
              label="设置"
              onClick={setScreen}
              icon={<GearIcon size={22} />}
              stacked
            />
          </div>
        </nav>
      </div>

      {editor && book && (
        <EntryEditor
          book={book}
          tags={tags}
          usage={usage}
          entryId={editor.entryId}
          onClose={() => setEditor(null)}
        />
      )}
      {editingSavings && book && (
        <SavingsEditor
          bookId={book.id}
          savings={savings}
          onClose={() => setEditingSavings(false)}
        />
      )}
    </div>
  )
}

function MissingBook({ onSettings }: { onSettings: () => void }) {
  return (
    <div className="flex flex-col gap-3 pt-8">
      <p className="text-sm text-muted">还没有账本。去设置里连接同步，或重新打开应用创建本地账本。</p>
      <button
        type="button"
        onClick={onSettings}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink"
      >
        去设置
      </button>
    </div>
  )
}

function NavButton({
  current,
  id,
  label,
  onClick,
  icon,
  stacked = false,
}: {
  current: Screen
  id: Screen
  label: string
  onClick: (screen: Screen) => void
  icon?: ReactNode
  stacked?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center justify-center rounded-md transition-colors duration-150 ${
        stacked
          ? 'flex-col gap-1.5 px-1 py-1 text-[10px] leading-none'
          : 'gap-2 px-2 py-1.5 text-sm md:justify-start'
      } ${current === id ? 'bg-active text-ink' : 'text-muted hover:bg-hover hover:text-ink'}`}
    >
      {icon}
      {label}
    </button>
  )
}

function EntryEditor({
  book,
  tags,
  usage,
  entryId,
  onClose,
}: {
  book: NonNullable<ReturnType<typeof useBook>>
  tags: ReturnType<typeof useTags>
  usage: Record<string, number>
  entryId?: string
  onClose: () => void
}) {
  const entry = useEntry(entryId)
  if (entryId && !entry) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay text-sm text-muted">
        加载中…
      </div>
    )
  }
  return <EntrySheet book={book} tags={tags} usage={usage} entry={entry} onClose={onClose} />
}

function ChartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 12V8M7 12V4M11 12V6.5M14 13H2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ListIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function TagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 8.3 8.2 2.6a1 1 0 0 1 .7-.3h3.6v3.6a1 1 0 0 1-.3.7L6.5 12.3a1 1 0 0 1-1.4 0L2.5 9.7a1 1 0 0 1 0-1.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="11" cy="5" r="0.8" fill="currentColor" />
    </svg>
  )
}

function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.4 1.8h3.2l.4 1.6a4.8 4.8 0 0 1 1.3.8l1.6-.5 1.6 2.8-1.2 1.2a4.8 4.8 0 0 1 0 1.6l1.2 1.2-1.6 2.8-1.6-.5a4.8 4.8 0 0 1-1.3.8l-.4 1.6H6.4l-.4-1.6a4.8 4.8 0 0 1-1.3-.8l-1.6.5L1.5 10.6l1.2-1.2a4.8 4.8 0 0 1 0-1.6L1.5 6.6l1.6-2.8 1.6.5a4.8 4.8 0 0 1 1.3-.8l.4-1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function TabPlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
