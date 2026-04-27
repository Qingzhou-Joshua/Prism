import { useState, useEffect, useCallback } from 'react'
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

// ── Platform badge color map ───────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

interface ConflictsPageProps {
  onClose?: () => void
}

export function ConflictsPage({ onClose: _onClose }: ConflictsPageProps) {
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

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

  function toggleExpanded(key: string) {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (loading) return <div className="loading-state">Loading conflicts…</div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            Conflicts
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
          <div className="page-subtitle">
            Cross-platform asset conflicts detected
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
          ↻ Refresh
        </button>
      </div>

      {/* Empty state */}
      {conflicts.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">No conflicts detected</div>
          <div className="empty-state-desc">
            All assets are consistent across platforms.
          </div>
        </div>
      )}

      {/* Conflict list */}
      {conflicts.length > 0 && (
        <div className="item-card-grid">
          {conflicts.map(group => {
            const isExpanded = expandedKeys.has(group.key)
            const platforms = group.entries.map(e => e.platformId)
            return (
              <div key={group.key} className="item-card" style={{ cursor: 'pointer' }}>
                {/* Card header row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => toggleExpanded(group.key)}
                >
                  <span style={{ fontWeight: 600, flex: 1 }}>{group.name}</span>
                  <span
                    className="badge"
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
                  style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}
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
                    {group.entries.length} conflicting entries
                  </span>
                </div>

                {/* Expanded detail: file paths */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 12,
                      borderTop: '1px solid var(--border-default)',
                      paddingTop: 10,
                    }}
                  >
                    {group.entries.map((entry, idx) => (
                      <div
                        key={idx}
                        style={{
                          marginBottom: 10,
                          padding: '8px 10px',
                          background: 'var(--bg-hover)',
                          borderRadius: 6,
                          border: '1px solid var(--border-default)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span
                            style={{
                              padding: '1px 7px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 500,
                              background: PLATFORM_COLORS[entry.platformId] ?? '#555',
                              color: '#fff',
                            }}
                          >
                            {PLATFORM_LABELS[entry.platformId] ?? entry.platformId}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              fontFamily: 'monospace',
                            }}
                          >
                            checksum: {entry.checksum.slice(0, 8)}…
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                          }}
                        >
                          {entry.filePath}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: 'var(--text-muted)',
                          }}
                        >
                          Updated {new Date(entry.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
