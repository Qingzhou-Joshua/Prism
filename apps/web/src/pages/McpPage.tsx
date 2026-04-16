import { useState, useEffect, useCallback } from 'react'
import type { McpServer } from '@prism/shared'
import { mcpApi } from '../api/mcp.js'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms.js'

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

  if (loading) return <div className="loading-state">Loading MCP servers…</div>
  if (error) return (
    <div className="error-state">
      <span>⚠ {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>Retry</button>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">MCP Servers</div>
          <div className="page-subtitle">{servers.length} server{servers.length !== 1 ? 's' : ''} configured</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void handleImport()}
            disabled={importing}
          >
            {importing ? 'Importing…' : '↓ Import from Claude Code'}
          </button>
          <button className="btn btn-primary" onClick={onNew}>+ New Server</button>
        </div>
      </div>

      {/* Empty state */}
      {servers.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔌</div>
          <div className="empty-state-title">No MCP servers yet</div>
          <div className="empty-state-desc">
            Add a server manually or import from an existing platform configuration.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void handleImport()}
              disabled={importing}
            >
              {importing ? 'Importing…' : '↓ Import from Claude Code'}
            </button>
            <button className="btn btn-primary" onClick={onNew}>+ New Server</button>
          </div>
        </div>
      )}

      {/* Card grid */}
      {servers.length > 0 && (
        <div className="item-card-grid">
          {servers.map(server => (
            <div
              key={server.id}
              className="item-card"
              onClick={() => onEdit(server)}
              style={{ cursor: 'pointer' }}
            >
              {/* Name */}
              <div className="item-card-name">{server.name}</div>

              {/* Command line preview */}
              <div className="mcp-card-cmd">
                <span className="mcp-cmd-bin">{server.command}</span>
                {server.args.length > 0 && (
                  <span className="mcp-cmd-args">{server.args.join(' ')}</span>
                )}
              </div>

              {/* Description */}
              {server.description && (
                <div className="item-card-filepath">{server.description}</div>
              )}

              {/* Env badge */}
              {server.env && Object.keys(server.env).length > 0 && (
                <div className="item-card-meta">
                  <span className="badge badge-muted">
                    {Object.keys(server.env).length} env var{Object.keys(server.env).length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Footer */}
              <div className="item-card-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {server.targetPlatforms.length > 0
                    ? server.targetPlatforms.map(pid => (
                        <span
                          key={pid}
                          title={PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)' }}
                        >
                          <PlatformIcon platformId={pid} size={13} />
                          {PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                        </span>
                      ))
                    : <span className="item-card-date">—</span>
                  }
                </div>
                <div className="item-card-actions">
                  <span className="item-card-date">{new Date(server.updatedAt).toLocaleDateString()}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={e => { e.stopPropagation(); void handleDelete(server) }}
                    disabled={deletingId === server.id}
                  >
                    {deletingId === server.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
