import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { McpServer } from '@prism/shared'
import { mcpApi } from '../api/mcp.js'
import { PlatformIcon } from '../components/PlatformIcon'
import { PLATFORM_LABELS } from '../constants/platforms.js'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface McpPageProps {
  onEdit: (server: McpServer) => void
  onNew: () => void
}

export function McpPage({ onEdit, onNew }: McpPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await mcpApi.list()
      setServers(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcp.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete(server: McpServer) {
    if (!confirm(`Delete MCP server "${server.name}"?`)) return
    setDeletingId(server.id)
    try {
      await mcpApi.delete(server.id)
      setServers(prev => prev.filter(s => s.id !== server.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : t('mcp.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleImport() {
    try {
      setImporting(true)
      setError(null)
      const scanned = await mcpApi.scanPlatform('claude-code')
      if (scanned.length === 0) {
        alert(t('mcp.noServersInClaude'))
        return
      }
      await mcpApi.importFromPlatform('claude-code')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mcp.importFailed'))
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <div className="loading-state">{t('mcp.title')}…</div>
  if (error) return (
    <div className="error-state">
      <span>⚠ {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>{tCommon('btn.retry')}</button>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <FadeIn>
      <div className="page-header">
        <div>
          <div className="page-title">{t('mcp.title')}</div>
          <div className="page-subtitle">{t('mcp.count', { count: servers.length })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void handleImport()}
            disabled={importing}
          >
            {importing ? t('mcp.importing') : t('mcp.importBtn')}
          </button>
          <button className="btn btn-primary" onClick={onNew}>{t('mcp.newBtn')}</button>
        </div>
      </div>
      </FadeIn>

      {/* Empty state */}
      {servers.length === 0 && (
        <FadeIn delay={0.1}>
        <div className="empty-state">
          <div className="empty-state-icon">🔌</div>
          <div className="empty-state-title">{t('mcp.empty')}</div>
          <div className="empty-state-desc">
            {t('mcp.emptyHint')}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void handleImport()}
              disabled={importing}
            >
              {importing ? t('mcp.importing') : t('mcp.importBtn')}
            </button>
            <button className="btn btn-primary" onClick={onNew}>{t('mcp.newBtn')}</button>
          </div>
        </div>
        </FadeIn>
      )}

      {/* Card grid */}
      {servers.length > 0 && (
        <div className="item-card-grid">
          {servers.map((server, i) => (
            <MotionCard
              key={server.id}
              index={i}
              style={{ cursor: 'pointer' }}
              onClick={() => onEdit(server)}
            >
              {/* Name */}
              <div className="item-card-name">{server.name}</div>

              {/* Command line preview */}
              <div className="mcp-card-cmd">
                <span className="mcp-cmd-bin">{server.command}</span>
                {server.args.length > 0 && (
                  <span className="mcp-cmd-args">{server.args.join(' ')}</span>
                )}
              </div>

              {/* Description */}
              {server.description && (
                <div className="item-card-filepath">{server.description}</div>
              )}

              {/* Env badge */}
              {server.env && Object.keys(server.env).length > 0 && (
                <div className="item-card-meta">
                  <span className="badge badge-muted">
                    {t('mcp.envVars', { count: Object.keys(server.env).length })}
                  </span>
                </div>
              )}

              {/* Footer */}
              <div className="item-card-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {server.targetPlatforms.length > 0
                    ? server.targetPlatforms.map(pid => (
                        <span
                          key={pid}
                          title={PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-secondary)' }}
                        >
                          <PlatformIcon platformId={pid} size={13} />
                          {PLATFORM_LABELS[pid as keyof typeof PLATFORM_LABELS] ?? pid}
                        </span>
                      ))
                    : <span className="item-card-date">—</span>
                  }
                </div>
                <div className="item-card-actions">
                  <span className="item-card-date">{new Date(server.updatedAt).toLocaleDateString()}</span>
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
    </div>
  )
}
