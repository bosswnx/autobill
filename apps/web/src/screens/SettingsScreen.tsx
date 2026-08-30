import type { ConnectResponse, MergeChoice } from '@tagledger/shared'
import { MIN_USER_TOKEN_LENGTH } from '@tagledger/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Overlay } from '../components/Overlay'
import { db } from '../db/database'
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

const INPUT =
  'mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm placeholder:text-faint hover:bg-hover focus:border-accent'

export function SettingsScreen() {
  const session = useLiveQuery(() => db.meta.get('sync'))
  const [ui, setUi] = useState(getSyncUi())

  useEffect(() => subscribeSync(() => setUi(getSyncUi())), [])

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="shrink-0 whitespace-nowrap text-[40px] leading-none font-bold tracking-[-0.03em]">
          设置
        </h1>
      </header>
      {session?.deviceToken ? (
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
      setError('请填写 target key')
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
          ? '这个网页就在同步服务器上。填这台服务器的 target key 和你的用户 token，就能把浏览器当一台终端。'
          : '连上自建服务器后，浏览器和手机共用一本账。需要三样：服务器地址、这台服务器的 target key、你自己设的用户 token。同一台服务器上，用户 token 就是你的空间，不要和别人重复。'}
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
        <span className="text-xs text-faint">Target key</span>
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

function MergeOverlay({
  busy,
  onPick,
  onClose,
}: {
  busy: boolean
  onPick: (choice: MergeChoice) => void
  onClose: () => void
}) {
  return (
    <Overlay onClose={onClose}>
      {() => (
        <div
          data-overlay-scroll
          className="anim-panel max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-line bg-page p-5"
        >
          <h2 className="text-lg font-semibold">两边都有账本</h2>
          <p className="mt-1 text-sm text-muted">这台设备和云端都有数据。选一种处理方式，不会自动合并成一本乱账。</p>
          <div className="mt-4 flex flex-col gap-2">
            <MergeButton
              disabled={busy}
              title="用本机覆盖云端"
              detail="云端现有记录会清掉，换成这台设备上的账。"
              onClick={() => onPick('local')}
            />
            <MergeButton
              disabled={busy}
              title="用云端覆盖本机"
              detail="这台设备上的记录会清掉，换成云端那本账。"
              onClick={() => onPick('cloud')}
            />
            <MergeButton
              disabled={busy}
              title="两边都留"
              detail="流水和标签都会保留。同名标签可能出现两份，存款以较新的设置为准。"
              onClick={() => onPick('both')}
            />
          </div>
        </div>
      )}
    </Overlay>
  )
}

function MergeButton({
  title,
  detail,
  disabled,
  onClick,
}: {
  title: string
  detail: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-line px-3 py-3 text-left transition-colors duration-150 hover:bg-hover disabled:opacity-40"
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-faint">{detail}</div>
    </button>
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
