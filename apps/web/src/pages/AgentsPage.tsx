import { useState, useEffect, useCallback } from 'react'
import type { UnifiedAgent } from '@prism/shared'
import { agentsApi } from '../api/agents'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'
import { ScopeBadge } from '../components/ScopeBadge'

interface AgentsPageProps {
  onEdit: (agent: UnifiedAgent) => void
  onNew: () => void
  agentsDir?: string
  platformId?: string
}

export function AgentsPage({ onEdit, onNew, agentsDir: _agentsDir, platformId }: AgentsPageProps) {
  const [agents, setAgents] = useState<UnifiedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await agentsApi.list(platformId)
      setAgents(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [platformId])

  useEffect(() => { void load() }, [load])

  async function handleDelete(agent: UnifiedAgent) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return
    setDeletingId(agent.id)
    try {
      await agentsApi.delete(agent.id, platformId)
      setAgents(prev => prev.filter(a => a.id !== agent.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="loading-state">Loading agents…</div>
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
          <div className="page-title">Agents</div>
          <div className="page-subtitle">{agents.length} agent{agents.length !== 1 ? 's' : ''} managed</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ New Agent</button>
      </div>

      {agents.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🤖</div>
          <div className="empty-state-title">No agents yet</div>
          <div className="empty-state-desc">Create an agent to define reusable AI agent definitions.</div>
          <button className="btn btn-primary" onClick={onNew}>+ New Agent</button>
        </div>
      )}

      {agents.length > 0 && (
        <div className="item-card-grid">
          {agents.map(agent => (
            <div key={agent.id} className="item-card" onClick={() => onEdit(agent)} style={{ cursor: 'pointer' }}>
              <div className="item-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {agent.name}
                <ScopeBadge scope={(agent as unknown as { scope?: string }).scope ?? 'global'} />
              </div>
              {agent.filePath && (
                <div className="item-card-filepath">{agent.filePath}</div>
              )}
              <div className="item-card-meta">
                {agent.targetPlatforms && agent.targetPlatforms.length > 0 ? (
                  agent.targetPlatforms.map(pid => (
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
                {agent.agentType && (
                  <span className="badge badge-muted">{agent.agentType}</span>
                )}
                {(agent.tags ?? []).map(t => (
                  <span key={t} className="badge badge-muted">{t}</span>
                ))}
              </div>
              <div className="item-card-footer">
                <span className="item-card-date">{new Date(agent.updatedAt).toLocaleDateString()}</span>
                <div className="item-card-actions">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); void handleDelete(agent) }}
                    disabled={deletingId === agent.id}
                  >
                    {deletingId === agent.id ? '…' : 'Delete'}
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
