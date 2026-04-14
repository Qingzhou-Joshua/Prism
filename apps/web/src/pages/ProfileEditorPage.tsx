import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Profile, UnifiedRule, PlatformId, PublishPreview } from '@prism/shared'
import { profilesApi } from '../api/profiles'
import { rulesApi } from '../api/rules'
import { ALL_PLATFORMS, PLATFORM_LABELS } from '../constants/platforms'
import { PlatformIcon } from '../components/PlatformIcon'

interface ProfileEditorPageProps {
  profile: Profile | undefined
  onSave: () => void
  onCancel: () => void
}

export function ProfileEditorPage({ profile, onSave, onCancel }: ProfileEditorPageProps) {
  const [name, setName] = useState(profile?.name ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set(profile?.ruleIds ?? []),
  )
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformId>>(
    new Set(profile?.targetPlatforms ?? []),
  )
  const [availableRules, setAvailableRules] = useState<UnifiedRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PublishPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<
    | { ok: true; revisionId: string; fileCount: number }
    | { ok: false; error: string }
    | null
  >(null)

  const loadRules = useCallback(async () => {
    try {
      const items = await rulesApi.list()
      setAvailableRules(items)
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : 'Failed to load rules')
    } finally {
      setRulesLoading(false)
    }
  }, [])

  useEffect(() => { void loadRules() }, [loadRules])

  const toggleRule = (id: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const togglePlatform = (id: PlatformId) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleFileExpand = (key: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('Name is required')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const dto = {
        name: name.trim(),
        description: description.trim(),
        ruleIds: Array.from(selectedRuleIds),
        skillIds: [],
        agentIds: [],
        targetPlatforms: Array.from(selectedPlatforms),
      }
      if (profile) {
        await profilesApi.update(profile.id, dto)
      } else {
        await profilesApi.create(dto)
      }
      onSave()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    if (!profile) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const result = await profilesApi.preview(profile.id)
      setPreview(result)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmPublish = async () => {
    if (!profile) return
    setConfirming(false)
    setPublishing(true)
    setPublishResult(null)
    try {
      const { revision } = await profilesApi.publish(profile.id)
      setPublishResult({
        ok: true,
        revisionId: revision.id,
        fileCount: revision.files.length,
      })
    } catch (err) {
      setPublishResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setPublishing(false)
    }
  }

  const previewByPlatform = useMemo(
    () =>
      preview
        ? ALL_PLATFORMS.filter((p) => preview.targetPlatforms.includes(p)).map((p) => ({
            platformId: p,
            platformDisplayName: PLATFORM_LABELS[p],
            files: preview.files.filter((f) => f.platformId === p),
          }))
        : [],
    [preview],
  )

  return (
    <div className="editor-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={onCancel}>←</button>
          <h1 className="page-title">{profile ? 'Edit Profile' : 'New Profile'}</h1>
        </div>
      </div>

      <div className="profile-grid">
        {/* Left column: metadata + platforms + actions */}
        <div className="profile-form-col">
          <label className="form-label">
            Name *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Profile"
              className="form-input"
            />
          </label>

          <label className="form-label">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="form-input"
              style={{ resize: 'vertical' }}
            />
          </label>

          <div className="editor-section">
            <div className="section-title">Target Platforms</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {ALL_PLATFORMS.map((platformId) => (
                <label key={platformId} className="platform-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.has(platformId)}
                    onChange={() => togglePlatform(platformId)}
                  />
                  <span className="platform-checkbox-label">
                    <PlatformIcon platformId={platformId} size={16} />
                    {PLATFORM_LABELS[platformId]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="error-state">{saveError}</div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>

        {/* Right column: rules checklist */}
        <div>
          <div className="section-title" style={{ marginBottom: '10px' }}>Rules</div>
          {rulesLoading ? (
            <div className="empty-state">Loading rules…</div>
          ) : rulesError ? (
            <div className="error-state">{rulesError}</div>
          ) : availableRules.length === 0 ? (
            <div className="empty-state">No rules available</div>
          ) : (
            <div className="card" style={{ maxHeight: '320px', overflowY: 'auto', padding: 0 }}>
              {availableRules.map((rule) => (
                <label
                  key={rule.id}
                  className="platform-checkbox-row"
                  style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRuleIds.has(rule.id)}
                    onChange={() => toggleRule(rule.id)}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13.5px' }}>{rule.name}</div>
                    {rule.tags.length > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{rule.tags.join(', ')}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview section — only shown when editing an existing profile */}
      {profile && (
        <div style={{ marginTop: '32px' }}>
          <div className="page-header" style={{ marginBottom: '12px' }}>
            <h2 className="page-title" style={{ fontSize: '16px' }}>Publish Preview</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-ghost"
                onClick={() => void handlePreview()}
                disabled={previewLoading}
              >
                {previewLoading ? 'Loading…' : 'Preview Publish'}
              </button>
              {preview !== null && (
                <button
                  className="btn btn-primary"
                  onClick={() => { setConfirming(true); setPublishResult(null) }}
                  disabled={publishing}
                >
                  发布
                </button>
              )}
            </div>
          </div>

          {previewError && (
            <div className="error-state" style={{ marginBottom: '8px' }}>{previewError}</div>
          )}

          {/* Confirming inline box */}
          {confirming && preview !== null && (() => {
            const totalFiles = preview.files.length
            const overwriteCount = preview.files.filter((f) => f.fileExists).length
            const newCount = totalFiles - overwriteCount
            const platformNames = preview.targetPlatforms.join(', ')
            let breakdownText: string
            if (overwriteCount > 0 && newCount > 0) {
              breakdownText = `（${overwriteCount} 个覆盖，${newCount} 个新建）`
            } else if (newCount === totalFiles) {
              breakdownText = '（全部新建）'
            } else {
              breakdownText = '（全部覆盖）'
            }
            return (
              <div className="confirm-inline">
                <div className="confirm-inline-title">
                  即将写入 {totalFiles} 个文件到 {platformNames}
                </div>
                <div className="confirm-inline-sub">
                  {breakdownText}<br />此操作会自动备份现有文件
                </div>
                <div className="confirm-inline-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleConfirmPublish()}
                  >
                    确认发布
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setConfirming(false)}
                  >
                    取消
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Publishing indicator */}
          {publishing && (
            <div style={{ marginBottom: '16px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
              发布中…
            </div>
          )}

          {/* Publish result */}
          {publishResult !== null && (
            <div className={`publish-result ${publishResult.ok ? 'publish-result-ok' : 'publish-result-error'}`}>
              {publishResult.ok
                ? `✅ 发布成功 — 已写入 ${publishResult.fileCount} 个文件 (revision: ${publishResult.revisionId})`
                : `❌ 发布失败: ${publishResult.error}`
              }
            </div>
          )}

          {/* File tree preview */}
          {preview && (
            <div className="file-tree">
              {previewByPlatform.length === 0 ? (
                <div className="empty-state">No files to publish</div>
              ) : (
                previewByPlatform.map(({ platformId, platformDisplayName, files }) => (
                  <div key={platformId}>
                    <div className="file-tree-platform-header">
                      {platformDisplayName} ({files.length} file{files.length !== 1 ? 's' : ''})
                    </div>
                    {files.map((file) => {
                      const key = `${platformId}:${file.filePath}`
                      const expanded = expandedFiles.has(key)
                      return (
                        <div key={file.filePath} className="file-tree-row">
                          <div
                            className="file-tree-row-header"
                            onClick={() => toggleFileExpand(key)}
                          >
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{expanded ? '▼' : '▶'}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '12.5px', flex: 1, color: 'var(--text-primary)' }}>{file.filePath}</span>
                            {file.fileExists ? (
                              <span className="badge badge-overwrite">will overwrite</span>
                            ) : (
                              <span className="badge badge-new">new file</span>
                            )}
                          </div>
                          {expanded && (
                            <pre className="file-tree-row-content">
                              {file.content}
                            </pre>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
