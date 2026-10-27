import { PIXEL_ICONS, type PixelIconName } from './pixel-icons'

interface PixelIconProps {
  name: PixelIconName
  size?: number
  /** Overrides the default pixel colour (currentColor). Palette colours still apply. */
  color?: string
  title?: string
  className?: string
  style?: React.CSSProperties
}

interface Run { x: number; y: number; w: number; fill: string }

// Merge horizontal runs of same-coloured pixels into one <rect> each.
const runCache = new Map<string, Run[]>()
function runsFor(name: PixelIconName): Run[] {
  const cached = runCache.get(name)
  if (cached) return cached
  const def = PIXEL_ICONS[name] as { rows: readonly string[]; palette?: Record<string, string> }
  const runs: Run[] = []
  def.rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let end = x
      while (end < row.length && row[end] === ch) end++
      runs.push({ x, y, w: end - x, fill: def.palette?.[ch] ?? 'currentColor' })
      x = end
    }
  })
  runCache.set(name, runs)
  return runs
}

/**
 * Pixel-art flat line icon on a 16×16 grid. The rendered size snaps to a
 * multiple of 16 so every source pixel maps to whole device pixels — at
 * fractional scales crispEdges would drop 1px strokes.
 */
export function PixelIcon({ name, size = 16, color, title, className, style }: PixelIconProps) {
  const px = Math.max(16, Math.round(size / 16) * 16)
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, color, verticalAlign: 'middle', ...style }}
    >
      {runsFor(name).map(r => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  )
}
