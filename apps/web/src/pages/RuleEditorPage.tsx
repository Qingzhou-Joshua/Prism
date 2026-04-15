import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedRule, RuleScope, PlatformId, PlatformOverride } from '@prism/shared'
import { rulesApi } from '../api/rules'
import { PlatformIcon } from '../components/PlatformIcon'

interface DetectedPlatform {
  id: string
  displayName: string
}

interface RuleEditorPageProps {
  rule: UnifiedRule | null
  onSave: (rule: UnifiedRule) => void
  onCancel: () => void
  detectedPlatforms: DetectedPlatform[]
  platformId?: string
}

interface DraftRule {
  name: string
  content: string
  scope: RuleScope
  targetPlatforms: string[]
  platformOverrides: Partial<Record<PlatformId, PlatformOverride>>
}

function toDraft(rule: UnifiedRule | null): DraftRule {
  if (rule === null) {
    return {
      name: '',
      content: '',
      scope: 'global',
      targetPlatforms: [],
      platformOverrides: {},
    }
  }
  return {
    name: rule.name,
    content: rule.content,
    scope: rule.scope,
    targetPlatforms: rule.targetPlatforms ?? [],
    platformOverrides: rule.platformOverrides ?? {},
  }
}

export function RuleEditorPage({ rule, onSave, onCancel, detectedPlatforms, platformId }: RuleEditorPageProps) {
  const [draft, setDraft] = useState<DraftRule>(() => toDraft(rule))
  const [applyGlobally, setApplyGlobally] = useState(
    () => (rule?.targetPlatforms?.length ?? 0) === 0
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset draft when rule changes
  useEffect(() => {
    const d = toDraft(rule)
    setDraft(d)
    setApplyGlobally(d.targetPlatforms.length === 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentional: reset only when navigating to a different rule (id change),
    // not when parent updates the same rule's content post-save.
  }, [rule?.id])

  // When switching off "apply globally", default-select all detected platforms
  function handleApplyGloballyToggle(checked: boolean) {
    setApplyGlobally(checked)
    if (!checked) {
      setDraft(prev => ({
        ...prev,
        targetPlatforms: detectedPlatforms.map(p => p.id),
      }))
    } else {
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
        targetPlatforms: applyGlobally ? [] : draft.targetPlatforms,
        platformOverrides: draft.platformOverrides,
      }
      const saved =
        rule === null
          ? await rulesApi.create(dto, platformId)
          : await rulesApi.update(rule.id, dto, platformId)
      onSave(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const title = rule === null ? 'New Rule' : `Edit: ${rule.name}`
  const isInvalidPlatformState =
    !applyGlobally && draft.targetPlatforms.length === 0 && detectedPlatforms.length > 0

  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {applyGlobally
              ? 'Applied globally across all platforms'
              : `Targeted to ${draft.targetPlatforms.length} platform${draft.targetPlatforms.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="editor-header-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !draft.name.trim() || isInvalidPlatformState}
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
          </div>

          <div className="editor-section">
            <div className="section-title">Target Platforms</div>

            <label className="platform-checkbox-row">
              <input
                type="checkbox"
                checked={applyGlobally}
                onChange={e => handleApplyGloballyToggle(e.target.checked)}
              />
              <span className="platform-checkbox-label">
                <PlatformIcon platformId="global" size={8} />
                Apply to all platforms
              </span>
            </label>

            <div className="platform-list">
              {detectedPlatforms.length === 0 && (
                <p className="platform-warning">No platforms detected.</p>
              )}
              {detectedPlatforms.map(platform => (
                <label key={platform.id} className="platform-checkbox-row">
                  <input
                    type="checkbox"
                    checked={applyGlobally || draft.targetPlatforms.includes(platform.id)}
                    disabled={applyGlobally}
                    onChange={e => handlePlatformToggle(platform.id, e.target.checked)}
                  />
                  <span className="platform-checkbox-label">
                    <PlatformIcon platformId={platform.id} size={16} />
                    {platform.displayName}
                  </span>
                </label>
              ))}
            </div>

            {!applyGlobally && draft.targetPlatforms.length === 0 && detectedPlatforms.length > 0 && (
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
