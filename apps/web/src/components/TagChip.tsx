import { useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import type { Tag } from '@tagledger/shared'
import { TagIcon } from './TagIcon'

type Props = {
  tag: Tag
  active?: boolean
  count?: number
  size?: 'md' | 'sm'
  onClick?: () => void
}

const MOVE_PX = 10
const SUPPRESS_CLICK_MS = 700

export function TagChip({ tag, active, count, size = 'md', onClick }: Props) {
  const filled = Boolean(active)
  const className = [
    'tag-chip inline-flex items-center gap-1 rounded font-medium transition-[color,background-color,box-shadow] duration-150',
    filled ? 'is-filled' : '',
    size === 'sm' ? 'px-1 py-px text-xs' : 'px-1.5 py-0.5 text-base md:text-sm',
    onClick ? 'cursor-pointer touch-manipulation' : '',
  ].join(' ')
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const handledAt = useRef(0)

  const label = (
    <>
      {tag.icon ? <TagIcon name={tag.icon} /> : null}
      <span>
        {tag.name}
        {count !== undefined ? `(${count})` : null}
      </span>
    </>
  )

  const style = { '--tag-color': tag.color } as CSSProperties

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse') return
    if (!event.isPrimary) return
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (dx * dx + dy * dy > MOVE_PX * MOVE_PX) return
    event.preventDefault()
    handledAt.current = Date.now()
    onClick?.()
  }

  function handlePointerCancel() {
    touchStart.current = null
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (Date.now() - handledAt.current < SUPPRESS_CLICK_MS) {
      event.preventDefault()
      return
    }
    onClick?.()
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={(event) => event.preventDefault()}
        onClick={handleClick}
      >
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
