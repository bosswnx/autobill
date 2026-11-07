import type { Category, TagKind } from '@autobill/shared'

export const MAX_CATEGORY_DEPTH = 2

export function categoryChildren(categories: Category[], parentId: string | null): Category[] {
  return categories
    .filter((category) => category.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

export function categoryDescendantIds(categories: Category[], id: string): Set<string> {
  const ids = new Set([id])
  for (const category of categories) {
    if (category.parentId === id) ids.add(category.id)
  }
  return ids
}

export function categoryPath(
  categories: Category[],
  id: string | null | undefined,
): string {
  if (!id) return ''
  const byId = new Map(categories.map((category) => [category.id, category]))
  const leaf = byId.get(id)
  if (!leaf) return ''
  const parent = leaf.parentId ? byId.get(leaf.parentId) : undefined
  return parent ? `${parent.name} / ${leaf.name}` : leaf.name
}

export function categoryRootId(
  categories: Category[],
  id: string | null | undefined,
): string | null {
  if (!id) return null
  const byId = new Map(categories.map((category) => [category.id, category]))
  const leaf = byId.get(id)
  if (!leaf) return null
  return leaf.parentId ?? leaf.id
}

export type FlatCategory = {
  category: Category
  depth: number
}

/** Roots first, each followed by its children. */
export function flattenCategoryTree(
  categories: Category[],
  kind?: TagKind,
): FlatCategory[] {
  const roots = categoryChildren(categories, null).filter(
    (category) => kind === undefined || category.kind === kind,
  )
  const rows: FlatCategory[] = []
  for (const root of roots) {
    rows.push({ category: root, depth: 0 })
    for (const child of categoryChildren(categories, root.id)) {
      rows.push({ category: child, depth: 1 })
    }
  }
  return rows
}
