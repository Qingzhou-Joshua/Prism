import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedSkill } from '@prism/shared'
import type { PlatformId } from '@prism/shared'
import { skillsApi } from '../api/skills'
import { PlatformIcon } from '../components/PlatformIcon'

interface DetectedPlatform {
  id: string
  displayName: string
}

interface SkillEditorPageProps {
  onBack: () => void
  initialSkill?: UnifiedSkill
  detectedPlatforms: DetectedPlatform[]
  platformId?: string
}

interface DraftSkill {
  name: string
  content: string
  trigger: string
  category: string
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

export function SkillEditorPage({ onBack, initialSkill, detectedPlatforms, platformId }: SkillEditorPageProps) {
  const [draft, setDraft] = useState<DraftSkill>(() => toDraft(initialSkill))
  const [applyGlobally, setApplyGlobally] = useState(
    () => (initialSkill?.targetPlatforms?.length ?? 0) === 0
  )
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(
    () => initialSkill?.targetPlatforms ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Intentional: reset only when navigating to a different skill (id change),
  // not when parent updates the same skill's content post-save.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDraft(toDraft(initialSkill))
    const saved = initialSkill?.targetPlatforms ?? []
    setTargetPlatforms(saved)
    setApplyGlobally(saved.length === 0)
  }, [initialSkill?.id])

  function handleApplyGloballyToggle(checked: boolean) {
    setApplyGlobally(checked)
    if (!checked) {
      setTargetPlatforms(detectedPlatforms.map(p => p.id))
    } else {
      setTargetPlatforms([])
    }
  }

  function handlePlatformToggle(platformId: string, checked: boolean) {
    setTargetPlatforms(prev =>
      checked ? [...prev, platformId] : prev.filter(p => p !== platformId)
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
        trigger: draft.trigger.trim() || undefined,
        category: draft.category.trim() || undefined,
        tags: [],
        targetPlatforms: (applyGlobally ? [] : targetPlatforms) as PlatformId[],
      }
      if (!initialSkill) {
        await skillsApi.create(dto, platformId)
      } else {
        await skillsApi.update(initialSkill.id, dto, platformId)
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

  const title = !initialSkill ? 'New Skill' : `Edit: ${initialSkill.name}`

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
            {saving ? 'Saving…' : 'Save Skill'}
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
                    checked={applyGlobally || targetPlatforms.includes(platform.id)}
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
