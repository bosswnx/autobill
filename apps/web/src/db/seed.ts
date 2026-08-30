import { createBook, createEntry, createTag } from './mutations'
import { db } from './database'
import { hasLocalData, isConnected } from '../sync/session'

let seeding: Promise<void> | null = null

export async function seedIfNeeded(): Promise<void> {
  if (!seeding) seeding = seedOnce()
  return seeding
}

export async function ensureBookIfEmpty(): Promise<void> {
  if (await hasLocalData()) return
  await createBook('日常', 'CNY')
}

async function seedOnce(): Promise<void> {
  if (await isConnected()) return
  const count = await db.books.count()
  if (count > 0) return

  const book = await createBook('日常', 'CNY')

  const food = await createTag(book.id, '餐饮', '#c45c26', null, 'expense')
  const coffee = await createTag(book.id, '咖啡', '#8b5a2b', null, 'expense')
  const transit = await createTag(book.id, '交通', '#3d5a80', null, 'expense')
  const salary = await createTag(book.id, '工资', '#2f6f4e', null, 'income')
  await createTag(book.id, '日用', '#6b705c', null, 'expense')
  await createTag(book.id, '购物', '#9b4d6c', null, 'expense')

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  yesterday.setHours(9, 20, 0, 0)

  await createEntry({
    bookId: book.id,
    type: 'expense',
    amountCents: 3650,
    currency: 'CNY',
    accountId: '',
    toAccountId: null,
    tagIds: [coffee.id, food.id],
    note: '瑞幸',
    occurredAt: yesterday.toISOString(),
  })

  await createEntry({
    bookId: book.id,
    type: 'expense',
    amountCents: 600,
    currency: 'CNY',
    accountId: '',
    toAccountId: null,
    tagIds: [transit.id],
    note: '地铁',
    occurredAt: now.toISOString(),
  })

  const payday = new Date(now.getFullYear(), now.getMonth(), 5, 10, 0, 0)
  if (payday.getTime() > now.getTime()) {
    payday.setMonth(payday.getMonth() - 1)
  }
  await createEntry({
    bookId: book.id,
    type: 'income',
    amountCents: 1500000,
    currency: 'CNY',
    accountId: '',
    toAccountId: null,
    tagIds: [salary.id],
    note: '工资',
    occurredAt: payday.toISOString(),
  })
}
