import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedAgent } from '@prism/shared'
import { agentsApi } from '../api/agents'
import type { AgentProjectionItem } from '../api/agents'

interface AgentEditorPageProps {
  onBack: () => void
  initialAgent?: UnifiedAgent
}

interface DraftAgent {
  name: string
  content: string
  agentType: string
  description: string
}

const PLATFORM_DOTS: Record<string, string> = {
  'claude-code': '#e65c46',
  'cursor':      '#6ea8fe',
  'openclaw':    '#34c799',
  'codebuddy':   '#c084fc',
}

function toDraft(agent?: UnifiedAgent): DraftAgent {
  if (!agent) {
    return { name: '', content: '', agentType: '', description: '' }
  }
  return {
    name: agent.name,
    content: agent.content,
    agentType: agent.agentType ?? '',
    description: agent.description ?? '',
  }
}

export function AgentEditorPage({ onBack, initialAgent }: AgentEditorPageProps) {
  const [draft, setDraft] = useState<DraftAgent>(() => toDraft(initialAgent))
  const [tagsInput, setTagsInput] = useState(() => initialAgent?.tags?.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<AgentProjectionItem[]>([])
  const [projectionsLoading, setProjectionsLoading] = useState(false)

  useEffect(() => {
    setProjections([])
    if (!initialAgent) return
    let cancelled = false
    setProjectionsLoading(true)
    agentsApi
      .projections(initialAgent.id)
      .then(data  => { if (!cancelled) setProjections(data) })
      .catch(()   => { if (!cancelled) setProjections([]) })
      .finally(() => { if (!cancelled) setProjectionsLoading(false) })
    return () => { cancelled = true }
  }, [initialAgent?.id])

  useEffect(() => {
    setDraft(toDraft(initialAgent))
    setTagsInput(initialAgent?.tags?.join(', ') ?? '')
  }, [initialAgent?.id])

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const dto = {
        name: draft.name.trim(),
        content: draft.content,
        description: draft.description.trim() || undefined,
        agentType: draft.agentType.trim() || undefined,
        tags,
        targetPlatforms: initialAgent?.targetPlatforms ?? [],
      }
      if (!initialAgent) {
        await agentsApi.create(dto)
      } else {
        await agentsApi.update(initialAgent.id, dto)
      }
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const title = !initialAgent ? 'New Agent' : `Edit: ${initialAgent.name}`

  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {initialAgent ? `Editing agent — ${initialAgent.name}` : 'Create a new agent'}
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
            {saving ? 'Saving…' : 'Save Agent'}
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
                placeholder="Agent name"
                className="form-input"
              />
            </label>

            <label className="form-label">
              Agent Type (optional)
              <input
                type="text"
                value={draft.agentType}
                onChange={e => setDraft(prev => ({ ...prev, agentType: e.target.value }))}
                placeholder="e.g. general-purpose, code-reviewer"
                className="form-input"
              />
            </label>

            <label className="form-label">
              Description (optional)
              <input
                type="text"
                value={draft.description}
                onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of what this agent does"
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
            <AgentProjectionPreview projections={projections} loading={projectionsLoading} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Agent Projection Preview (tab-based) ───────────────────────────────────

interface AgentProjectionPreviewProps {
  projections: AgentProjectionItem[]
  loading?: boolean
}

function AgentProjectionPreview({ projections, loading }: AgentProjectionPreviewProps) {
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
