import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedRule, RuleScope, PlatformId, PlatformOverride } from '@prism/shared'
import { rulesApi } from '../api/rules'
import type { RuleProjectionItem } from '../api/rules'
import { ProjectionPreview } from '../components/ProjectionPreview'
import { ALL_PLATFORMS, PLATFORM_LABELS } from '../constants/platforms.js'

interface RuleEditorPageProps {
  rule: UnifiedRule | null // null = new rule
  onSave: (rule: UnifiedRule) => void
  onCancel: () => void
}

interface DraftRule {
  name: string
  content: string
  scope: RuleScope
  tags: string
  targetPlatforms: string[]
  platformOverrides: Partial<Record<PlatformId, PlatformOverride>>
}

function toDraft(rule: UnifiedRule | null): DraftRule {
  if (rule === null) {
    return {
      name: '',
      content: '',
      scope: 'global',
      tags: '',
      targetPlatforms: [],
      platformOverrides: {},
    }
  }
  return {
    name: rule.name,
    content: rule.content,
    scope: rule.scope,
    tags: rule.tags?.join(', ') ?? '',
    targetPlatforms: rule.targetPlatforms ?? [],
    platformOverrides: rule.platformOverrides ?? {},
  }
}

export function RuleEditorPage({ rule, onSave, onCancel }: RuleEditorPageProps) {
  const [draft, setDraft] = useState<DraftRule>(() => toDraft(rule))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<RuleProjectionItem[]>([])
  const [projectionsLoading, setProjectionsLoading] = useState(false)

  // Load projections in edit mode
  useEffect(() => {
    setProjections([])
    if (rule === null) return
    setProjectionsLoading(true)
    rulesApi
      .projections(rule.id)
      .then(setProjections)
      .catch(() => setProjections([]))
      .finally(() => setProjectionsLoading(false))
  }, [rule?.id])

  // Reset draft when rule changes
  useEffect(() => {
    setDraft(toDraft(rule))
  }, [rule?.id])

  const applyGlobally = draft.targetPlatforms.length === 0

  function handleApplyGloballyToggle(checked: boolean) {
    setDraft(prev => ({ ...prev, targetPlatforms: checked ? [] : [] }))
    if (checked) {
      setDraft(prev => ({ ...prev, targetPlatforms: [] }))
    }
  }

  function handlePlatformToggle(platformId: string, checked: boolean) {
    setDraft(prev => {
      const next = checked
        ? [...prev.targetPlatforms, platformId]
        : prev.targetPlatforms.filter(p => p !== platformId)
      return { ...prev, targetPlatforms: next }
    })
  }

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const dto = {
        name: draft.name.trim(),
        content: draft.content,
        scope: draft.scope,
        tags: draft.tags.split(',').map(t => t.trim()).filter(Boolean),
        targetPlatforms: draft.targetPlatforms,
        platformOverrides: draft.platformOverrides,
      }
      const saved =
        rule === null
          ? await rulesApi.create(dto)
          : await rulesApi.update(rule.id, dto)
      onSave(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const title = rule === null ? 'New Rule' : `Edit: ${rule.name}`

  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {applyGlobally ? 'Applied globally across all platforms' : `Targeted to ${draft.targetPlatforms.length} platform${draft.targetPlatforms.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="editor-header-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>

      {error && <div className="error-state">{error}</div>}

      <div className="editor-layout">
        {/* LEFT: Metadata + Platform Targeting */}
        <div className="editor-left">
          <div className="editor-section">
            <label className="form-label">
              Name
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Rule name"
                className="form-input"
              />
            </label>

            <label className="form-label">
              Scope
              <select
                value={draft.scope}
                onChange={e =>
                  setDraft(prev => ({ ...prev, scope: e.target.value as RuleScope }))
                }
                className="form-select"
              >
                <option value="global">global</option>
                <option value="project">project</option>
              </select>
            </label>

            <label className="form-label">
              Tags
              <input
                type="text"
                value={draft.tags}
                onChange={e => setDraft(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="typescript, backend"
                className="form-input"
              />
            </label>
          </div>

          <div className="editor-section">
            <div className="section-title">Platform Targeting</div>

            <label className="platform-checkbox-row">
              <input
                type="checkbox"
                checked={applyGlobally}
                onChange={e => handleApplyGloballyToggle(e.target.checked)}
              />
              <span className="platform-checkbox-label">
                <span className="platform-dot platform-dot-global" />
                Apply globally
              </span>
            </label>

            {!applyGlobally && (
              <div className="platform-list">
                {ALL_PLATFORMS.map(platformId => (
                  <label key={platformId} className="platform-checkbox-row">
                    <input
                      type="checkbox"
                      checked={draft.targetPlatforms.includes(platformId)}
                      onChange={e => handlePlatformToggle(platformId, e.target.checked)}
                    />
                    <span className="platform-checkbox-label">
                      <span className={`platform-dot platform-dot-${platformId}`} />
                      {PLATFORM_LABELS[platformId]}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {!applyGlobally && draft.targetPlatforms.length === 0 && (
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

        {/* RIGHT: Projection Preview */}
        <div className="editor-right">
          <div className="projection-panel">
            <div className="section-title">Platform Projections</div>
            <ProjectionPreview projections={projections} loading={projectionsLoading} />
          </div>
        </div>
      </div>
    </div>
  )
}
