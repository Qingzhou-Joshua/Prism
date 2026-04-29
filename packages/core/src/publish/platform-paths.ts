import { homedir } from 'node:os'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import type { PlatformId } from '@prism/shared'

// ── Claude Code base dir detection ─────────────────────────────────────────
//
// Scans homedir() for any directory matching /^\.claude/ and prefers `.claude`.
// Falls back to `~/.claude` if no match is found.
//
// Usage: call resolveClaudeCodeBaseDir() once at server startup, then call
// setClaudeCodeBaseDir() with the result before constructing any stores.
// All path functions below will use the cached value automatically.

let _claudeCodeBaseDir: string | null = null

/** Override the detected Claude Code base directory (e.g. for tests or startup). */
export function setClaudeCodeBaseDir(dir: string): void {
  _claudeCodeBaseDir = dir
}

/** Returns the cached base dir, defaulting to ~/.claude if not yet resolved. */
export function claudeCodeBase(): string {
  return _claudeCodeBaseDir ?? join(homedir(), '.claude')
}

/**
 * Detect the Claude Code config base directory at runtime.
 * Scans homedir() for directories matching `.claude*`, preferring `.claude` if present.
 * Falls back to `~/.claude` if none found.
 * Call this once at server startup and pass the result to setClaudeCodeBaseDir().
 */
export async function resolveClaudeCodeBaseDir(): Promise<string> {
  const home = homedir()
  const defaultDir = join(home, '.claude')
  try {
    const entries = await readdir(home, { withFileTypes: true })
    const claudeDirs = entries
      .filter(e => e.isDirectory() && /^\.claude/.test(e.name))
      .map(e => e.name)
    if (claudeDirs.includes('.claude')) return join(home, '.claude')
    if (claudeDirs.length > 0) return join(home, claudeDirs[0])
  } catch {
    // fallthrough to default
  }
  return defaultDir
}

/**
 * Returns the absolute path to the rules directory for a given platform.
 */
export function getPlatformRulesDir(platformId: PlatformId): string {
  switch (platformId) {
    case 'claude-code':
      return join(claudeCodeBase(), 'rules')
    case 'codebuddy':
      return join(homedir(), '.codebuddy', 'rules')
    case 'openclaw':
      return join(homedir(), '.openclaw', 'rules')
  }
}

/**
 * Converts a rule name to a kebab-case filename with .md extension.
 * e.g. "TypeScript Patterns" → "typescript-patterns.md"
 */
export function ruleFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.md'
  )
}

/**
 * Returns the absolute path to the skills directory for a given platform.
 * Supported: claude-code, codebuddy.
 */
export function getPlatformSkillsDir(platformId: PlatformId): string {
  switch (platformId) {
    case 'claude-code':
      return join(claudeCodeBase(), 'skills')
    case 'codebuddy':
      return join(homedir(), '.codebuddy', 'skills')
    case 'openclaw':
      return join(homedir(), '.openclaw', 'skills')
  }
}

/**
 * Converts a skill name to a kebab-case directory name (no extension).
 * Skills are stored as directories containing a SKILL.md file.
 * e.g. "My Skill" → "my-skill"
 */
export function skillFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Returns the absolute path to the agents directory for a given platform.
 * Returns null for unsupported platforms.
 */
export function getPlatformAgentsDir(platformId: PlatformId): string | null {
  switch (platformId) {
    case 'claude-code':
      return join(claudeCodeBase(), 'agents')
    case 'codebuddy':
      return join(homedir(), '.codebuddy', 'agents')
    case 'openclaw':
      return join(homedir(), '.openclaw', 'agents')
  }
}

/**
 * Converts an agent name to a kebab-case filename with .md extension.
 * e.g. "Code Reviewer" → "code-reviewer.md"
 */
export function agentFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.md'
  )
}

/**
 * Returns the absolute path to the MCP settings file for a given platform.
 * Only claude-code supports MCP settings via settings.json.
 * Returns null for unsupported platforms.
 */
export function getPlatformMcpSettingsPath(platformId: PlatformId): string | null {
  switch (platformId) {
    case 'claude-code':
      return join(claudeCodeBase(), 'settings.json')
    default:
      return null
  }
}

/**
 * Returns the absolute path to the commands directory for a given platform.
 */
export function getPlatformCommandsDir(platformId: PlatformId): string {
  switch (platformId) {
    case 'claude-code': return join(claudeCodeBase(), 'commands')
    case 'codebuddy':   return join(homedir(), '.codebuddy', 'commands')
    case 'openclaw':    return join(homedir(), '.openclaw', 'commands')
  }
}

/**
 * Converts a command name to a kebab-case filename with .md extension.
 * e.g. "Deploy App" → "deploy-app.md"
 */
export function commandFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.md'
  )
}
