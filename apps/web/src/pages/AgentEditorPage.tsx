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

const PLATFORM_COLORS: Record<string, string> = {
  'claude-code': '#cc785c',
  'cursor': '#1a73e8',
  'openclaw': '#2e7d32',
  'codebuddy': '#7b1fa2',
}

function toDraft(agent?: UnifiedAgent): DraftAgent {
  if (!agent) {
    return {
      name: '',
      content: '',
      agentType: '',
      description: '',
    }
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

  // 编辑模式下加载当前 projections
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

  // 当 agent 切换时重置 draft 和 tagsInput
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

  const title = !initialAgent ? 'New Agent' : `Edit Agent: ${initialAgent.name}`

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
          <AgentProjectionPreview projections={projections} loading={projectionsLoading} />
        </div>
      </div>
    </div>
  )
}

// ─── Agent Projection Preview ────────────────────────────────────────────────

interface AgentProjectionPreviewProps {
  projections: AgentProjectionItem[]
  loading?: boolean
}

function AgentProjectionPreview({ projections, loading }: AgentProjectionPreviewProps) {
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
