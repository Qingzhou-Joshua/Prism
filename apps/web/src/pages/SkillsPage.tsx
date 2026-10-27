import { AssetSources } from '../components/AssetSources'
import { CardSummary, ListSearch, matchesQuery } from '../components/CardSummary'
import { PixelIcon } from '../components/PixelIcon'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedSkill } from '@prism/shared'
import { skillsApi } from '../api/skills'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'
import { ScopeBadge } from '../components/ScopeBadge'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface SkillsPageProps {
  onEdit: (skill: UnifiedSkill) => void
  onNew: () => void
  skillsDir?: string
  platformId?: string
}

export function SkillsPage({ onEdit, onNew, skillsDir: _skillsDir, platformId }: SkillsPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [skills, setSkills] = useState<UnifiedSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await skillsApi.list(platformId)
      setSkills(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('skills.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [platformId])

  useEffect(() => { void load() }, [load])

  async function handleDelete(skill: UnifiedSkill) {
    if (!confirm(`Delete skill "${skill.name}"?`)) return
    setDeletingId(skill.id)
    try {
      await skillsApi.delete(skill.id, platformId)
      setSkills(prev => prev.filter(s => s.id !== skill.id))
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
          <div className="page-title">{t('skills.title')}</div>
          <div className="page-subtitle">{t('skills.count', { count: skills.length })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ListSearch value={query} onChange={setQuery} />
          <button className="btn btn-primary" onClick={onNew}>{t('skills.newBtn')}</button>
        </div>
      </div>
      </FadeIn>

      <AssetSources
        platformId={platformId ?? ''}
        type="skills"
        typeLabel={t('skills.title')}
        query={query}
        ownCount={skills.length}
        ownMatchCount={skills.filter(x => matchesQuery(x, query)).length}
        ownNames={skills.map(x => x.name)}
      >
        {skills.length === 0 && (
          <FadeIn delay={0.1}>
          <div className="empty-state">
            <div className="empty-state-icon"><PixelIcon name="bolt" size={32} /></div>
            <div className="empty-state-title">{t('skills.empty')}</div>
            <div className="empty-state-desc">{t('skills.emptyHint')}</div>
            <button className="btn btn-primary" onClick={onNew}>{t('skills.newBtn')}</button>
          </div>
          </FadeIn>
        )}

        {skills.length > 0 && (
          <div className="item-card-grid">
            {skills.filter(x => matchesQuery(x, query)).map((skill, i) => (
              <MotionCard key={skill.id} index={i} style={{ cursor: 'pointer' }} onClick={() => onEdit(skill)}>
                <div className="item-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {skill.name}
                  <ScopeBadge scope={(skill as unknown as { scope?: string }).scope ?? 'global'} />
                </div>
                <CardSummary text={skill.description} />
                {skill.filePath && (
                  <div className="item-card-filepath item-card-filepath--compact" title={skill.filePath}>{skill.filePath}</div>
                )}
                <div className="item-card-meta">
                  {skill.targetPlatforms && skill.targetPlatforms.length > 0 ? (
                    skill.targetPlatforms.map(pid => (
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
                  {skill.trigger && (
                    <span className="badge badge-muted">{skill.trigger}</span>
                  )}
                  {(skill.tags ?? []).map(tag => (
                    <span key={tag} className="badge badge-muted">{tag}</span>
                  ))}
                </div>
                <div className="item-card-footer">
                  <span className="item-card-date">{new Date(skill.updatedAt).toLocaleDateString()}</span>
                  <div className="item-card-actions">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); void handleDelete(skill) }}
                      disabled={deletingId === skill.id}
                    >
                      {deletingId === skill.id ? '…' : tCommon('btn.delete')}
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
