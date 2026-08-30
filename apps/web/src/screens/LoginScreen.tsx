import type { ConnectResponse, MergeChoice } from '@tagledger/shared'
import { MIN_USER_TOKEN_LENGTH } from '@tagledger/shared'
import { useState } from 'react'
import { describeSyncError } from '../sync/api'
import { connectToServer, finishConnect } from '../sync/engine'
import { hasLocalData } from '../sync/session'
import { ensureBookIfEmpty } from '../db/seed'
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
      setError('请填写服务器密钥')
      return
    }
    if (userToken.trim().length < MIN_USER_TOKEN_LENGTH) {
      setError(`用户 token 至少 ${MIN_USER_TOKEN_LENGTH} 位`)
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
          <span className="flex size-8 items-center justify-center rounded-md bg-ink text-sm font-semibold text-page">
            T
          </span>
          <div>
            <div className="text-sm font-medium">TagLedger</div>
            <div className="text-[11px] text-faint">同步服务器</div>
          </div>
        </div>
        <h1 className="text-[40px] leading-none font-bold tracking-[-0.03em]">登录</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          第一次用这个浏览器打开时，要用服务器密钥和你的用户 token 验证身份。通过之后，这个浏览器就是一台终端。
        </p>
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) void submit()
          }}
        >
          <label className="block">
            <span className="text-xs text-faint">服务器密钥</span>
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
            <span className="text-xs text-faint">用户 token</span>
            <input
              type="password"
              value={userToken}
              onChange={(event) => setUserToken(event.target.value)}
              placeholder={`至少 ${MIN_USER_TOKEN_LENGTH} 位，自己设、自己保管`}
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
            {busy ? '验证中…' : '进入'}
          </button>
        </form>
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
