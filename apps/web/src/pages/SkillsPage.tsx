import { useState, useEffect, useCallback } from 'react'
import type { UnifiedSkill } from '@prism/shared'
import { skillsApi } from '../api/skills'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms'

interface SkillsPageProps {
  onEdit: (skill: UnifiedSkill) => void
  onNew: () => void
}

function isGlobal(skill: UnifiedSkill): boolean {
  return !skill.targetPlatforms || skill.targetPlatforms.length === 0
}

export function SkillsPage({ onEdit, onNew }: SkillsPageProps) {
  const [skills, setSkills] = useState<UnifiedSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await skillsApi.list()
      setSkills(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(skill: UnifiedSkill) {
    if (!confirm(`Delete skill "${skill.name}"?`)) return
    setDeletingId(skill.id)
    try {
      await skillsApi.delete(skill.id)
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

      {skills.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🛠</div>
          <div className="empty-state-title">No skills yet</div>
          <div className="empty-state-desc">Create a skill to define reusable agent capabilities.</div>
          <button className="btn btn-primary" onClick={onNew}>+ New Skill</button>
        </div>
      )}

      {skills.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope</th>
                <th>Platforms</th>
                <th>Trigger</th>
                <th>Tags</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {skills.map(skill => (
                <tr key={skill.id}>
                  <td style={{ fontWeight: 500 }}>{skill.name}</td>
                  <td>
                    {isGlobal(skill)
                      ? <span className="badge badge-global">◉ Global</span>
                      : <span className="badge badge-targeted">◎ Targeted</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {isGlobal(skill) ? (
                        <span className="text-muted text-sm">All platforms</span>
                      ) : (
                        skill.targetPlatforms.map(pid => (
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
                    {skill.trigger
                      ? <span className="badge badge-muted">{skill.trigger}</span>
                      : <span className="text-muted text-sm">—</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(skill.tags ?? []).length > 0
                        ? (skill.tags ?? []).map(t => <span key={t} className="badge badge-muted">{t}</span>)
                        : <span className="text-muted text-sm">—</span>
                      }
                    </div>
                  </td>
                  <td className="muted">{new Date(skill.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(skill)}>Edit</button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDelete(skill)}
                        disabled={deletingId === skill.id}
                      >
                        {deletingId === skill.id ? '…' : 'Delete'}
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
