import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface RegistryEntry {
  id: string
  type: 'rule' | 'skill' | 'agent' | 'mcp' | 'hook'
  name: string
  filePath: string
  platformId: 'claude-code' | 'codebuddy' | 'openclaw'
  scope: string
  tags: string[]
  targetPlatforms: string[]
  checksum: string
  createdAt: string
  updatedAt: string
  indexedAt: string
}

interface ConflictGroup {
  key: string
  type: 'rule' | 'skill' | 'agent' | 'mcp' | 'hook'
  name: string
  entries: RegistryEntry[]
}

interface ConflictContentEntry {
  entry: RegistryEntry
  content: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  'claude-code': '#7c5cbf',
  'codebuddy':   '#1a7abf',
  'openclaw':    '#bf6c1a',
}

const PLATFORM_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codebuddy':   'Codebuddy',
  'openclaw':    'OpenClaw',
}

// ── DiffViewer ────────────────────────────────────────────────────────────────

function DiffViewer({ entries }: { entries: ConflictContentEntry[] }) {
  const { t } = useTranslation('pages')
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
      {entries.map(({ entry, content }) => (
        <div key={entry.id} style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              background: PLATFORM_COLORS[entry.platformId] ?? '#555',
              color: '#fff',
              marginBottom: 6,
            }}
          >
            {PLATFORM_LABELS[entry.platformId] ?? entry.platformId}
          </div>
          <pre
            style={{
              margin: 0,
              padding: '8px 10px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-default)',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: 280,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}
          >
            {content || t('conflicts.empty_content')}
          </pre>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {entry.filePath}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MergeModal ────────────────────────────────────────────────────────────────

interface MergeModalProps {
  name: string
  initialContent: string
  loading: boolean
  onConfirm: (content: string) => void
  onClose: () => void
}

function MergeModal({ name, initialContent, loading, onConfirm, onClose }: MergeModalProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [content, setContent] = useState(initialContent)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-primary, #1e1e1e)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: 20,
          width: 640,
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>
          {t('conflicts.mergeAsGlobal')} — {name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('conflicts.mergeHint')}
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            flex: 1,
            minHeight: 320,
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.5,
            padding: '8px 10px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-default)',
            borderRadius: 6,
            color: 'inherit',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={onClose} disabled={loading}>
            {tCommon('btn.cancel')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onConfirm(content)}
            disabled={loading}
          >
            {loading ? t('conflicts.merging') : t('conflicts.confirmMerge')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface ConflictsPageProps {
  onClose?: () => void
}

export function ConflictsPage({ onClose: _onClose }: ConflictsPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  // Per-key content cache and loading state
  const [contentMap, setContentMap] = useState<Record<string, ConflictContentEntry[]>>({})
  const [contentLoadingKeys, setContentLoadingKeys] = useState<Set<string>>(new Set())

  // Resolve operation loading state (per key)
  const [resolvingKeys, setResolvingKeys] = useState<Set<string>>(new Set())

  // Merge modal
  const [mergeModal, setMergeModal] = useState<{
    key: string
    name: string
    entries: ConflictContentEntry[]
  } | null>(null)
  const [mergingKey, setMergingKey] = useState<string | null>(null)

  // ── Data loading ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/registry/conflicts`)
      if (res.ok) {
        const data = await res.json()
        setConflicts(data.conflicts ?? [])
      } else {
        setConflicts([])
      }
    } catch {
      setConflicts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const loadContent = useCallback(async (key: string) => {
    setContentLoadingKeys(prev => new Set([...prev, key]))
    try {
      const res = await fetch(
        `${API_BASE}/registry/conflicts/${encodeURIComponent(key)}/content`
      )
      if (res.ok) {
        const data = await res.json()
        setContentMap(prev => ({ ...prev, [key]: data.entries ?? [] }))
      }
    } catch {
      // Content won't be shown; user can still use resolve buttons
    } finally {
      setContentLoadingKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [])

  // ── Expand / collapse ─────────────────────────────────────────────────────────

  function toggleExpanded(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        // Load content on first expand
        if (!contentMap[key] && !contentLoadingKeys.has(key)) {
          void loadContent(key)
        }
      }
      return next
    })
  }

  // ── Resolve actions ───────────────────────────────────────────────────────────

  function markResolved(key: string) {
    // After success: refresh list, collapse & clear cached content for this key
    void load()
    setExpandedKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    setContentMap(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  async function handleKeepOne(key: string, winnerId: string) {
    setResolvingKeys(prev => new Set([...prev, key]))
    try {
      const res = await fetch(
        `${API_BASE}/registry/conflicts/${encodeURIComponent(key)}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'keep-one', winnerId }),
        }
      )
      if (res.ok) markResolved(key)
    } finally {
      setResolvingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  async function handleKeepBoth(key: string) {
    setResolvingKeys(prev => new Set([...prev, key]))
    try {
      const res = await fetch(
        `${API_BASE}/registry/conflicts/${encodeURIComponent(key)}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'keep-both' }),
        }
      )
      if (res.ok) markResolved(key)
    } finally {
      setResolvingKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  async function handleMerge(key: string, content: string) {
    setMergingKey(key)
    try {
      const res = await fetch(
        `${API_BASE}/registry/conflicts/${encodeURIComponent(key)}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'merge', content }),
        }
      )
      if (res.ok) {
        setMergeModal(null)
        markResolved(key)
      }
    } finally {
      setMergingKey(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) return <div className="loading-state">{tCommon('status.loading')}</div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            {t('conflicts.title')}
            {conflicts.length > 0 && (
              <span
                style={{
                  marginLeft: 10,
                  padding: '2px 8px',
                  background: '#bf3030',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  verticalAlign: 'middle',
                }}
              >
                {conflicts.length}
              </span>
            )}
          </div>
          <div className="page-subtitle">{t('conflicts.subtitle')}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
          {t('conflicts.refreshBtn')}
        </button>
      </div>

      {/* Empty state */}
      {conflicts.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">{t('conflicts.empty')}</div>
          <div className="empty-state-desc">
            {t('conflicts.emptyHint')}
          </div>
        </div>
      )}

      {/* Conflict list */}
      {conflicts.length > 0 && (
        <div className="item-card-grid">
          {conflicts.map(group => {
            const isExpanded = expandedKeys.has(group.key)
            const isContentLoading = contentLoadingKeys.has(group.key)
            const isResolving = resolvingKeys.has(group.key)
            const loadedEntries = contentMap[group.key]
            const platforms = group.entries.map(e => e.platformId)

            return (
              <div key={group.key} className="item-card">
                {/* Card header row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => toggleExpanded(group.key)}
                >
                  <span style={{ fontWeight: 600, flex: 1 }}>{group.name}</span>
                  <span
                    style={{
                      background: 'var(--bg-hover)',
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 4,
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {group.type}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>

                {/* Platform badges */}
                <div
                  style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', cursor: 'pointer' }}
                  onClick={() => toggleExpanded(group.key)}
                >
                  {platforms.map((pid, idx) => (
                    <span
                      key={`${pid}-${idx}`}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        background: PLATFORM_COLORS[pid] ?? '#555',
                        color: '#fff',
                      }}
                    >
                      {PLATFORM_LABELS[pid] ?? pid}
                    </span>
                  ))}
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      alignSelf: 'center',
                    }}
                  >
                    {t('conflicts.count', { count: group.entries.length })}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 12,
                      borderTop: '1px solid var(--border-default)',
                      paddingTop: 12,
                    }}
                  >
                    {/* Content loading indicator */}
                    {isContentLoading && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                        {t('conflicts.loadingContent')}
                      </div>
                    )}

                    {/* Side-by-side diff viewer */}
                    {!isContentLoading && loadedEntries && (
                      <DiffViewer entries={loadedEntries} />
                    )}

                    {/* Resolve buttons */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 14,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {/* Merge as global — only shown when content is loaded */}
                      {loadedEntries && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isResolving}
                          onClick={() =>
                            setMergeModal({
                              key: group.key,
                              name: group.name,
                              entries: loadedEntries,
                            })
                          }
                        >
                          {t('conflicts.mergeAsGlobal')}
                        </button>
                      )}

                      {/* Keep platform — one button per entry */}
                      {group.entries.map(entry => (
                        <button
                          key={entry.id}
                          className="btn btn-sm"
                          disabled={isResolving}
                          onClick={() => void handleKeepOne(group.key, entry.id)}
                        >
                          {t('conflicts.keepPlatform', { platform: PLATFORM_LABELS[entry.platformId] ?? entry.platformId })}
                        </button>
                      ))}

                      {/* Keep separate */}
                      <button
                        className="btn btn-sm"
                        disabled={isResolving}
                        onClick={() => void handleKeepBoth(group.key)}
                      >
                        {t('conflicts.keepSeparate')}
                      </button>

                      {/* Resolving indicator */}
                      {isResolving && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {t('conflicts.resolving')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Merge modal */}
      {mergeModal && (
        <MergeModal
          name={mergeModal.name}
          initialContent={mergeModal.entries
            .map(
              ({ entry, content }) =>
                `// === ${PLATFORM_LABELS[entry.platformId] ?? entry.platformId} ===\n${content}`
            )
            .join('\n\n')}
          loading={mergingKey === mergeModal.key}
          onConfirm={content => void handleMerge(mergeModal.key, content)}
          onClose={() => setMergeModal(null)}
        />
      )}
    </div>
  )
}
