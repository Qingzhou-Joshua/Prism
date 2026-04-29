import { describe, it, expect, beforeEach } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  getPlatformRulesDir,
  ruleFileName,
  getPlatformSkillsDir,
  skillFileName,
  setClaudeCodeBaseDir,
} from './platform-paths.js'

// Pin the Claude Code base dir for deterministic tests.
// In production this is set at server startup via resolveClaudeCodeBaseDir().
const FAKE_CC_BASE = join(homedir(), '.claude')

beforeEach(() => {
  setClaudeCodeBaseDir(FAKE_CC_BASE)
})

describe('getPlatformRulesDir', () => {
  it('returns claude-code rules dir', () => {
    expect(getPlatformRulesDir('claude-code')).toBe(join(FAKE_CC_BASE, 'rules'))
  })

  it('returns codebuddy rules dir', () => {
    expect(getPlatformRulesDir('codebuddy')).toBe(join(homedir(), '.codebuddy', 'rules'))
  })

  it('uses .claude base dir when set to public path', () => {
    setClaudeCodeBaseDir(join(homedir(), '.claude'))
    expect(getPlatformRulesDir('claude-code')).toBe(join(homedir(), '.claude', 'rules'))
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
    expect(dir).toBe(join(FAKE_CC_BASE, 'skills'))
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
