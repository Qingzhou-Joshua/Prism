import { useState, useEffect, useCallback } from 'react'
import type { UnifiedAgent } from '@prism/shared'
import { agentsApi } from '../api/agents'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'

interface AgentsPageProps {
  onEdit: (agent: UnifiedAgent) => void
  onNew: () => void
}

function isGlobal(agent: UnifiedAgent): boolean {
  return !agent.targetPlatforms || agent.targetPlatforms.length === 0
}

export function AgentsPage({ onEdit, onNew }: AgentsPageProps) {
  const [agents, setAgents] = useState<UnifiedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await agentsApi.list()
      setAgents(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(agent: UnifiedAgent) {
    if (!confirm(`Delete agent "${agent.name}"?`)) return
    setDeletingId(agent.id)
    try {
      await agentsApi.delete(agent.id)
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
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope</th>
                <th>Platforms</th>
                <th>Agent Type</th>
                <th>Tags</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id}>
                  <td style={{ fontWeight: 500 }}>{agent.name}</td>
                  <td>
                    {isGlobal(agent)
                      ? <span className="badge badge-global">◉ Global</span>
                      : <span className="badge badge-targeted">◎ Targeted</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {isGlobal(agent) ? (
                        <span className="text-muted text-sm">All platforms</span>
                      ) : (
                        agent.targetPlatforms.map(pid => (
                          <span
                            key={pid}
                            title={PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}
                          >
                            <PlatformIcon platformId={pid} size={14} />
                            {PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    {agent.agentType
                      ? <span className="badge badge-muted">{agent.agentType}</span>
                      : <span className="text-muted text-sm">—</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(agent.tags ?? []).length > 0
                        ? (agent.tags ?? []).map(t => <span key={t} className="badge badge-muted">{t}</span>)
                        : <span className="text-muted text-sm">—</span>
                      }
                    </div>
                  </td>
                  <td className="muted">{new Date(agent.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(agent)}>Edit</button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(agent)}
                        disabled={deletingId === agent.id}
                      >
                        {deletingId === agent.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
