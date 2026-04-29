import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { knowledgeApi } from '../api/knowledge'

interface KnowledgeProfilePageProps {
  onBack: () => void
}

export function KnowledgeProfilePage({ onBack }: KnowledgeProfilePageProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true)
      setError(null)
      try {
        const profile = await knowledgeApi.getProfile()
        setName(profile.name ?? '')
        setRole(profile.role ?? '')
        setSkillsInput(profile.skills.join(', '))
        setBio(profile.bio)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    void fetchProfile()
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const skills = skillsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      await knowledgeApi.updateProfile({
        name: name.trim() || undefined,
        role: role.trim() || undefined,
        skills,
        bio,
        updatedAt: new Date().toISOString(),
      })
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-state">Loading profile…</div>

  return (
    <div className="editor-page">
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your Name"
          className="editor-toolbar-name"
          disabled={saving}
        />
        <input
          type="text"
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="Role / Title"
          className="editor-toolbar-name"
          style={{ maxWidth: 220 }}
          disabled={saving}
        />

        <div className="editor-toolbar-divider" />

        <div className="editor-toolbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={onBack}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* ── Meta strip: skills ── */}
      <div className="editor-meta-strip">
        <input
          type="text"
          value={skillsInput}
          onChange={e => setSkillsInput(e.target.value)}
          placeholder="Skills (comma-separated, e.g. typescript, react, rust)"
          className="editor-meta-input"
          disabled={saving}
        />
      </div>

      {error && <div className="error-state" style={{ margin: '0 0 8px' }}>{error}</div>}

      {/* ── Bio editor (Monaco) ── */}
      <div className="editor-full">
        <div className="monaco-wrapper">
          <Editor
            height="100%"
            defaultLanguage="markdown"
            theme="vs-dark"
            value={bio}
            onChange={val => setBio(val ?? '')}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 14,
              readOnly: saving,
            }}
          />
        </div>
      </div>
    </div>
  )
}
