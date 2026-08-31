import { useI18n } from '../i18n'
import { useChartScrub } from '../lib/chartScrub'
import { formatYuan } from '../lib/money'
import type { SeriesPoint, TagAmount } from '../lib/stats'
import { TagChip } from './TagChip'

const CHART_TOUCH = 'touch-pan-y select-none'

function formatChartYuan(cents: number): string {
  return formatYuan(cents, { sign: cents < 0 ? 'auto' : 'never' })
}

export function BarChart({
  points,
  color,
}: {
  points: SeriesPoint[]
  color: string
}) {
  const max = Math.max(0, ...points.map((point) => point.cents))
  const scrub = useChartScrub(points.length)
  const hover = scrub.index !== null ? points[scrub.index] ?? null : null
  const shown = hover ?? tallest(points)

  return (
    <div>
      <div
        ref={scrub.ref}
        className={`flex h-36 items-end gap-[2px] overflow-visible pt-5 ${CHART_TOUCH}`}
        {...scrub.pointerProps}
      >
        {points.map((point) => {
          const ratio = max > 0 ? point.cents / max : 0
          const active = shown?.key === point.key
          const bar = ratio > 0 ? Math.max(ratio * 124, 4) : 0
          return (
            <div
              key={point.key}
              title={`${point.label} ${formatYuan(point.cents, { sign: 'never' })}`}
              className="pointer-events-none relative flex h-full min-w-0 flex-1 items-end"
            >
              {active && (hover !== null || point.cents > 0) ? (
                <span className="absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted">
                  {formatYuan(point.cents, { sign: 'never' })}
                </span>
              ) : null}
              <span
                className="w-full rounded-t-[2px] transition-opacity duration-150"
                style={{
                  height: `${bar}px`,
                  background: color,
                  opacity: hover && !active ? 0.35 : 1,
                }}
              />
            </div>
          )
        })}
      </div>
      <AxisTicks points={points} highlightKeys={hover ? [hover.key] : []} />
    </div>
  )
}

export function LineChart({ points, color }: { points: SeriesPoint[]; color: string }) {
  const { t } = useI18n()
  const scrub = useChartScrub(points.length)
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">{t.stats.noData}</p>
  }

  const hover =
    scrub.index !== null && scrub.index < points.length ? scrub.index : null
  const values = points.map((point) => point.cents)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = Math.max((hi - lo) * 0.12, 100)
  const min = lo - pad
  const max = lo < 0 && hi <= 0 ? Math.max(0, hi + pad) : hi + pad
  const span = max - min || 1
  const width = 320
  const height = 144
  const top = 8
  const bottom = 8
  const innerH = height - top - bottom
  const floor = top + innerH
  const zeroY = Math.min(floor, Math.max(top, top + ((max - 0) / span) * innerH))

  const slot = width / points.length
  const coords = points.map((point, index) => {
    const x = (index + 0.5) * slot
    const y = top + ((max - point.cents) / span) * innerH
    return { x, y, point }
  })
  const line = `0,${coords[0].y} ${coords.map((item) => `${item.x},${item.y}`).join(' ')} ${width},${coords[coords.length - 1].y}`
  const area = `0,${zeroY} ${line} ${width},${zeroY}`
  const end = coords.length - 1
  let high = 0
  let low = 0
  for (let i = 1; i < coords.length; i++) {
    if (coords[i].point.cents > coords[high].point.cents) high = i
    if (coords[i].point.cents < coords[low].point.cents) low = i
  }
  const marked = new Map<number, { dash: boolean; amount: boolean }>()
  marked.set(end, { dash: high === end || low === end, amount: true })
  marked.set(high, { dash: true, amount: true })
  marked.set(low, { dash: true, amount: true })
  if (hover !== null) {
    marked.set(hover, { dash: true, amount: true })
  }

  return (
    <div>
      <div
        ref={scrub.ref}
        className={`relative h-36 overflow-visible ${CHART_TOUCH}`}
        {...scrub.pointerProps}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="pointer-events-none h-full w-full"
        >
          <polygon points={area} fill={color} opacity="0.12" />
          {lo < 0 ? (
            <line
              x1="0"
              x2={width}
              y1={zeroY}
              y2={zeroY}
              stroke={color}
              strokeOpacity="0.28"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {[...marked.entries()].map(([index, flags]) => (
          <LineMark
            key={coords[index].point.key}
            x={(coords[index].x / width) * 100}
            y={(coords[index].y / height) * 100}
            color={color}
            amount={flags.amount ? formatChartYuan(coords[index].point.cents) : null}
            dash={flags.dash}
          />
        ))}
      </div>
      <AxisTicks
        points={points}
        highlightKeys={[
          coords[high].point.key,
          coords[low].point.key,
          hover !== null ? coords[hover].point.key : '',
        ]}
      />
    </div>
  )
}

function LineMark({
  x,
  y,
  color,
  amount,
  dash,
}: {
  x: number
  y: number
  color: string
  amount: string | null
  dash: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {dash ? (
        <div
          className="absolute border-l border-dashed"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            bottom: 0,
            borderColor: color,
            transform: 'translateX(-50%)',
          }}
        />
      ) : null}
      <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
        <div className="-translate-x-1/2 -translate-y-1/2">
          {amount ? (
            <div className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-muted">
              {amount}
            </div>
          ) : null}
          <div className="size-1.5 rounded-full" style={{ background: color }} />
        </div>
      </div>
    </div>
  )
}

export function TagAmountList({ items, empty }: { items: TagAmount[]; empty: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted">{empty}</p>
  }
  const max = items[0]?.cents ?? 0
  return (
    <div className="grid w-full grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-x-3 gap-y-2.5">
      {items.map((item) => (
        <div key={item.tag.id} className="contents">
          <div className="flex items-center justify-end">
            <TagChip tag={item.tag} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-hover">
            <div
              className="h-full rounded-full"
              style={{
                width: `${max > 0 ? (item.cents / max) * 100 : 0}%`,
                background: item.tag.color,
              }}
            />
          </div>
          <span className="text-left tabular-nums text-xs text-muted">
            {formatYuan(item.cents, { sign: 'never' })}
          </span>
        </div>
      ))}
    </div>
  )
}

function AxisTicks({
  points,
  highlightKeys = [],
}: {
  points: SeriesPoint[]
  highlightKeys?: string[]
}) {
  const extra = new Set(highlightKeys.filter(Boolean))
  const tickEvery = points.length > 20 ? 5 : points.length > 12 ? 2 : 1
  const last = points.length - 1
  let lastRegular = 0
  for (let i = 0; i < last; i++) {
    if (i === 0 || (i + 1) % tickEvery === 0) lastRegular = i
  }
  const showLast = last - lastRegular >= 2

  return (
    <div className="relative mt-1.5 flex h-4 gap-[2px] overflow-visible text-[11px] tabular-nums text-muted">
      {points.map((point, index) => {
        const onTick =
          index === 0 ||
          (index + 1) % tickEvery === 0 ||
          (index === last && showLast) ||
          extra.has(point.key)
        return (
          <span key={point.key} className="relative min-w-0 flex-1 overflow-visible">
            {onTick ? (
              <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap">
                {point.label}
              </span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

function tallest(points: SeriesPoint[]): SeriesPoint | null {
  if (points.length === 0) return null
  return points.reduce((best, point) => (point.cents > best.cents ? point : best))
}
