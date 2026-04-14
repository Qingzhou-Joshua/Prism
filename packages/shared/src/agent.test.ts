import { describe, it, expect } from 'vitest'
import type { UnifiedAgent, CreateAgentDto, UpdateAgentDto, ImportedAgent } from './agent.js'

describe('UnifiedAgent type', () => {
  it('accepts a valid agent object', () => {
    const agent: UnifiedAgent = {
      id: 'test-id',
      name: 'Code Reviewer',
      content: '# Code Reviewer\nReview code for quality.',
      tools: ['Read', 'Grep', 'Glob'],
      model: 'claude-sonnet-4-5',
      tags: ['review'],
      targetPlatforms: ['claude-code'],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    expect(agent.id).toBe('test-id')
    expect(agent.tools).toHaveLength(3)
    expect(agent.model).toBe('claude-sonnet-4-5')
  })

  it('accepts agent without optional fields', () => {
    const agent: UnifiedAgent = {
      id: 'test-id',
      name: 'Simple Agent',
      content: 'Do something.',
      tags: [],
      targetPlatforms: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    expect(agent.description).toBeUndefined()
    expect(agent.tools).toBeUndefined()
    expect(agent.model).toBeUndefined()
  })

  it('accepts CreateAgentDto', () => {
    const dto: CreateAgentDto = {
      name: 'My Agent',
      content: 'Content here',
      targetPlatforms: ['claude-code'],
    }
    expect(dto.name).toBe('My Agent')
  })

  it('accepts UpdateAgentDto with partial fields', () => {
    const dto: UpdateAgentDto = {
      name: 'Updated Name',
    }
    expect(dto.name).toBe('Updated Name')
  })

  it('accepts ImportedAgent', () => {
    const imported: ImportedAgent = {
      fileName: 'code-reviewer.md',
      content: '---\nname: Code Reviewer\n---\nContent',
    }
    expect(imported.fileName).toBe('code-reviewer.md')
  })
})
