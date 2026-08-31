import type { ConnectResponse } from '@tagledger/shared'
import { MIN_USER_TOKEN_LENGTH } from '@tagledger/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Overlay } from '../components/Overlay'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { SavingsSection } from '../components/SavingsEditor'
import { db } from '../db/database'
import { ensureBookIfEmpty } from '../db/seed'
import { wipeAllLocalData } from '../db/wipe'
import { useBook, useSavings } from '../hooks/useLedger'
import { getMessages, useI18n } from '../i18n'
import { describeSyncError, detectHostedOrigin, normalizeServerUrl, stripServerScheme } from '../sync/api'
import {
  connectToServer,
  disconnect,
  finishConnect,
  getSyncUi,
  runSync,
  subscribeSync,
} from '../sync/engine'
import { hasLocalData } from '../sync/session'
import { MergeOverlay } from './MergeOverlay'

const INPUT =
  'mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent'

export function SettingsScreen() {
  const { t } = useI18n()
  const book = useBook()
  const savings = useSavings(book)
  const rows = useLiveQuery(() => db.meta.toArray())
  const session = rows?.find((row) => row.key === 'sync')
  const [ui, setUi] = useState(getSyncUi())

  useEffect(() => subscribeSync(() => setUi(getSyncUi())), [])

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">
          {t.settings.title}
        </h1>
      </header>
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted">{t.settings.language}</h2>
        <LanguageSwitch />
      </section>
      {book ? <SavingsSection bookId={book.id} savings={savings} /> : null}
      {rows === undefined ? null : session?.deviceToken ? (
        <ConnectedCard
          host={hostOf(session.serverUrl)}
          lastSyncedAt={session.lastSyncedAt}
          lastError={session.lastError ?? ui.lastError}
          syncing={ui.syncing}
        />
      ) : (
        <ConnectForm />
      )}
      <WipeSection />
    </div>
  )
}

function ConnectedCard({
  host,
  lastSyncedAt,
  lastError,
  syncing,
}: {
  host: string
  lastSyncedAt: string | null
  lastError: string | null
  syncing: boolean
}) {
  const { t } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const errorText = lastError ? describeSyncError(lastError) : null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted">{t.sync.title}</h2>
      <div className="rounded-xl border border-line px-4 py-3">
        <div className="text-sm">{t.sync.connectedTo(host)}</div>
        <div className="mt-1 text-xs text-faint">
          {syncing ? t.sync.syncing : errorText ? errorText : formatSyncedAt(lastSyncedAt, t.intl)}
        </div>
        {errorText && !syncing ? (
          <p className="mt-2 text-sm text-expense">{errorText}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={syncing || busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
          onClick={() => void runSync()}
        >
          {t.sync.syncNow}
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-expense px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
              onClick={() => {
                setBusy(true)
                void disconnect().finally(() => {
                  setBusy(false)
                  setConfirming(false)
                })
              }}
            >
              {t.sync.confirmDisconnect}
            </button>
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover"
              onClick={() => setConfirming(false)}
            >
              {t.common.cancel}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover"
            onClick={() => setConfirming(true)}
          >
            {t.sync.disconnect}
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-faint">{t.sync.disconnectHint}</p>
    </section>
  )
}

function ConnectForm() {
  const { t } = useI18n()
  const [serverUrl, setServerUrl] = useState('')
  const [hosted, setHosted] = useState(false)
  const [targetKey, setTargetKey] = useState('')
  const [userToken, setUserToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ url: string; connected: ConnectResponse } | null>(null)

  useEffect(() => {
    void detectHostedOrigin().then((origin) => {
      if (!origin) return
      setHosted(true)
      setServerUrl(origin)
    })
  }, [])

  async function submit() {
    const url = hosted ? serverUrl.replace(/\/+$/, '') : normalizeServerUrl(serverUrl)
    if (!url) {
      setError(t.sync.urlRequired)
      return
    }
    if (!targetKey.trim()) {
      setError(t.sync.targetKeyRequired)
      return
    }
    if (userToken.trim().length < MIN_USER_TOKEN_LENGTH) {
      setError(t.sync.tokenMin(MIN_USER_TOKEN_LENGTH))
      return
    }
    setBusy(true)
    setError('')
    try {
      const connected = await connectToServer({
        serverUrl: url,
        targetKey: targetKey.trim(),
        userToken: userToken.trim(),
      })
      const local = await hasLocalData()
      if (local && connected.hasCloudData) {
        setPending({ url, connected })
        return
      }
      await finishConnect(url, connected, null)
      await ensureBookIfEmpty()
    } catch (err) {
      setError(describeSyncError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted">{t.sync.title}</h2>
      <p className="text-sm leading-relaxed text-muted">
        {hosted ? t.sync.hostedHint : t.sync.connectHint}
      </p>
      {hosted ? null : (
      <label className="block">
        <span className="text-xs text-faint">{t.sync.serverUrl}</span>
        <div className="mt-1 flex items-center rounded-md border border-line bg-page px-3 py-2 hover:bg-hover focus-within:border-accent">
          <span className="shrink-0 text-sm text-faint">https://</span>
          <input
            value={serverUrl}
            onChange={(event) => setServerUrl(stripServerScheme(event.target.value))}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </label>
      )}
      <label className="block">
        <span className="text-xs text-faint">{t.sync.targetKey}</span>
        <input
          type="password"
          value={targetKey}
          onChange={(event) => setTargetKey(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={INPUT}
        />
      </label>
      <label className="block">
        <span className="text-xs text-faint">{t.sync.userToken}</span>
        <input
          type="password"
          value={userToken}
          onChange={(event) => setUserToken(event.target.value)}
          placeholder={t.sync.tokenPlaceholder(MIN_USER_TOKEN_LENGTH)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={INPUT}
        />
      </label>
      {error ? <p className="text-sm text-expense">{error}</p> : null}
      <div>
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
          onClick={() => void submit()}
        >
          {busy ? t.sync.connecting : t.sync.connect}
        </button>
      </div>
      {pending ? (
        <MergeOverlay
          busy={busy}
          onPick={(choice) => {
            setBusy(true)
            void finishConnect(pending.url, pending.connected, choice)
              .then(() => ensureBookIfEmpty())
              .then(() => setPending(null))
              .catch((err) => setError(describeSyncError(err)))
              .finally(() => setBusy(false))
          }}
          onClose={() => {
            if (!busy) setPending(null)
          }}
        />
      ) : null}
    </section>
  )
}

const WIPE_WAIT_SECONDS = 10

function WipeSection() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        className="self-start rounded-md border border-expense px-3 py-1.5 text-sm text-expense hover:bg-hover"
        onClick={() => setOpen(true)}
      >
        {t.settings.wipe}
      </button>
      {open ? <WipeOverlay onClose={() => setOpen(false)} /> : null}
    </section>
  )
}

function WipeOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [left, setLeft] = useState(WIPE_WAIT_SECONDS)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (left <= 0) return
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left])

  async function confirm() {
    if (left > 0 || busy) return
    setBusy(true)
    try {
      await wipeAllLocalData()
      window.location.reload()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Overlay onClose={onClose} className="overlay-pad items-center">
      {(close) => (
        <div
          data-overlay-scroll
          className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5"
        >
          <h2 className="text-lg font-semibold text-expense">{t.settings.wipe}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t.settings.wipeHint}</p>
          <div className="mt-4 flex justify-end gap-1">
            <button
              type="button"
              disabled={busy}
              className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover disabled:opacity-40"
              onClick={close}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              disabled={left > 0 || busy}
              className="rounded-md bg-expense px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
              onClick={() => void confirm()}
            >
              {left > 0 ? t.settings.wipeWait(left) : busy ? t.common.loading : t.settings.wipeConfirm}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function formatSyncedAt(iso: string | null, intl: string): string {
  const t = getMessages()
  if (!iso) return t.sync.neverSynced
  const date = new Date(iso)
  return t.sync.lastSynced(
    date.toLocaleString(intl, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )
}
