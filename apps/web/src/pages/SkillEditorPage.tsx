import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedSkill } from '@prism/shared'
import { skillsApi } from '../api/skills'
import type { SkillProjectionItem } from '../api/skills'

interface SkillEditorPageProps {
  onBack: () => void
  initialSkill?: UnifiedSkill
}

interface DraftSkill {
  name: string
  content: string
  trigger: string
  category: string
}

const PLATFORM_COLORS: Record<string, string> = {
  'claude-code': '#cc785c',
  'cursor': '#1a73e8',
  'openclaw': '#2e7d32',
  'codebuddy': '#7b1fa2',
}

function toDraft(skill?: UnifiedSkill): DraftSkill {
  if (!skill) {
    return {
      name: '',
      content: '',
      trigger: '',
      category: '',
    }
  }
  return {
    name: skill.name,
    content: skill.content,
    trigger: skill.trigger ?? '',
    category: skill.category ?? '',
  }
}

export function SkillEditorPage({ onBack, initialSkill }: SkillEditorPageProps) {
  const [draft, setDraft] = useState<DraftSkill>(() => toDraft(initialSkill))
  const [tagsInput, setTagsInput] = useState(() => initialSkill?.tags?.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<SkillProjectionItem[]>([])
  const [projectionsLoading, setProjectionsLoading] = useState(false)

  // 编辑模式下加载当前 projections
  useEffect(() => {
    setProjections([])
    if (!initialSkill) return
    setProjectionsLoading(true)
    skillsApi
      .projections(initialSkill.id)
      .then(setProjections)
      .catch(() => setProjections([]))
      .finally(() => setProjectionsLoading(false))
  }, [initialSkill?.id])

  // 当 skill 切换时重置 draft 和 tagsInput
  useEffect(() => {
    setDraft(toDraft(initialSkill))
    setTagsInput(initialSkill?.tags?.join(', ') ?? '')
  }, [initialSkill?.id])

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const dto = {
        name: draft.name.trim(),
        content: draft.content,
        trigger: draft.trigger.trim() || undefined,
        category: draft.category.trim() || undefined,
        tags,
        targetPlatforms: initialSkill?.targetPlatforms ?? [],
      }
      if (!initialSkill) {
        await skillsApi.create(dto)
      } else {
        await skillsApi.update(initialSkill.id, dto)
      }
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const title = !initialSkill ? 'New Skill' : `Edit Skill: ${initialSkill.name}`

  return (
    <div className="rule-editor-page">
      <div className="rule-editor-header">
        <h2>{title}</h2>
        <div className="rule-editor-actions">
          <button onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="rule-editor-error">{error}</div>}

      <div className="rule-editor-body">
        <div className="rule-editor-form">
          <label className="form-label">
            Name
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Skill name"
              className="form-input"
            />
          </label>

          <label className="form-label">
            Trigger (optional)
            <input
              type="text"
              value={draft.trigger}
              onChange={e => setDraft(prev => ({ ...prev, trigger: e.target.value }))}
              placeholder="e.g. /myskill"
              className="form-input"
            />
          </label>

          <label className="form-label">
            Category (optional)
            <input
              type="text"
              value={draft.category}
              onChange={e => setDraft(prev => ({ ...prev, category: e.target.value }))}
              placeholder="e.g. development, testing"
              className="form-input"
            />
          </label>

          <label className="form-label">
            Tags (comma-separated)
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. typescript, backend"
              className="form-input"
            />
          </label>

          <div className="rule-editor-monaco">
            <span className="form-label-text">Content</span>
            <Editor
              height="400px"
              defaultLanguage="markdown"
              value={draft.content}
              onChange={val => setDraft(prev => ({ ...prev, content: val ?? '' }))}
              options={{ minimap: { enabled: false }, wordWrap: 'on' }}
            />
          </div>
        </div>

        <div className="rule-editor-preview">
          <SkillProjectionPreview projections={projections} loading={projectionsLoading} />
        </div>
      </div>
    </div>
  )
}

// ─── Skill Projection Preview ────────────────────────────────────────────────

interface SkillProjectionPreviewProps {
  projections: SkillProjectionItem[]
  loading?: boolean
}

function SkillProjectionPreview({ projections, loading }: SkillProjectionPreviewProps) {
  if (loading) return <div className="projection-loading">Loading projections…</div>
  if (projections.length === 0) return <div className="projection-empty">No projections available</div>

  return (
    <div className="projection-preview">
      <h3>Platform Projections</h3>
      {projections.map(p => (
        <div
          key={`${p.platformId}-${p.fileName}`}
          className="projection-card"
          style={{ borderLeft: `4px solid ${PLATFORM_COLORS[p.platformId] ?? '#888'}` }}
        >
          <div className="projection-platform">{p.platformId}</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontFamily: 'monospace' }}>
            {p.fileName}
          </div>
          {p.content !== null ? (
            <pre className="projection-content">{p.content}</pre>
          ) : (
            <div className="projection-empty-content">(uses global content)</div>
          )}
        </div>
      ))}
    </div>
  )
}
