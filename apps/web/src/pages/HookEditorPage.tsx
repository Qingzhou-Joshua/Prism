import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedHook, HookEventType, HookAction, HookCommand, HookHttp, HookPrompt, HookAgent } from '@prism/shared'
import { hooksApi } from '../api/hooks.js'

interface HookEditorPageProps {
  platformId: string
  onBack: () => void
  initialHook?: UnifiedHook
}

const EVENT_TYPES: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'SubagentStart',
  'SubagentStop',
]

interface DraftHook {
  eventType: HookEventType
  matcher: string
  description: string
  actions: HookAction[]
}

function toDraft(hook?: UnifiedHook): DraftHook {
  if (!hook) {
    return {
      eventType: 'PostToolUse',
      matcher: '',
      description: '',
      actions: [{ type: 'command', command: '' }],
    }
  }
  return {
    eventType: hook.eventType,
    matcher: hook.matcher,
    description: hook.description ?? '',
    actions: hook.actions.length > 0 ? hook.actions : [{ type: 'command', command: '' }],
  }
}

function newAction(type: HookAction['type']): HookAction {
  if (type === 'command') return { type: 'command', command: '' }
  if (type === 'http') return { type: 'http', url: '', method: 'POST' }
  if (type === 'prompt') return { type: 'prompt', prompt: '' }
  return { type: 'agent', agent: '' }
}

const inputStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #333',
  borderRadius: 4,
  color: '#f0f0f0',
  fontSize: 13,
  padding: '6px 10px',
  width: '100%',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

function ActionEditor({
  action,
  onChange,
  onRemove,
  canRemove,
}: {
  action: HookAction
  onChange: (a: HookAction) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="hook-action-editor">
      <div className="hook-action-header">
        <select
          value={action.type}
          onChange={e => onChange(newAction(e.target.value as HookAction['type']))}
          style={{ ...selectStyle, width: 120 }}
        >
          <option value="command">command</option>
          <option value="http">http</option>
          <option value="prompt">prompt</option>
          <option value="agent">agent</option>
        </select>
        {canRemove && (
          <button
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: '1px solid #7f1d1d',
              borderRadius: 3,
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 12,
              padding: '4px 8px',
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {action.type === 'command' && (
        <div style={{ marginTop: 8 }}>
          <label className="form-label">
            Command *
            <input
              type="text"
              value={(action as HookCommand).command}
              onChange={e => onChange({ ...action, command: e.target.value } as HookCommand)}
              placeholder="e.g. pnpm format"
              style={monoInputStyle}
            />
          </label>
          <label className="form-label" style={{ marginTop: 6 }}>
            Timeout (ms, optional)
            <input
              type="number"
              value={(action as HookCommand).timeout ?? ''}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : undefined
                onChange({ ...action, timeout: v } as HookCommand)
              }}
              placeholder="e.g. 10000"
              style={inputStyle}
            />
          </label>
        </div>
      )}

      {action.type === 'http' && (
        <div style={{ marginTop: 8 }}>
          <label className="form-label">
            URL *
            <input
              type="text"
              value={(action as HookHttp).url}
              onChange={e => onChange({ ...action, url: e.target.value } as HookHttp)}
              placeholder="e.g. https://example.com/webhook"
              style={monoInputStyle}
            />
          </label>
          <label className="form-label" style={{ marginTop: 6 }}>
            Method
            <select
              value={(action as HookHttp).method ?? 'POST'}
              onChange={e => onChange({ ...action, method: e.target.value } as HookHttp)}
              style={selectStyle}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </label>
        </div>
      )}

      {action.type === 'prompt' && (
        <div style={{ marginTop: 8 }}>
          <label className="form-label">
            Prompt *
            <textarea
              value={(action as HookPrompt).prompt}
              onChange={e => onChange({ ...action, prompt: e.target.value } as HookPrompt)}
              placeholder="Prompt text to inject…"
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </div>
      )}

      {action.type === 'agent' && (
        <div style={{ marginTop: 8 }}>
          <label className="form-label">
            Agent *
            <input
              type="text"
              value={(action as HookAgent).agent}
              onChange={e => onChange({ ...action, agent: e.target.value } as HookAgent)}
              placeholder="e.g. code-reviewer"
              style={inputStyle}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function HookEditorPage({ platformId, onBack, initialHook }: HookEditorPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [draft, setDraft] = useState<DraftHook>(() => toDraft(initialHook))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(toDraft(initialHook))
  }, [initialHook?.id])

  function updateAction(i: number, action: HookAction) {
    setDraft(prev => ({ ...prev, actions: prev.actions.map((a, idx) => idx === i ? action : a) }))
  }

  function removeAction(i: number) {
    setDraft(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }))
  }

  function addAction() {
    setDraft(prev => ({ ...prev, actions: [...prev.actions, { type: 'command', command: '' }] }))
  }

  function isValid() {
    if (!draft.matcher.trim()) return false
    for (const action of draft.actions) {
      if (action.type === 'command' && !(action as HookCommand).command.trim()) return false
      if (action.type === 'http' && !(action as HookHttp).url.trim()) return false
      if (action.type === 'prompt' && !(action as HookPrompt).prompt.trim()) return false
      if (action.type === 'agent' && !(action as HookAgent).agent.trim()) return false
    }
    return true
  }

  async function handleSave() {
    if (!isValid()) {
      setError('Matcher and all action fields are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const dto = {
        eventType: draft.eventType,
        matcher: draft.matcher.trim(),
        description: draft.description.trim() || undefined,
        actions: draft.actions,
      }
      if (!initialHook) {
        await hooksApi.create(platformId, dto)
      } else {
        await hooksApi.update(platformId, initialHook.id, dto)
      }
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hookEditor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const title = !initialHook ? t('hookEditor.newTitle') : t('hookEditor.editTitle', { matcher: initialHook.matcher })

  return (
    <div className="rule-editor-page">
      <div className="rule-editor-header">
        <h2>{title}</h2>
        <div className="rule-editor-actions">
          <button onClick={onBack} disabled={saving}>{tCommon('btn.cancel')}</button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !isValid()}
            className="btn-primary"
          >
            {saving ? tCommon('status.saving') : tCommon('btn.save')}
          </button>
        </div>
      </div>

      {error && <div className="rule-editor-error">{error}</div>}

      <div style={{ maxWidth: 640, padding: '24px 0' }}>
        <label className="form-label">
          Event Type *
          <select
            value={draft.eventType}
            onChange={e => setDraft(prev => ({ ...prev, eventType: e.target.value as HookEventType }))}
            style={selectStyle}
          >
            {EVENT_TYPES.map(et => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </label>

        <label className="form-label" style={{ marginTop: 16 }}>
          Matcher *
          <input
            type="text"
            value={draft.matcher}
            onChange={e => setDraft(prev => ({ ...prev, matcher: e.target.value }))}
            placeholder="e.g. Write|Edit  or  .*"
            style={monoInputStyle}
          />
          <span style={{ fontSize: 11, color: '#666', marginTop: 4, display: 'block' }}>Regex pattern matched against the tool name</span>
        </label>

        <label className="form-label" style={{ marginTop: 16 }}>
          Description (optional)
          <input
            type="text"
            value={draft.description}
            onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
            placeholder={t('hookEditor.descPlaceholder')}
            style={inputStyle}
          />
        </label>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="form-label" style={{ margin: 0 }}>Actions *</span>
            <button
              onClick={addAction}
              style={{
                background: 'transparent',
                border: '1px solid #374151',
                borderRadius: 3,
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 8px',
                fontFamily: 'inherit',
              }}
            >
              {t('hookEditor.addAction')}
            </button>
          </div>
          {draft.actions.map((action, i) => (
            <ActionEditor
              key={i}
              action={action}
              onChange={a => updateAction(i, a)}
              onRemove={() => removeAction(i)}
              canRemove={draft.actions.length > 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
