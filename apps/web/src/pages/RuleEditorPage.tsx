import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedRule } from '@prism/shared'
import { rulesApi } from '../api/rules'
import { PlatformIcon } from '../components/PlatformIcon'
import { API_BASE } from '../api/client'

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

  // Platform Overrides state
  const [overridesExpanded, setOverridesExpanded] = useState(false)
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({
    'claude-code': '', 'codebuddy': '', 'openclaw': '',
  })
  const [overrideSaving, setOverrideSaving] = useState<Record<string, boolean>>({})
  const [overrideSaveError, setOverrideSaveError] = useState<Record<string, string | null>>({})

  // Reset draft when rule changes
  useEffect(() => {
    const d = toDraft(rule)
    setDraft(d)
    setApplyGlobally(d.targetPlatforms.length === 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentional: reset only when navigating to a different rule (id change).
  }, [rule?.id])

  // Load platform overrides when the panel is expanded
  useEffect(() => {
    if (!rule || !overridesExpanded) return
    const platforms = ['claude-code', 'codebuddy', 'openclaw'] as const
    void Promise.all(
      platforms.map(async (pid) => {
        try {
          const res = await fetch(`${API_BASE}/overrides/${pid}/rule/${rule.id}`)
          if (res.ok) {
            const data = await res.json()
            return [pid, data.content ?? ''] as const
          }
        } catch { /* ignore */ }
        return [pid, ''] as const
      })
    ).then(results => {
      setOverrideValues(Object.fromEntries(results))
    })
  }, [rule, overridesExpanded])

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

  async function handleSaveOverride(pid: string) {
    if (!rule) return
    setOverrideSaving(prev => ({ ...prev, [pid]: true }))
    setOverrideSaveError(prev => ({ ...prev, [pid]: null }))
    try {
      const res = await fetch(`${API_BASE}/overrides/${pid}/rule/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: overrideValues[pid] ?? '' }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
    } catch (e) {
      setOverrideSaveError(prev => ({
        ...prev,
        [pid]: e instanceof Error ? e.message : 'Save failed',
      }))
    } finally {
      setOverrideSaving(prev => ({ ...prev, [pid]: false }))
    }
  }

  async function handleClearOverride(pid: string) {
    if (!rule) return
    setOverrideSaving(prev => ({ ...prev, [pid]: true }))
    setOverrideSaveError(prev => ({ ...prev, [pid]: null }))
    try {
      const res = await fetch(`${API_BASE}/overrides/${pid}/rule/${rule.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        throw new Error(`Delete failed: ${res.status}`)
      }
      setOverrideValues(prev => ({ ...prev, [pid]: '' }))
    } catch (e) {
      setOverrideSaveError(prev => ({
        ...prev,
        [pid]: e instanceof Error ? e.message : 'Clear failed',
      }))
    } finally {
      setOverrideSaving(prev => ({ ...prev, [pid]: false }))
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

      {/* ── Platform Overrides (only when editing existing rule) ── */}
      {rule !== null && (
        <div
          style={{
            borderTop: '1px solid var(--border-default)',
            marginTop: 0,
          }}
        >
          {/* Toggle header */}
          <button
            onClick={() => setOverridesExpanded(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <span>{overridesExpanded ? '▼' : '▶'}</span>
            Platform Overrides
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
              — per-platform content that overrides the base rule
            </span>
          </button>

          {/* Expanded panel */}
          {overridesExpanded && (
            <div style={{ padding: '0 16px 16px' }}>
              {(['claude-code', 'codebuddy', 'openclaw'] as const).map(pid => (
                <div
                  key={pid}
                  style={{
                    marginBottom: 20,
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  {/* Sub-header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'var(--bg-hover)',
                      borderBottom: '1px solid var(--border-default)',
                    }}
                  >
                    <PlatformIcon platformId={pid} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{pid}</span>
                    {overrideSaving[pid] && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        Saving…
                      </span>
                    )}
                  </div>

                  {/* Monaco editor */}
                  <div style={{ height: 180 }}>
                    <Editor
                      height={180}
                      language="markdown"
                      theme="vs-dark"
                      value={overrideValues[pid] ?? ''}
                      onChange={val =>
                        setOverrideValues(prev => ({ ...prev, [pid]: val ?? '' }))
                      }
                      options={{
                        minimap: { enabled: false },
                        wordWrap: 'on',
                        fontSize: 13,
                        lineNumbers: 'off',
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: 'var(--bg-hover)',
                      borderTop: '1px solid var(--border-default)',
                    }}
                  >
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => void handleSaveOverride(pid)}
                      disabled={overrideSaving[pid]}
                    >
                      {overrideSaving[pid] ? 'Saving…' : 'Save Override'}
                    </button>
                    {(overrideValues[pid] ?? '').length > 0 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handleClearOverride(pid)}
                        disabled={overrideSaving[pid]}
                      >
                        Clear Override
                      </button>
                    )}
                    {overrideSaveError[pid] && (
                      <span style={{ fontSize: 12, color: 'var(--color-danger, #e05252)', marginLeft: 4 }}>
                        {overrideSaveError[pid]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
