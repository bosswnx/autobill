import type { EntryType } from '@autobill/shared'
import { getMessages } from '../i18n'

export function entryTitle(
  note: string,
  type: EntryType,
  firstTagName?: string | null,
): string {
  const trimmed = note.trim()
  if (trimmed) return trimmed
  if (firstTagName) return firstTagName
  return getMessages().entryType[type]
}
