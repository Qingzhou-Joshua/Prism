import { useState, useEffect, useCallback } from 'react'
import type { UnifiedSkill } from '@prism/shared'
import { skillsApi } from '../api/skills'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'

interface SkillsPageProps {
  onEdit: (skill: UnifiedSkill) => void
  onNew: () => void
  skillsDir?: string
  platformId?: string
}

function isGlobal(skill: UnifiedSkill): boolean {
  return !skill.targetPlatforms || skill.targetPlatforms.length === 0
}

export function SkillsPage({ onEdit, onNew, skillsDir, platformId }: SkillsPageProps) {
  const [skills, setSkills] = useState<UnifiedSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await skillsApi.list(platformId)
      setSkills(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills')
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

  if (loading) return <div className="loading-state">Loading skills…</div>
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
          <div className="page-title">Skills</div>
          <div className="page-subtitle">{skills.length} skill{skills.length !== 1 ? 's' : ''} managed</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ New Skill</button>
      </div>

      {skillsDir && (
        <div className="path-info-card">
          <span className="path-info-label">📁 Directory</span>
          <code className="path-info-value">{skillsDir}</code>
        </div>
      )}

      {skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🛠</div>
          <div className="empty-state-title">No skills yet</div>
          <div className="empty-state-desc">Create a skill to define reusable agent capabilities.</div>
          <button className="btn btn-primary" onClick={onNew}>+ New Skill</button>
        </div>
      )}

      {skills.length > 0 && (
        <div className="item-card-grid">
          {skills.map(skill => (
            <div key={skill.id} className="item-card">
              <div className="item-card-name">{skill.name}</div>
              {skill.filePath && (
                <div className="item-card-filepath">{skill.filePath}</div>
              )}
              <div className="item-card-meta">
                {isGlobal(skill)
                  ? <span className="badge badge-global">◉ Global</span>
                  : <span className="badge badge-targeted">◎ Targeted</span>
                }
                {isGlobal(skill) ? (
                  <span className="text-muted text-sm">All platforms</span>
                ) : (
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
                )}
                {skill.trigger && (
                  <span className="badge badge-muted">{skill.trigger}</span>
                )}
                {(skill.tags ?? []).map(t => (
                  <span key={t} className="badge badge-muted">{t}</span>
                ))}
              </div>
              <div className="item-card-footer">
                <span className="item-card-date">{new Date(skill.updatedAt).toLocaleDateString()}</span>
                <div className="item-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(skill)}>Edit</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => void handleDelete(skill)}
                    disabled={deletingId === skill.id}
                  >
                    {deletingId === skill.id ? '…' : 'Delete'}
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
