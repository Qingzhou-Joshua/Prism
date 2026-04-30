import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  platformId?: string
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

export function AgentEditorPage({ onBack, initialAgent, detectedPlatforms, platformId }: AgentEditorPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [draft, setDraft] = useState<DraftAgent>(() => toDraft(initialAgent))
  const [applyGlobally, setApplyGlobally] = useState(
    () => (initialAgent?.targetPlatforms?.length ?? 0) === 0
  )
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(
    () => initialAgent?.targetPlatforms ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Intentional: reset only when navigating to a different agent (id change).
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
        await agentsApi.create(dto, platformId)
      } else {
        await agentsApi.update(initialAgent.id, dto, platformId)
      }
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentEditor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const isInvalidPlatformState =
    !applyGlobally && targetPlatforms.length === 0 && detectedPlatforms.length > 0

  return (
    <div className="editor-page">
      {/* ── Compact toolbar: name + platform targeting + actions ── */}
      <div className="editor-toolbar">
        <input
          type="text"
          value={draft.name}
          onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
          placeholder={t('agentEditor.namePlaceholder')}
          className="editor-toolbar-name"
        />

        <div className="editor-toolbar-divider" />

        {/* Platform targeting */}
        <div className="editor-toolbar-platforms">
          <label className="toolbar-platform-item">
            <input
              type="checkbox"
              checked={applyGlobally}
              onChange={e => handleApplyGloballyToggle(e.target.checked)}
            />
            <PlatformIcon platformId="global" size={14} />
            <span>{tCommon('platform.allPlatforms')}</span>
          </label>

          {detectedPlatforms.map(platform => (
            <label key={platform.id} className="toolbar-platform-item">
              <input
                type="checkbox"
                checked={applyGlobally || targetPlatforms.includes(platform.id)}
                disabled={applyGlobally}
                onChange={e => handlePlatformToggle(platform.id, e.target.checked)}
              />
              <PlatformIcon platformId={platform.id} size={14} />
              <span>{platform.displayName}</span>
            </label>
          ))}

          {isInvalidPlatformState && (
            <span className="toolbar-platform-warning">{tCommon('platform.selectAtLeastOne')}</span>
          )}
        </div>

        <div className="editor-toolbar-divider" />

        <div className="editor-toolbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onBack} disabled={saving}>
            {tCommon('btn.cancel')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !draft.name.trim() || isInvalidPlatformState}
          >
            {saving ? tCommon('status.saving') : t('agentEditor.saveAgent')}
          </button>
        </div>
      </div>

      {/* ── Metadata strip: agentType + description ── */}
      <div className="editor-meta-strip">
        <input
          type="text"
          value={draft.agentType}
          onChange={e => setDraft(prev => ({ ...prev, agentType: e.target.value }))}
          placeholder={t('agentEditor.namePlaceholder')}
          className="editor-meta-input"
        />
        <input
          type="text"
          value={draft.description}
          onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
          placeholder={t('agentEditor.descPlaceholder')}
          className="editor-meta-input"
        />
      </div>

      {error && <div className="error-state" style={{ margin: '0 0 8px' }}>{error}</div>}

      {/* ── Full-width Monaco editor ── */}
      <div className="editor-full">
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
  )
}
