import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getPlatformRulesDir, ruleFileName, getPlatformSkillsDir, skillFileName } from './platform-paths.js'

describe('getPlatformRulesDir', () => {
  it('returns claude-code rules dir', () => {
    expect(getPlatformRulesDir('claude-code')).toBe(join(homedir(), '.claude-internal', 'rules'))
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
})

describe('skillFileName', () => {
  it('lowercases and kebab-cases the name', () => {
    expect(skillFileName('My Skill')).toBe('my-skill')
  })

  it('strips non-alphanumeric characters', () => {
    expect(skillFileName('Hello World!')).toBe('hello-world')
  })

  it('handles already-lowercase single-word names', () => {
    expect(skillFileName('deploy')).toBe('deploy')
  })
})
