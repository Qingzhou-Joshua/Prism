import { useState, useEffect, useCallback } from 'react'
import type { UnifiedRule } from '@prism/shared'
import { rulesApi } from '../api/rules.js'
import { PLATFORM_LABELS } from '../constants/platforms.js'

interface RulesPageProps {
  onEdit: (rule: UnifiedRule) => void
  onNew: () => void
}

const PLATFORM_DOT_CLASS: Record<string, string> = {
  'claude-code': 'platform-dot platform-dot-claude',
  'cursor': 'platform-dot platform-dot-cursor',
  'openclaw': 'platform-dot platform-dot-openclaw',
  'codebuddy': 'platform-dot platform-dot-codebuddy',
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

  useEffect(() => { void load() }, [load])

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

  const isGlobal = (rule: UnifiedRule) =>
    !rule.targetPlatforms || rule.targetPlatforms.length === 0

  if (loading) return <div className="loading-state">Loading rules…</div>
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
          <div className="page-title">Rules</div>
          <div className="page-subtitle">{rules.length} rule{rules.length !== 1 ? 's' : ''} managed</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ New Rule</button>
      </div>

      {/* Empty state */}
      {rules.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No rules yet</div>
          <div className="empty-state-desc">
            Create a rule or import from a platform using the Scanner tab.
          </div>
          <button className="btn btn-primary" onClick={onNew}>+ New Rule</button>
        </div>
      )}

      {/* Rules table */}
      {rules.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope</th>
                <th>Platforms</th>
                <th>Tags</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td style={{ fontWeight: 500 }}>{rule.name}</td>
                  <td>
                    {isGlobal(rule) ? (
                      <span className="badge badge-global">◉ Global</span>
                    ) : (
                      <span className="badge badge-targeted">◎ Targeted</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {isGlobal(rule) ? (
                        <span className="text-muted text-sm">All platforms</span>
                      ) : (
                        rule.targetPlatforms.map(pid => (
                          <span
                            key={pid}
                            title={PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}
                          >
                            <span className={PLATFORM_DOT_CLASS[pid] ?? 'platform-dot'} />
                            {PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {rule.tags.length > 0
                        ? rule.tags.map(t => (
                            <span key={t} className="badge badge-muted">{t}</span>
                          ))
                        : <span className="text-muted text-sm">—</span>
                      }
                    </div>
                  </td>
                  <td className="muted">{new Date(rule.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onEdit(rule)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(rule)}
                        disabled={deletingId === rule.id}
                      >
                        {deletingId === rule.id ? '…' : 'Delete'}
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
