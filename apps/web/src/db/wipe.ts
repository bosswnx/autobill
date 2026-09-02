import { db } from './database'
import { ensureBookIfEmpty } from './seed'

export async function wipeAllLocalData(): Promise<void> {
  await db.transaction('rw', [db.books, db.accounts, db.tags, db.entries, db.subscriptions, db.changes, db.meta], async () => {
    await db.books.clear()
    await db.accounts.clear()
    await db.tags.clear()
    await db.entries.clear()
    await db.subscriptions.clear()
    await db.changes.clear()
    await db.meta.clear()
  })
  await ensureBookIfEmpty()
}
