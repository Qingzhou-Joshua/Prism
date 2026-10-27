import { PixelIcon } from './PixelIcon'
import type { PixelIconName } from './pixel-icons'

const PLATFORM_PIXEL_ICON: Record<string, PixelIconName> = {
  'claude-code': 'claude',
  claude: 'claude',
  codebuddy: 'codebuddy',
  cursor: 'cursor',
  codex: 'codex',
  opencode: 'opencode',
}

const PLATFORM_DOT_COLOR: Record<string, string> = {
  'global': '#4ecdc4',
}

/** Instance ids like `claude-code-tclaude` share their kind's icon. */
function kindOf(platformId: string): string {
  if (platformId.startsWith('claude-code')) return 'claude-code'
  return platformId
}

interface PlatformIconProps {
  platformId: string
  size?: number
  style?: React.CSSProperties
  className?: string
}

export function PlatformIcon({ platformId, size = 16, style, className }: PlatformIconProps) {
  const icon = PLATFORM_PIXEL_ICON[kindOf(platformId)]
  if (icon) {
    return <PixelIcon name={icon} size={size} title={platformId} className={className} style={style} />
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
