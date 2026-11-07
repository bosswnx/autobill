import { createBook, createCategory, createEntry, createTag } from './mutations'
import { db } from './database'
import { getMessages } from '../i18n'
import { hasLocalData, isConnected } from '../sync/session'

let seeding: Promise<void> | null = null

export async function seedIfNeeded(): Promise<void> {
  if (!seeding) seeding = seedOnce()
  return seeding
}

export async function ensureBookIfEmpty(): Promise<void> {
  if (await hasLocalData()) return
  await createBook(getMessages().seed.bookName, 'CNY')
}

async function seedOnce(): Promise<void> {
  if (await isConnected()) return
  const count = await db.books.count()
  if (count > 0) return

  const seed = getMessages().seed
  const book = await createBook(seed.bookName, 'CNY')

  const food = await createCategory(book.id, {
    name: seed.tags.food,
    kind: 'expense',
    color: '#c45c26',
  })
  const coffee = await createCategory(book.id, {
    name: seed.tags.coffee,
    kind: 'expense',
    parentId: food.id,
    color: '#8b5a2b',
  })
  const transit = await createCategory(book.id, {
    name: seed.tags.transit,
    kind: 'expense',
    color: '#3d5a80',
  })
  const salary = await createCategory(book.id, {
    name: seed.tags.salary,
    kind: 'income',
    color: '#2f6f4e',
  })
  await createCategory(book.id, {
    name: seed.tags.daily,
    kind: 'expense',
    color: '#6b705c',
  })
  await createCategory(book.id, {
    name: seed.tags.shopping,
    kind: 'expense',
    color: '#9b4d6c',
  })

  const foodTag = await createTag(book.id, seed.tags.food, '#c45c26', null, 'expense')
  const coffeeTag = await createTag(book.id, seed.tags.coffee, '#8b5a2b', null, 'expense')
  const transitTag = await createTag(book.id, seed.tags.transit, '#3d5a80', null, 'expense')
  const salaryTag = await createTag(book.id, seed.tags.salary, '#2f6f4e', null, 'income')
  await createTag(book.id, seed.tags.daily, '#6b705c', null, 'expense')
  await createTag(book.id, seed.tags.shopping, '#9b4d6c', null, 'expense')

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
    categoryId: coffee.id,
    tagIds: [coffeeTag.id, foodTag.id],
    note: seed.notes.luckin,
    remark: '',
    occurredAt: yesterday.toISOString(),
  })

  await createEntry({
    bookId: book.id,
    type: 'expense',
    amountCents: 600,
    currency: 'CNY',
    accountId: '',
    toAccountId: null,
    categoryId: transit.id,
    tagIds: [transitTag.id],
    note: seed.notes.metro,
    remark: '',
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
    categoryId: salary.id,
    tagIds: [salaryTag.id],
    note: seed.notes.salary,
    remark: '',
    occurredAt: payday.toISOString(),
  })
}
