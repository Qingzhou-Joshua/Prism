import { PixelIcon } from '../components/PixelIcon'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { McpServer, McpTransport } from '@prism/shared'
import { mcpApi, type McpProjection } from '../api/mcp.js'
import { platformLabel } from '../constants/platforms.js'

interface KvEntry {
  key: string
  value: string
}

interface McpEditorPageProps {
  platformId: string
  configPath?: string
  onBack: () => void
  initialServer?: McpServer
}

interface DraftServer {
  name: string
  type: McpTransport
  command: string
  /** One argument per line — args may contain spaces. */
  argsText: string
  url: string
  enabled: boolean
  envEntries: KvEntry[]
  headerEntries: KvEntry[]
}

const toEntries = (rec?: Record<string, string>): KvEntry[] =>
  rec ? Object.entries(rec).map(([key, value]) => ({ key, value })) : []

const fromEntries = (entries: KvEntry[]): Record<string, string> | undefined => {
  const valid = entries.filter(e => e.key.trim())
  return valid.length > 0 ? Object.fromEntries(valid.map(e => [e.key.trim(), e.value])) : undefined
}

function toDraft(server?: McpServer): DraftServer {
  return {
    name: server?.name ?? '',
    type: server?.type ?? 'stdio',
    command: server?.command ?? '',
    argsText: (server?.args ?? []).join('\n'),
    url: server?.url ?? '',
    enabled: server?.enabled !== false,
    envEntries: toEntries(server?.env),
    headerEntries: toEntries(server?.headers),
  }
}

function KvEditor({
  label,
  entries,
  onChange,
}: {
  label: string
  entries: KvEntry[]
  onChange: (next: KvEntry[]) => void
}) {
  return (
    <div className="form-label">
      <div className="mcp-env-header">
        <span className="form-label-text">{label}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => onChange([...entries, { key: '', value: '' }])}>+ Add</button>
      </div>
      {entries.length > 0 && (
        <div className="mcp-env-list">
          {entries.map((entry, i) => (
            <div key={i} className="mcp-env-row">
              <input
                className="form-input form-input-mono mcp-env-key"
                value={entry.key}
                onChange={e => onChange(entries.map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))}
                placeholder="KEY"
              />
              <input
                className="form-input form-input-mono mcp-env-value"
                value={entry.value}
                onChange={e => onChange(entries.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                placeholder="value"
              />
              <button className="btn btn-danger btn-sm" onClick={() => onChange(entries.filter((_, idx) => idx !== i))}><PixelIcon name="close" size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function McpEditorPage({ platformId, configPath, onBack, initialServer }: McpEditorPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [draft, setDraft] = useState<DraftServer>(() => toDraft(initialServer))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<McpProjection[]>([])

  useEffect(() => {
    setDraft(toDraft(initialServer))
    setProjections([])
    if (!initialServer) return
    let cancelled = false
    mcpApi
      .projections(initialServer.id, platformId)
      .then(data => { if (!cancelled) setProjections(data) })
      .catch(() => { if (!cancelled) setProjections([]) })
    return () => { cancelled = true }
  }, [initialServer?.id, platformId])

  const isRemote = draft.type !== 'stdio'
  const valid = draft.name.trim() !== '' && (isRemote ? draft.url.trim() !== '' : draft.command.trim() !== '')

  async function handleSave() {
    if (!valid) {
      setError(t('mcpEditor.commandOrUrlRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const dto = {
        name: draft.name.trim(),
        type: draft.type,
        command: isRemote ? '' : draft.command.trim(),
        args: isRemote ? [] : draft.argsText.split('\n').map(a => a.trim()).filter(Boolean),
        env: isRemote ? undefined : fromEntries(draft.envEntries),
        url: isRemote ? draft.url.trim() : undefined,
        headers: isRemote ? fromEntries(draft.headerEntries) : undefined,
        enabled: draft.enabled,
        targetPlatforms: [platformId],
      }
      if (!initialServer) {
        await mcpApi.create(dto, platformId)
      } else {
        await mcpApi.update(initialServer.id, dto, platformId)
      }
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcpEditor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const title = !initialServer ? t('mcpEditor.newTitle') : t('mcpEditor.editTitle', { name: initialServer.name })
  const writesTo = initialServer?.filePath ?? configPath

  return (
    <div className="editor-page">
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-subtitle">
            MCP Server · {platformLabel(platformId)}
            {writesTo && <> · <code style={{ fontSize: 11 }}>{t('mcpEditor.writesTo', { path: writesTo })}</code></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onBack} disabled={saving}>
            {tCommon('btn.cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving || !valid}>
            {saving ? tCommon('status.saving') : tCommon('btn.save')}
          </button>
        </div>
      </div>

      {error && <div className="rule-editor-error">{error}</div>}

      <div className="rule-editor-body">
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

          <div className="form-label">
            <span className="form-label-text">{t('mcpEditor.transport')}</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {(['stdio', 'http', 'sse'] as const).map(tp => (
                <label key={tp} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="radio"
                    name="mcp-transport"
                    checked={draft.type === tp}
                    onChange={() => setDraft(prev => ({ ...prev, type: tp }))}
                  />
                  {tp}
                </label>
              ))}
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13, marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={e => setDraft(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                {t('mcpEditor.enabled')}
              </label>
            </div>
          </div>

          {isRemote ? (
            <>
              <label className="form-label">
                <span className="form-label-text">{t('mcpEditor.url')} <span className="form-required">*</span></span>
                <input
                  type="text"
                  className="form-input form-input-mono"
                  value={draft.url}
                  onChange={e => setDraft(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/mcp"
                />
              </label>
              <KvEditor
                label={t('mcpEditor.headers')}
                entries={draft.headerEntries}
                onChange={headerEntries => setDraft(prev => ({ ...prev, headerEntries }))}
              />
            </>
          ) : (
            <>
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
                <span className="form-label-text">Args <span className="form-hint">(one per line)</span></span>
                <textarea
                  className="form-input form-input-mono"
                  rows={4}
                  value={draft.argsText}
                  onChange={e => setDraft(prev => ({ ...prev, argsText: e.target.value }))}
                  placeholder={'-y\n@upstash/context7-mcp'}
                />
              </label>
              <KvEditor
                label="Environment Variables"
                entries={draft.envEntries}
                onChange={envEntries => setDraft(prev => ({ ...prev, envEntries }))}
              />
            </>
          )}
        </div>

        <div className="rule-editor-preview">
          {projections.length === 0 ? (
            <div className="projection-empty">
              {initialServer ? t('mcpEditor.noProjections') : t('mcpEditor.saveToSeeProjections')}
            </div>
          ) : (
            <div className="projection-preview">
              <h3>Platform Projections</h3>
              {projections.map(proj => (
                <div key={proj.platformId} className="projection-card">
                  <div className="projection-platform">{platformLabel(proj.platformId)}</div>
                  <pre className="projection-content">
                    {JSON.stringify({ [proj.key]: proj.config }, null, 2)}
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
