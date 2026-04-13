import type { PlatformId } from '@prism/shared'

export const ALL_PLATFORMS: PlatformId[] = ['claude-code', 'openclaw', 'codebuddy', 'cursor']

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  'claude-code': 'Claude Code',
  'openclaw': 'OpenClaw',
  'codebuddy': 'CodeBuddy',
  'cursor': 'Cursor',
}
