import { describe, it, expect } from 'vitest'
import type { McpServer, CreateMcpServerDto, UpdateMcpServerDto, ImportedMcpServer } from './mcp.js'

describe('McpServer types', () => {
  it('McpServer has required fields', () => {
    const server: McpServer = {
      id: '1', name: 'test-mcp', command: 'npx', args: ['-y', 'some-mcp'],
      targetPlatforms: ['claude-code'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    expect(server.id).toBe('1')
    expect(server.args).toHaveLength(2)
  })

  it('McpServer supports optional env', () => {
    const server: McpServer = {
      id: '2', name: 'env-mcp', command: 'node', args: ['server.js'],
      env: { API_KEY: 'secret' }, targetPlatforms: [], createdAt: '', updatedAt: '',
    }
    expect(server.env?.['API_KEY']).toBe('secret')
  })

  it('ImportedMcpServer shape', () => {
    const imported: ImportedMcpServer = { name: 'x', command: 'cmd', args: [] }
    expect(imported.name).toBe('x')
  })

  it('CreateMcpServerDto excludes id/timestamps', () => {
    const dto: CreateMcpServerDto = {
      name: 'n', command: 'c', args: [], targetPlatforms: ['claude-code'],
    }
    expect(dto.name).toBe('n')
  })

  it('UpdateMcpServerDto is fully optional', () => {
    const dto: UpdateMcpServerDto = {}
    expect(dto).toBeDefined()
  })
})
