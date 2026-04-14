import { useState, useEffect, useCallback } from 'react'
import type { McpServer } from '@prism/shared'
import { mcpApi } from '../api/mcp.js'

interface McpPageProps {
  onEdit: (server: McpServer) => void
  onNew: () => void
}

export function McpPage({ onEdit, onNew }: McpPageProps) {
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await mcpApi.list()
      setServers(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load MCP servers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(server: McpServer) {
    if (!confirm(`Delete MCP server "${server.name}"?`)) return
    setDeletingId(server.id)
    try {
      await mcpApi.delete(server.id)
      setServers(prev => prev.filter(s => s.id !== server.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleImport() {
    try {
      setImporting(true)
      setError(null)
      const scanned = await mcpApi.scanPlatform('claude-code')
      if (scanned.length === 0) {
        alert('No MCP servers found in Claude Code settings')
        return
      }
      await mcpApi.importFromPlatform('claude-code')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <div className="loading">Loading MCP servers…</div>
  if (error) return (
    <div className="error">
      {error} <button onClick={() => void load()}>Retry</button>
    </div>
  )

  return (
    <div className="rules-page">
      <div className="rules-header">
        <h2>MCP Servers</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => void handleImport()}
            disabled={importing}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid #374151',
              borderRadius: 4,
              color: '#9ca3af',
              cursor: importing ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            {importing ? 'Importing…' : '↓ Import from Claude Code'}
          </button>
          <button onClick={onNew}>+ New MCP Server</button>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="empty">
          No MCP servers yet. <button onClick={onNew}>Create one</button> or import from a platform.
        </div>
      ) : (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Command</th>
              <th>Args</th>
              <th>Platforms</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {servers.map(server => (
              <tr key={server.id}>
                <td>{server.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{server.command}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#9ca3af' }}>
                  {server.args.length > 0 ? server.args.join(' ') : '—'}
                </td>
                <td>{server.targetPlatforms.length > 0 ? server.targetPlatforms.join(', ') : '—'}</td>
                <td>{new Date(server.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => onEdit(server)}>Edit</button>
                  <button
                    onClick={() => void handleDelete(server)}
                    disabled={deletingId === server.id}
                  >
                    {deletingId === server.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
