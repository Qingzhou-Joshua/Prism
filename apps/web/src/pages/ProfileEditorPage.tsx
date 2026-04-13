import { useState, useEffect } from 'react'
import type { Profile, UnifiedRule, PlatformId, PublishPreview } from '@prism/shared'
import { profilesApi } from '../api/profiles'
import { rulesApi } from '../api/rules'

const ALL_PLATFORMS: PlatformId[] = ['claude-code', 'openclaw', 'codebuddy', 'cursor']
const PLATFORM_LABELS: Record<PlatformId, string> = {
  'claude-code': 'Claude Code',
  'openclaw': 'OpenClaw',
  'codebuddy': 'CodeBuddy',
  'cursor': 'Cursor',
}

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
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PublishPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    rulesApi
      .list()
      .then(setAvailableRules)
      .catch(() => {
        // rules load failure is non-fatal; editor still usable
      })
      .finally(() => setRulesLoading(false))
  }, [])

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

  const previewByPlatform = preview
    ? ALL_PLATFORMS.filter((p) => preview.targetPlatforms.includes(p)).map((p) => ({
        platformId: p,
        platformDisplayName: PLATFORM_LABELS[p],
        files: preview.files.filter((f) => f.platformId === p),
      }))
    : []

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
          ←
        </button>
        <h2 style={{ margin: 0 }}>{profile ? 'Edit Profile' : 'New Profile'}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left column: metadata + platforms + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Profile"
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Target Platforms</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ALL_PLATFORMS.map((platformId) => (
                <label key={platformId} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.has(platformId)}
                    onChange={() => togglePlatform(platformId)}
                  />
                  {PLATFORM_LABELS[platformId]}
                </label>
              ))}
            </div>
          </div>

          {saveError && (
            <div style={{ color: '#dc2626', fontSize: '14px' }}>{saveError}</div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right column: rules checklist */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Rules</label>
          {rulesLoading ? (
            <div style={{ color: '#6b7280' }}>Loading rules…</div>
          ) : availableRules.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No rules available</div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', maxHeight: '320px', overflowY: 'auto' }}>
              {availableRules.map((rule) => (
                <label
                  key={rule.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRuleIds.has(rule.id)}
                    onChange={() => toggleRule(rule.id)}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{rule.name}</div>
                    {rule.tags.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{rule.tags.join(', ')}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Publish Preview</h3>
            <button
              onClick={() => void handlePreview()}
              disabled={previewLoading}
              style={{ padding: '6px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: previewLoading ? 'not-allowed' : 'pointer', opacity: previewLoading ? 0.7 : 1 }}
            >
              {previewLoading ? 'Loading…' : 'Preview Publish'}
            </button>
          </div>

          {previewError && (
            <div style={{ color: '#dc2626', fontSize: '14px', marginBottom: '8px' }}>{previewError}</div>
          )}

          {preview && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}>
              {previewByPlatform.length === 0 ? (
                <div style={{ padding: '16px', color: '#6b7280' }}>No files to publish</div>
              ) : (
                previewByPlatform.map(({ platformId, platformDisplayName, files }) => (
                  <div key={platformId}>
                    <div style={{ padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '14px' }}>
                      {platformDisplayName} ({files.length} file{files.length !== 1 ? 's' : ''})
                    </div>
                    {files.map((file) => {
                      const key = `${platformId}:${file.filePath}`
                      const expanded = expandedFiles.has(key)
                      return (
                        <div key={file.filePath} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <div
                            onClick={() => toggleFileExpand(key)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer' }}
                          >
                            <span style={{ fontSize: '12px' }}>{expanded ? '▼' : '▶'}</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '13px', flex: 1 }}>{file.filePath}</span>
                            {file.fileExists && (
                              <span style={{ fontSize: '11px', padding: '2px 6px', background: '#fef3c7', color: '#92400e', borderRadius: '4px' }}>
                                will overwrite
                              </span>
                            )}
                            {!file.fileExists && (
                              <span style={{ fontSize: '11px', padding: '2px 6px', background: '#d1fae5', color: '#065f46', borderRadius: '4px' }}>
                                new file
                              </span>
                            )}
                          </div>
                          {expanded && (
                            <pre style={{ margin: 0, padding: '8px 12px 8px 32px', background: '#f9fafb', fontSize: '12px', overflowX: 'auto', borderTop: '1px solid #f3f4f6' }}>
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
