const PLATFORM_ICON_SRC: Record<string, string> = {
  'claude-code': '/icons/ic_claude.png',
  'claude':      '/icons/ic_claude.png',
  'openclaw':    '/icons/ic_openclaw.png',
  'codebuddy':   '/icons/ic_codebuddy.png',
}

const PLATFORM_DOT_COLOR: Record<string, string> = {
  'cursor': '#1a73e8',
  'global': '#4ecdc4',
}

interface PlatformIconProps {
  platformId: string
  size?: number
  style?: React.CSSProperties
  className?: string
}

export function PlatformIcon({ platformId, size = 16, style, className }: PlatformIconProps) {
  const src = PLATFORM_ICON_SRC[platformId]
  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        alt={platformId}
        className={className}
        style={{ objectFit: 'contain', borderRadius: 3, flexShrink: 0, display: 'block', ...style }}
      />
    )
  }

  const bg = PLATFORM_DOT_COLOR[platformId] ?? '#888'
  const dotSize = 8
  return (
    <span
      className={className}
      style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        background: bg,
        flexShrink: 0,
        display: 'inline-block',
        ...style,
      }}
    />
  )
}
