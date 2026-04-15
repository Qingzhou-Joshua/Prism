export const ALL_PLATFORMS = ['claude-code', 'codebuddy'] as const

export type KnownPlatformId = (typeof ALL_PLATFORMS)[number]

export const PLATFORM_LABELS: Record<KnownPlatformId, string> = {
  'claude-code': 'Claude Code',
  codebuddy: 'CodeBuddy',
}
