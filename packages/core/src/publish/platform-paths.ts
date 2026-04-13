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
    case 'openclaw':
      return join(home, '.openclaw', 'rules')
    case 'codebuddy':
      return join(home, '.codebuddy', 'rules')
    case 'cursor':
      return join(home, '.cursor', 'rules')
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
 * Only claude-code and codebuddy support skills.
 */
export function getPlatformSkillsDir(platformId: PlatformId): string {
  switch (platformId) {
    case 'claude-code':
      return join(homedir(), '.claude-internal', 'skills')
    case 'codebuddy':
      return join(homedir(), '.codebuddy', 'skills')
    default:
      throw new Error(`Platform ${platformId} does not support skills`)
  }
}

/**
 * Converts a skill name to a kebab-case filename with .md extension.
 * e.g. "My Skill" → "my-skill.md"
 */
export function skillFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') + '.md'
  )
}
