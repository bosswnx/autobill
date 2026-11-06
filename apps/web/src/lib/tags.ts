import type { Tag, TagKind } from '@tagbill/shared'

export function entryMatchesTagFilter(
  entry: { tagIds: string[] },
  selectedIds: string[],
  tags: Pick<Tag, 'id' | 'kind'>[],
): boolean {
  if (selectedIds.length === 0) return true
  const selected = new Set(selectedIds)
  const matchesKind = (kind: TagKind): boolean | null => {
    const ids = tags.filter((tag) => tag.kind === kind && selected.has(tag.id)).map((tag) => tag.id)
    if (ids.length === 0) return null
    return ids.every((id) => entry.tagIds.includes(id))
  }
  const expense = matchesKind('expense')
  const income = matchesKind('income')
  if (expense === null) return income ?? true
  if (income === null) return expense
  return expense || income
}

export function sortByUsage(tags: Tag[], usage: Record<string, number>): Tag[] {
  return [...tags].sort((a, b) => {
    const byCount = (usage[b.id] ?? 0) - (usage[a.id] ?? 0)
    return byCount || a.name.localeCompare(b.name, 'zh')
  })
}

export function tagsOfKind(tags: Tag[], kind: TagKind): Tag[] {
  return tags.filter((tag) => tag.kind === kind)
}

export function firstSortedTagName(
  tagIds: string[],
  tags: Tag[],
  usage: Record<string, number>,
): string | undefined {
  const selected = new Set(tagIds)
  return sortByUsage(
    tags.filter((tag) => selected.has(tag.id)),
    usage,
  )[0]?.name
}
