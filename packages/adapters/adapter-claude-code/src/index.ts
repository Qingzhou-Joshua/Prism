import type { PlatformAdapter } from '@prism/core'

export const claudeCodeAdapter: PlatformAdapter = {
  id: 'claude-code',
  displayName: 'Claude Code',
  async scan() {
    return {
      id: 'claude-code',
      displayName: 'Claude Code',
      detected: false,
      message: 'Claude Code scan not implemented yet',
      capabilities: {
        rules: true,
        profiles: true
      }
    }
  }
}
