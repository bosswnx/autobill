import type { ConnectResponse } from '@tagledger/shared'
import { MIN_USER_TOKEN_LENGTH } from '@tagledger/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/database'
import { ensureBookIfEmpty } from '../db/seed'
import { describeSyncError, detectHostedOrigin, normalizeServerUrl } from '../sync/api'
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
  const rows = useLiveQuery(() => db.meta.toArray())
  const session = rows?.find((row) => row.key === 'sync')
  const [ui, setUi] = useState(getSyncUi())

  useEffect(() => subscribeSync(() => setUi(getSyncUi())), [])

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">
          设置
        </h1>
      </header>
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
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted">同步</h2>
      <div className="rounded-xl border border-line px-4 py-3">
        <div className="text-sm">已连接到 {host}</div>
        <div className="mt-1 text-xs text-faint">
          {syncing ? '正在同步…' : lastError ? lastError : formatSyncedAt(lastSyncedAt)}
        </div>
        {lastError && !syncing ? (
          <p className="mt-2 text-sm text-expense">{lastError}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={syncing || busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
          onClick={() => void runSync()}
        >
          立即同步
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
              确认断开
            </button>
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover"
              onClick={() => setConfirming(false)}
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-muted hover:bg-hover"
            onClick={() => setConfirming(true)}
          >
            断开
          </button>
        )}
      </div>
      <p className="text-xs leading-relaxed text-faint">
        断开只取消这台设备的同步，本机账本还在。云端和其他设备不受影响。
      </p>
    </section>
  )
}

function ConnectForm() {
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
      setError('请填写服务器地址')
      return
    }
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
      <h2 className="text-sm font-medium text-muted">同步</h2>
      <p className="text-sm leading-relaxed text-muted">
        {hosted
          ? '这个网页就在同步服务器上。填这台服务器的密钥和你的用户 token，就能把浏览器当一台终端。'
          : '连上自建服务器后，浏览器和手机共用一本账。需要三样：服务器地址、这台服务器的密钥、你自己设的用户 token。同一台服务器上，用户 token 就是你的空间，不要和别人重复。'}
      </p>
      {hosted ? null : (
      <label className="block">
        <span className="text-xs text-faint">服务器地址</span>
        <input
          value={serverUrl}
          onChange={(event) => setServerUrl(event.target.value)}
          placeholder="http://192.168.1.8:8787"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={INPUT}
        />
      </label>
      )}
      <label className="block">
        <span className="text-xs text-faint">服务器密钥</span>
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
        <span className="text-xs text-faint">用户 token</span>
        <input
          type="password"
          value={userToken}
          onChange={(event) => setUserToken(event.target.value)}
          placeholder={`至少 ${MIN_USER_TOKEN_LENGTH} 位，自己设、自己保管`}
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
          {busy ? '连接中…' : '连接'}
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

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return '尚未同步'
  const date = new Date(iso)
  return `上次同步 ${date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}
