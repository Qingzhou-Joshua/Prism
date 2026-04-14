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

const PLATFORM_DOTS: Record<string, string> = {
  'claude-code': '#e65c46',
  'cursor':      '#6ea8fe',
  'openclaw':    '#34c799',
  'codebuddy':   '#c084fc',
}

function toDraft(skill?: UnifiedSkill): DraftSkill {
  if (!skill) {
    return { name: '', content: '', trigger: '', category: '' }
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

  useEffect(() => {
    setProjections([])
    if (!initialSkill) return
    let cancelled = false
    setProjectionsLoading(true)
    skillsApi
      .projections(initialSkill.id)
      .then(data  => { if (!cancelled) setProjections(data) })
      .catch(()   => { if (!cancelled) setProjections([]) })
      .finally(() => { if (!cancelled) setProjectionsLoading(false) })
    return () => { cancelled = true }
  }, [initialSkill?.id])

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

  const title = !initialSkill ? 'New Skill' : `Edit: ${initialSkill.name}`

  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {initialSkill ? `Editing skill — ${initialSkill.name}` : 'Create a new skill'}
          </p>
        </div>
        <div className="editor-header-actions">
          <button className="btn btn-ghost" onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? 'Saving…' : 'Save Skill'}
          </button>
        </div>
      </div>

      {error && <div className="error-state">{error}</div>}

      <div className="editor-layout">
        {/* LEFT: Metadata */}
        <div className="editor-left">
          <div className="editor-section">
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
          </div>
        </div>

        {/* CENTER: Monaco Editor */}
        <div className="editor-center">
          <div className="monaco-wrapper">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              theme="vs-dark"
              value={draft.content}
              onChange={val => setDraft(prev => ({ ...prev, content: val ?? '' }))}
              options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 14 }}
            />
          </div>
        </div>

        {/* RIGHT: Projection Preview */}
        <div className="editor-right">
          <div className="projection-panel">
            <div className="section-title">Platform Projections</div>
            <SkillProjectionPreview projections={projections} loading={projectionsLoading} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skill Projection Preview (tab-based) ───────────────────────────────────

interface SkillProjectionPreviewProps {
  projections: SkillProjectionItem[]
  loading?: boolean
}

function SkillProjectionPreview({ projections, loading }: SkillProjectionPreviewProps) {
  const [activeTab, setActiveTab] = useState(0)

  if (loading) {
    return (
      <div className="proj-wrap">
        <div className="proj-loading">Loading projections…</div>
      </div>
    )
  }

  if (projections.length === 0) {
    return (
      <div className="proj-wrap">
        <div className="proj-empty">No projections available</div>
      </div>
    )
  }

  const clampedTab = Math.min(activeTab, projections.length - 1)
  const current = projections[clampedTab]

  return (
    <div className="proj-wrap">
      <div className="proj-tabs" role="tablist">
        {projections.map((p, i) => (
          <button
            key={`${p.platformId}-${p.fileName}`}
            role="tab"
            aria-selected={i === clampedTab}
            className={`proj-tab${i === clampedTab ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <span
              className="proj-tab-dot"
              style={{ background: PLATFORM_DOTS[p.platformId] ?? '#888' }}
            />
            {p.platformId}
          </button>
        ))}
      </div>

      <div className="proj-body">
        {current.fileName && (
          <div className="proj-filename">{current.fileName}</div>
        )}
        {current.content !== null ? (
          <pre className="proj-content">{current.content}</pre>
        ) : (
          <div className="proj-empty-content">(uses global content)</div>
        )}
      </div>
    </div>
  )
}
