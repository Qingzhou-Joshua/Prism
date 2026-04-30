import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [draft, setDraft] = useState<DraftSkill>(() => toDraft(initialSkill))
  const [applyGlobally, setApplyGlobally] = useState(
    () => (initialSkill?.targetPlatforms?.length ?? 0) === 0
  )
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(
    () => initialSkill?.targetPlatforms ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Intentional: reset only when navigating to a different skill (id change).
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

  function handlePlatformToggle(pid: string, checked: boolean) {
    setTargetPlatforms(prev =>
      checked ? [...prev, pid] : prev.filter(p => p !== pid)
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
      setError(e instanceof Error ? e.message : t('skillEditor.saveFailed'))
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
          placeholder={t('skillEditor.namePlaceholder')}
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
            {saving ? tCommon('status.saving') : t('skillEditor.saveSkill')}
          </button>
        </div>
      </div>

      {/* ── Metadata strip: trigger + category ── */}
      <div className="editor-meta-strip">
        <input
          type="text"
          value={draft.trigger}
          onChange={e => setDraft(prev => ({ ...prev, trigger: e.target.value }))}
          placeholder={t('skillEditor.triggerPlaceholder')}
          className="editor-meta-input"
        />
        <input
          type="text"
          value={draft.category}
          onChange={e => setDraft(prev => ({ ...prev, category: e.target.value }))}
          placeholder={t('skillEditor.categoryPlaceholder')}
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
