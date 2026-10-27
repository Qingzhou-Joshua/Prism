import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { ImportedAgent, ImportedMcpServer, ImportedRule, ImportedSkill, PlatformScanResult } from '@prism/shared'
import type { PlatformAdapter } from '../types.js'
import { instanceCapabilities, type PlatformInstance } from './instances.js'
import { NativeMcpStore } from '../mcp/native-store.js'

async function isDir(p: string | null): Promise<boolean> {
  if (!p) return false
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

async function readMarkdownFiles(dir: string | null, exts: string[]): Promise<{ fileName: string; filePath: string; content: string }[]> {
  if (!dir) return []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const e of entries) {
    if (!e.isFile() || !exts.some(x => e.name.endsWith(x))) continue
    const filePath = join(dir, e.name)
    try {
      out.push({ fileName: e.name, filePath, content: await readFile(filePath, 'utf-8') })
    } catch {
      // skip unreadable files
    }
  }
  return out
}

/** Build a PlatformAdapter that reads assets from a discovered PlatformInstance. */
export function createInstanceAdapter(p: PlatformInstance): PlatformAdapter {
  const capabilities = instanceCapabilities(p)
  const base = { id: p.id, displayName: p.displayName, capabilities }

  return {
    ...base,

    async scan(): Promise<PlatformScanResult> {
      const detected = await isDir(p.baseDir)
      const rulesDetected = await isDir(p.rulesDir)
      return {
        ...base,
        kind: p.kind,
        detected,
        configPath: p.baseDir,
        message: detected ? `${p.displayName} detected at ${p.baseDir}` : `${p.displayName} not found at ${p.baseDir}`,
        rulesDetected,
        ...(p.rulesDir ? { rulesDir: p.rulesDir } : {}),
        ...(p.skillsDir ? { skillsDir: p.skillsDir } : {}),
        ...(p.agentsDir ? { agentsDir: p.agentsDir } : {}),
        ...(p.commandsDir ? { commandsDir: p.commandsDir } : {}),
        ...(p.mcp ? { mcpConfigPath: p.mcp.path } : {}),
      }
    },

    async importRules(): Promise<ImportedRule[]> {
      const files = await readMarkdownFiles(p.rulesDir, ['.md', '.mdc'])
      return files.map(f => ({ platformId: p.id, ...f }))
    },

    async importSkills(): Promise<ImportedSkill[]> {
      if (!p.skillsDir) return []
      const out: ImportedSkill[] = []
      let entries
      try {
        entries = await readdir(p.skillsDir, { withFileTypes: true })
      } catch {
        return []
      }
      for (const e of entries) {
        if (!e.isDirectory() && !e.isSymbolicLink()) continue
        const filePath = join(p.skillsDir, e.name, 'SKILL.md')
        try {
          out.push({ fileName: relative(p.skillsDir, filePath), content: await readFile(filePath, 'utf-8') })
        } catch {
          // no SKILL.md
        }
      }
      return out
    },

    async importAgents(): Promise<ImportedAgent[]> {
      const files = await readMarkdownFiles(p.agentsDir, ['.md'])
      return files.map(f => ({ fileName: f.fileName, content: f.content }))
    },

    async importMcpServers(): Promise<ImportedMcpServer[]> {
      if (!p.mcp) return []
      const servers = await new NativeMcpStore(p.mcp, p.id).findAll()
      return servers.map(s => ({
        name: s.name,
        command: s.command,
        args: s.args,
        ...(s.env ? { env: s.env } : {}),
        ...(s.type ? { type: s.type } : {}),
        ...(s.url ? { url: s.url } : {}),
        ...(s.headers ? { headers: s.headers } : {}),
      }))
    },
  }
}
