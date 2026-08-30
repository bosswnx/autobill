import type { Book, Entry, Tag } from '@tagledger/shared'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { entryMatchesTagFilter } from '../lib/tags'
import { inMonth } from '../lib/time'

function alive<T extends { deletedAt: string | null }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((row) => !row.deletedAt)
}

export function useBook(): Book | undefined {
  return useLiveQuery(async () => {
    const books = await db.books.toArray()
    return books.find((book) => !book.deletedAt)
  })
}

export function useSavings(book: Book | undefined): number {
  return (
    useLiveQuery(async () => {
      if (!book) return 0
      const rows = alive(await db.entries.where('bookId').equals(book.id).toArray())
      let net = 0
      for (const entry of rows) {
        if (entry.type === 'income') net += entry.amountCents
        if (entry.type === 'expense') net -= entry.amountCents
      }
      return (book.openingBalanceCents ?? 0) + net
    }, [book?.id, book?.openingBalanceCents]) ?? 0
  )
}

export function useTags(bookId: string | undefined): Tag[] {
  return (
    useLiveQuery(async () => {
      if (!bookId) return []
      const rows = await db.tags.where('bookId').equals(bookId).toArray()
      return alive(rows).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    }, [bookId]) ?? []
  )
}

export function useAllTags(bookId: string | undefined): Tag[] {
  return (
    useLiveQuery(async () => {
      if (!bookId) return []
      return db.tags.where('bookId').equals(bookId).toArray()
    }, [bookId]) ?? []
  )
}

export function useBookEntries(bookId: string | undefined): Entry[] {
  return (
    useLiveQuery(async () => {
      if (!bookId) return []
      return alive(await db.entries.where('bookId').equals(bookId).toArray())
    }, [bookId]) ?? []
  )
}

export function useEntries(
  bookId: string | undefined,
  month: string,
  tagIds: string[],
  query: string,
): Entry[] {
  return (
    useLiveQuery(async () => {
      if (!bookId) return []
      const rows = await db.entries.where('bookId').equals(bookId).toArray()
      const tags = alive(await db.tags.where('bookId').equals(bookId).toArray())
      const needle = query.trim().toLowerCase()
      return alive(rows)
        .filter((entry) => inMonth(entry.occurredAt, month))
        .filter((entry) => entryMatchesTagFilter(entry, tagIds, tags))
        .filter((entry) => {
          if (!needle) return true
          return entry.note.toLowerCase().includes(needle)
        })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    }, [bookId, month, tagIds.join('|'), query]) ?? []
  )
}

export function useMonthStats(bookId: string | undefined, month: string) {
  return (
    useLiveQuery(async () => {
      if (!bookId) return { expense: 0, income: 0, net: 0, count: 0 }
      const rows = alive(await db.entries.where('bookId').equals(bookId).toArray()).filter(
        (entry) => inMonth(entry.occurredAt, month),
      )
      let expense = 0
      let income = 0
      for (const entry of rows) {
        if (entry.type === 'expense') expense += entry.amountCents
        if (entry.type === 'income') income += entry.amountCents
      }
      return { expense, income, net: income - expense, count: rows.length }
    }, [bookId, month]) ?? { expense: 0, income: 0, net: 0, count: 0 }
  )
}

export function useTagUsage(bookId: string | undefined): Record<string, number> {
  return (
    useLiveQuery(async () => {
      if (!bookId) return {}
      const rows = alive(await db.entries.where('bookId').equals(bookId).toArray())
      const usage: Record<string, number> = {}
      for (const entry of rows) {
        for (const tagId of entry.tagIds) {
          usage[tagId] = (usage[tagId] ?? 0) + 1
        }
      }
      return usage
    }, [bookId]) ?? {}
  )
}

export function useEntry(id: string | undefined): Entry | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined
    return db.entries.get(id)
  }, [id])
}
