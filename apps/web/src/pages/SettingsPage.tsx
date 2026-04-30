import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitSyncConfig } from '@prism/shared'
import { gitSyncApi } from '../api/git-sync.js'
import { GitSyncInitWizard } from '../components/GitSyncInitWizard.js'

interface SettingsPageProps {
  onNavigateToGitSync: () => void
}

function maskUrl(url: string): string {
  // https://user:TOKEN@github.com/... → https://user:***@github.com/...
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2')
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function SettingsPage({ onNavigateToGitSync }: SettingsPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [config, setConfig] = useState<GitSyncConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline form state
  const [showForm, setShowForm] = useState(false)
  const [formUrl, setFormUrl] = useState('')
  const [formBranch, setFormBranch] = useState('main')
  const [formUrlError, setFormUrlError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { config: cfg } = await gitSyncApi.getConfig()
      setConfig(cfg)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  function handleEditClick() {
    if (config) {
      setFormUrl(config.remoteUrl)
      setFormBranch(config.branch)
    }
    setFormUrlError('')
    setSaveError('')
    setShowForm(true)
    setShowWizard(false)
  }

  function handleConfigureClick() {
    setShowWizard(true)
    setShowForm(false)
  }

  async function handleSave() {
    setFormUrlError('')
    setSaveError('')
    if (!formUrl.trim()) {
      setFormUrlError('Remote URL is required')
      return
    }
    if (!formUrl.startsWith('https://')) {
      setFormUrlError('URL must start with https://')
      return
    }
    setSaving(true)
    try {
      const result = await gitSyncApi.initSync(formUrl.trim(), formBranch.trim() || 'main')
      if (!result.success) {
        setSaveError(result.message ?? t('settings.saveFailed'))
        return
      }
      const { config: newConfig } = await gitSyncApi.getConfig()
      setConfig(newConfig)
      setShowForm(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm(t('settings.disconnectConfirm'))) {
      return
    }
    try {
      await gitSyncApi.deleteConfig()
      setConfig(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : t('settings.disconnectFailed'))
    }
  }

  function handleWizardComplete(cfg: GitSyncConfig) {
    setConfig(cfg)
    setShowWizard(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{t('settings.title')}</div>
      </div>

      {loading && (
        <div className="loading-state">{tCommon('status.loading')}</div>
      )}

      {error && (
        <div className="error-state">{error}</div>
      )}

      {!loading && (
        <div style={{ maxWidth: 640 }}>
          {/* Git Sync section */}
          <div className="item-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🔄</span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{t('settings.gitSync')}</span>
              {/* Status badge */}
              {config ? (
                <span className="badge badge-accent" style={{ marginLeft: 4 }}>{tCommon('status.configured')}</span>
              ) : (
                <span className="badge badge-muted" style={{ marginLeft: 4 }}>{tCommon('status.notConfigured')}</span>
              )}
            </div>

            {/* Configured state */}
            {config && !showForm && !showWizard && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t('settings.remoteUrl')}</span>
                    <code style={{ fontSize: 12 }}>{maskUrl(config.remoteUrl)}</code>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t('settings.branch')}</span>
                    <code style={{ fontSize: 12 }}>{config.branch}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>{t('settings.lastSync')}</span>
                    {formatDate(config.lastSyncAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-primary btn-sm" onClick={onNavigateToGitSync}>
                    {t('settings.openGitSync')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleEditClick}>
                    {tCommon('btn.edit')}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => void handleDisconnect()}>
                    {t('settings.disconnect')}
                  </button>
                </div>
              </div>
            )}

            {/* Not configured, no form/wizard open */}
            {!config && !showForm && !showWizard && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  {t('settings.gitSyncDescription')}
                </p>
                <button className="btn btn-primary btn-sm" onClick={handleConfigureClick}>
                  {t('settings.configureGitSync')}
                </button>
              </div>
            )}

            {/* Wizard (multi-step clone init) */}
            {showWizard && (
              <GitSyncInitWizard
                onComplete={handleWizardComplete}
                onCancel={() => setShowWizard(false)}
              />
            )}

            {/* Inline edit form */}
            {showForm && (
              <div style={{ marginTop: 4 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('settings.remoteUrlLabel')} <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className="editor-meta-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {formUrlError && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--danger, #ef4444)' }}>
                      {formUrlError}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('settings.branchLabel')}
                  </label>
                  <input
                    type="text"
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    placeholder="main"
                    className="editor-meta-input"
                    style={{ width: 200 }}
                  />
                </div>

                {saveError && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--danger, #ef4444)' }}>
                    {saveError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? tCommon('status.saving') : tCommon('btn.save')}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                  >
                    {tCommon('btn.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
