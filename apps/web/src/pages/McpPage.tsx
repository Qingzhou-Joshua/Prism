import { AssetSources } from '../components/AssetSources'
import { PixelIcon } from '../components/PixelIcon'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { McpServer } from '@prism/shared'
import { mcpApi } from '../api/mcp.js'
import { PlatformIcon } from '../components/PlatformIcon'
import { platformLabel } from '../constants/platforms.js'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface McpPageProps {
  platformId: string
  /** Other MCP-capable platforms that servers can be imported from. */
  importSources: { id: string; displayName: string }[]
  configPath?: string
  onEdit: (server: McpServer) => void
  onNew: () => void
}

export function McpPage({ platformId, importSources, configPath, onEdit, onNew }: McpPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importSource, setImportSource] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setServers(await mcpApi.list(platformId))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcp.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [platformId, t])

  useEffect(() => { void load() }, [load])

  async function handleDelete(server: McpServer) {
    if (!confirm(t('mcp.confirmDelete', { name: server.name }))) return
    setDeletingId(server.id)
    try {
      await mcpApi.delete(server.id, platformId)
      setServers(prev => prev.filter(s => s.id !== server.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : t('mcp.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleImport(sourceId: string) {
    if (!sourceId) return
    const sourceName = platformLabel(sourceId)
    try {
      setImporting(true)
      setError(null)
      const scanned = await mcpApi.scanPlatform(sourceId)
      if (scanned.length === 0) {
        alert(t('mcp.noServersInSource', { name: sourceName }))
        return
      }
      const result = await mcpApi.importFromPlatform(sourceId, platformId)
      setServers(result.items)
      alert(t('mcp.imported', { count: result.imported }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcp.importFailed'))
    } finally {
      setImporting(false)
      setImportSource('')
    }
  }

  const importControl = importSources.length > 0 && (
    <select
      className="form-input"
      style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
      value={importSource}
      disabled={importing}
      onChange={e => { setImportSource(e.target.value); void handleImport(e.target.value) }}
      aria-label={t('mcp.importBtn')}
    >
      <option value="">{importing ? t('mcp.importing') : t('mcp.importBtn')}</option>
      {importSources.map(p => (
        <option key={p.id} value={p.id}>{t('mcp.importFrom', { name: p.displayName })}</option>
      ))}
    </select>
  )

  if (loading) return <div className="loading-state">{t('mcp.title')}…</div>
  if (error) return (
    <div className="error-state">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PixelIcon name="warning" size={14} /> {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>{tCommon('btn.retry')}</button>
    </div>
  )

  return (
    <div>
      <FadeIn>
      <div className="page-header">
        <div>
          <div className="page-title">{t('mcp.title')}</div>
          <div className="page-subtitle">
            {t('mcp.count', { count: servers.length })}
            {configPath && <> · <code style={{ fontSize: 11 }}>{t('mcp.configFile', { path: configPath })}</code></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {importControl}
          <button className="btn btn-primary" onClick={onNew}>{t('mcp.newBtn')}</button>
        </div>
      </div>
      </FadeIn>

      <AssetSources
        platformId={platformId}
        type="mcp"
        typeLabel={t('mcp.title')}
        query=""
        ownCount={servers.length}
        ownMatchCount={servers.length}
        ownNames={servers.map(s => s.name)}
      >
        {servers.length === 0 && (
          <FadeIn delay={0.1}>
          <div className="empty-state">
            <div className="empty-state-icon"><PixelIcon name="plug" size={32} /></div>
            <div className="empty-state-title">{t('mcp.empty')}</div>
            <div className="empty-state-desc">{t('mcp.emptyHint')}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
              {importControl}
              <button className="btn btn-primary" onClick={onNew}>{t('mcp.newBtn')}</button>
            </div>
          </div>
          </FadeIn>
        )}

        {servers.length > 0 && (
          <div className="item-card-grid">
            {servers.map((server, i) => (
              <MotionCard
                key={server.id}
                index={i}
                style={{ cursor: 'pointer', opacity: server.enabled === false ? 0.6 : 1 }}
                onClick={() => onEdit(server)}
              >
                <div className="item-card-name">{server.name}</div>

                <div className="mcp-card-cmd">
                  {server.url ? (
                    <span className="mcp-cmd-bin">{server.url}</span>
                  ) : (
                    <>
                      <span className="mcp-cmd-bin">{server.command}</span>
                      {server.args.length > 0 && (
                        <span className="mcp-cmd-args">{server.args.join(' ')}</span>
                      )}
                    </>
                  )}
                </div>

                <div className="item-card-meta">
                  <span className="badge badge-muted">{server.type ?? 'stdio'}</span>
                  {server.enabled === false && <span className="badge badge-muted">{t('mcp.disabled')}</span>}
                  {server.env && Object.keys(server.env).length > 0 && (
                    <span className="badge badge-muted">
                      {t('mcp.envVars', { count: Object.keys(server.env).length })}
                    </span>
                  )}
                </div>

                <div className="item-card-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <PlatformIcon platformId={platformId} size={13} />
                    {platformLabel(platformId)}
                  </div>
                  <div className="item-card-actions">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={e => { e.stopPropagation(); void handleDelete(server) }}
                      disabled={deletingId === server.id}
                    >
                      {deletingId === server.id ? '…' : tCommon('btn.delete')}
                    </button>
                  </div>
                </div>
              </MotionCard>
            ))}
          </div>
        )}
      </AssetSources>
    </div>
  )
}
