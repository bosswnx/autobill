export type EntryType = 'expense' | 'income' | 'transfer'

export type TagKind = 'expense' | 'income'

export type AccountKind = 'cash' | 'bank' | 'alipay' | 'wechat' | 'credit' | 'other'

export type EntityType = 'book' | 'account' | 'tag' | 'entry'

export type Syncable = {
  id: string
  rev: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Book = Syncable & {
  name: string
  currency: string
  openingBalanceCents: number
}

export type Account = Syncable & {
  bookId: string
  name: string
  kind: AccountKind
}

export type Tag = Syncable & {
  bookId: string
  kind: TagKind
  name: string
  color: string
  icon?: string | null
}

export type Entry = Syncable & {
  bookId: string
  type: EntryType
  amountCents: number
  currency: string
  accountId: string
  toAccountId: string | null
  tagIds: string[]
  note: string
  occurredAt: string
}

export type Change = {
  id: string
  bookId: string
  entity: EntityType
  entityId: string
  rev: number
  payload: unknown
  deviceId: string
  createdAt: string
  seq?: number | null
}

export type SyncCursor = string

export type SyncRequest = {
  cursor: SyncCursor | null
  deviceId: string
  changes: Change[]
}

export type SyncResponse = {
  cursor: SyncCursor
  changes: Change[]
  acked: { id: string; seq: number }[]
}

export type ConnectRequest = {
  targetKey: string
  userToken: string
  deviceId: string
  deviceName: string
}

export type ConnectResponse = {
  deviceToken: string
  spaceId: string
  isNewSpace: boolean
  hasCloudData: boolean
  cloudBookId: string | null
}

export type MergeChoice = 'local' | 'cloud' | 'both'

export const ENTITY_TYPES: EntityType[] = ['book', 'account', 'tag', 'entry']

export const MIN_USER_TOKEN_LENGTH = 8
export const MAX_TOKEN_LENGTH = 256
export const MAX_CHANGES_PER_SYNC = 500

export function incomingWins(
  incoming: Pick<Syncable, 'updatedAt' | 'rev'>,
  current: Pick<Syncable, 'updatedAt' | 'rev'> | undefined,
): boolean {
  if (!current) return true
  if (incoming.updatedAt !== current.updatedAt) return incoming.updatedAt > current.updatedAt
  return incoming.rev >= current.rev
}

export function isEntityType(value: string): value is EntityType {
  return ENTITY_TYPES.includes(value as EntityType)
}

export const TAG_COLOR_PALETTE = [
  '#c45c26',
  '#3d5a80',
  '#2f6f4e',
  '#9b4d6c',
  '#6b705c',
  '#7c4a7c',
  '#8b5a2b',
  '#4a5568',
  '#b45309',
  '#1d4e89',
  '#9a3412',
  '#365314',
] as const

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  cash: '现金',
  bank: '银行卡',
  alipay: '支付宝',
  wechat: '微信',
  credit: '信用卡',
  other: '其他',
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  expense: '支出',
  income: '收入',
  transfer: '转账',
}

export const TAG_KIND_LABEL: Record<TagKind, string> = {
  expense: '支出',
  income: '收入',
}
