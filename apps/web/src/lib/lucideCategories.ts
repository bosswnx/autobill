import { iconNames, type IconName } from 'lucide-react/dynamic'
import categories from './lucide-categories.json'

export const LUCIDE_CATEGORY_LABEL: Record<string, string> = {
  accessibility: '无障碍',
  account: '账户',
  animals: '动物',
  arrows: '箭头',
  buildings: '建筑',
  charts: '图表',
  communication: '沟通',
  connectivity: '连接',
  cursors: '光标',
  design: '设计',
  development: '开发',
  devices: '设备',
  emoji: '表情',
  files: '文件',
  finance: '财务',
  'food-beverage': '餐饮',
  gaming: '游戏',
  home: '家居',
  layout: '布局',
  mail: '邮件',
  math: '数学',
  medical: '医疗',
  multimedia: '多媒体',
  nature: '自然',
  navigation: '导航',
  notifications: '通知',
  people: '人物',
  photography: '摄影',
  science: '科学',
  seasons: '季节',
  security: '安全',
  shapes: '形状',
  shopping: '购物',
  social: '社交',
  sports: '运动',
  sustainability: '环保',
  text: '文字',
  time: '时间',
  tools: '工具',
  transportation: '交通',
  travel: '旅行',
  weather: '天气',
}

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
