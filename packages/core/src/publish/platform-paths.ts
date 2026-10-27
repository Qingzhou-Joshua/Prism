import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PlatformId } from '@prism/shared'
import {
  buildClaudeInstance,
  discoverClaudeDirs,
  getPlatformInstance,
  getPlatformInstances,
  setPlatformInstances,
} from '../platforms/instances.js'

// All path helpers resolve against the discovered platform instances
// (see platforms/instances.ts). They return null when the platform is unknown
// or does not support that asset type.

/** Override the default Claude Code (`claude-code`) base directory — mainly for tests. */
export function setClaudeCodeBaseDir(dir: string): void {
  const next = buildClaudeInstance(dir, homedir())
  next.id = 'claude-code'
  next.displayName = 'Claude Code'
  const others = getPlatformInstances().filter(p => p.id !== 'claude-code')
  setPlatformInstances([next, ...others])
}

/** Base dir of the default Claude Code instance. */
export function claudeCodeBase(): string {
  return getPlatformInstance('claude-code')?.baseDir ?? join(homedir(), '.claude')
}

/** @deprecated Use discoverPlatformInstances(); kept for callers wanting a single dir. */
export async function resolveClaudeCodeBaseDir(): Promise<string> {
  const dirs = await discoverClaudeDirs()
  return dirs[0] ?? join(homedir(), '.claude')
}

export function getPlatformRulesDir(platformId: PlatformId): string | null {
  return getPlatformInstance(platformId)?.rulesDir ?? null
}

export function getPlatformSkillsDir(platformId: PlatformId): string | null {
  return getPlatformInstance(platformId)?.skillsDir ?? null
}

export function getPlatformAgentsDir(platformId: PlatformId): string | null {
  return getPlatformInstance(platformId)?.agentsDir ?? null
}

export function getPlatformCommandsDir(platformId: PlatformId): string | null {
  return getPlatformInstance(platformId)?.commandsDir ?? null
}

/** Path of the native MCP config file (settings/.claude.json/mcp.json/config.toml/opencode.json). */
export function getPlatformMcpSettingsPath(platformId: PlatformId): string | null {
  return getPlatformInstance(platformId)?.mcp?.path ?? null
}

export function getPlatformHooksSettingsPath(platformId: PlatformId): string | null {
  return getPlatformInstance(platformId)?.hooksSettingsPath ?? null
}

function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Converts a rule name to a kebab-case filename.
 * e.g. "TypeScript Patterns" → "typescript-patterns.md"
 */
export function ruleFileName(name: string, ext: '.md' | '.mdc' = '.md'): string {
  return kebab(name) + ext
}

/**
 * Converts a skill name to a kebab-case directory name (no extension).
 * e.g. "My Skill" → "my-skill"
 */
export function skillFileName(name: string): string {
  return kebab(name)
}

/** e.g. "Code Reviewer" → "code-reviewer.md" */
export function agentFileName(name: string): string {
  return kebab(name) + '.md'
}

/** e.g. "Deploy App" → "deploy-app.md" */
export function commandFileName(name: string): string {
  return kebab(name) + '.md'
}
