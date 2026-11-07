import { createRequire } from 'node:module'
import type { Account, Book, Category, Change, EntityType, Entry, Subscription, Tag } from '@autobill/shared'
import { incomingWins } from '@autobill/shared'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

type Sqlite = import('better-sqlite3').Database

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  space_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  UNIQUE(space_id, device_id)
);

CREATE TABLE IF NOT EXISTS changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  book_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  payload TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS changes_space_seq ON changes(space_id, seq);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  entity TEXT NOT NULL,
  book_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  rev INTEGER NOT NULL,
  deleted_at TEXT,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entities_space_book ON entities(space_id, entity, deleted_at);
`

export type SpaceRow = {
  id: string
  space_key: string
  created_at: string
}

export type DeviceRow = {
  id: string
  space_id: string
  device_id: string
  name: string
  token_hash: string
  created_at: string
  last_seen: string
}

export type EntityRow = {
  id: string
  space_id: string
  entity: string
  book_id: string
  updated_at: string
  rev: number
  deleted_at: string | null
  payload: string
}

export type StoredChange = Change & { seq: number }

let db: Sqlite

export function openDb(path: string): Sqlite {
  db = new Database(path)
  db.exec(SCHEMA)
  return db
}

export function getDb(): Sqlite {
  return db
}

export function findSpaceByKey(spaceKey: string): SpaceRow | undefined {
  return db.prepare('SELECT * FROM spaces WHERE space_key = ?').get(spaceKey) as SpaceRow | undefined
}

export function insertSpace(row: SpaceRow): void {
  db.prepare('INSERT INTO spaces (id, space_key, created_at) VALUES (?, ?, ?)').run(
    row.id,
    row.space_key,
    row.created_at,
  )
}

export function findDeviceByTokenHash(tokenHash: string): DeviceRow | undefined {
  return db
    .prepare('SELECT * FROM devices WHERE token_hash = ?')
    .get(tokenHash) as DeviceRow | undefined
}

export function upsertDevice(row: DeviceRow): void {
  db.prepare(
    `INSERT INTO devices (id, space_id, device_id, name, token_hash, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(space_id, device_id) DO UPDATE SET
       name = excluded.name,
       token_hash = excluded.token_hash,
       last_seen = excluded.last_seen`,
  ).run(row.id, row.space_id, row.device_id, row.name, row.token_hash, row.created_at, row.last_seen)
}

export function touchDevice(id: string, at: string): void {
  db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(at, id)
}

export function listEntityRows(spaceId: string, entity: EntityType): EntityRow[] {
  return db
    .prepare(
      `SELECT * FROM entities
       WHERE space_id = ? AND entity = ?
       ORDER BY updated_at ASC`,
    )
    .all(spaceId, entity) as EntityRow[]
}

export function getEntityRow(id: string): EntityRow | undefined {
  return db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as EntityRow | undefined
}

export function cloudBookId(spaceId: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM entities
       WHERE space_id = ? AND entity = 'book' AND (deleted_at IS NULL OR deleted_at = '')
       ORDER BY updated_at ASC
       LIMIT 1`,
    )
    .get(spaceId) as { id: string } | undefined
  return row?.id ?? null
}

export function hasCloudData(spaceId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM entities
       WHERE space_id = ? AND entity = 'book' AND (deleted_at IS NULL OR deleted_at = '')
       LIMIT 1`,
    )
    .get(spaceId) as { ok: number } | undefined
  return Boolean(row)
}

export function replaceSpace(spaceId: string): void {
  db.prepare('DELETE FROM changes WHERE space_id = ?').run(spaceId)
  db.prepare('DELETE FROM entities WHERE space_id = ?').run(spaceId)
}

export function insertChange(spaceId: string, change: Change): number {
  const result = db
    .prepare(
      `INSERT INTO changes (id, space_id, book_id, entity, entity_id, rev, payload, device_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      change.id,
      spaceId,
      change.bookId,
      change.entity,
      change.entityId,
      change.rev,
      JSON.stringify(change.payload),
      change.deviceId,
      change.createdAt,
    )
  return Number(result.lastInsertRowid)
}

export function changeSeq(id: string): number | undefined {
  const row = db.prepare('SELECT seq FROM changes WHERE id = ?').get(id) as { seq: number } | undefined
  return row?.seq
}

export function changesAfter(spaceId: string, cursor: number): StoredChange[] {
  const rows = db
    .prepare(
      `SELECT seq, id, book_id AS bookId, entity, entity_id AS entityId, rev, payload, device_id AS deviceId, created_at AS createdAt
       FROM changes
       WHERE space_id = ? AND seq > ?
       ORDER BY seq ASC`,
    )
    .all(spaceId, cursor) as Array<{
    seq: number
    id: string
    bookId: string
    entity: EntityType
    entityId: string
    rev: number
    payload: string
    deviceId: string
    createdAt: string
  }>
  return rows.map((row) => ({
    seq: row.seq,
    id: row.id,
    bookId: row.bookId,
    entity: row.entity,
    entityId: row.entityId,
    rev: row.rev,
    payload: JSON.parse(row.payload) as unknown,
    deviceId: row.deviceId,
    createdAt: row.createdAt,
  }))
}

export function maxSeq(spaceId: string): number {
  const row = db.prepare('SELECT MAX(seq) AS seq FROM changes WHERE space_id = ?').get(spaceId) as {
    seq: number | null
  }
  return row.seq ?? 0
}

export function applyEntity(spaceId: string, change: Change): void {
  const payload = change.payload
  if (!payload || typeof payload !== 'object') return
  const body = payload as Book | Category | Tag | Entry | Account | Subscription
  const current = db
    .prepare('SELECT updated_at AS updatedAt, rev FROM entities WHERE id = ?')
    .get(body.id) as { updatedAt: string; rev: number } | undefined

  if (!incomingWins(body, current)) return

  const bookId = 'bookId' in body && typeof body.bookId === 'string' ? body.bookId : body.id
  db.prepare(
    `INSERT INTO entities (id, space_id, entity, book_id, updated_at, rev, deleted_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       space_id = excluded.space_id,
       entity = excluded.entity,
       book_id = excluded.book_id,
       updated_at = excluded.updated_at,
       rev = excluded.rev,
       deleted_at = excluded.deleted_at,
       payload = excluded.payload`,
  ).run(
    body.id,
    spaceId,
    change.entity,
    bookId,
    body.updatedAt,
    body.rev,
    body.deletedAt ?? null,
    JSON.stringify(body),
  )
}

export function withTxn<T>(fn: () => T): T {
  return db.transaction(fn)()
}
