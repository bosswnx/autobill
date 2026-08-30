import type { Tag } from '@tagledger/shared'
import { TagIcon } from './TagIcon'

type Props = {
  tag: Tag
  active?: boolean
  count?: number
  onClick?: () => void
}

export function TagChip({ tag, active, count, onClick }: Props) {
  const filled = Boolean(active)
  const className = [
    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-[color,background-color,box-shadow] duration-150',
    onClick ? 'cursor-pointer' : '',
  ].join(' ')

  const label = (
    <>
      {tag.icon ? <TagIcon name={tag.icon} /> : null}
      <span>
        {tag.name}
        {count !== undefined ? `(${count})` : null}
      </span>
    </>
  )

  const style = filled
    ? {
        color: '#ffffff',
        background: tag.color,
        boxShadow: `inset 0 0 0 1px ${tag.color}`,
      }
    : {
        color: tag.color,
        background: 'transparent',
        boxShadow: `inset 0 0 0 1px ${tag.color}`,
      }

  if (onClick) {
    return (
      <button type="button" className={className} style={style} onClick={onClick}>
        {label}
      </button>
    )
  }

  return (
    <span className={className} style={style}>
      {label}
    </span>
  )
}
