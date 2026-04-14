import { useState, useEffect } from 'react'
import type { McpServer } from '@prism/shared'
import { mcpApi } from '../api/mcp.js'

interface EnvEntry {
  key: string
  value: string
}

interface McpEditorPageProps {
  onBack: () => void
  initialServer?: McpServer
}

interface DraftServer {
  name: string
  command: string
  argsText: string
  description: string
  targetPlatforms: string[]
  envEntries: EnvEntry[]
}

function toDraft(server?: McpServer): DraftServer {
  if (!server) {
    return {
      name: '',
      command: '',
      argsText: '',
      description: '',
      targetPlatforms: ['claude-code'],
      envEntries: [],
    }
  }
  return {
    name: server.name,
    command: server.command,
    argsText: server.args.join(' '),
    description: server.description ?? '',
    targetPlatforms: server.targetPlatforms as string[],
    envEntries: server.env
      ? Object.entries(server.env).map(([key, value]) => ({ key, value }))
      : [],
  }
}

const PLATFORM_COLORS: Record<string, string> = {
  'claude-code': '#cc785c',
  'cursor': '#1a73e8',
  'openclaw': '#2e7d32',
  'codebuddy': '#7b1fa2',
}

const ALL_PLATFORMS = ['claude-code']

export function McpEditorPage({ onBack, initialServer }: McpEditorPageProps) {
  const [draft, setDraft] = useState<DraftServer>(() => toDraft(initialServer))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<Record<string, unknown>>({})
  const [projectionsLoading, setProjectionsLoading] = useState(false)

  // Load projections for edit mode
  useEffect(() => {
    setProjections({})
    if (!initialServer) return
    let cancelled = false
    setProjectionsLoading(true)
    mcpApi
      .projections(initialServer.id)
      .then(data => { if (!cancelled) setProjections(data) })
      .catch(() => { if (!cancelled) setProjections({}) })
      .finally(() => { if (!cancelled) setProjectionsLoading(false) })
    return () => { cancelled = true }
  }, [initialServer?.id])

  // Reset draft when server changes
  useEffect(() => {
    setDraft(toDraft(initialServer))
  }, [initialServer?.id])

  function togglePlatform(platformId: string) {
    setDraft(prev => ({
      ...prev,
      targetPlatforms: prev.targetPlatforms.includes(platformId)
        ? prev.targetPlatforms.filter(p => p !== platformId)
        : [...prev.targetPlatforms, platformId],
    }))
  }

  function addEnvEntry() {
    setDraft(prev => ({ ...prev, envEntries: [...prev.envEntries, { key: '', value: '' }] }))
  }

  function removeEnvEntry(i: number) {
    setDraft(prev => ({ ...prev, envEntries: prev.envEntries.filter((_, idx) => idx !== i) }))
  }

  function updateEnvEntry(i: number, field: 'key' | 'value', val: string) {
    setDraft(prev => ({
      ...prev,
      envEntries: prev.envEntries.map((e, idx) => idx === i ? { ...e, [field]: val } : e),
    }))
  }

  async function handleSave() {
    if (!draft.name.trim() || !draft.command.trim()) {
      setError('Name and command are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const args = draft.argsText.trim() ? draft.argsText.trim().split(/\s+/) : []
      const validEnvEntries = draft.envEntries.filter(e => e.key.trim())
      const env = validEnvEntries.length > 0
        ? Object.fromEntries(validEnvEntries.map(e => [e.key.trim(), e.value]))
        : undefined

      const dto = {
        name: draft.name.trim(),
        command: draft.command.trim(),
        args,
        description: draft.description.trim() || undefined,
        env,
        targetPlatforms: draft.targetPlatforms as import('@prism/shared').McpServer['targetPlatforms'],
      }

      if (!initialServer) {
        await mcpApi.create(dto)
      } else {
        await mcpApi.update(initialServer.id, dto)
      }
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const title = !initialServer ? 'New MCP Server' : `Edit MCP Server: ${initialServer.name}`
  const projectionEntries = Object.entries(projections)

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

  return (
    <div className="rule-editor-page">
      <div className="rule-editor-header">
        <h2>{title}</h2>
        <div className="rule-editor-actions">
          <button onClick={onBack} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !draft.name.trim() || !draft.command.trim()}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="rule-editor-error">{error}</div>}

      <div className="rule-editor-body">
        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <div className="rule-editor-form">
          <label className="form-label">
            Name *
            <input
              type="text"
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. context7"
              className="form-input"
            />
          </label>

          <label className="form-label">
            Command *
            <input
              type="text"
              value={draft.command}
              onChange={e => setDraft(prev => ({ ...prev, command: e.target.value }))}
              placeholder="e.g. npx"
              style={monoInputStyle}
              className="form-input"
            />
          </label>

          <label className="form-label">
            Args (space-separated)
            <input
              type="text"
              value={draft.argsText}
              onChange={e => setDraft(prev => ({ ...prev, argsText: e.target.value }))}
              placeholder="e.g. -y @upstash/context7-mcp"
              style={monoInputStyle}
              className="form-input"
            />
          </label>

          <label className="form-label">
            Description (optional)
            <input
              type="text"
              value={draft.description}
              onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what this MCP server provides"
              className="form-input"
            />
          </label>

          {/* Target Platforms */}
          <div className="form-label">
            <span style={{ display: 'block', marginBottom: 6 }}>Target Platforms</span>
            {ALL_PLATFORMS.map(platformId => (
              <label
                key={platformId}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={draft.targetPlatforms.includes(platformId)}
                  onChange={() => togglePlatform(platformId)}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: PLATFORM_COLORS[platformId] ?? '#f0f0f0',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {platformId}
                </span>
              </label>
            ))}
          </div>

          {/* Environment Variables */}
          <div className="form-label">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span>Environment Variables</span>
              <button
                onClick={addEnvEntry}
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
                + Add
              </button>
            </div>
            {draft.envEntries.length === 0 ? (
              <div style={{ fontSize: 12, color: '#555' }}>No environment variables</div>
            ) : (
              draft.envEntries.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input
                    value={entry.key}
                    onChange={e => updateEnvEntry(i, 'key', e.target.value)}
                    placeholder="KEY"
                    style={{ ...monoInputStyle, flex: '0 0 180px', width: 'auto' }}
                  />
                  <input
                    value={entry.value}
                    onChange={e => updateEnvEntry(i, 'value', e.target.value)}
                    placeholder="value"
                    style={{ ...monoInputStyle, flex: 1, width: 'auto' }}
                  />
                  <button
                    onClick={() => removeEnvEntry(i)}
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
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Projection Preview ────────────────────────────────────────────── */}
        <div className="rule-editor-preview">
          {projectionsLoading ? (
            <div className="projection-loading">Loading projections…</div>
          ) : projectionEntries.length === 0 ? (
            <div className="projection-empty">
              {initialServer ? 'No projections available' : 'Save to see platform projections'}
            </div>
          ) : (
            <div className="projection-preview">
              <h3>Platform Projections</h3>
              {projectionEntries.map(([platformId, proj]) => (
                <div
                  key={platformId}
                  className="projection-card"
                  style={{ borderLeft: `4px solid ${PLATFORM_COLORS[platformId] ?? '#888'}` }}
                >
                  <div className="projection-platform">{platformId}</div>
                  <pre className="projection-content">
                    {JSON.stringify(proj, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
