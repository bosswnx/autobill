import type { ConnectResponse, MergeChoice } from '@tagbill/shared'
import { MIN_USER_TOKEN_LENGTH } from '@tagbill/shared'
import { useState } from 'react'
import { describeSyncError } from '../sync/api'
import { connectToServer, finishConnect } from '../sync/engine'
import { hasLocalData } from '../sync/session'
import { ensureBookIfEmpty } from '../db/seed'
import { BrandMark } from '../components/BrandMark'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { useI18n } from '../i18n'
import { MergeOverlay } from './MergeOverlay'

const INPUT =
  'mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent'

export function LoginScreen({
  serverUrl,
  onLoggedIn,
}: {
  serverUrl: string
  onLoggedIn: () => void
}) {
  const { t } = useI18n()
  const [targetKey, setTargetKey] = useState('')
  const [userToken, setUserToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ url: string; connected: ConnectResponse } | null>(null)

  async function complete(url: string, connected: ConnectResponse, choice: MergeChoice | null) {
    await finishConnect(url, connected, choice)
    await ensureBookIfEmpty()
    onLoggedIn()
  }

  async function submit() {
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
        serverUrl,
        targetKey: targetKey.trim(),
        userToken: userToken.trim(),
      })
      const local = await hasLocalData()
      if (local && connected.hasCloudData) {
        setPending({ url: serverUrl, connected })
        return
      }
      await complete(serverUrl, connected, null)
    } catch (err) {
      setError(describeSyncError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-5 py-[calc(2rem+var(--sat))] pb-[calc(2rem+var(--sab))] pl-[calc(1.25rem+var(--sal))] pr-[calc(1.25rem+var(--sar))]">
      <div className="anim-page w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark className="size-8 shrink-0" />
          <div>
            <div className="text-sm font-medium">{t.appName}</div>
            <div className="text-[11px] text-faint">{t.login.subtitle}</div>
          </div>
        </div>
        <h1 className="text-[40px] leading-none font-bold tracking-[-0.03em]">{t.login.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t.login.hint}</p>
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) void submit()
          }}
        >
          <label className="block">
            <span className="text-xs text-faint">{t.sync.targetKey}</span>
            <input
              type="password"
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
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
              autoComplete="off"
              className={INPUT}
            />
          </label>
          {error ? <p className="text-sm text-expense">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-3 py-2 text-sm text-accent-ink disabled:opacity-40"
          >
            {busy ? t.login.verifying : t.login.enter}
          </button>
        </form>
        <div className="mt-10 flex justify-center">
          <LanguageSwitch />
        </div>
      </div>
      {pending ? (
        <MergeOverlay
          busy={busy}
          onPick={(choice) => {
            setBusy(true)
            void complete(pending.url, pending.connected, choice)
              .then(() => setPending(null))
              .catch((err) => setError(describeSyncError(err)))
              .finally(() => setBusy(false))
          }}
          onClose={() => {
            if (!busy) setPending(null)
          }}
        />
      ) : null}
    </div>
  )
}
