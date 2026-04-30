import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { SyncStatus, GitConflict, GitConflictResolution, GitSyncConfig } from '@prism/shared'
import { gitSyncApi } from '../api/git-sync.js'
import { GitSyncPanel } from '../components/GitSyncPanel.js'
import { GitConflictResolver } from '../components/GitConflictResolver.js'

export function GitSyncPage() {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [config, setConfig] = useState<GitSyncConfig | null>(null)
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>()
  const [message, setMessage] = useState<string | undefined>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Conflict state
  const [conflicts, setConflicts] = useState<GitConflict[]>([])
  const [showConflictResolver, setShowConflictResolver] = useState(false)

  // Operation state
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const [opSuccess, setOpSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [configResult, statusResult] = await Promise.all([
        gitSyncApi.getConfig(),
        gitSyncApi.getStatus(),
      ])
      setConfig(configResult.config)
      setStatus(statusResult.status)
      setLastSyncAt(statusResult.lastSyncAt)
      setMessage(statusResult.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('gitSync.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  function clearOpMessages() {
    setOpError(null)
    setOpSuccess(null)
  }

  // ── Pull flow ──────────────────────────────────────────────────────────────

  async function handlePull() {
    clearOpMessages()
    setPulling(true)
    setStatus('pulling')
    try {
      const check = await gitSyncApi.prePullCheck()

      if (check.conflictsDetected.length > 0) {
        // Show conflict resolver
        setConflicts(check.conflictsDetected)
        setShowConflictResolver(true)
        setStatus('conflict-detected')
        setPulling(false)
        return
      }

      // No conflicts — pull directly
      const result = await gitSyncApi.pull([])
      if (result.success) {
        setStatus('synced')
        setLastSyncAt(new Date().toISOString())
        setOpSuccess(result.message ?? t('gitSync.pullSuccess'))
      } else {
        setStatus('error')
        setOpError(result.message ?? t('gitSync.pullFailed'))
      }
    } catch (e) {
      setStatus('error')
      setOpError(e instanceof Error ? e.message : t('gitSync.pullFailed'))
    } finally {
      setPulling(false)
    }
  }

  // ── Push flow ──────────────────────────────────────────────────────────────

  async function handlePush(commitMessage: string) {
    clearOpMessages()
    setPushing(true)
    setStatus('pushing')
    try {
      const result = await gitSyncApi.push(commitMessage)
      if (result.success) {
        setStatus('synced')
        setLastSyncAt(new Date().toISOString())
        setOpSuccess(result.message ?? t('gitSync.pushSuccess'))
      } else {
        setStatus('error')
        setOpError(result.message ?? t('gitSync.pushFailed'))
      }
    } catch (e) {
      setStatus('error')
      setOpError(e instanceof Error ? e.message : t('gitSync.pushFailed'))
    } finally {
      setPushing(false)
    }
  }

  // ── Conflict resolution ────────────────────────────────────────────────────

  async function handleResolveAll(resolutions: GitConflictResolution[]) {
    setShowConflictResolver(false)
    setPulling(true)
    setStatus('pulling')
    clearOpMessages()
    try {
      const result = await gitSyncApi.pull(resolutions)
      if (result.success) {
        setStatus('synced')
        setLastSyncAt(new Date().toISOString())
        setOpSuccess(result.message ?? t('gitSync.pullWithResolutionsSuccess'))
        setConflicts([])
      } else {
        setStatus('error')
        setOpError(result.message ?? t('gitSync.pullWithResolutionsFailed'))
      }
    } catch (e) {
      setStatus('error')
      setOpError(e instanceof Error ? e.message : t('gitSync.pullFailed'))
    } finally {
      setPulling(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('gitSync.title')}</div>
          <div className="page-subtitle">
            {t('gitSync.subtitle')}
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? '…' : tCommon('btn.refresh')}
        </button>
      </div>

      {loading && <div className="loading-state">{tCommon('status.loading')}</div>}

      {error && (
        <div className="error-state" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!loading && !config && (
        <div className="empty-state">
          <div className="empty-state-icon">🔄</div>
          <div className="empty-state-title">{t('gitSync.notConfigured')}</div>
          <div className="empty-state-desc">
            {t('gitSync.notConfiguredHint')}
          </div>
        </div>
      )}

      {!loading && config && (
        <>
          {/* Operation messages */}
          {opSuccess && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 6,
                fontSize: 13,
                color: '#22c55e',
              }}
            >
              ✓ {opSuccess}
              <button
                onClick={clearOpMessages}
                style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14 }}
              >
                ×
              </button>
            </div>
          )}
          {opError && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 6,
                fontSize: 13,
                color: '#ef4444',
              }}
            >
              ✗ {opError}
              <button
                onClick={clearOpMessages}
                style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14 }}
              >
                ×
              </button>
            </div>
          )}
          {message && !opError && !opSuccess && (
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              {message}
            </div>
          )}

          {/* Main panel */}
          <GitSyncPanel
            status={status}
            lastSyncAt={lastSyncAt}
            branch={config.branch}
            onPull={() => void handlePull()}
            onPush={(msg) => void handlePush(msg)}
            pushing={pushing}
            pulling={pulling}
          />

          {/* Conflict resolver */}
          {showConflictResolver && conflicts.length > 0 && (
            <GitConflictResolver
              conflicts={conflicts}
              onResolveAll={(res) => void handleResolveAll(res)}
              onCancel={() => {
                setShowConflictResolver(false)
                setStatus('idle')
              }}
            />
          )}

          {/* Config info */}
          <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
            Remote: <code style={{ fontSize: 11 }}>{config.remoteUrl.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2')}</code>
          </div>
        </>
      )}
    </div>
  )
}
