import { useState, useEffect, useCallback } from 'react'
import type { UnifiedRule } from '@prism/shared'
import { rulesApi } from '../api/rules'

interface RulesPageProps {
  onEdit: (rule: UnifiedRule) => void
  onNew: () => void
}

export function RulesPage({ onEdit, onNew }: RulesPageProps) {
  const [rules, setRules] = useState<UnifiedRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await rulesApi.list()
      setRules(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(rule: UnifiedRule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    setDeletingId(rule.id)
    try {
      await rulesApi.delete(rule.id)
      setRules(prev => prev.filter(r => r.id !== rule.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="loading">Loading rules…</div>
  if (error) return <div className="error">{error} <button onClick={() => void load()}>Retry</button></div>

  return (
    <div className="rules-page">
      <div className="rules-header">
        <h2>Rules</h2>
        <button onClick={onNew}>+ New Rule</button>
      </div>
      {rules.length === 0 ? (
        <div className="empty">No rules yet. <button onClick={onNew}>Create one</button></div>
      ) : (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Scope</th>
              <th>Tags</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.scope}</td>
                <td>{(rule.tags ?? []).join(', ') || '—'}</td>
                <td>{new Date(rule.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => onEdit(rule)}>Edit</button>
                  <button
                    onClick={() => void handleDelete(rule)}
                    disabled={deletingId === rule.id}
                  >
                    {deletingId === rule.id ? 'Deleting…' : 'Delete'}
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
