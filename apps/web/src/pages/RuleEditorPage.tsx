import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedRule } from '@prism/shared'
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
  targetPlatforms: string[]
}

function toDraft(rule: UnifiedRule | null): DraftRule {
  if (rule === null) {
    return { name: '', content: '', targetPlatforms: [] }
  }
  return {
    name: rule.name,
    content: rule.content,
    targetPlatforms: rule.targetPlatforms ?? [],
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
    // Intentional: reset only when navigating to a different rule (id change).
  }, [rule?.id])

  function handleApplyGloballyToggle(checked: boolean) {
    setApplyGlobally(checked)
    if (!checked) {
      setDraft(prev => ({ ...prev, targetPlatforms: detectedPlatforms.map(p => p.id) }))
    } else {
      setDraft(prev => ({ ...prev, targetPlatforms: [] }))
    }
  }

  function handlePlatformToggle(pid: string, checked: boolean) {
    setDraft(prev => {
      const next = checked
        ? [...prev.targetPlatforms, pid]
        : prev.targetPlatforms.filter(p => p !== pid)
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
        scope: 'global' as const,
        targetPlatforms: applyGlobally ? [] : draft.targetPlatforms,
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

  const isInvalidPlatformState =
    !applyGlobally && draft.targetPlatforms.length === 0 && detectedPlatforms.length > 0

  return (
    <div className="editor-page">
      {/* ── Compact toolbar: name + platform targeting + actions ── */}
      <div className="editor-toolbar">
        <input
          type="text"
          value={draft.name}
          onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Rule name…"
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
            <span>All platforms</span>
          </label>

          {detectedPlatforms.map(platform => (
            <label key={platform.id} className="toolbar-platform-item">
              <input
                type="checkbox"
                checked={applyGlobally || draft.targetPlatforms.includes(platform.id)}
                disabled={applyGlobally}
                onChange={e => handlePlatformToggle(platform.id, e.target.checked)}
              />
              <PlatformIcon platformId={platform.id} size={14} />
              <span>{platform.displayName}</span>
            </label>
          ))}

          {isInvalidPlatformState && (
            <span className="toolbar-platform-warning">Select at least one</span>
          )}
        </div>

        <div className="editor-toolbar-divider" />

        <div className="editor-toolbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !draft.name.trim() || isInvalidPlatformState}
          >
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
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
