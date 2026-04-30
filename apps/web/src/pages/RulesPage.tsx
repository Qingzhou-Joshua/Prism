import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedRule } from '@prism/shared'
import { rulesApi } from '../api/rules.js'
import { PLATFORM_LABELS } from '../constants/platforms.js'
import { PlatformIcon } from '../components/PlatformIcon'
import { ScopeBadge } from '../components/ScopeBadge'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface RulesPageProps {
  onEdit: (rule: UnifiedRule) => void
  onNew: () => void
  rulesDir?: string
  platformId?: string
}

export function RulesPage({ onEdit, onNew, rulesDir, platformId }: RulesPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
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
      setError(e instanceof Error ? e.message : t('rules.loadingFailed'))
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

  if (loading) return <div className="loading-state">{tCommon('status.loading')}</div>
  if (error) return (
    <div className="error-state">
      <span>⚠ {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>{tCommon('btn.retry')}</button>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <FadeIn>
        <div className="page-header">
          <div>
            <div className="page-title">{t('rules.title')}</div>
            <div className="page-subtitle">{t('rules.count', { count: rules.length })}</div>
          </div>
          <button className="btn btn-primary" onClick={onNew}>{t('rules.newBtn')}</button>
        </div>
      </FadeIn>

      {/* Empty state */}
      {rules.length === 0 && (
        <FadeIn delay={0.1}>
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">{t('rules.empty')}</div>
            <div className="empty-state-desc">
              {t('rules.emptyHint')}
            </div>
            <button className="btn btn-primary" onClick={onNew}>{t('rules.newBtn')}</button>
          </div>
        </FadeIn>
      )}

      {/* Rules card grid */}
      {rules.length > 0 && (
        <div className="item-card-grid">
          {rules.map((rule, i) => (
            <MotionCard key={rule.id} index={i} style={{ cursor: 'pointer' }} onClick={() => onEdit(rule)}>
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
                {rule.tags.map(tag => (
                  <span key={tag} className="badge badge-muted">{tag}</span>
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
                    {deletingId === rule.id ? '…' : tCommon('btn.delete')}
                  </button>
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      )}
    </div>
  )
}
