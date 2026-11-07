import { db } from './database'
import { createEntry } from './mutations'
import {
  duePeriods,
  matchesLegacySlot,
  occurrenceAt,
  recurrencesOf,
  scheduledEntryId,
  slotKey,
} from '../lib/subscriptionSchedule'

let running = false

export async function fireDueSubscriptions(now = new Date()): Promise<void> {
  if (running) return
  running = true
  try {
    const books = (await db.books.toArray()).filter((book) => !book.deletedAt)
    for (const book of books) {
      const rows = await db.subscriptions.where('bookId').equals(book.id).toArray()
      for (const sub of rows) {
        if (sub.deletedAt || !sub.enabled) continue
        const startsAt = new Date(sub.startsAt || sub.createdAt)
        for (const rec of recurrencesOf(sub)) {
          const periods = duePeriods(rec, startsAt, now)
          const key = slotKey(rec)
          for (const period of periods) {
            const id = scheduledEntryId(sub.id, period, key)
            if (await db.entries.get(id)) continue
            if (matchesLegacySlot(sub, rec) && (await db.entries.get(scheduledEntryId(sub.id, period)))) {
              continue
            }
            const at = occurrenceAt(rec, period)
            await createEntry({
              id,
              bookId: book.id,
              type: sub.type,
              amountCents: sub.amountCents,
              currency: sub.currency || book.currency,
              accountId: '',
              toAccountId: null,
              categoryId: null,
              tagIds: sub.tagIds,
              note: sub.note,
              remark: '',
              occurredAt: at.toISOString(),
            })
          }
        }
      }
    }
  } finally {
    running = false
  }
}
