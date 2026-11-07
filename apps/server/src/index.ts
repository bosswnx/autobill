import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import type { Change, ConnectRequest, ConnectResponse, SyncRequest, SyncResponse } from '@autobill/shared'
import {
  isEntityType,
  MAX_CHANGES_PER_SYNC,
  MAX_TOKEN_LENGTH,
  MIN_USER_TOKEN_LENGTH,
} from '@autobill/shared'
import { loadConfig } from './config.ts'
import { hashSecret, newDeviceToken, newId, safeEqual, spaceKey } from './crypto.ts'
import {
  applyEntity,
  changeSeq,
  changesAfter,
  cloudBookId,
  findDeviceByTokenHash,
  findSpaceByKey,
  hasCloudData,
  insertChange,
  insertSpace,
  maxSeq,
  openDb,
  replaceSpace,
  touchDevice,
  upsertDevice,
  withTxn,
} from './db.ts'
import { rateLimit } from './rateLimit.ts'
import { mountMcp } from './mcp/http.ts'
import { mountWeb } from './web.ts'

const config = loadConfig()
openDb(config.dbPath)

const app = new Hono()

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'MCP-Protocol-Version',
      'Mcp-Session-Id',
      'Last-Event-ID',
    ],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
)

app.use(
  '/v1/*',
  bodyLimit({
    maxSize: 2 * 1024 * 1024,
    onError: (c) => c.json({ error: 'payload_too_large' }, 413),
  }),
)

app.get('/healthz', (c) => c.json({ ok: true, web: Boolean(config.webRoot) }))

app.post('/v1/connect', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!rateLimit(`connect:${ip}`)) {
    return c.json({ error: 'rate_limited' }, 429)
  }

  let body: ConnectRequest
  try {
    body = await c.req.json<ConnectRequest>()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const targetKey = String(body.targetKey ?? '').trim()
  const userToken = String(body.userToken ?? '').trim()
  const deviceId = String(body.deviceId ?? '').trim()
  const deviceName = String(body.deviceName ?? '设备').trim().slice(0, 80) || '设备'

  if (!safeEqual(targetKey, config.targetKey)) {
    return c.json({ error: 'invalid_target_key' }, 403)
  }
  if (userToken.length < MIN_USER_TOKEN_LENGTH || userToken.length > MAX_TOKEN_LENGTH) {
    return c.json({ error: 'invalid_user_token' }, 400)
  }
  if (!deviceId || deviceId.length > 80) {
    return c.json({ error: 'invalid_device' }, 400)
  }

  const key = spaceKey(userToken, config.pepper)
  const now = new Date().toISOString()
  const deviceToken = newDeviceToken()
  const tokenHash = hashSecret(deviceToken)

  const result = withTxn((): ConnectResponse => {
    let space = findSpaceByKey(key)
    let isNewSpace = false
    if (!space) {
      space = { id: newId(), space_key: key, created_at: now }
      insertSpace(space)
      isNewSpace = true
    }
    upsertDevice({
      id: newId(),
      space_id: space.id,
      device_id: deviceId,
      name: deviceName,
      token_hash: tokenHash,
      created_at: now,
      last_seen: now,
    })
    return {
      deviceToken,
      spaceId: space.id,
      isNewSpace,
      hasCloudData: hasCloudData(space.id),
      cloudBookId: cloudBookId(space.id),
    }
  })

  console.log(
    result.isNewSpace ? 'space created' : 'space joined',
    `space=${result.spaceId.slice(0, 8)} device=${deviceId.slice(0, 8)}`,
  )
  return c.json(result)
})

app.post('/v1/mcp/token', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!rateLimit(`mcp-token:${ip}`)) {
    return c.json({ error: 'rate_limited' }, 429)
  }

  let body: { targetKey?: string; userToken?: string; deviceId?: string; deviceName?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const targetKey = String(body.targetKey ?? '').trim()
  const userToken = String(body.userToken ?? '').trim()
  const deviceName = (String(body.deviceName ?? '').trim() || 'AI agent').slice(0, 80)
  // One device row per named agent: the same name rotates its token, different
  // names (Claude Code, Claude Desktop, ...) keep separate tokens alive.
  const deviceId = (
    String(body.deviceId ?? '').trim() || `mcp-${agentSlug(deviceName)}`
  ).slice(0, 80)

  if (!safeEqual(targetKey, config.targetKey)) {
    return c.json({ error: 'invalid_target_key' }, 403)
  }
  if (userToken.length < MIN_USER_TOKEN_LENGTH || userToken.length > MAX_TOKEN_LENGTH) {
    return c.json({ error: 'invalid_user_token' }, 400)
  }

  const key = spaceKey(userToken, config.pepper)
  const now = new Date().toISOString()
  const token = newDeviceToken()

  const result = withTxn(() => {
    let space = findSpaceByKey(key)
    let isNewSpace = false
    if (!space) {
      space = { id: newId(), space_key: key, created_at: now }
      insertSpace(space)
      isNewSpace = true
    }
    upsertDevice({
      id: newId(),
      space_id: space.id,
      device_id: deviceId,
      name: deviceName,
      token_hash: hashSecret(token),
      created_at: now,
      last_seen: now,
    })
    return {
      token,
      spaceId: space.id,
      deviceId,
      deviceName,
      isNewSpace,
      hasCloudData: hasCloudData(space.id),
      cloudBookId: cloudBookId(space.id),
    }
  })

  console.log('mcp token issued', `space=${result.spaceId.slice(0, 8)} device=${deviceId.slice(0, 24)}`)
  return c.json(result)
})

app.post('/v1/replace', (c) => {
  const device = authDevice(c.req.header('Authorization'))
  if (!device) return c.json({ error: 'unauthorized' }, 401)
  const now = new Date().toISOString()
  withTxn(() => {
    replaceSpace(device.space_id)
    touchDevice(device.id, now)
  })
  return c.json({ cursor: '0' })
})

app.post('/v1/sync', async (c) => {
  const device = authDevice(c.req.header('Authorization'))
  if (!device) return c.json({ error: 'unauthorized' }, 401)

  let body: SyncRequest
  try {
    body = await c.req.json<SyncRequest>()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const incoming = Array.isArray(body.changes) ? body.changes : []
  if (incoming.length > MAX_CHANGES_PER_SYNC) {
    return c.json({ error: 'too_many_changes' }, 400)
  }

  const cursor = parseCursor(body.cursor)
  if (cursor === null && body.cursor != null && body.cursor !== '') {
    return c.json({ error: 'invalid_cursor' }, 400)
  }

  try {
    const response = withTxn((): SyncResponse => {
      const acked: { id: string; seq: number }[] = []
      for (const change of incoming) {
        const parsed = parseChange(change)
        if (!parsed) throw new Error('invalid_change')
        const existing = changeSeq(parsed.id)
        if (existing != null) {
          acked.push({ id: parsed.id, seq: existing })
          continue
        }
        const seq = insertChange(device.space_id, parsed)
        applyEntity(device.space_id, parsed)
        acked.push({ id: parsed.id, seq })
      }
      const after = changesAfter(device.space_id, cursor ?? 0)
      const next = maxSeq(device.space_id)
      touchDevice(device.id, new Date().toISOString())
      return { cursor: String(next), changes: after, acked }
    })
    return c.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_change') {
      return c.json({ error: 'invalid_change' }, 400)
    }
    console.error(error)
    return c.json({ error: 'sync_failed' }, 500)
  }
})

mountMcp(app)

if (config.webRoot) {
  mountWeb(app, config.webRoot)
}

app.notFound((c) => {
  if (c.req.path.startsWith('/v1/') || c.req.header('accept')?.includes('application/json')) {
    return c.json({ error: 'not_found' }, 404)
  }
  return c.text('Not found', 404)
})

function authDevice(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  if (!token) return undefined
  return findDeviceByTokenHash(hashSecret(token))
}

function agentSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'agent'
}

function parseCursor(cursor: string | null | undefined): number | null {
  if (cursor == null || cursor === '') return 0
  if (!/^\d+$/.test(cursor)) return null
  return Number(cursor)
}

function parseChange(raw: Change): Change | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.bookId !== 'string' || !raw.bookId) return null
  if (!isEntityType(raw.entity)) return null
  if (typeof raw.entityId !== 'string' || !raw.entityId) return null
  if (typeof raw.rev !== 'number' || !Number.isFinite(raw.rev)) return null
  if (typeof raw.deviceId !== 'string' || !raw.deviceId) return null
  if (typeof raw.createdAt !== 'string' || !raw.createdAt) return null
  if (!raw.payload || typeof raw.payload !== 'object') return null
  const payload = raw.payload as { id?: unknown; updatedAt?: unknown; rev?: unknown }
  if (payload.id !== raw.entityId) return null
  if (typeof payload.updatedAt !== 'string') return null
  if (typeof payload.rev !== 'number') return null
  const encoded = JSON.stringify(raw.payload)
  if (encoded.length > 100_000) return null
  return {
    id: raw.id,
    bookId: raw.bookId,
    entity: raw.entity,
    entityId: raw.entityId,
    rev: raw.rev,
    payload: raw.payload,
    deviceId: raw.deviceId,
    createdAt: raw.createdAt,
  }
}

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, () => {
  console.log(`AutoBill sync  http://${config.host}:${config.port}`)
  console.log(`database         ${config.dbPath}`)
  if (config.webRoot) {
    console.log(`web              ${config.webRoot}`)
    console.log(`open             http://127.0.0.1:${config.port}/`)
  } else {
    console.log('web              not built — run npm run build, then restart')
  }
  if (config.generatedTargetKey) {
    console.log('')
    console.log('AUTOBILL_TARGET_KEY was not set. Using the generated value in data/secrets.json:')
    console.log(`  ${config.targetKey}`)
    console.log('Put this in the app as the server target key. Keep it private.')
    console.log('')
  }
})
