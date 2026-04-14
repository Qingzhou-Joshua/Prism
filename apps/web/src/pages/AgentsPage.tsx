import { useState, useEffect, useCallback } from 'react'
import type { UnifiedAgent } from '@prism/shared'
import { agentsApi } from '../api/agents'

interface AgentsPageProps {
  onEdit: (agent: UnifiedAgent) => void
  onNew: () => void
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

  if (loading) return <div className="loading">Loading agents…</div>
  if (error) return (
    <div className="error">
      {error} <button onClick={() => void load()}>Retry</button>
    </div>
  )

  return (
    <div className="rules-page">
      <div className="rules-header">
        <h2>Agents</h2>
        <button onClick={onNew}>+ New Agent</button>
      </div>
      {agents.length === 0 ? (
        <div className="empty">No agents yet. <button onClick={onNew}>Create one</button></div>
      ) : (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Agent Type</th>
              <th>Tags</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>{agent.agentType ?? '—'}</td>
                <td>{(agent.tags ?? []).join(', ') || '—'}</td>
                <td>{new Date(agent.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => onEdit(agent)}>Edit</button>
                  <button
                    onClick={() => void handleDelete(agent)}
                    disabled={deletingId === agent.id}
                  >
                    {deletingId === agent.id ? 'Deleting…' : 'Delete'}
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
