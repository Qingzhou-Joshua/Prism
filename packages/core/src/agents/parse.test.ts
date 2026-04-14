import { describe, it, expect } from 'vitest'
import { parseAgentFile } from './parse.js'

describe('parseAgentFile', () => {
  it('parses full front-matter with tools list', () => {
    const raw = `---
name: Code Reviewer
description: Reviews code quality
tools:
  - Read
  - Grep
  - Glob
model: claude-sonnet-4-5
---
# Code Reviewer

Review the code carefully.
`
    const result = parseAgentFile(raw)
    expect(result.name).toBe('Code Reviewer')
    expect(result.description).toBe('Reviews code quality')
    expect(result.tools).toEqual(['Read', 'Grep', 'Glob'])
    expect(result.model).toBe('claude-sonnet-4-5')
    expect(result.content).toContain('# Code Reviewer')
    expect(result.content).toContain('Review the code carefully.')
  })

  it('parses agent without optional fields', () => {
    const raw = `---
name: Simple Agent
---
Do something useful.
`
    const result = parseAgentFile(raw)
    expect(result.name).toBe('Simple Agent')
    expect(result.description).toBeUndefined()
    expect(result.tools).toBeUndefined()
    expect(result.model).toBeUndefined()
    expect(result.content).toContain('Do something useful.')
  })

  it('parses agent with no front-matter, uses fileName as name', () => {
    const raw = `# Just markdown content

No front-matter here.
`
    const result = parseAgentFile(raw, 'my-agent.md')
    expect(result.name).toBe('my-agent')
    expect(result.content).toContain('# Just markdown content')
  })

  it('handles empty tools list', () => {
    const raw = `---
name: No Tools Agent
tools:
---
Content here.
`
    const result = parseAgentFile(raw)
    expect(result.tools).toBeUndefined()
  })

  it('trims whitespace from name', () => {
    const raw = `---
name:   Trimmed Name
---
Content.
`
    const result = parseAgentFile(raw)
    expect(result.name).toBe('Trimmed Name')
  })

  it('strips path prefix from fileName when deriving name', () => {
    const raw = `# Agent without front-matter\nDo something.`
    const result = parseAgentFile(raw, 'planner/code-reviewer.md')
    expect(result.name).toBe('code-reviewer')
  })

  it('handles CRLF line endings in front-matter', () => {
    const raw = `---\r\nname: CRLF Agent\r\ndescription: Windows style\r\n---\r\nContent here.\r\n`
    const result = parseAgentFile(raw)
    expect(result.name).toBe('CRLF Agent')
    expect(result.description).toBe('Windows style')
    expect(result.content).toContain('Content here.')
  })

  it('returns empty name when no front-matter and no fileName', () => {
    const raw = `No front-matter, no fileName.`
    const result = parseAgentFile(raw)
    expect(result.name).toBe('')
  })

  it('returns content as-is when front-matter is malformed (no closing delimiter)', () => {
    const raw = `---\nname: Broken\nNo closing delimiter here.\n`
    const result = parseAgentFile(raw, 'broken.md')
    expect(result.name).toBe('broken')
    expect(result.content).toContain('---')
  })
})
