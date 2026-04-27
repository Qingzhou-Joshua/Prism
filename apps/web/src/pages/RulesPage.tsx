import { useState, useEffect, useCallback } from 'react'
import type { UnifiedRule } from '@prism/shared'
import { rulesApi } from '../api/rules.js'
import { PLATFORM_LABELS } from '../constants/platforms.js'
import { PlatformIcon } from '../components/PlatformIcon'
import { ScopeBadge } from '../components/ScopeBadge'

interface RulesPageProps {
  onEdit: (rule: UnifiedRule) => void
  onNew: () => void
  rulesDir?: string
  platformId?: string
}

export function RulesPage({ onEdit, onNew, rulesDir, platformId }: RulesPageProps) {
  const [rules, setRules] = useState<UnifiedRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await rulesApi.list(platformId)
      setRules(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [platformId])

  useEffect(() => { void load() }, [load])

  async function handleDelete(rule: UnifiedRule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    setDeletingId(rule.id)
    try {
      await rulesApi.delete(rule.id, platformId)
      setRules(prev => prev.filter(r => r.id !== rule.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

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

      {/* Rules card grid */}
      {rules.length > 0 && (
        <div className="item-card-grid">
          {rules.map(rule => (
            <div key={rule.id} className="item-card" onClick={() => onEdit(rule)} style={{ cursor: 'pointer' }}>
              <div className="item-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {rule.name}
                <ScopeBadge scope={rule.scope} />
              </div>
              {rule.filePath && (
                <div className="item-card-filepath">{rule.filePath}</div>
              )}
              <div className="item-card-meta">
                {rule.targetPlatforms && rule.targetPlatforms.length > 0 ? (
                  rule.targetPlatforms.map(pid => (
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
                {rule.tags.map(t => (
                  <span key={t} className="badge badge-muted">{t}</span>
                ))}
              </div>
              <div className="item-card-footer">
                <span className="item-card-date">{new Date(rule.updatedAt).toLocaleDateString()}</span>
                <div className="item-card-actions">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); void handleDelete(rule) }}
                    disabled={deletingId === rule.id}
                  >
                    {deletingId === rule.id ? '…' : 'Delete'}
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
