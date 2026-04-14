import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedAgent, PlatformId } from '@prism/shared'
import { agentsApi } from '../api/agents'
import { PlatformIcon } from '../components/PlatformIcon'

// Uses string (not PlatformId) to avoid coupling to @prism/shared union type;
// callers must ensure values are valid PlatformIds.
interface DetectedPlatform {
  id: string
  displayName: string
}

interface AgentEditorPageProps {
  onBack: () => void
  initialAgent?: UnifiedAgent
  detectedPlatforms: DetectedPlatform[]
}

interface DraftAgent {
  name: string
  content: string
  agentType: string
  description: string
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

export function AgentEditorPage({ onBack, initialAgent, detectedPlatforms }: AgentEditorPageProps) {
  const [draft, setDraft] = useState<DraftAgent>(() => toDraft(initialAgent))
  const [applyGlobally, setApplyGlobally] = useState(
    () => (initialAgent?.targetPlatforms?.length ?? 0) === 0
  )
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(
    () => initialAgent?.targetPlatforms ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Intentional: reset only when navigating to a different agent (id change),
  // not when parent updates the same agent's content post-save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDraft(toDraft(initialAgent))
    const saved = initialAgent?.targetPlatforms ?? []
    setTargetPlatforms(saved)
    setApplyGlobally(saved.length === 0)
  }, [initialAgent?.id])

  function handleApplyGloballyToggle(checked: boolean) {
    setApplyGlobally(checked)
    if (!checked) {
      setTargetPlatforms(detectedPlatforms.map(p => p.id))
    } else {
      setTargetPlatforms([])
    }
  }

  function handlePlatformToggle(id: string, checked: boolean) {
    setTargetPlatforms(prev =>
      checked ? [...prev, id] : prev.filter(pid => pid !== id)
    )
  }

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const dto = {
        name: draft.name.trim(),
        content: draft.content,
        description: draft.description.trim() || undefined,
        agentType: draft.agentType.trim() || undefined,
        tags: [] as string[],
        targetPlatforms: (applyGlobally ? [] : targetPlatforms) as PlatformId[],
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

  const isInvalidPlatformState =
    !applyGlobally && targetPlatforms.length === 0 && detectedPlatforms.length > 0

  const title = !initialAgent ? 'New Agent' : `Edit: ${initialAgent.name}`

  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {applyGlobally
              ? 'Applied globally across all platforms'
              : `Targeted to ${targetPlatforms.length} platform${targetPlatforms.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="editor-header-actions">
          <button className="btn btn-ghost" onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !draft.name.trim() || isInvalidPlatformState}
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
          </div>

          {/* Platform Targeting */}
          <div className="editor-section">
            <div className="section-title">Target Platforms</div>

            <label className="platform-checkbox-row" style={{ marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={applyGlobally}
                onChange={e => handleApplyGloballyToggle(e.target.checked)}
              />
              <span>Apply to all platforms</span>
            </label>

            <div className="platform-list">
              {detectedPlatforms.length === 0 ? (
                <p className="platform-warning">No platforms detected.</p>
              ) : (
                detectedPlatforms.map(platform => (
                  <label
                    key={platform.id}
                    className="platform-checkbox-row"
                    style={{ opacity: applyGlobally ? 0.5 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={applyGlobally || targetPlatforms.includes(platform.id)}
                      disabled={applyGlobally}
                      onChange={e => handlePlatformToggle(platform.id, e.target.checked)}
                    />
                    <span
                      className="platform-checkbox-label"
                    >
                      <PlatformIcon platformId={platform.id} size={16} />
                      {platform.displayName}
                    </span>
                  </label>
                ))
              )}
            </div>
            {isInvalidPlatformState && (
              <p className="platform-warning">Select at least one platform, or enable global.</p>
            )}
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
      </div>
    </div>
  )
}
