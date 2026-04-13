import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedRule, RuleScope, PlatformId, PlatformOverride } from '@prism/shared'
import { rulesApi } from '../api/rules'
import type { RuleProjectionItem } from '../api/rules'
import { ProjectionPreview } from '../components/ProjectionPreview'

interface RuleEditorPageProps {
  rule: UnifiedRule | null // null = new rule
  onSave: (rule: UnifiedRule) => void
  onCancel: () => void
}

interface DraftRule {
  name: string
  content: string
  scope: RuleScope
  platformOverrides: Partial<Record<PlatformId, PlatformOverride>>
}

function toDraft(rule: UnifiedRule | null): DraftRule {
  if (rule === null) {
    return {
      name: '',
      content: '',
      scope: 'global',
      platformOverrides: {},
    }
  }
  return {
    name: rule.name,
    content: rule.content,
    scope: rule.scope,
    platformOverrides: rule.platformOverrides ?? {},
  }
}

export function RuleEditorPage({ rule, onSave, onCancel }: RuleEditorPageProps) {
  const [draft, setDraft] = useState<DraftRule>(() => toDraft(rule))
  const [tagsInput, setTagsInput] = useState(() => rule?.tags?.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<RuleProjectionItem[]>([])
  const [projectionsLoading, setProjectionsLoading] = useState(false)

  // 编辑模式下加载当前 projections
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

  // 当 rule 切换时重置 draft 和 tagsInput
  useEffect(() => {
    setDraft(toDraft(rule))
    setTagsInput(rule?.tags?.join(', ') ?? '')
  }, [rule?.id])

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const dto = {
        name: draft.name.trim(),
        content: draft.content,
        scope: draft.scope,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
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

  const title = rule === null ? 'New Rule' : `Edit Rule: ${rule.name}`

  return (
    <div className="rule-editor-page">
      <div className="rule-editor-header">
        <h2>{title}</h2>
        <div className="rule-editor-actions">
          <button onClick={onCancel} disabled={saving}>
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
          <ProjectionPreview projections={projections} loading={projectionsLoading} />
        </div>
      </div>
    </div>
  )
}
