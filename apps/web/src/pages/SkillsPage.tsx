import { useState, useEffect, useCallback } from 'react'
import type { UnifiedSkill, ImportedSkill, PlatformId } from '@prism/shared'
import { skillsApi } from '../api/skills'
import { platformsApi } from '../api/platforms'

interface SkillsPageProps {
  onEdit: (skill: UnifiedSkill) => void
  onNew: () => void
}

type SubTab = 'prism' | PlatformId

const PLATFORM_TABS: { id: PlatformId; label: string }[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codebuddy', label: 'CodeBuddy' },
]

const subTabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 16px',
  border: 'none',
  borderBottom: active ? '2px solid #7c6af7' : '2px solid transparent',
  background: 'none',
  color: active ? '#c9b8ff' : '#666',
  cursor: 'pointer',
  fontSize: '13px',
  fontFamily: 'inherit',
  transition: 'color 0.15s',
})

export function SkillsPage({ onEdit, onNew }: SkillsPageProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('prism')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #222',
        background: '#111',
        padding: '0 16px',
        gap: '4px',
        flexShrink: 0,
      }}>
        <button
          style={subTabStyle(activeTab === 'prism')}
          onClick={() => setActiveTab('prism')}
        >
          Prism Skills
        </button>
        {PLATFORM_TABS.map(tab => (
          <button
            key={tab.id}
            style={subTabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'prism' ? (
          <PrismSkillsTab onEdit={onEdit} onNew={onNew} />
        ) : (
          <PlatformSkillsTab platformId={activeTab as PlatformId} />
        )}
      </div>
    </div>
  )
}

// ─── Prism Skills Tab ────────────────────────────────────────────────────────

function PrismSkillsTab({ onEdit, onNew }: SkillsPageProps) {
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

  if (loading) return <div className="loading">Loading skills…</div>
  if (error) return (
    <div className="error">
      {error} <button onClick={() => void load()}>Retry</button>
    </div>
  )

  return (
    <div className="rules-page">
      <div className="rules-header">
        <h2>Prism Skills</h2>
        <button onClick={onNew}>+ New Skill</button>
      </div>
      {skills.length === 0 ? (
        <div className="empty">No skills yet. <button onClick={onNew}>Create one</button></div>
      ) : (
        <table className="rules-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Tags</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {skills.map(skill => (
              <tr key={skill.id}>
                <td>{skill.name}</td>
                <td>{skill.trigger ?? '—'}</td>
                <td>{(skill.tags ?? []).join(', ') || '—'}</td>
                <td>{new Date(skill.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => onEdit(skill)}>Edit</button>
                  <button
                    onClick={() => void handleDelete(skill)}
                    disabled={deletingId === skill.id}
                  >
                    {deletingId === skill.id ? 'Deleting…' : 'Delete'}
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

// ─── Platform Skills Tab ─────────────────────────────────────────────────────

function PlatformSkillsTab({ platformId }: { platformId: PlatformId }) {
  const [skills, setSkills] = useState<ImportedSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await platformsApi.importSkills(platformId)
      setSkills(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load platform skills')
    } finally {
      setLoading(false)
    }
  }, [platformId])

  useEffect(() => { void load() }, [load])

  if (loading) return <div className="loading">Loading skills…</div>
  if (error) return (
    <div className="error">
      {error} <button onClick={() => void load()}>Retry</button>
    </div>
  )

  const platformLabel = PLATFORM_TABS.find(t => t.id === platformId)?.label ?? platformId

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, color: '#e0e0e0', fontSize: '16px' }}>
          {platformLabel} Skills
        </h2>
        <span style={{ color: '#555', fontSize: '12px' }}>
          {skills.length} file{skills.length !== 1 ? 's' : ''} found
        </span>
        <button
          onClick={() => void load()}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            background: '#1a1a1a',
            border: '1px solid #333',
            color: '#aaa',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      </div>

      {skills.length === 0 ? (
        <div style={{ color: '#555', fontSize: '14px', padding: '32px 0', textAlign: 'center' }}>
          No skills found for {platformLabel}.
          <br />
          <span style={{ fontSize: '12px', color: '#444', marginTop: '8px', display: 'block' }}>
            Place <code style={{ color: '#7c6af7' }}>.md</code> files in the platform's{' '}
            <code style={{ color: '#7c6af7' }}>skills/</code> directory.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {skills.map(skill => (
            <div
              key={skill.fileName}
              style={{
                border: '1px solid #222',
                borderRadius: '6px',
                background: '#111',
                overflow: 'hidden',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  gap: '10px',
                }}
                onClick={() => setExpanded(prev => prev === skill.fileName ? null : skill.fileName)}
              >
                <span style={{ color: '#555', fontSize: '14px' }}>
                  {expanded === skill.fileName ? '▾' : '▸'}
                </span>
                <span style={{ color: '#c9b8ff', fontSize: '13px', fontWeight: 500 }}>
                  {skill.fileName}
                </span>
              </div>

              {/* Expanded content */}
              {expanded === skill.fileName && (
                <div style={{
                  borderTop: '1px solid #1a1a1a',
                  padding: '12px 14px',
                  maxHeight: '320px',
                  overflow: 'auto',
                }}>
                  <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#bbb',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    fontFamily: 'monospace',
                  }}>
                    {skill.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
