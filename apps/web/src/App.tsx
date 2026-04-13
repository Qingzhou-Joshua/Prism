import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import type { UnifiedRule, Profile } from '@prism/shared'
import { RulesPage } from './pages/RulesPage'
import { RuleEditorPage } from './pages/RuleEditorPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { ProfileEditorPage } from './pages/ProfileEditorPage'

// ── Navigation state ────────────────────────────────────────────────────────
type Page =
  | { view: 'scanner' }
  | { view: 'rules-list' }
  | { view: 'rules-edit'; rule: UnifiedRule }
  | { view: 'rules-new' }
  | { view: 'profiles-list' }
  | { view: 'profiles-new' }
  | { view: 'profiles-edit'; profile: Profile }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#f0f0f0' }}>
          {platform.displayName}
        </span>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            background: platform.detected ? '#14532d' : '#3b1f1f',
            color: platform.detected ? '#4ade80' : '#f87171',
            border: `1px solid ${platform.detected ? '#16a34a' : '#dc2626'}`,
          }}
        >
          {platform.detected ? '✓ Detected' : '✗ Not Found'}
        </span>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        ID: <code style={{ color: '#a78bfa' }}>{platform.id}</code>
      </div>

      {platform.configPath && (
        <div
          style={{
            fontSize: 11,
            color: '#666',
            background: '#0a0a0a',
            borderRadius: 4,
            padding: '4px 8px',
            marginBottom: 8,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
          }}
        >
          {platform.configPath}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        <CapabilityBadge label="Rules" active={platform.capabilities.rules} />
        <CapabilityBadge label="Profiles" active={platform.capabilities.profiles} />
        {platform.capabilities.skills !== undefined && (
          <CapabilityBadge label="Skills" active={platform.capabilities.skills} />
        )}
        {platform.capabilities.agents !== undefined && (
          <CapabilityBadge label="Agents" active={platform.capabilities.agents} />
        )}
        {platform.capabilities.mcp !== undefined && (
          <CapabilityBadge label="MCP" active={platform.capabilities.mcp} />
        )}
      </div>

      {platform.message && (
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>
          {platform.message}
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
  const isProfilesTab = page.view === 'profiles-list' || page.view === 'profiles-new' || page.view === 'profiles-edit'

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
            style={tabStyle(isProfilesTab)}
            onClick={() => setPage({ view: 'profiles-list' })}
          >
            Profiles
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

      </div>
    </div>
  )
}
