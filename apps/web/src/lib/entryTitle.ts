import type { EntryType } from '@tagledger/shared'
import { ENTRY_TYPE_LABEL } from '@tagledger/shared'

export function entryTitle(
  note: string,
  type: EntryType,
  firstTagName?: string | null,
): string {
  const trimmed = note.trim()
  if (trimmed) return trimmed
  if (firstTagName) return firstTagName
  return ENTRY_TYPE_LABEL[type]
}
