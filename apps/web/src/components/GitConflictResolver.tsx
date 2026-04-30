import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitConflict, GitConflictResolution, ConflictResolution } from '@prism/shared'

interface GitConflictResolverProps {
  conflicts: GitConflict[]
  onResolveAll: (resolutions: GitConflictResolution[]) => void
  onCancel: () => void
}

const ASSET_TYPE_KEYS: Record<string, string> = {
  rule: 'gitConflictResolver.assetTypes.rule',
  skill: 'gitConflictResolver.assetTypes.skill',
  agent: 'gitConflictResolver.assetTypes.agent',
  mcp: 'gitConflictResolver.assetTypes.mcp',
  hook: 'gitConflictResolver.assetTypes.hook',
}

const RESOLUTION_KEYS: Record<ConflictResolution, string> = {
  'keep-local': 'gitConflictResolver.resolutions.keepLocal',
  'keep-remote': 'gitConflictResolver.resolutions.keepRemote',
  'merge': 'gitConflictResolver.resolutions.merge',
}

export function GitConflictResolver({ conflicts, onResolveAll, onCancel }: GitConflictResolverProps) {
  const { t } = useTranslation('components')
  const tCommon = useTranslation('common').t

  // Map of key → chosen resolution
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({})
  // Map of key → merge textarea content
  const [mergeContents, setMergeContents] = useState<Record<string, string>>({})

  function setResolution(key: string, resolution: ConflictResolution) {
    setResolutions((prev) => ({ ...prev, [key]: resolution }))
    // Pre-fill merge textarea with local content if switching to merge
    if (resolution === 'merge' && !mergeContents[key]) {
      const conflict = conflicts.find((c) => c.key === key)
      const localText = conflict?.local ? JSON.stringify(conflict.local, null, 2) : ''
      setMergeContents((prev) => ({ ...prev, [key]: localText }))
    }
  }

  const allResolved = conflicts.length > 0 && conflicts.every((c) => resolutions[c.key] !== undefined)

  function handleApply() {
    const result: GitConflictResolution[] = conflicts.map((c) => ({
      key: c.key,
      resolution: resolutions[c.key],
      mergedContent: resolutions[c.key] === 'merge' ? mergeContents[c.key] : undefined,
    }))
    onResolveAll(result)
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {t('gitConflictResolver.conflictsTitle', { count: conflicts.length })}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          {tCommon('btn.cancel')}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {conflicts.map((conflict) => {
          const chosen = resolutions[conflict.key]
          const assetTypeKey = ASSET_TYPE_KEYS[conflict.type]
          return (
            <div
              key={conflict.key}
              className="item-card"
              style={{ padding: '12px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span
                  className="badge badge-accent"
                  style={{ fontSize: 11 }}
                >
                  {assetTypeKey ? t(assetTypeKey) : conflict.type}
                </span>
                <span style={{ fontWeight: 500, fontSize: 13 }}>
                  {conflict.name}
                </span>
                {chosen && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      background: 'var(--bg-hover)',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    → {t(RESOLUTION_KEYS[chosen])}
                  </span>
                )}
              </div>

              {/* Resolution buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['keep-local', 'keep-remote', 'merge'] as ConflictResolution[]).map((res) => (
                  <button
                    key={res}
                    className={`btn btn-sm ${chosen === res ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setResolution(conflict.key, res)}
                  >
                    {t(RESOLUTION_KEYS[res])}
                  </button>
                ))}
              </div>

              {/* Merge textarea */}
              {chosen === 'merge' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {t('gitConflictResolver.editMergedContent')}
                  </div>
                  <textarea
                    value={mergeContents[conflict.key] ?? ''}
                    onChange={(e) =>
                      setMergeContents((prev) => ({ ...prev, [conflict.key]: e.target.value }))
                    }
                    rows={6}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 12,
                      padding: '8px',
                      background: 'var(--bg-code, var(--bg-surface))',
                      border: '1px solid var(--border-default)',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleApply}
          disabled={!allResolved}
          title={!allResolved ? t('gitConflictResolver.resolveAllFirst') : undefined}
        >
          {t('gitConflictResolver.applyBtn', { resolved: Object.keys(resolutions).length, total: conflicts.length })}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          {tCommon('btn.cancel')}
        </button>
      </div>
    </div>
  )
}
