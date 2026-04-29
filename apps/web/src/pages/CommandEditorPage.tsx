import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { UnifiedCommand, PlatformId } from '@prism/shared'
import { commandsApi } from '../api/commands'
import type { CommandProjectionItem } from '../api/commands'
import { PlatformIcon } from '../components/PlatformIcon'
import { API_BASE } from '../api/client'

interface CommandEditorPageProps {
  command?: UnifiedCommand
  onBack: () => void
  platform?: string
}

interface DetectedPlatform {
  id: string
  displayName: string
}

interface DraftCommand {
  name: string
  description: string
  tags: string
  content: string
}

function toDraft(command?: UnifiedCommand): DraftCommand {
  if (!command) {
    return { name: '', description: '', tags: '', content: '' }
  }
  return {
    name: command.name,
    description: command.description ?? '',
    tags: (command.tags ?? []).join(', '),
    content: command.content,
  }
}

export function CommandEditorPage({ command, onBack, platform }: CommandEditorPageProps) {
  const [draft, setDraft] = useState<DraftCommand>(() => toDraft(command))
  const [applyGlobally, setApplyGlobally] = useState(
    () => (command?.targetPlatforms?.length ?? 0) === 0
  )
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>(
    () => command?.targetPlatforms ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<CommandProjectionItem[]>([])
  const [projectionsLoading, setProjectionsLoading] = useState(false)
  const [detectedPlatforms, setDetectedPlatforms] = useState<DetectedPlatform[]>([])

  // Fetch detected platforms for the targeting checkboxes
  useEffect(() => {
    fetch(`${API_BASE}/platforms`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { items: Array<{ id: string; displayName: string; detected: boolean }> } | null) => {
        if (data) setDetectedPlatforms(data.items.filter(p => p.detected))
      })
      .catch(() => { /* noop */ })
  }, [])

  // Reset draft when switching to a different command
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDraft(toDraft(command))
    const saved = command?.targetPlatforms ?? []
    setTargetPlatforms(saved)
    setApplyGlobally(saved.length === 0)
  }, [command?.id])

  // Load projections for existing command
  useEffect(() => {
    if (!command?.id) return
    setProjectionsLoading(true)
    commandsApi.projections(command.id)
      .then(setProjections)
      .catch(() => setProjections([]))
      .finally(() => setProjectionsLoading(false))
  }, [command?.id])

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
      const tags = draft.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
      const dto = {
        name: draft.name.trim(),
        content: draft.content,
        description: draft.description.trim() || undefined,
        tags,
        targetPlatforms: (applyGlobally ? [] : targetPlatforms) as PlatformId[],
      }
      if (!command) {
        await commandsApi.create(dto, platform)
        onBack()
      } else {
        await commandsApi.update(command.id, dto, platform)
        onBack()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
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
          placeholder="Command name…"
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
                checked={applyGlobally || targetPlatforms.includes(platform.id)}
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
          <button className="btn btn-ghost btn-sm" onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving || !draft.name.trim() || isInvalidPlatformState}
          >
            {saving ? 'Saving…' : 'Save Command'}
          </button>
        </div>
      </div>

      {/* ── Metadata strip: description + tags ── */}
      <div className="editor-meta-strip">
        <input
          type="text"
          value={draft.description}
          onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Description (optional)"
          className="editor-meta-input"
        />
        <input
          type="text"
          value={draft.tags}
          onChange={e => setDraft(prev => ({ ...prev, tags: e.target.value }))}
          placeholder="Tags (comma-separated, optional)"
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

      {/* ── Projection Preview (edit mode only) ── */}
      {command && (
        <div className="projection-panel">
          <div className="projection-panel-header">
            <span className="projection-panel-title">Projection Preview</span>
            {projectionsLoading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>}
          </div>
          {!projectionsLoading && projections.length === 0 && (
            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
              No projections available.
            </div>
          )}
          {projections.map(proj => (
            <div key={proj.platformId} className="projection-item">
              <div className="projection-item-header">
                <PlatformIcon platformId={proj.platformId} size={13} />
                <span className="projection-item-platform">{proj.platformId}</span>
                <span className="projection-item-filename">{proj.fileName}</span>
              </div>
              <pre className="projection-item-content">{proj.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
