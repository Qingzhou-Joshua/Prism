import { useState, useEffect, useCallback } from 'react'
import type { UnifiedCommand } from '@prism/shared'
import { commandsApi } from '../api/commands'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'

interface CommandsPageProps {
  platform?: string
  onEdit: (command?: UnifiedCommand) => void
}

export function CommandsPage({ platform, onEdit }: CommandsPageProps) {
  const [commands, setCommands] = useState<UnifiedCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await commandsApi.list(platform)
      setCommands(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commands')
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => { void load() }, [load])

  async function handleDelete(command: UnifiedCommand) {
    if (!confirm(`Delete command "${command.name}"?`)) return
    setDeletingId(command.id)
    try {
      await commandsApi.delete(command.id, platform)
      setCommands(prev => prev.filter(c => c.id !== command.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="loading-state">Loading commands…</div>
  if (error) return (
    <div className="error-state">
      <span>⚠ {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>Retry</button>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Commands</div>
          <div className="page-subtitle">{commands.length} command{commands.length !== 1 ? 's' : ''} managed</div>
        </div>
        <button className="btn btn-primary" onClick={() => onEdit(undefined)}>+ New Command</button>
      </div>

      {commands.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⌨️</div>
          <div className="empty-state-title">No commands yet</div>
          <div className="empty-state-desc">Create a command to define reusable slash command definitions.</div>
          <button className="btn btn-primary" onClick={() => onEdit(undefined)}>+ New Command</button>
        </div>
      )}

      {commands.length > 0 && (
        <div className="item-card-grid">
          {commands.map(command => (
            <div key={command.id} className="item-card" onClick={() => onEdit(command)} style={{ cursor: 'pointer' }}>
              <div className="item-card-name">
                {command.name}
              </div>
              {command.filePath && (
                <div className="item-card-filepath">{command.filePath}</div>
              )}
              <div className="item-card-meta">
                {command.targetPlatforms && command.targetPlatforms.length > 0 ? (
                  command.targetPlatforms.map(pid => (
                    <span
                      key={pid}
                      title={PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)' }}
                    >
                      <PlatformIcon platformId={pid} size={13} />
                      {PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                    </span>
                  ))
                ) : null}
                {(command.tags ?? []).map(t => (
                  <span key={t} className="badge badge-muted">{t}</span>
                ))}
              </div>
              <div className="item-card-footer">
                <span className="item-card-date">{new Date(command.updatedAt).toLocaleDateString()}</span>
                <div className="item-card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); onEdit(command) }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); void handleDelete(command) }}
                    disabled={deletingId === command.id}
                  >
                    {deletingId === command.id ? '…' : 'Delete'}
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
