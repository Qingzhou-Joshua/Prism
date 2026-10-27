import { homedir } from 'node:os'
import { join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import type { PlatformCapabilities, PlatformId, PlatformKind } from '@prism/shared'

// ── Platform instance model ────────────────────────────────────────────────
//
// A PlatformInstance describes where one installed AI tool keeps each asset
// type on disk. Paths are null when the tool has no such asset. Instances are
// discovered once at server startup (discoverPlatformInstances) and cached via
// setPlatformInstances(); all getPlatform*Dir helpers read from that cache.

export type McpConfigFormat = 'json' | 'jsonc' | 'toml'

/**
 * - standard: `{ mcpServers: { name: { command, args, env } | { type, url } } }`
 * - opencode: `{ mcp: { name: { type: 'local', command: [...], environment } | { type: 'remote', url } } }`
 * - codex:    TOML `[mcp_servers.name]` tables
 */
export type McpDialect = 'standard' | 'opencode' | 'codex'

export interface McpConfigSpec {
  path: string
  format: McpConfigFormat
  dialect: McpDialect
}

export type PluginSourceSpec =
  /** Claude-style: plugins/installed_plugins.json + settings.json `enabledPlugins` */
  | { type: 'claude'; installedPath: string; settingsPath: string }
  /** Codex: `[plugins."id"] enabled = bool` in config.toml; files in plugins/cache/<market>/<name>/<version>/ */
  | { type: 'codex'; configPath: string; cacheDir: string }
  /** OpenCode: `plugin: string[]` in opencode.json(c) */
  | { type: 'opencode'; configPath: string }
  /** Cursor: plugins/cache/<marketplace>/<name>/<sha>/ (read-only) */
  | { type: 'cursor'; cacheDir: string }

export interface PlatformInstance {
  id: PlatformId
  kind: PlatformKind
  displayName: string
  baseDir: string
  rulesDir: string | null
  /** Extension used when creating new rule files. */
  ruleExt: '.md' | '.mdc'
  skillsDir: string | null
  agentsDir: string | null
  commandsDir: string | null
  /** settings.json holding a Claude-style `hooks` field. */
  hooksSettingsPath: string | null
  mcp: McpConfigSpec | null
  plugins: PluginSourceSpec | null
}

export const PLATFORM_KIND_LABELS: Record<PlatformKind, string> = {
  'claude-code': 'Claude Code',
  codebuddy: 'CodeBuddy',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
}

export function instanceCapabilities(p: PlatformInstance): PlatformCapabilities {
  return {
    rules: p.rulesDir !== null,
    profiles: p.rulesDir !== null,
    skills: p.skillsDir !== null,
    agents: p.agentsDir !== null,
    commands: p.commandsDir !== null,
    hooks: p.hooksSettingsPath !== null,
    mcp: p.mcp !== null,
    plugins: p.plugins !== null,
  }
}

// ── Instance builders ──────────────────────────────────────────────────────

/** Matches Claude Code config dirs such as `.claude`, `.tclaude`, `.claude-internal`. */
export const CLAUDE_DIR_PATTERN = /^\.[a-z0-9_-]*claude[a-z0-9_-]*$/i

/** Files/dirs whose presence marks a directory as a real Claude Code config dir. */
const CLAUDE_DIR_MARKERS = ['settings.json', '.claude.json', 'skills', 'agents', 'rules', 'commands', 'plugins', 'projects']

export function claudeInstanceId(dirName: string): PlatformId {
  if (dirName === '.claude') return 'claude-code'
  return `claude-code-${dirName.replace(/^\./, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}`
}

export function buildClaudeInstance(baseDir: string, home: string = homedir(), multi = false): PlatformInstance {
  const dirName = baseDir.split('/').pop() ?? '.claude'
  const isDefault = baseDir === join(home, '.claude')
  return {
    id: isDefault ? 'claude-code' : claudeInstanceId(dirName),
    kind: 'claude-code',
    displayName: multi || !isDefault ? `Claude Code (${dirName})` : 'Claude Code',
    baseDir,
    rulesDir: join(baseDir, 'rules'),
    ruleExt: '.md',
    skillsDir: join(baseDir, 'skills'),
    agentsDir: join(baseDir, 'agents'),
    commandsDir: join(baseDir, 'commands'),
    hooksSettingsPath: join(baseDir, 'settings.json'),
    // The default ~/.claude dir keeps user MCP servers in ~/.claude.json;
    // a custom CLAUDE_CONFIG_DIR keeps it inside the dir itself.
    mcp: {
      path: isDefault ? join(home, '.claude.json') : join(baseDir, '.claude.json'),
      format: 'json',
      dialect: 'standard',
    },
    plugins: {
      type: 'claude',
      installedPath: join(baseDir, 'plugins', 'installed_plugins.json'),
      settingsPath: join(baseDir, 'settings.json'),
    },
  }
}

export function buildCodebuddyInstance(home: string = homedir()): PlatformInstance {
  const base = join(home, '.codebuddy')
  return {
    id: 'codebuddy',
    kind: 'codebuddy',
    displayName: 'CodeBuddy',
    baseDir: base,
    rulesDir: join(base, 'rules'),
    ruleExt: '.mdc',
    skillsDir: join(base, 'skills'),
    agentsDir: join(base, 'agents'),
    commandsDir: join(base, 'commands'),
    hooksSettingsPath: join(base, 'settings.json'),
    mcp: { path: join(base, 'mcp.json'), format: 'json', dialect: 'standard' },
    plugins: {
      type: 'claude',
      installedPath: join(base, 'plugins', 'installed_plugins.json'),
      settingsPath: join(base, 'settings.json'),
    },
  }
}

export function buildCursorInstance(home: string = homedir()): PlatformInstance {
  const base = join(home, '.cursor')
  return {
    id: 'cursor',
    kind: 'cursor',
    displayName: 'Cursor',
    baseDir: base,
    rulesDir: join(base, 'rules'),
    ruleExt: '.mdc',
    skillsDir: join(base, 'skills'),
    agentsDir: join(base, 'agents'),
    commandsDir: join(base, 'commands'),
    hooksSettingsPath: null,
    mcp: { path: join(base, 'mcp.json'), format: 'json', dialect: 'standard' },
    plugins: { type: 'cursor', cacheDir: join(base, 'plugins', 'cache') },
  }
}

export function buildCodexInstance(home: string = homedir()): PlatformInstance {
  const base = process.env.CODEX_HOME || join(home, '.codex')
  const configPath = join(base, 'config.toml')
  return {
    id: 'codex',
    kind: 'codex',
    displayName: 'Codex',
    baseDir: base,
    rulesDir: null,
    ruleExt: '.md',
    skillsDir: join(base, 'skills'),
    agentsDir: null,
    commandsDir: join(base, 'prompts'),
    hooksSettingsPath: null,
    mcp: { path: configPath, format: 'toml', dialect: 'codex' },
    plugins: { type: 'codex', configPath, cacheDir: join(base, 'plugins', 'cache') },
  }
}

export function buildOpencodeInstance(
  home: string = homedir(),
  opts: { configFile?: string; dirNames?: { skills?: string; agents?: string; commands?: string } } = {},
): PlatformInstance {
  const base = join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  const configPath = join(base, opts.configFile ?? 'opencode.json')
  return {
    id: 'opencode',
    kind: 'opencode',
    displayName: 'OpenCode',
    baseDir: base,
    rulesDir: null,
    ruleExt: '.md',
    skillsDir: join(base, opts.dirNames?.skills ?? 'skills'),
    agentsDir: join(base, opts.dirNames?.agents ?? 'agents'),
    commandsDir: join(base, opts.dirNames?.commands ?? 'commands'),
    hooksSettingsPath: null,
    mcp: { path: configPath, format: configPath.endsWith('.jsonc') ? 'jsonc' : 'json', dialect: 'opencode' },
    plugins: { type: 'opencode', configPath },
  }
}

/** Static defaults (no filesystem checks) — used before discovery and in tests. */
export function defaultPlatformInstances(home: string = homedir()): PlatformInstance[] {
  return [
    buildClaudeInstance(join(home, '.claude'), home),
    buildCodebuddyInstance(home),
    buildCursorInstance(home),
    buildCodexInstance(home),
    buildOpencodeInstance(home),
  ]
}

// ── Discovery ──────────────────────────────────────────────────────────────

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

/** Returns all `~/.*claude*` dirs that look like Claude Code config dirs. */
export async function discoverClaudeDirs(home: string = homedir()): Promise<string[]> {
  const found = new Set<string>()
  try {
    const entries = await readdir(home, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory() || !CLAUDE_DIR_PATTERN.test(e.name)) continue
      const dir = join(home, e.name)
      const marks = await Promise.all(CLAUDE_DIR_MARKERS.map(m => exists(join(dir, m))))
      if (marks.some(Boolean)) found.add(dir)
    }
  } catch {
    // unreadable home — fall through
  }
  const envDir = process.env.CLAUDE_CONFIG_DIR
  if (envDir && (await isDir(envDir))) found.add(envDir)

  const defaultDir = join(home, '.claude')
  return [...found].sort((a, b) => (a === defaultDir ? -1 : b === defaultDir ? 1 : a.localeCompare(b)))
}

async function pickDir(base: string, candidates: string[]): Promise<string> {
  for (const c of candidates) {
    if (await isDir(join(base, c))) return c
  }
  return candidates[0]
}

/** Scan the home directory and return every installed platform instance. */
export async function discoverPlatformInstances(home: string = homedir()): Promise<PlatformInstance[]> {
  const result: PlatformInstance[] = []

  const claudeDirs = await discoverClaudeDirs(home)
  for (const dir of claudeDirs) result.push(buildClaudeInstance(dir, home, claudeDirs.length > 1))

  const codebuddy = buildCodebuddyInstance(home)
  if (await isDir(codebuddy.baseDir)) result.push(codebuddy)

  const cursor = buildCursorInstance(home)
  if (await isDir(cursor.baseDir)) result.push(cursor)

  const codex = buildCodexInstance(home)
  if (await isDir(codex.baseDir)) result.push(codex)

  const opencodeBase = buildOpencodeInstance(home).baseDir
  if (await isDir(opencodeBase)) {
    const configFile = (await exists(join(opencodeBase, 'opencode.jsonc'))) ? 'opencode.jsonc' : 'opencode.json'
    result.push(buildOpencodeInstance(home, {
      configFile,
      dirNames: {
        skills: await pickDir(opencodeBase, ['skills', 'skill']),
        agents: await pickDir(opencodeBase, ['agents', 'agent']),
        commands: await pickDir(opencodeBase, ['commands', 'command']),
      },
    }))
  }

  return result
}

// ── Instance cache ─────────────────────────────────────────────────────────

let _instances: PlatformInstance[] | null = null

export function setPlatformInstances(instances: PlatformInstance[]): void {
  _instances = instances
}

export function getPlatformInstances(): PlatformInstance[] {
  if (!_instances) _instances = defaultPlatformInstances()
  return _instances
}

export function getPlatformInstance(id: PlatformId): PlatformInstance | undefined {
  return getPlatformInstances().find(p => p.id === id)
}

export function requirePlatformInstance(id: PlatformId): PlatformInstance {
  const p = getPlatformInstance(id)
  if (!p) throw new Error(`Unknown platform: ${id}`)
  return p
}
