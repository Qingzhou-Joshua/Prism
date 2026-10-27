import { AssetSources } from '../components/AssetSources'
import { CardSummary, ListSearch, matchesQuery } from '../components/CardSummary'
import { PixelIcon } from '../components/PixelIcon'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedAgent } from '@prism/shared'
import { agentsApi } from '../api/agents'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'
import { ScopeBadge } from '../components/ScopeBadge'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface AgentsPageProps {
  onEdit: (agent: UnifiedAgent) => void
  onNew: () => void
  agentsDir?: string
  platformId?: string
}

export function AgentsPage({ onEdit, onNew, agentsDir: _agentsDir, platformId }: AgentsPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [agents, setAgents] = useState<UnifiedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await agentsApi.list(platformId)
      setAgents(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agents.loadingFailed'))
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

  if (loading) return <div className="loading-state">{tCommon('status.loading')}</div>
  if (error) return (
    <div className="error-state">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PixelIcon name="warning" size={14} /> {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>{tCommon('btn.retry')}</button>
    </div>
  )

  return (
    <div>
      <FadeIn>
      <div className="page-header">
        <div>
          <div className="page-title">{t('agents.title')}</div>
          <div className="page-subtitle">{t('agents.count', { count: agents.length })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ListSearch value={query} onChange={setQuery} />
          <button className="btn btn-primary" onClick={onNew}>{t('agents.newBtn')}</button>
        </div>
      </div>
      </FadeIn>

      <AssetSources
        platformId={platformId ?? ''}
        type="agents"
        typeLabel={t('agents.title')}
        query={query}
        ownCount={agents.length}
        ownMatchCount={agents.filter(x => matchesQuery(x, query)).length}
        ownNames={agents.map(x => x.name)}
      >
        {agents.length === 0 && (
          <FadeIn delay={0.1}>
          <div className="empty-state">
            <div className="empty-state-icon"><PixelIcon name="robot" size={32} /></div>
            <div className="empty-state-title">{t('agents.empty')}</div>
            <div className="empty-state-desc">{t('agents.emptyHint')}</div>
            <button className="btn btn-primary" onClick={onNew}>{t('agents.newBtn')}</button>
          </div>
          </FadeIn>
        )}

        {agents.length > 0 && (
          <div className="item-card-grid">
            {agents.filter(x => matchesQuery(x, query)).map((agent, i) => (
              <MotionCard key={agent.id} index={i} style={{ cursor: 'pointer' }} onClick={() => onEdit(agent)}>
                <div className="item-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {agent.name}
                  <ScopeBadge scope={(agent as unknown as { scope?: string }).scope ?? 'global'} />
                </div>
                <CardSummary text={agent.description} />
                {agent.filePath && (
                  <div className="item-card-filepath item-card-filepath--compact" title={agent.filePath}>{agent.filePath}</div>
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
                  {(agent.tags ?? []).map(tag => (
                    <span key={tag} className="badge badge-muted">{tag}</span>
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
                      {deletingId === agent.id ? '…' : tCommon('btn.delete')}
                    </button>
                  </div>
                </div>
              </MotionCard>
            ))}
          </div>
        )}
      </AssetSources>
    </div>
  )
}
