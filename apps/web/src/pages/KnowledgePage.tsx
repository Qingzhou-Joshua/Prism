import { useState, useEffect, useCallback } from 'react'
import type { KnowledgeEntry, DeveloperProfile, GeneratedAsset } from '@prism/shared'
import { knowledgeApi } from '../api/knowledge'

interface KnowledgePageProps {
  onEditProfile: () => void
  onViewEntry: (entry: KnowledgeEntry) => void
}

export function KnowledgePage({ onEditProfile, onViewEntry }: KnowledgePageProps) {
  const [profile, setProfile] = useState<DeveloperProfile | null>(null)
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filters
  const [domainFilter, setDomainFilter] = useState('')
  const [projectPathFilter, setProjectPathFilter] = useState('')

  // Auto-capture hook state
  const [hookEnabled, setHookEnabled] = useState(false)
  const [hookLoading, setHookLoading] = useState(false)

  // Generated assets state
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([])
  const [generatingProfileRule, setGeneratingProfileRule] = useState(false)
  const [generatingProjectRule, setGeneratingProjectRule] = useState(false)
  const [deletingGeneratedId, setDeletingGeneratedId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  // Project rule inline form state
  const [showProjectRuleForm, setShowProjectRuleForm] = useState(false)
  const [projectRuleDomain, setProjectRuleDomain] = useState('')
  const [projectRulePath, setProjectRulePath] = useState('')

  // Per-card publish select state: { [assetId]: { platformId, assetType } }
  const [publishSelects, setPublishSelects] = useState<Record<string, { platformId: string; assetType: 'rule' | 'skill' }>>(() => ({}))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [profileData, entriesData, hookStatus, generatedData] = await Promise.all([
        knowledgeApi.getProfile(),
        knowledgeApi.listEntries({
          domain: domainFilter || undefined,
          projectPath: projectPathFilter || undefined,
        }),
        knowledgeApi.getHookStatus(['claude-code', 'codebuddy']),
        knowledgeApi.listGenerated(),
      ])
      setProfile(profileData)
      setEntries(entriesData)
      setHookEnabled(hookStatus.enabled)
      setGeneratedAssets(generatedData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load knowledge data')
    } finally {
      setLoading(false)
    }
  }, [domainFilter, projectPathFilter])

  useEffect(() => { void load() }, [load])

  async function handleToggleHook() {
    setHookLoading(true)
    try {
      if (hookEnabled) {
        await knowledgeApi.teardownHook(['claude-code', 'codebuddy'])
        setHookEnabled(false)
      } else {
        await knowledgeApi.setupHook(['claude-code', 'codebuddy'])
        setHookEnabled(true)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to toggle auto-capture hook')
    } finally {
      setHookLoading(false)
    }
  }

  async function handleDelete(entry: KnowledgeEntry) {
    if (!window.confirm(`Delete this entry?\n\n"${entry.summary}"`)) return
    setDeletingId(entry.id)
    try {
      await knowledgeApi.deleteEntry(entry.id)
      setEntries(prev => prev.filter(e => e.id !== entry.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleGenerateProfileRule() {
    setGeneratingProfileRule(true)
    try {
      const asset = await knowledgeApi.generateProfileRule()
      setGeneratedAssets(prev =>
        prev.some(a => a.id === asset.id)
          ? prev.map(a => a.id === asset.id ? asset : a)
          : [asset, ...prev]
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate profile rule')
    } finally {
      setGeneratingProfileRule(false)
    }
  }

  async function handleGenerateProjectRule() {
    setGeneratingProjectRule(true)
    try {
      const asset = await knowledgeApi.generateProjectRule({
        domain: projectRuleDomain || undefined,
        projectPath: projectRulePath || undefined,
      })
      setGeneratedAssets(prev =>
        prev.some(a => a.id === asset.id)
          ? prev.map(a => a.id === asset.id ? asset : a)
          : [asset, ...prev]
      )
      setShowProjectRuleForm(false)
      setProjectRuleDomain('')
      setProjectRulePath('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to generate project rule')
    } finally {
      setGeneratingProjectRule(false)
    }
  }

  async function handlePublishGenerated(asset: GeneratedAsset) {
    const sel = publishSelects[asset.id] ?? { platformId: 'claude-code', assetType: 'rule' as const }
    setPublishingId(asset.id)
    try {
      const updated = await knowledgeApi.publishGenerated(asset.id, {
        platformId: sel.platformId,
        assetType: sel.assetType,
      })
      setGeneratedAssets(prev => prev.map(a => a.id === updated.id ? updated : a))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to publish asset')
    } finally {
      setPublishingId(null)
    }
  }

  async function handleDeleteGenerated(asset: GeneratedAsset) {
    if (!window.confirm(`Delete generated asset?\n\n"${asset.name}"`)) return
    setDeletingGeneratedId(asset.id)
    try {
      await knowledgeApi.deleteGenerated(asset.id)
      setGeneratedAssets(prev => prev.filter(a => a.id !== asset.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingGeneratedId(null)
    }
  }

  function getPublishSelect(assetId: string) {
    return publishSelects[assetId] ?? { platformId: 'claude-code', assetType: 'rule' as const }
  }

  function setPublishSelect(assetId: string, patch: Partial<{ platformId: string; assetType: 'rule' | 'skill' }>) {
    setPublishSelects(prev => ({
      ...prev,
      [assetId]: { ...getPublishSelect(assetId), ...patch },
    }))
  }

  if (loading) return <div className="loading-state">Loading knowledge…</div>
  if (error) return (
    <div className="error-state">
      <span>⚠ {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>Retry</button>
    </div>
  )

  return (
    <div>
      {/* ── Profile header bar ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Developer Profile</div>
          {profile && (
            <div className="page-subtitle">
              {[profile.name, profile.role].filter(Boolean).join(' · ')}
              {profile.skills.length > 0 && (
                <span style={{ marginLeft: 8 }}>
                  Skills: {profile.skills.slice(0, 5).join(', ')}
                  {profile.skills.length > 5 && ` +${profile.skills.length - 5} more`}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${hookEnabled ? 'btn-success-outline' : 'btn-ghost'}`}
            onClick={() => void handleToggleHook()}
            disabled={hookLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: hookEnabled ? 'var(--color-success, #22c55e)' : undefined,
              color: hookEnabled ? 'var(--color-success, #22c55e)' : undefined,
            }}
          >
            {hookLoading ? (
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            ) : hookEnabled ? '✓' : null}
            {hookEnabled ? 'Auto-Capture ON' : 'Configure Auto-Capture'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onEditProfile}>
            Edit Profile
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="editor-meta-strip" style={{ marginBottom: 16 }}>
        <select
          className="editor-meta-input"
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">All domains</option>
          {Array.from(new Set(entries.map(e => e.domain))).sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input
          type="text"
          className="editor-meta-input"
          placeholder="Filter by project path…"
          value={projectPathFilter}
          onChange={e => setProjectPathFilter(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center', marginLeft: 4 }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* ── Empty state ── */}
      {entries.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <div className="empty-state-title">No knowledge entries yet</div>
          <div className="empty-state-desc">
            Enable Auto-Capture to automatically record learnings from your coding sessions.
          </div>
        </div>
      )}

      {/* ── Entry cards ── */}
      {entries.length > 0 && (
        <div className="item-card-grid">
          {entries.map(entry => (
            <div key={entry.id} className="item-card">
              <div className="item-card-meta" style={{ marginBottom: 6 }}>
                <span className="badge badge-accent">{entry.domain}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(entry.sessionDate).toLocaleDateString()}
                </span>
              </div>
              <div className="item-card-name" style={{ fontSize: 14, marginBottom: 6 }}>
                {entry.summary}
              </div>
              {entry.tags.length > 0 && (
                <div className="item-card-meta" style={{ marginBottom: 4 }}>
                  {entry.tags.map(tag => (
                    <span key={tag} className="badge badge-muted">{tag}</span>
                  ))}
                </div>
              )}
              <div className="item-card-footer">
                <span className="item-card-date">
                  {entry.projectPath ? entry.projectPath : ''}
                </span>
                <div className="item-card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onViewEntry(entry)}
                  >
                    View ▸
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => void handleDelete(entry)}
                    disabled={deletingId === entry.id}
                  >
                    {deletingId === entry.id ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Generated Assets ── */}
      <div style={{ marginTop: 32 }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 16 }}>Generated Assets</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handleGenerateProfileRule()}
              disabled={generatingProfileRule}
            >
              {generatingProfileRule ? (
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: 4 }} />
              ) : null}
              🪄 Generate Profile Rule
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowProjectRuleForm(v => !v)}
            >
              📁 Generate Project Rule
            </button>
          </div>
        </div>

        {/* Project rule inline form */}
        {showProjectRuleForm && (
          <div className="editor-meta-strip" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <select
              className="editor-meta-input"
              value={projectRuleDomain}
              onChange={e => setProjectRuleDomain(e.target.value)}
              style={{ maxWidth: 180 }}
            >
              <option value="">All domains</option>
              {Array.from(new Set(entries.map(e => e.domain))).sort().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="text"
              className="editor-meta-input"
              placeholder="Project path (optional)…"
              value={projectRulePath}
              onChange={e => setProjectRulePath(e.target.value)}
              style={{ maxWidth: 260 }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handleGenerateProjectRule()}
              disabled={generatingProjectRule}
            >
              {generatingProjectRule ? (
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: 4 }} />
              ) : null}
              Generate
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setShowProjectRuleForm(false); setProjectRuleDomain(''); setProjectRulePath('') }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Empty state */}
        {generatedAssets.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">✨</div>
            <div className="empty-state-title">No generated assets yet</div>
            <div className="empty-state-desc">
              Use the buttons above to generate Rules or Skills from your knowledge.
            </div>
          </div>
        )}

        {/* Generated asset cards */}
        {generatedAssets.length > 0 && (
          <div className="item-card-grid">
            {generatedAssets.map(asset => {
              const sel = getPublishSelect(asset.id)
              return (
                <div key={asset.id} className="item-card">
                  <div className="item-card-meta" style={{ marginBottom: 6 }}>
                    <span className="badge badge-accent">{asset.type}</span>
                    <span className="badge badge-muted">{asset.sourceType}</span>
                    {asset.domain && (
                      <span className="badge badge-muted">{asset.domain}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(asset.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="item-card-name" style={{ fontSize: 14, marginBottom: 6 }}>
                    {asset.name}
                  </div>

                  {/* Published To */}
                  <div className="item-card-meta" style={{ marginBottom: 8 }}>
                    {asset.publishedTo.length > 0 ? (
                      asset.publishedTo.map(p => (
                        <span key={p.platformId} className="badge badge-accent" style={{ gap: 4 }}>
                          ✓ {p.platformId}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not published</span>
                    )}
                  </div>

                  <div className="item-card-footer">
                    {/* Publish controls */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        className="editor-meta-input"
                        value={sel.platformId}
                        onChange={e => setPublishSelect(asset.id, { platformId: e.target.value })}
                        style={{ maxWidth: 130, fontSize: 12, padding: '2px 4px' }}
                      >
                        <option value="claude-code">claude-code</option>
                        <option value="codebuddy">codebuddy</option>
                      </select>
                      <select
                        className="editor-meta-input"
                        value={sel.assetType}
                        onChange={e => setPublishSelect(asset.id, { assetType: e.target.value as 'rule' | 'skill' })}
                        style={{ maxWidth: 80, fontSize: 12, padding: '2px 4px' }}
                      >
                        <option value="rule">rule</option>
                        <option value="skill">skill</option>
                      </select>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void handlePublishGenerated(asset)}
                        disabled={publishingId === asset.id}
                      >
                        {publishingId === asset.id ? '…' : 'Publish'}
                      </button>
                    </div>

                    {/* Delete */}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void handleDeleteGenerated(asset)}
                      disabled={deletingGeneratedId === asset.id}
                    >
                      {deletingGeneratedId === asset.id ? '…' : '🗑'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
