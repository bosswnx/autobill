import type { ConnectResponse, MergeChoice } from '@tagledger/shared'
import { MAX_CHANGES_PER_SYNC } from '@tagledger/shared'
import { Capacitor } from '@capacitor/core'
import { db } from '../db/database'
import { deviceId } from '../lib/id'
import { isTauri } from '../lib/runtime'
import { nowIso } from '../lib/time'
import {
  connect as apiConnect,
  replaceRemote,
  SyncApiError,
  syncPullPush,
} from './api'
import { applyChange, clearLedger, clearSeqs, rebindLocalToBook, stripSeq, unsyncedChanges } from './apply'
import { clearSession, getSession, saveSession } from './session'

type Listener = () => void

const listeners = new Set<Listener>()

export type SyncUi = {
  syncing: boolean
  lastError: string | null
}

let ui: SyncUi = { syncing: false, lastError: null }
let started = false
let running = false
let queued = false
let timer: ReturnType<typeof setTimeout> | undefined

export function getSyncUi(): SyncUi {
  return ui
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setUi(patch: Partial<SyncUi>): void {
  ui = { ...ui, ...patch }
  for (const listener of listeners) listener()
}

export function deviceName(): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? 'iOS' : 'Android'
  }
  if (isTauri()) {
    if (/Mac/i.test(navigator.userAgent)) return 'macOS'
    if (/Windows/i.test(navigator.userAgent)) return 'Windows'
    if (/Linux/i.test(navigator.userAgent)) return 'Linux'
    return '桌面'
  }
  return '浏览器'
}

export async function connectToServer(input: {
  serverUrl: string
  targetKey: string
  userToken: string
}): Promise<ConnectResponse> {
  return apiConnect(input.serverUrl, {
    targetKey: input.targetKey,
    userToken: input.userToken,
    deviceId: deviceId(),
    deviceName: deviceName(),
  })
}

export async function finishConnect(
  serverUrl: string,
  connected: ConnectResponse,
  choice: MergeChoice | null,
): Promise<void> {
  await saveSession({
    serverUrl,
    spaceId: connected.spaceId,
    deviceToken: connected.deviceToken,
    cursor: null,
    lastSyncedAt: null,
    lastError: null,
  })

  if (choice === 'cloud') {
    await installFromCloud(serverUrl, connected.deviceToken)
    return
  }

  if (choice === 'local') {
    await replaceRemote(serverUrl, connected.deviceToken)
    await clearSeqs()
    await saveSession({ cursor: null })
  }

  if (choice === 'both' && connected.cloudBookId) {
    await rebindLocalToBook(connected.cloudBookId)
  }

  await runSync()
}

export async function disconnect(): Promise<void> {
  await clearSession()
  setUi({ lastError: null })
}

export function requestSync(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    void runSync()
  }, 800)
}

export async function runSync(): Promise<void> {
  if (running) {
    queued = true
    return
  }
  const session = await getSession()
  if (!session?.deviceToken) return

  running = true
  setUi({ syncing: true })
  try {
    const allOutgoing = await unsyncedChanges()
    const outgoing = allOutgoing.slice(0, MAX_CHANGES_PER_SYNC)
    const response = await syncPullPush(session.serverUrl, session.deviceToken, {
      cursor: session.cursor,
      deviceId: deviceId(),
      changes: outgoing.map(stripSeq),
    })

    await db.transaction(
      'rw',
      [db.books, db.tags, db.entries, db.accounts, db.subscriptions, db.changes],
      async () => {
      for (const change of response.changes) {
        await applyChange(change)
      }
      for (const item of response.acked ?? []) {
        const current = await db.changes.get(item.id)
        if (current) await db.changes.put({ ...current, seq: item.seq })
      }
    })

    await saveSession({
      cursor: response.cursor,
      lastSyncedAt: nowIso(),
      lastError: null,
    })
    setUi({ lastError: null })
    if (allOutgoing.length > outgoing.length) queued = true
    void import('../db/fireSubscriptions').then((mod) => mod.fireDueSubscriptions())
  } catch (error) {
    const code = error instanceof SyncApiError ? error.code : 'failed'
    await saveSession({ lastError: code }).catch(() => undefined)
    setUi({ lastError: code })
    if (error instanceof SyncApiError && error.code === 'unauthorized') {
      await clearSession()
    }
  } finally {
    running = false
    setUi({ syncing: false })
    if (queued) {
      queued = false
      void runSync()
    }
  }
}

async function installFromCloud(serverUrl: string, token: string): Promise<void> {
  const response = await syncPullPush(serverUrl, token, {
    cursor: null,
    deviceId: deviceId(),
    changes: [],
  })
  await db.transaction(
    'rw',
    [db.books, db.tags, db.entries, db.accounts, db.subscriptions, db.changes],
    async () => {
    await clearLedger()
    for (const change of response.changes) {
      await applyChange(change)
    }
  })
  await saveSession({
    cursor: response.cursor,
    lastSyncedAt: nowIso(),
    lastError: null,
  })
}

export function initSync(): void {
  if (started) return
  started = true
  window.addEventListener('online', () => void runSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runSync()
  })
  void runSync()
}
