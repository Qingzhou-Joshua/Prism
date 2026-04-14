import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { UnifiedRule, Profile, ImportableRule, UnifiedSkill, UnifiedAgent, McpServer } from '@prism/shared'
import { fetchPlatformRules } from './api/platformRules.js'
import { rulesApi } from './api/rules.js'
import { detectConflicts, type ConflictResult, type RuleStatus } from './utils/conflictDetection.js'
import { RulesPage } from './pages/RulesPage'
import { RuleEditorPage } from './pages/RuleEditorPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { ProfileEditorPage } from './pages/ProfileEditorPage'
import { RevisionsPage } from './pages/RevisionsPage.js'
import { SkillsPage } from './pages/SkillsPage'
import { SkillEditorPage } from './pages/SkillEditorPage'
import { AgentsPage } from './pages/AgentsPage'
import { AgentEditorPage } from './pages/AgentEditorPage'
import { McpPage } from './pages/McpPage.js'
import { McpEditorPage } from './pages/McpEditorPage.js'

// ── Navigation state ────────────────────────────────────────────────────────
type Page =
  | { view: 'scanner' }
  | { view: 'rules-list' }
  | { view: 'rules-edit'; rule: UnifiedRule }
  | { view: 'rules-new' }
  | { view: 'profiles-list' }
  | { view: 'profiles-new' }
  | { view: 'profiles-edit'; profile: Profile }
  | { view: 'revisions' }
  | { view: 'skills-list' }
  | { view: 'skills-editor'; skill?: UnifiedSkill }
  | { view: 'agents-list' }
  | { view: 'agents-editor'; agent?: UnifiedAgent }
  | { view: 'mcp-list' }
  | { view: 'mcp-editor'; server?: McpServer }

interface PlatformCapabilities {
  rules: boolean
  profiles: boolean
  skills?: boolean
  agents?: boolean
  mcp?: boolean
}

interface PlatformScanResult {
  id: string
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
  rulesDetected?: boolean
}

interface ScanResponse {
  items: PlatformScanResult[]
  scannedAt?: string
}

const API_BASE = 'http://localhost:3001'

function CapabilityBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: active ? '#1a472a' : '#2a2a2a',
        color: active ? '#4ade80' : '#666',
        border: `1px solid ${active ? '#16a34a' : '#333'}`,
        marginRight: 4,
      }}
    >
      {label}
    </span>
  )
}

function PlatformCard({ platform }: { platform: PlatformScanResult }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [results, setResults] = useState<ConflictResult[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, RuleStatus>>({})
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<{ success: number; skipped: number; failed: number } | null>(null)

  const canImport = platform.detected && platform.rulesDetected

  const handleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    setLoading(true)
    setLoadError(null)
    setSummary(null)
    try {
      const [platformRules, existingRules] = await Promise.all([
        fetchPlatformRules(platform.id),
        rulesApi.list(),
      ])
      const detected = detectConflicts(platformRules, existingRules)
      setResults(detected)
      const initial: Record<string, RuleStatus> = {}
      for (const r of detected) {
        initial[r.rule.fileName] = r.status as RuleStatus
      }
      setStatusMap(initial)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [expanded, platform.id])

  const toggleOverwrite = useCallback((fileName: string) => {
    setStatusMap((prev) => {
      const cur = prev[fileName]
      return {
        ...prev,
        [fileName]: cur === 'conflict-skip' ? 'conflict-overwrite' : 'conflict-skip',
      }
    })
  }, [])

  const toggleSelect = useCallback((fileName: string) => {
    setStatusMap((prev) => {
      const cur = prev[fileName]
      const result = results.find((r) => r.rule.fileName === fileName)
      if (!result) return prev
      // If currently skipped, restore to original status
      if (cur === 'skipped') {
        return { ...prev, [fileName]: result.status as RuleStatus }
      }
      return { ...prev, [fileName]: 'skipped' }
    })
  }, [results])

  const selectAll = useCallback(() => {
    setStatusMap((prev) => {
      const next = { ...prev }
      for (const r of results) {
        if (next[r.rule.fileName] === 'imported') continue
        next[r.rule.fileName] = r.status as RuleStatus
      }
      return next
    })
  }, [results])

  const deselectAll = useCallback(() => {
    setStatusMap((prev) => {
      const next = { ...prev }
      for (const r of results) {
        if (next[r.rule.fileName] === 'imported') continue
        next[r.rule.fileName] = 'skipped'
      }
      return next
    })
  }, [results])

  const selectedCount = results.filter((r) => {
    const s = statusMap[r.rule.fileName]
    return s === 'new' || s === 'conflict-overwrite'
  }).length

  const handleImport = useCallback(async () => {
    if (importing) return
    setImporting(true)
    setSummary(null)
    let success = 0
    let skipped = 0
    let failed = 0

    for (const r of results) {
      const status = statusMap[r.rule.fileName]
      if (status === 'skipped' || status === 'imported') {
        skipped++
        continue
      }
      if (status === 'conflict-skip') {
        skipped++
        continue
      }
      try {
        if (status === 'new') {
          await rulesApi.create({ name: r.rule.name, content: r.rule.content, scope: 'global', tags: [] })
        } else if (status === 'conflict-overwrite' && r.existingId) {
          await rulesApi.update(r.existingId, { content: r.rule.content })
        }
        setStatusMap((prev) => ({ ...prev, [r.rule.fileName]: 'imported' }))
        success++
      } catch {
        setStatusMap((prev) => ({ ...prev, [r.rule.fileName]: 'failed' }))
        failed++
      }
    }

    setSummary({ success, skipped, failed })
    setImporting(false)
  }, [results, statusMap, importing])

  return (
    <div
      style={{
        background: '#111',
        border: `1px solid ${platform.detected ? '#1d4ed8' : '#333'}`,
        borderRadius: 8,
        padding: '16px 20px',
        minWidth: 240,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: platform.detected ? '#22c55e' : '#6b7280', fontSize: 10 }}>●</span>
        <span style={{ fontWeight: 600 }}>{platform.displayName}</span>
      </div>

      {/* Config path */}
      {platform.configPath && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          {platform.configPath}
        </div>
      )}

      {/* Capability badges */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {platform.capabilities.rules && (
          <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
            rules
          </span>
        )}
        {platform.capabilities.profiles && (
          <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
            profiles
          </span>
        )}
        {platform.capabilities.mcp && (
          <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
            mcp
          </span>
        )}
        {platform.capabilities.agents && (
          <span style={{ background: '#1e3a5f', color: '#93c5fd', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
            agents
          </span>
        )}
      </div>

      {/* Message */}
      {platform.message && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{platform.message}</div>
      )}

      {/* Import button — only when detected && rulesDetected */}
      {canImport && (
        <button
          onClick={handleExpand}
          style={{
            background: 'transparent',
            border: '1px solid #374151',
            borderRadius: 4,
            color: '#d1d5db',
            cursor: 'pointer',
            fontSize: 12,
            padding: '4px 10px',
            marginTop: 4,
          }}
        >
          {expanded ? '▼ 收起规则列表' : '▶ 查看可导入规则'}
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid #1f2937', paddingTop: 12 }}>
          {loading && <div style={{ color: '#6b7280', fontSize: 12 }}>加载中…</div>}

          {loadError && (
            <div style={{ color: '#f87171', fontSize: 12 }}>
              {loadError}
              <button
                onClick={handleExpand}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontSize: 12,
                  marginLeft: 8,
                }}
              >
                重试
              </button>
            </div>
          )}

          {!loading && !loadError && results.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: 12 }}>该平台暂无可导入规则</div>
          )}

          {!loading && !loadError && results.length > 0 && (
            <>
              {/* Rule list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {results.map((r) => {
                  const s = statusMap[r.rule.fileName]
                  const isChecked = s !== 'skipped'
                  const labelColor =
                    s === 'new' ? '#22c55e'
                    : s === 'conflict-skip' ? '#f59e0b'
                    : s === 'conflict-overwrite' ? '#f97316'
                    : s === 'imported' ? '#6b7280'
                    : s === 'failed' ? '#ef4444'
                    : '#6b7280'
                  const labelText =
                    s === 'new' ? '新建'
                    : s === 'conflict-skip' ? '冲突·跳过'
                    : s === 'conflict-overwrite' ? '冲突·覆盖'
                    : s === 'imported' ? '已导入'
                    : s === 'failed' ? '失败'
                    : '跳过'

                  return (
                    <div
                      key={r.rule.fileName}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked && s !== 'imported' && s !== 'failed'}
                        disabled={s === 'imported' || s === 'failed' || importing}
                        onChange={() => toggleSelect(r.rule.fileName)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, color: '#d1d5db' }}>{r.rule.fileName}</span>
                      <span style={{ color: labelColor, minWidth: 60 }}>{labelText}</span>
                      {(s === 'conflict-skip' || s === 'conflict-overwrite') && !importing && (
                        <button
                          onClick={() => toggleOverwrite(r.rule.fileName)}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${s === 'conflict-overwrite' ? '#f97316' : '#374151'}`,
                            borderRadius: 3,
                            color: s === 'conflict-overwrite' ? '#f97316' : '#6b7280',
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '1px 5px',
                          }}
                        >
                          {s === 'conflict-overwrite' ? '改为跳过' : '改为覆盖'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              {summary && (
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                  ✅ 成功 {summary.success} 条　⚠️ 跳过 {summary.skipped} 条　❌ 失败 {summary.failed} 条
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={selectAll}
                  disabled={importing}
                  style={{
                    background: 'transparent',
                    border: '1px solid #374151',
                    borderRadius: 3,
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '2px 8px',
                  }}
                >
                  全选
                </button>
                <button
                  onClick={deselectAll}
                  disabled={importing}
                  style={{
                    background: 'transparent',
                    border: '1px solid #374151',
                    borderRadius: 3,
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: '2px 8px',
                  }}
                >
                  取消全选
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                  style={{
                    background: selectedCount > 0 && !importing ? '#1d4ed8' : '#1f2937',
                    border: 'none',
                    borderRadius: 4,
                    color: selectedCount > 0 && !importing ? '#fff' : '#6b7280',
                    cursor: selectedCount > 0 && !importing ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    padding: '4px 12px',
                    marginLeft: 'auto',
                  }}
                >
                  {importing ? '导入中…' : `导入已选 ${selectedCount} 条`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  // ── Routing ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState<Page>({ view: 'scanner' })

  // ── Scanner state ──────────────────────────────────────────────────────────
  const [data, setData] = useState<ScanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const fetchPlatforms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/platforms`)
      if (!res.ok) {
        throw new Error(`Server returned ${res.status} ${res.statusText}`)
      }
      const json: { items: PlatformScanResult[] } = await res.json()
      setData({ items: json.items, scannedAt: new Date().toISOString() })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unknown error — is the server running on :3001?'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const rescan = useCallback(async () => {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        throw new Error(`Rescan failed: ${res.status} ${res.statusText}`)
      }
      const json: ScanResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Rescan failed'
      )
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    fetchPlatforms()
  }, [fetchPlatforms])

  const detectedCount = data?.items.filter((p) => p.detected).length ?? 0

  // ── Shared shell ────────────────────────────────────────────────────────────
  const tabStyle = (active: boolean): CSSProperties => ({
    padding: '8px 20px',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#f0f0f0' : '#666',
    border: 'none',
    borderBottom: `2px solid ${active ? '#3b82f6' : 'transparent'}`,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    transition: 'color 0.15s, border-bottom-color 0.15s',
  })

  const isRulesTab = page.view === 'rules-list' || page.view === 'rules-edit' || page.view === 'rules-new'
  const isSkillsTab = page.view === 'skills-list' || page.view === 'skills-editor'
  const isAgentsTab = page.view === 'agents-list' || page.view === 'agents-editor'
  const isMcpTab = page.view === 'mcp-list' || page.view === 'mcp-editor'
  const isProfilesTab = page.view === 'profiles-list' || page.view === 'profiles-new' || page.view === 'profiles-edit'
  const isRevisionsTab = page.view === 'revisions'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        color: '#f0f0f0',
        fontFamily: 'ui-monospace, "Cascadia Code", monospace',
      }}
    >
      {/* App shell: header + tab bar */}
      <div
        style={{
          padding: '28px 32px 0',
          borderBottom: '1px solid #222',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -1 }}>
              ▲ Prism
            </h1>
            <p style={{ margin: '4px 0 12px', color: '#555', fontSize: 12 }}>
              Local-first AI config control plane
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          <button
            style={tabStyle(page.view === 'scanner')}
            onClick={() => setPage({ view: 'scanner' })}
          >
            Scanner
          </button>
          <button
            style={tabStyle(isRulesTab)}
            onClick={() => setPage({ view: 'rules-list' })}
          >
            Rules
          </button>
          <button
            style={tabStyle(isSkillsTab)}
            onClick={() => setPage({ view: 'skills-list' })}
          >
            Skills
          </button>
          <button
            style={tabStyle(isAgentsTab)}
            onClick={() => setPage({ view: 'agents-list' })}
          >
            Agents
          </button>
          <button
            style={tabStyle(isMcpTab)}
            onClick={() => setPage({ view: 'mcp-list' })}
          >
            MCP
          </button>
          <button
            style={tabStyle(isProfilesTab)}
            onClick={() => setPage({ view: 'profiles-list' })}
          >
            Profiles
          </button>
          <button
            style={tabStyle(isRevisionsTab)}
            onClick={() => setPage({ view: 'revisions' })}
          >
            Revisions
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding: '32px 32px' }}>

        {/* ── Scanner tab ──────────────────────────────────────────────────── */}
        {page.view === 'scanner' && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#ccc' }}>
                Platform Scanner
              </h2>
              {data && (
                <span style={{ fontSize: 12, color: '#555' }}>
                  {detectedCount}/{data.items.length} detected
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                {data?.scannedAt && (
                  <span style={{ fontSize: 11, color: '#444' }}>
                    Last scan: {new Date(data.scannedAt).toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={rescan}
                  disabled={scanning || loading}
                  style={{
                    padding: '6px 14px',
                    background: scanning ? '#1a1a1a' : '#1d3557',
                    color: scanning ? '#555' : '#93c5fd',
                    border: '1px solid #1d4ed8',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'inherit',
                    cursor: scanning ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {scanning ? '⟳ Scanning...' : '↺ Rescan'}
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div style={{ color: '#555', fontSize: 13, padding: '32px 0' }}>
                ⟳ Scanning platforms...
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div
                style={{
                  background: '#1a0a0a',
                  border: '1px solid #7f1d1d',
                  borderRadius: 8,
                  padding: '16px 20px',
                  color: '#fca5a5',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ Scan Failed</div>
                <div style={{ color: '#f87171', fontSize: 12, fontFamily: 'monospace' }}>
                  {error}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: '#888' }}>
                  Make sure the server is running:{' '}
                  <code style={{ color: '#a78bfa' }}>pnpm --filter @prism/server dev</code>
                </div>
                <button
                  onClick={fetchPlatforms}
                  style={{
                    marginTop: 12,
                    padding: '5px 12px',
                    background: '#2a0a0a',
                    color: '#f87171',
                    border: '1px solid #7f1d1d',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && data && data.items.length === 0 && (
              <div style={{ color: '#555', fontSize: 13, padding: '32px 0' }}>
                No platform adapters registered.
              </div>
            )}

            {/* Platform cards */}
            {!loading && !error && data && data.items.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {data.items.map((platform) => (
                  <PlatformCard key={platform.id} platform={platform} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Rules list tab ───────────────────────────────────────────────── */}
        {page.view === 'rules-list' && (
          <RulesPage
            onEdit={(rule) => setPage({ view: 'rules-edit', rule })}
            onNew={() => setPage({ view: 'rules-new' })}
          />
        )}

        {/* ── Rule editor (edit) ───────────────────────────────────────────── */}
        {page.view === 'rules-edit' && (
          <RuleEditorPage
            rule={page.rule}
            onSave={() => setPage({ view: 'rules-list' })}
            onCancel={() => setPage({ view: 'rules-list' })}
          />
        )}

        {/* ── Rule editor (new) ────────────────────────────────────────────── */}
        {page.view === 'rules-new' && (
          <RuleEditorPage
            rule={null}
            onSave={() => setPage({ view: 'rules-list' })}
            onCancel={() => setPage({ view: 'rules-list' })}
          />
        )}

        {/* ── Profiles list tab ─────────────────────────────────────────────── */}
        {page.view === 'profiles-list' && (
          <ProfilesPage
            onNew={() => setPage({ view: 'profiles-new' })}
            onEdit={(profile) => setPage({ view: 'profiles-edit', profile })}
          />
        )}
        {/* ── Profile editor (edit) ─────────────────────────────────────────── */}
        {page.view === 'profiles-edit' && (
          <ProfileEditorPage
            profile={page.profile}
            onSave={() => setPage({ view: 'profiles-list' })}
            onCancel={() => setPage({ view: 'profiles-list' })}
          />
        )}
        {/* ── Profile editor (new) ──────────────────────────────────────────── */}
        {page.view === 'profiles-new' && (
          <ProfileEditorPage
            profile={undefined}
            onSave={() => setPage({ view: 'profiles-list' })}
            onCancel={() => setPage({ view: 'profiles-list' })}
          />
        )}

        {/* ── Skills list tab ──────────────────────────────────────────────── */}
        {page.view === 'skills-list' && (
          <SkillsPage
            onEdit={(skill) => setPage({ view: 'skills-editor', skill })}
            onNew={() => setPage({ view: 'skills-editor' })}
          />
        )}

        {/* ── Skill editor ─────────────────────────────────────────────────── */}
        {page.view === 'skills-editor' && (
          <SkillEditorPage
            initialSkill={page.skill}
            onBack={() => setPage({ view: 'skills-list' })}
          />
        )}

        {/* ── Agents list tab ──────────────────────────────────────────────── */}
        {page.view === 'agents-list' && (
          <AgentsPage
            onEdit={(agent) => setPage({ view: 'agents-editor', agent })}
            onNew={() => setPage({ view: 'agents-editor' })}
          />
        )}

        {/* ── Agent editor ─────────────────────────────────────────────────── */}
        {page.view === 'agents-editor' && (
          <AgentEditorPage
            initialAgent={page.agent}
            onBack={() => setPage({ view: 'agents-list' })}
          />
        )}

        {/* ── MCP list tab ─────────────────────────────────────────────────── */}
        {page.view === 'mcp-list' && (
          <McpPage
            onEdit={(server) => setPage({ view: 'mcp-editor', server })}
            onNew={() => setPage({ view: 'mcp-editor' })}
          />
        )}

        {/* ── MCP editor ───────────────────────────────────────────────────── */}
        {page.view === 'mcp-editor' && (
          <McpEditorPage
            initialServer={page.server}
            onBack={() => setPage({ view: 'mcp-list' })}
          />
        )}

        {/* ── Revisions tab ────────────────────────────────────────────────── */}
        {page.view === 'revisions' && <RevisionsPage />}

      </div>
    </div>
  )
}
