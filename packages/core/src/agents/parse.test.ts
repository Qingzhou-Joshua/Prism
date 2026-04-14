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
})
