import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { McpServer } from '@prism/shared'
import { mcpApi } from '../api/mcp.js'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms.js'

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
  'codebuddy': '#7b1fa2',
}

const ALL_PLATFORMS = ['claude-code', 'codebuddy']

export function McpEditorPage({ onBack, initialServer }: McpEditorPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [draft, setDraft] = useState<DraftServer>(() => toDraft(initialServer))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<Record<string, unknown>>({})
  const [projectionsLoading, setProjectionsLoading] = useState(false)

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
      setError(e instanceof Error ? e.message : t('mcpEditor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const title = !initialServer ? t('mcpEditor.newTitle') : t('mcpEditor.editTitle', { name: initialServer.name })
  const projectionEntries = Object.entries(projections)

  return (
    <div className="editor-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-subtitle">MCP Server</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onBack} disabled={saving}>
            {tCommon('btn.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={saving || !draft.name.trim() || !draft.command.trim()}
          >
            {saving ? tCommon('status.saving') : tCommon('btn.save')}
          </button>
        </div>
      </div>

      {error && <div className="rule-editor-error">{error}</div>}

      <div className="rule-editor-body">
        {/* ── Form ─────────────────────────────────────────────── */}
        <div className="rule-editor-form">

          <label className="form-label">
            <span className="form-label-text">Name <span className="form-required">*</span></span>
            <input
              type="text"
              className="form-input"
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. context7"
            />
          </label>

          <label className="form-label">
            <span className="form-label-text">Command <span className="form-required">*</span></span>
            <input
              type="text"
              className="form-input form-input-mono"
              value={draft.command}
              onChange={e => setDraft(prev => ({ ...prev, command: e.target.value }))}
              placeholder="e.g. npx"
            />
          </label>

          <label className="form-label">
            <span className="form-label-text">Args <span className="form-hint">(space-separated)</span></span>
            <input
              type="text"
              className="form-input form-input-mono"
              value={draft.argsText}
              onChange={e => setDraft(prev => ({ ...prev, argsText: e.target.value }))}
              placeholder="e.g. -y @upstash/context7-mcp"
            />
          </label>

          <label className="form-label">
            <span className="form-label-text">Description <span className="form-hint">(optional)</span></span>
            <input
              type="text"
              className="form-input"
              value={draft.description}
              onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('mcpEditor.descPlaceholder')}
            />
          </label>

          {/* Target Platforms */}
          <div className="form-label">
            <span className="form-label-text">Target Platforms</span>
            <div className="mcp-platform-list">
              {ALL_PLATFORMS.map(platformId => (
                <label key={platformId} className="mcp-platform-item">
                  <input
                    type="checkbox"
                    checked={draft.targetPlatforms.includes(platformId)}
                    onChange={() => togglePlatform(platformId)}
                  />
                  <PlatformIcon platformId={platformId} size={14} />
                  <span
                    className="mcp-platform-label"
                    style={{ color: PLATFORM_COLORS[platformId] ?? 'var(--text-primary)' }}
                  >
                    {PLATFORM_LABELS[platformId as keyof typeof PLATFORM_LABELS] ?? platformId}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Environment Variables */}
          <div className="form-label">
            <div className="mcp-env-header">
              <span className="form-label-text">Environment Variables</span>
              <button className="btn btn-ghost btn-sm" onClick={addEnvEntry}>+ Add</button>
            </div>
            {draft.envEntries.length === 0 ? (
              <div className="mcp-env-empty">No environment variables configured</div>
            ) : (
              <div className="mcp-env-list">
                {draft.envEntries.map((entry, i) => (
                  <div key={i} className="mcp-env-row">
                    <input
                      className="form-input form-input-mono mcp-env-key"
                      value={entry.key}
                      onChange={e => updateEnvEntry(i, 'key', e.target.value)}
                      placeholder="KEY"
                    />
                    <input
                      className="form-input form-input-mono mcp-env-value"
                      value={entry.value}
                      onChange={e => updateEnvEntry(i, 'value', e.target.value)}
                      placeholder="value"
                    />
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeEnvEntry(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Projection Preview ───────────────────────────────── */}
        <div className="rule-editor-preview">
          {projectionsLoading ? (
            <div className="projection-loading">Loading projections…</div>
          ) : projectionEntries.length === 0 ? (
            <div className="projection-empty">
              {initialServer ? t('mcpEditor.noProjections') : t('mcpEditor.saveToSeeProjections')}
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
