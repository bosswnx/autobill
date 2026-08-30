import { iconNames, type IconName } from 'lucide-react/dynamic'
import categories from './lucide-categories.json'

const available = new Set<string>(iconNames)

export const LUCIDE_CATEGORY_IDS = Object.keys(categories).filter((id) =>
  (categories as Record<string, string[]>)[id].some((name) => available.has(name)),
)

export function iconsInCategory(id: string): IconName[] {
  return ((categories as Record<string, string[]>)[id] ?? []).filter((name): name is IconName =>
    available.has(name),
  )
}

export function searchLucideIcons(query: string): IconName[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '-')
  if (!needle) return []
  return iconNames.filter((name) => name.includes(needle))
}
