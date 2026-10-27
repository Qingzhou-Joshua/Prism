import { AssetSources } from '../components/AssetSources'
import { CardSummary, ListSearch, matchesQuery } from '../components/CardSummary'
import { PixelIcon } from '../components/PixelIcon'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedCommand } from '@prism/shared'
import { commandsApi } from '../api/commands'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface CommandsPageProps {
  platform?: string
  onEdit: (command?: UnifiedCommand) => void
}

export function CommandsPage({ platform, onEdit }: CommandsPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [commands, setCommands] = useState<UnifiedCommand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await commandsApi.list(platform)
      setCommands(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('commands.loadingFailed'))
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
      alert(e instanceof Error ? e.message : t('commands.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="loading-state">{tCommon('status.loading')}…</div>
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
          <div className="page-title">{t('commands.title')}</div>
          <div className="page-subtitle">{t('commands.count', { count: commands.length })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ListSearch value={query} onChange={setQuery} />
          <button className="btn btn-primary" onClick={() => onEdit(undefined)}>{t('commands.newBtn')}</button>
        </div>
      </div>
      </FadeIn>

      <AssetSources
        platformId={platform ?? ''}
        type="commands"
        typeLabel={t('commands.title')}
        query={query}
        ownCount={commands.length}
        ownMatchCount={commands.filter(x => matchesQuery(x, query)).length}
        ownNames={commands.map(x => x.name)}
      >
        {commands.length === 0 && (
          <FadeIn delay={0.1}>
          <div className="empty-state">
            <div className="empty-state-icon"><PixelIcon name="terminal" size={32} /></div>
            <div className="empty-state-title">{t('commands.empty')}</div>
            <div className="empty-state-desc">{t('commands.emptyHint')}</div>
            <button className="btn btn-primary" onClick={() => onEdit(undefined)}>{t('commands.newBtn')}</button>
          </div>
          </FadeIn>
        )}

        {commands.length > 0 && (
          <div className="item-card-grid">
            {commands.filter(x => matchesQuery(x, query)).map((command, i) => (
              <MotionCard key={command.id} index={i} style={{ cursor: 'pointer' }} onClick={() => onEdit(command)}>
                <div className="item-card-name">
                  {command.name}
                </div>
                <CardSummary text={command.description} />
                {command.filePath && (
                  <div className="item-card-filepath item-card-filepath--compact" title={command.filePath}>{command.filePath}</div>
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
                      {tCommon('btn.edit')}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); void handleDelete(command) }}
                      disabled={deletingId === command.id}
                    >
                      {deletingId === command.id ? '…' : tCommon('btn.delete')}
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
