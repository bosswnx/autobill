import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic'

const available = new Set<string>(iconNames)

const ALIAS: Record<string, string> = {
  food: 'utensils',
  coffee: 'coffee',
  drink: 'cup-soda',
  cart: 'shopping-cart',
  home: 'house',
  car: 'car',
  transit: 'train-front',
  plane: 'plane',
  fuel: 'fuel',
  coin: 'coins',
  card: 'credit-card',
  gift: 'gift',
  phone: 'smartphone',
  laptop: 'laptop',
  game: 'gamepad-2',
  film: 'clapperboard',
  book: 'book-open',
  pill: 'pill',
  cross: 'heart-pulse',
  shirt: 'shirt',
  scissors: 'scissors',
  receipt: 'receipt',
  paw: 'paw-print',
  leaf: 'leaf',
  bulb: 'lightbulb',
  music: 'music',
  sport: 'dumbbell',
  school: 'graduation-cap',
  '🍜': 'utensils',
  '🍱': 'utensils',
  '☕': 'coffee',
  '🧋': 'cup-soda',
  '🍺': 'beer',
  '🛒': 'shopping-cart',
  '🏠': 'house',
  '🚗': 'car',
  '🚇': 'train-front',
  '✈️': 'plane',
  '⛽': 'fuel',
  '💰': 'coins',
  '💳': 'credit-card',
  '🎁': 'gift',
  '📱': 'smartphone',
  '💻': 'laptop',
  '🎮': 'gamepad-2',
  '🎬': 'clapperboard',
  '📚': 'book-open',
  '💊': 'pill',
  '🏥': 'heart-pulse',
  '👕': 'shirt',
  '✂️': 'scissors',
  '🧾': 'receipt',
  '🐶': 'paw-print',
  '🌱': 'leaf',
  '💡': 'lightbulb',
  '🎵': 'music',
  '🏋️': 'dumbbell',
  '🎓': 'graduation-cap',
}

export function resolveTagIcon(icon: string | null | undefined): IconName | null {
  if (!icon) return null
  const name = ALIAS[icon] ?? icon
  return available.has(name) ? (name as IconName) : null
}

export function TagIcon({
  name,
  size = 12,
}: {
  name: string
  size?: number
}) {
  const id = resolveTagIcon(name)
  if (!id) return null
  return <DynamicIcon name={id} size={size} strokeWidth={1.15} aria-hidden />
}
