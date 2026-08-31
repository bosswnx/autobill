import { ChartColumn, Menu, Plus, Settings, Tag } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { seedIfNeeded } from './db/seed'
import { detectHostedOrigin } from './sync/api'
import { initSync, subscribeSync } from './sync/engine'
import { isConnected } from './sync/session'
import {
  useBook,
  useEntries,
  useEntry,
  useMonthStats,
  useSavings,
  useTagUsage,
  useTags,
} from './hooks/useLedger'
import { BrandMark } from './components/BrandMark'
import { monthKey } from './lib/time'
import { useI18n } from './i18n'
import { EntrySheet } from './screens/EntrySheet'
import { LedgerScreen } from './screens/LedgerScreen'
import { LoginScreen } from './screens/LoginScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'
import { TagsScreen } from './screens/TagsScreen'

type Screen = 'ledger' | 'tags' | 'stats' | 'settings'
type Boot = 'loading' | 'login' | 'app'

export default function App() {
  const [boot, setBoot] = useState<Boot>('loading')
  const [hostedOrigin, setHostedOrigin] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('ledger')
  const [month, setMonth] = useState(monthKey())
  const [filterTagIds, setFilterTagIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<null | { entryId?: string }>(null)
  const { t } = useI18n()

  useEffect(() => {
    void (async () => {
      const origin = await detectHostedOrigin()
      setHostedOrigin(origin)
      if (origin && !(await isConnected())) {
        setBoot('login')
        return
      }
      await seedIfNeeded()
      initSync()
      setBoot('app')
    })()
  }, [])

  useEffect(() => {
    if (boot !== 'app' || !hostedOrigin) return
    return subscribeSync(() => {
      void isConnected().then((ok) => {
        if (!ok) setBoot('login')
      })
    })
  }, [boot, hostedOrigin])

  const book = useBook()
  const tags = useTags(book?.id)
  const entries = useEntries(book?.id, month, filterTagIds, query)
  const stats = useMonthStats(book?.id, month)
  const usage = useTagUsage(book?.id)
  const savings = useSavings(book)

  if (boot === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted">
        {t.boot.opening}
      </div>
    )
  }

  if (boot === 'login') {
    if (!hostedOrigin) {
      return (
        <div className="flex min-h-svh items-center justify-center text-sm text-muted">
          {t.boot.opening}
        </div>
      )
    }
    return (
      <LoginScreen
        serverUrl={hostedOrigin}
        onLoggedIn={() => {
          initSync()
          setScreen('ledger')
          setBoot('app')
        }}
      />
    )
  }

  return (
    <div className="min-h-svh pl-[var(--sal)] pr-[var(--sar)]">
      <aside className="hidden bg-sidebar px-2 pb-3 pt-[calc(0.75rem+var(--sat))] md:fixed md:inset-y-0 md:left-[var(--sal)] md:flex md:w-[var(--sidebar-width)] md:flex-col md:overflow-y-auto">
        <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
          <BrandMark className="size-5 shrink-0" />
          <div className="truncate text-sm font-medium">{t.appName}</div>
        </div>
        <nav className="mt-2 flex flex-col gap-0.5">
          <NavButton current={screen} id="ledger" label={t.nav.ledger} onClick={setScreen} icon={<Menu size={16} strokeWidth={1.75} />} />
          <NavButton current={screen} id="stats" label={t.nav.stats} onClick={setScreen} icon={<ChartColumn size={16} strokeWidth={1.75} />} />
          <NavButton current={screen} id="tags" label={t.nav.tags} onClick={setScreen} icon={<Tag size={16} strokeWidth={1.75} />} />
          <NavButton current={screen} id="settings" label={t.nav.settings} onClick={setScreen} icon={<Settings size={16} strokeWidth={1.75} />} />
        </nav>
        <button
          type="button"
          onClick={() => book && setEditor({})}
          className="mt-2 flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted transition-colors duration-150 hover:bg-hover"
        >
          <Plus size={16} strokeWidth={1.75} />
          {t.nav.addEntry}
        </button>
      </aside>

      <div className="flex min-h-svh flex-col md:ml-[var(--sidebar-width)]">
        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-5 pb-[calc(7rem+var(--sab))] pt-[calc(2.5rem+var(--sat))] md:px-16 md:pb-16 md:pt-[calc(3rem+var(--sat))]">
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

        {createPortal(
        <nav className="app-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line px-2 pb-[max(0.375rem,var(--sab))] pt-1 md:hidden">
          <div className="grid grid-cols-5">
            <NavButton
              current={screen}
              id="ledger"
              label={t.nav.ledger}
              onClick={setScreen}
              icon={<Menu size={22} strokeWidth={1.75} />}
              stacked
            />
            <NavButton
              current={screen}
              id="stats"
              label={t.nav.stats}
              onClick={setScreen}
              icon={<ChartColumn size={22} strokeWidth={1.75} />}
              stacked
            />
            <button
              type="button"
              onClick={() => book && setEditor({})}
              aria-label={t.nav.addEntry}
              className="flex h-full items-center justify-center rounded-md px-1 py-1 text-accent transition-colors duration-150 hover:bg-hover"
            >
              <Plus size={22} strokeWidth={1.75} />
            </button>
            <NavButton
              current={screen}
              id="tags"
              label={t.nav.tags}
              onClick={setScreen}
              icon={<Tag size={22} strokeWidth={1.75} />}
              stacked
            />
            <NavButton
              current={screen}
              id="settings"
              label={t.nav.settings}
              onClick={setScreen}
              icon={<Settings size={22} strokeWidth={1.75} />}
              stacked
            />
          </div>
        </nav>,
        document.body,
        )}
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
    </div>
  )
}

function MissingBook({ onSettings }: { onSettings: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-3 pt-8">
      <p className="text-sm text-muted">{t.missingBook.body}</p>
      <button
        type="button"
        onClick={onSettings}
        className="self-start rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink"
      >
        {t.missingBook.goSettings}
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
  const { t } = useI18n()
  if (entryId && !entry) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay text-sm text-muted">
        {t.common.loading}
      </div>
    )
  }
  return <EntrySheet book={book} tags={tags} usage={usage} entry={entry} onClose={onClose} />
}
