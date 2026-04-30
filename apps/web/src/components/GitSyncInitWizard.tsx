import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitSyncConfig, GitInitResult } from '@prism/shared'
import { gitSyncApi } from '../api/git-sync.js'

interface GitSyncInitWizardProps {
  onComplete: (config: GitSyncConfig) => void
  onCancel: () => void
}

type Step = 1 | 2 | 3 | 4

const SPINNER_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 14,
  height: 14,
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
  verticalAlign: 'middle',
  marginRight: 8,
}

export function GitSyncInitWizard({ onComplete, onCancel }: GitSyncInitWizardProps) {
  const { t } = useTranslation('components')
  const tCommon = useTranslation('common').t

  const [step, setStep] = useState<Step>(1)

  // Step 1 fields
  const [remoteUrl, setRemoteUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [urlError, setUrlError] = useState('')

  // Step 2 state
  const [cloneResult, setCloneResult] = useState<GitInitResult | null>(null)
  const [cloneError, setCloneError] = useState('')
  const [completedConfig, setCompletedConfig] = useState<GitSyncConfig | null>(null)

  // Step 3 fields
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({
    'claude-code': true,
    'codebuddy': false,
  })
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  // Step 4 state
  const [publishedCount, setPublishedCount] = useState(0)

  // ── Step 1 → Step 2 ──────────────────────────────────────────────────────

  async function handleNext() {
    setUrlError('')
    if (!remoteUrl.trim()) {
      setUrlError('Remote URL is required')
      return
    }
    if (!remoteUrl.startsWith('https://')) {
      setUrlError('URL must start with https://')
      return
    }

    setStep(2)
    setCloneError('')

    try {
      const result = await gitSyncApi.cloneInit(remoteUrl.trim(), branch.trim() || 'main')
      if (!result.success) {
        setCloneError(result.message ?? 'Clone failed')
        return
      }
      setCloneResult(result)

      // Fetch the newly created config
      const { config } = await gitSyncApi.getConfig()
      if (config) setCompletedConfig(config)

      setStep(3)
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : 'Clone init failed')
    }
  }

  // ── Step 3 → Step 4 ──────────────────────────────────────────────────────

  async function handlePublish() {
    setPublishError('')
    const targets = Object.entries(selectedPlatforms)
      .filter(([, checked]) => checked)
      .map(([id]) => id)

    if (targets.length === 0) {
      setPublishError(tCommon('platform.selectAtLeastOne'))
      return
    }

    setPublishing(true)
    try {
      const result = await gitSyncApi.publishToIde(targets)
      if (!result.success) {
        setPublishError(result.error ?? 'Publish failed')
        return
      }
      setPublishedCount(result.publishedCount ?? 0)
      setStep(4)
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  function handleDone() {
    if (completedConfig) onComplete(completedConfig)
    else onCancel()
  }

  const STEP_LABELS: Record<Step, string> = {
    1: t('gitSyncInitWizard.configureRepo'),
    2: t('gitSyncInitWizard.cloning'),
    3: t('gitSyncInitWizard.publishToIde'),
    4: t('gitSyncInitWizard.done'),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      border: '1px solid var(--border-default)',
      borderRadius: 8,
      padding: '20px 24px',
      marginTop: 12,
      background: 'var(--bg-surface)',
    }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: step === s ? 'var(--accent)' : step > s ? 'var(--success, #22c55e)' : 'var(--bg-hover)',
              color: step >= s ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {step > s ? '✓' : s}
            </div>
            {s < 4 && (
              <div style={{ width: 24, height: 1, background: 'var(--border-default)' }} />
            )}
          </div>
        ))}
        <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          {STEP_LABELS[step]}
        </span>
      </div>

      {/* ── Step 1: Input URL ─────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('gitSyncInitWizard.remoteUrlLabel')} <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
            </label>
            <input
              type="text"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder={t('gitSyncInitWizard.remoteUrlPlaceholder')}
              className="editor-meta-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            {urlError && (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--danger, #ef4444)' }}>
                {urlError}
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              {t('gitSyncInitWizard.remoteUrlHint')}
              {' '}<code style={{ fontSize: 11 }}>https://user:TOKEN@github.com/...</code>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('gitSyncInitWizard.branchLabel')}
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={t('gitSyncInitWizard.branchPlaceholder')}
              className="editor-meta-input"
              style={{ width: 200 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => void handleNext()}>
              {tCommon('btn.next')} →
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>
              {tCommon('btn.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Cloning progress ──────────────────────────────── */}
      {step === 2 && (
        <div>
          {cloneError ? (
            <div>
              <div style={{ color: 'var(--danger, #ef4444)', marginBottom: 12 }}>
                {t('gitSyncInitWizard.cloneError', { error: cloneError })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                  {tCommon('btn.back')}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                  {tCommon('btn.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
              <span style={SPINNER_STYLE} />
              <span>{t('gitSyncInitWizard.initializing')}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Select publish targets ───────────────────────── */}
      {step === 3 && (
        <div>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('gitSyncInitWizard.cloneComplete')}
            {cloneResult?.registryRebuilt && t('gitSyncInitWizard.registryRebuilt')}
            {' '}{t('gitSyncInitWizard.selectIdes')}
          </div>

          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(selectedPlatforms).map(([id, checked]) => (
              <label
                key={id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setSelectedPlatforms((prev) => ({ ...prev, [id]: e.target.checked }))
                  }
                />
                {id === 'claude-code' ? t('gitSyncInitWizard.claudeCode') : t('gitSyncInitWizard.codebuddy')}
              </label>
            ))}
          </div>

          {publishError && (
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--danger, #ef4444)' }}>
              {publishError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handlePublish()}
              disabled={publishing}
            >
              {publishing ? <><span style={SPINNER_STYLE} />{t('gitSyncInitWizard.publishing')}</> : t('gitSyncInitWizard.publishBtn')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleDone}
              disabled={publishing}
            >
              {tCommon('btn.skip')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ─────────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('gitSyncInitWizard.allDone', { count: publishedCount })}
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleDone}>
            {t('gitSyncInitWizard.done')} ✓
          </button>
        </div>
      )}
    </div>
  )
}
