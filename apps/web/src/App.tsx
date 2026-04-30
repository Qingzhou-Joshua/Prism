import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedRule, UnifiedSkill, UnifiedAgent, McpServer, UnifiedHook, UnifiedCommand, KnowledgeEntry } from '@prism/shared'
import { PlatformIcon } from './components/PlatformIcon'
import { useFileWatcher } from './hooks/useFileWatcher'
import { FileChangeBanner } from './components/FileChangeBanner'
import { RulesPage } from './pages/RulesPage'
import { RuleEditorPage } from './pages/RuleEditorPage'
import { SkillsPage } from './pages/SkillsPage'
import { SkillEditorPage } from './pages/SkillEditorPage'
import { AgentsPage } from './pages/AgentsPage'
import { AgentEditorPage } from './pages/AgentEditorPage'
import { McpPage } from './pages/McpPage.js'
import { McpEditorPage } from './pages/McpEditorPage.js'
import { HooksPage } from './pages/HooksPage'
import { HookEditorPage } from './pages/HookEditorPage'
import { CommandsPage } from './pages/CommandsPage'
import { CommandEditorPage } from './pages/CommandEditorPage'
import { ConflictsPage } from './pages/ConflictsPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { KnowledgeProfilePage } from './pages/KnowledgeProfilePage'
import { KnowledgeEntryDetailPage } from './pages/KnowledgeEntryDetailPage'
import { SettingsPage } from './pages/SettingsPage.js'
import { GitSyncPage } from './pages/GitSyncPage.js'
import { knowledgeApi } from './api/knowledge'
import { API_BASE } from './api/client'

// ── Types ────────────────────────────────────────────────────────────────────

type Page =
  | { view: 'rules-list' }
  | { view: 'rules-edit'; rule: UnifiedRule }
  | { view: 'rules-new' }
  | { view: 'skills-list' }
  | { view: 'skills-editor'; skill?: UnifiedSkill }
  | { view: 'agents-list' }
  | { view: 'agents-editor'; agent?: UnifiedAgent }
  | { view: 'mcp-list' }
  | { view: 'mcp-editor'; server?: McpServer }
  | { view: 'hooks-list' }
  | { view: 'hooks-editor'; hook?: UnifiedHook }
  | { view: 'commands-list' }
  | { view: 'commands-editor'; command?: UnifiedCommand }
  | { view: 'conflicts-list' }
  | { view: 'knowledge-list' }
  | { view: 'knowledge-profile' }
  | { view: 'knowledge-entry'; entry: KnowledgeEntry }
  | { view: 'settings' }
  | { view: 'git-sync' }

type Capability = 'rules' | 'skills' | 'agents' | 'mcp' | 'hooks' | 'commands' | 'conflicts' | 'knowledge' | 'settings' | 'git-sync'

type Theme = 'dark' | 'light'

interface PlatformCapabilities {
  rules: boolean
  skills?: boolean
  agents?: boolean
  mcp?: boolean
  hooks?: boolean
  commands?: boolean
  conflicts?: boolean
  knowledge?: boolean
}

interface PlatformScanResult {
  id: string
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
  rulesDetected?: boolean
  rulesDir?: string
  skillsDir?: string
  agentsDir?: string
  commandsDir?: string
}

// ── Capability config ─────────────────────────────────────────────────────────


const CAPABILITY_DEFAULT_PAGES: Record<Capability, Page> = {
  rules: { view: 'rules-list' },
  skills: { view: 'skills-list' },
  agents: { view: 'agents-list' },
  mcp: { view: 'mcp-list' },
  hooks: { view: 'hooks-list' },
  commands: { view: 'commands-list' },
  conflicts: { view: 'conflicts-list' },
  knowledge: { view: 'knowledge-list' },
  settings: { view: 'settings' },
  'git-sync': { view: 'git-sync' },
}

type GlobalCapability = 'conflicts' | 'knowledge' | 'git-sync' | 'settings'
const GLOBAL_CAPS: GlobalCapability[] = ['conflicts', 'knowledge', 'git-sync', 'settings']

const CAPABILITY_ICONS: Record<GlobalCapability, string> = {
  conflicts: '⚠️',
  knowledge: '🧠',
  'git-sync': '⇅',
  settings: '⚙',
}

function getPlatformCapabilities(platform: PlatformScanResult): Capability[] {
  const caps: Capability[] = []
  if (platform.capabilities.rules) caps.push('rules')
  if (platform.capabilities.skills) caps.push('skills')
  if (platform.capabilities.agents) caps.push('agents')
  if (platform.capabilities.mcp) caps.push('mcp')
  if (platform.capabilities.hooks) caps.push('hooks')
  if (platform.capabilities.commands) caps.push('commands')
  return caps
}

function getActiveCapability(page: Page): Capability {
  switch (page.view) {
    case 'rules-list':
    case 'rules-edit':
    case 'rules-new':
      return 'rules'
    case 'skills-list':
    case 'skills-editor':
      return 'skills'
    case 'agents-list':
    case 'agents-editor':
      return 'agents'
    case 'mcp-list':
    case 'mcp-editor':
      return 'mcp'
    case 'hooks-list':
    case 'hooks-editor':
      return 'hooks'
    case 'commands-list':
    case 'commands-editor':
      return 'commands'
    case 'conflicts-list':
      return 'conflicts'
    case 'knowledge-list':
    case 'knowledge-profile':
    case 'knowledge-entry':
      return 'knowledge'
    case 'settings':
      return 'settings'
    case 'git-sync':
      return 'git-sync'
    default:
      return 'rules'
  }
}

// ── Platform icon map ─────────────────────────────────────────────────────────

// ── Theme helpers ─────────────────────────────────────────────────────────────

type WithViewTransition = Document & { startViewTransition?: (cb: () => void) => void }

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('prism-theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem('prism-theme', theme)
  } catch { /* noop */ }
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function GlobalNavBar({
  activeCapability,
  conflictCount,
  onNavigate,
}: {
  activeCapability: Capability
  conflictCount: number
  onNavigate: (cap: Capability) => void
}) {
  const { t } = useTranslation('common')
  return (
    <div className="header-global-nav">
      {GLOBAL_CAPS.map((cap) => {
        const capKey = cap === 'git-sync' ? 'gitSync' : cap
        const isActive = activeCapability === cap
        return (
          <button
            key={cap}
            className={`global-nav-btn${isActive ? ' active' : ''}`}
            onClick={() => onNavigate(cap)}
            aria-label={t(`nav.${capKey}`)}
          >
            <span className="global-nav-icon">{CAPABILITY_ICONS[cap]}</span>
            <span className="global-nav-label">{t(`nav.${capKey}`)}</span>
            {cap === 'conflicts' && conflictCount > 0 && (
              <span className="global-nav-badge">{conflictCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function LanguageToggle() {
  const { i18n } = useTranslation()
  const isZh = i18n.language.startsWith('zh')
  return (
    <button
      className="lang-toggle"
      onClick={() => i18n.changeLanguage(isZh ? 'en' : 'zh')}
      title={isZh ? 'Switch to English' : '切换为中文'}
      aria-label={isZh ? 'Switch to English' : '切换为中文'}
    >
      {isZh ? 'EN' : '中'}
    </button>
  )
}

// ── Main App component ────────────────────────────────────────────────────────

export default function App() {
  const { t } = useTranslation('common')

  // Theme
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Conflict count badge
  const [conflictCount, setConflictCount] = useState(0)

  useEffect(() => {
    async function fetchConflictCount() {
      try {
        const res = await fetch(`${API_BASE}/registry/conflicts`)
        if (res.ok) {
          const data = await res.json()
          setConflictCount((data.conflicts ?? []).length)
        }
      } catch { /* ignore */ }
    }
    void fetchConflictCount()
    const interval = setInterval(() => void fetchConflictCount(), 30_000)
    return () => clearInterval(interval)
  }, [])

  const toggleTheme = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    document.documentElement.style.setProperty('--vt-x', `${x}px`)
    document.documentElement.style.setProperty('--vt-y', `${y}px`)

    const doc = document as WithViewTransition
    const nextTheme = theme === 'dark' ? 'light' : 'dark'

    if (doc.startViewTransition) {
      doc.startViewTransition(() => {
        applyTheme(nextTheme)
        setTheme(nextTheme)
      })
    } else {
      applyTheme(nextTheme)
      setTheme(nextTheme)
    }
  }, [theme])

  // Platform scan
  const [platforms, setPlatforms] = useState<PlatformScanResult[]>([])
  const [platformsLoading, setPlatformsLoading] = useState(true)
  const [platformsError, setPlatformsError] = useState<string | null>(null)

  const fetchPlatforms = useCallback(async () => {
    setPlatformsLoading(true)
    setPlatformsError(null)
    try {
      const res = await fetch(`${API_BASE}/platforms`)
      if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`)
      const json: { items: PlatformScanResult[] } = await res.json()
      setPlatforms(json.items)
    } catch (err) {
      setPlatformsError(
        err instanceof Error ? err.message : 'Failed to connect — is the server running on :3001?'
      )
    } finally {
      setPlatformsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlatforms()
  }, [fetchPlatforms])

  // Selected platform (defaults to first detected)
  const detectedPlatforms = platforms.filter((p) => p.detected)
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedPlatformId === null && detectedPlatforms.length > 0) {
      setSelectedPlatformId(detectedPlatforms[0].id)
    }
  }, [detectedPlatforms, selectedPlatformId])

  const selectedPlatform =
    platforms.find((p) => p.id === selectedPlatformId) ?? detectedPlatforms[0] ?? null

  // Page routing
  const [page, setPage] = useState<Page>({ view: 'rules-list' })

  const activeCapability = getActiveCapability(page)
  const isGlobalPage = (GLOBAL_CAPS as Capability[]).includes(activeCapability)

  const navigateTo = useCallback((cap: Capability) => {
    setPage(CAPABILITY_DEFAULT_PAGES[cap])
  }, [])

  const handlePlatformSelect = useCallback((id: string) => {
    setSelectedPlatformId(id)
    setPage({ view: 'rules-list' })
  }, [])

  const capabilities = selectedPlatform ? getPlatformCapabilities(selectedPlatform) : []

  // File watcher
  const { changes, dismissChange } = useFileWatcher()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {/* ── Top header bar ──────────────────────────────────────────────── */}
      <header className="app-header">
        {/* Logo */}
        <div className="app-logo">
          <img src="/favicon.png" alt="Prism" className="logo-img" />
          <span className="logo-text">Prism</span>
        </div>

        {/* Platform tabs */}
        <nav className="platform-tabs">
          {platformsLoading && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '0 12px' }}>
              {t('status.loading')}
            </span>
          )}
          {!platformsLoading && platforms.length === 0 && !platformsError && (
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '0 12px' }}>
              {t('platform.allPlatforms')}
            </span>
          )}
          {!platformsLoading &&
            platforms.map((p) => (
              <button
                key={p.id}
                className={`platform-tab${selectedPlatformId === p.id ? ' active' : ''}`}
                onClick={() => handlePlatformSelect(p.id)}
                title={p.message ?? p.displayName}
              >
                <PlatformIcon platformId={p.id} size={18} />
                {p.displayName}
                <span className={`tab-dot${p.detected ? '' : ' offline'}`} />
              </button>
            ))}
        </nav>

        {/* Right controls */}
        <div className="header-right">
          <GlobalNavBar
            activeCapability={activeCapability}
            conflictCount={conflictCount}
            onNavigate={navigateTo}
          />
          <div className="header-right-divider" />
          <LanguageToggle />
          <div className="theme-toggle-pill">
            <button
              className={`theme-toggle-icon${theme === 'light' ? ' active' : ''}`}
              onClick={toggleTheme}
              title="Switch to light mode"
              aria-label="Switch to light mode"
            >
              <SunIcon />
            </button>
            <button
              className={`theme-toggle-icon${theme === 'dark' ? ' active' : ''}`}
              onClick={toggleTheme}
              title="Switch to dark mode"
              aria-label="Switch to dark mode"
            >
              <MoonIcon />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + main ────────────────────────────────────────── */}
      <div className="app-body">
        {/* Sidebar：仅 IDE 模式显示 */}
        {!isGlobalPage && (
        <aside className="app-sidebar">
          {selectedPlatform && capabilities.length > 0 && (
            <>
              <div className="sidebar-section-label">
                {selectedPlatform.displayName}
              </div>
              {capabilities.map((cap) => {
                const capKey = cap === 'git-sync' ? 'gitSync' : cap
                return (
                  <button
                    key={cap}
                    className={`sidebar-nav-item${activeCapability === cap ? ' active' : ''}`}
                    onClick={() => navigateTo(cap)}
                  >
                    {t(`nav.${capKey}`)}
                  </button>
                )
              })}
            </>
          )}

          {!platformsLoading && platforms.length === 0 && (
            <div style={{ padding: '16px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
              {t('status.notConfigured')}
              <br />
              <button
                onClick={fetchPlatforms}
                style={{
                  marginTop: 8,
                  padding: '4px 10px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t('btn.retry')}
              </button>
            </div>
          )}
        </aside>
        )}

        {/* Main content area */}
        <main className={`app-main${isGlobalPage ? ' app-main--global' : ''}`}>
          <FileChangeBanner changes={changes} onDismiss={dismissChange} />
          <div className="app-content">
            {/* Error banner */}
            {platformsError && (
              <div className="alert alert-danger" style={{ marginBottom: 20 }}>
                <div>
                  <strong>{t('status.error')}:</strong> {platformsError}
                  <div style={{ marginTop: 6 }}>
                    <code>pnpm --filter @prism/server dev</code>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={fetchPlatforms}
                  >
                    {t('btn.retry')}
                  </button>
                </div>
              </div>
            )}

            {/* Rules */}
            {page.view === 'rules-list' && (
              <RulesPage
                platformId={selectedPlatformId ?? 'claude-code'}
                onEdit={(rule) => setPage({ view: 'rules-edit', rule })}
                onNew={() => setPage({ view: 'rules-new' })}
                rulesDir={selectedPlatform?.rulesDir}
              />
            )}
            {page.view === 'rules-edit' && (
              <RuleEditorPage
                platformId={selectedPlatformId ?? 'claude-code'}
                rule={page.rule}
                onSave={() => setPage({ view: 'rules-list' })}
                onCancel={() => setPage({ view: 'rules-list' })}
                detectedPlatforms={detectedPlatforms}
              />
            )}
            {page.view === 'rules-new' && (
              <RuleEditorPage
                platformId={selectedPlatformId ?? 'claude-code'}
                rule={null}
                onSave={() => setPage({ view: 'rules-list' })}
                onCancel={() => setPage({ view: 'rules-list' })}
                detectedPlatforms={detectedPlatforms}
              />
            )}

            {/* Skills */}
            {page.view === 'skills-list' && (
              <SkillsPage
                platformId={selectedPlatformId ?? 'claude-code'}
                onEdit={(skill) => setPage({ view: 'skills-editor', skill })}
                onNew={() => setPage({ view: 'skills-editor' })}
                skillsDir={selectedPlatform?.skillsDir}
              />
            )}
            {page.view === 'skills-editor' && (
              <SkillEditorPage
                platformId={selectedPlatformId ?? 'claude-code'}
                initialSkill={page.skill}
                onBack={() => setPage({ view: 'skills-list' })}
                detectedPlatforms={detectedPlatforms}
              />
            )}

            {/* Agents */}
            {page.view === 'agents-list' && (
              <AgentsPage
                platformId={selectedPlatformId ?? 'claude-code'}
                onEdit={(agent) => setPage({ view: 'agents-editor', agent })}
                onNew={() => setPage({ view: 'agents-editor' })}
                agentsDir={selectedPlatform?.agentsDir}
              />
            )}
            {page.view === 'agents-editor' && (
              <AgentEditorPage
                platformId={selectedPlatformId ?? 'claude-code'}
                initialAgent={page.agent}
                onBack={() => setPage({ view: 'agents-list' })}
                detectedPlatforms={detectedPlatforms}
              />
            )}

            {/* MCP */}
            {page.view === 'mcp-list' && (
              <McpPage
                onEdit={(server) => setPage({ view: 'mcp-editor', server })}
                onNew={() => setPage({ view: 'mcp-editor' })}
              />
            )}
            {page.view === 'mcp-editor' && (
              <McpEditorPage
                initialServer={page.server}
                onBack={() => setPage({ view: 'mcp-list' })}
              />
            )}

            {/* Hooks */}
            {page.view === 'hooks-list' && (
              <HooksPage
                platformId={selectedPlatformId ?? 'claude-code'}
                onEdit={(hook) => setPage({ view: 'hooks-editor', hook })}
                onNew={() => setPage({ view: 'hooks-editor' })}
              />
            )}
            {page.view === 'hooks-editor' && (
              <HookEditorPage
                platformId={selectedPlatformId ?? 'claude-code'}
                initialHook={page.hook}
                onBack={() => setPage({ view: 'hooks-list' })}
              />
            )}

            {/* Commands */}
            {page.view === 'commands-list' && (
              <CommandsPage
                platform={selectedPlatformId ?? undefined}
                onEdit={(cmd) => setPage({ view: 'commands-editor', command: cmd })}
              />
            )}
            {page.view === 'commands-editor' && (
              <CommandEditorPage
                command={page.command}
                onBack={() => setPage({ view: 'commands-list' })}
                platform={selectedPlatformId ?? undefined}
              />
            )}

            {/* Conflicts */}
            {page.view === 'conflicts-list' && (
              <ConflictsPage onClose={() => setPage({ view: 'rules-list' })} />
            )}

            {/* Knowledge */}
            {page.view === 'knowledge-list' && (
              <KnowledgePage
                onEditProfile={() => setPage({ view: 'knowledge-profile' })}
                onViewEntry={(entry) => setPage({ view: 'knowledge-entry', entry })}
              />
            )}
            {page.view === 'knowledge-profile' && (
              <KnowledgeProfilePage onBack={() => setPage({ view: 'knowledge-list' })} />
            )}
            {page.view === 'knowledge-entry' && 'entry' in page && (
              <KnowledgeEntryDetailPage
                entry={page.entry}
                onBack={() => setPage({ view: 'knowledge-list' })}
                onDelete={async () => {
                  try {
                    await knowledgeApi.deleteEntry(page.entry.id)
                    setPage({ view: 'knowledge-list' })
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Delete failed')
                  }
                }}
              />
            )}

            {/* Settings */}
            {page.view === 'settings' && (
              <SettingsPage onNavigateToGitSync={() => setPage({ view: 'git-sync' })} />
            )}

            {/* Git Sync */}
            {page.view === 'git-sync' && (
              <GitSyncPage />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
