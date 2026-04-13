import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { PlatformId } from '@prism/shared'
import { getPlatformRulesDir, ruleFileName, getPlatformSkillsDir, skillFileName } from './platform-paths.js'

describe('getPlatformRulesDir', () => {
  it('returns claude-code rules dir', () => {
    expect(getPlatformRulesDir('claude-code')).toBe(join(homedir(), '.claude-internal', 'rules'))
  })

  it('returns openclaw rules dir', () => {
    expect(getPlatformRulesDir('openclaw')).toBe(join(homedir(), '.openclaw', 'rules'))
  })

  it('returns codebuddy rules dir', () => {
    expect(getPlatformRulesDir('codebuddy')).toBe(join(homedir(), '.codebuddy', 'rules'))
  })
})

describe('ruleFileName', () => {
  it('lowercases and kebab-cases the name', () => {
    expect(ruleFileName('TypeScript Patterns')).toBe('typescript-patterns.md')
  })

  it('handles already-lowercase names', () => {
    expect(ruleFileName('my-rule')).toBe('my-rule.md')
  })
})

describe('getPlatformSkillsDir', () => {
  it('returns claude-code skills dir', () => {
    const dir = getPlatformSkillsDir('claude-code')
    expect(dir).toBe(join(homedir(), '.claude-internal', 'skills'))
  })

  it('returns codebuddy skills dir', () => {
    const dir = getPlatformSkillsDir('codebuddy')
    expect(dir).toBe(join(homedir(), '.codebuddy', 'skills'))
  })

  it('throws for unsupported platform', () => {
    expect(() => getPlatformSkillsDir('openclaw' as PlatformId)).toThrow(
      'Platform openclaw does not support skills'
    )
  })
})

describe('skillFileName', () => {
  it('lowercases and kebab-cases the name', () => {
    expect(skillFileName('My Skill')).toBe('my-skill.md')
  })

  it('strips non-alphanumeric characters', () => {
    expect(skillFileName('Hello World!')).toBe('hello-world.md')
  })

  it('handles already-lowercase single-word names', () => {
    expect(skillFileName('deploy')).toBe('deploy.md')
  })
})
