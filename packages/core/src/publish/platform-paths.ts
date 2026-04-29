import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PlatformId } from '@prism/shared'

/**
 * Returns the absolute path to the rules directory for a given platform.
 */
export function getPlatformRulesDir(platformId: PlatformId): string {
  const home = homedir()
  switch (platformId) {
    case 'claude-code':
      return join(home, '.claude-internal', 'rules')
    case 'codebuddy':
      return join(home, '.codebuddy', 'rules')
    case 'openclaw':
      return join(home, '.openclaw', 'rules')
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
      return join(homedir(), '.claude-internal', 'skills')
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
      return join(homedir(), '.claude-internal', 'agents')
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
      return join(homedir(), '.claude-internal', 'settings.json')
    default:
      return null
  }
}

/**
 * Returns the absolute path to the commands directory for a given platform.
 */
export function getPlatformCommandsDir(platformId: PlatformId): string {
  switch (platformId) {
    case 'claude-code': return join(homedir(), '.claude-internal', 'commands')
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
