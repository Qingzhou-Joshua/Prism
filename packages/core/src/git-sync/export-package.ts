import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { hostname } from 'node:os'
import type { PrismExportPackage, Registry } from '@prism/shared'
import type { RegistryStore } from '../registry/registry-store.js'
import type { OverrideStore } from '../overrides/override-store.js'
import type { KnowledgeStore } from '../knowledge/knowledge-store.js'

/**
 * Build a PrismExportPackage from the current state of all stores.
 *
 * registry   → RegistryStore.load()
 * overrides  → walk ~/.prism/overrides/**\/*.md  (via OverrideStore internals)
 * knowledge  → walk KnowledgeStore.entriesDir/**\/*.md
 */
export async function createExportPackage(
  registryStore: RegistryStore,
  overrideStore: OverrideStore,
  knowledgeStore: KnowledgeStore,
  machine?: string,
): Promise<PrismExportPackage> {
  // ── registry ──────────────────────────────────────────────────────────────
  const registry: Registry = await registryStore.load()

  // ── overrides ─────────────────────────────────────────────────────────────
  // OverrideStore stores files at baseDir/{platformId}/{assetType}/{id}.md
  // We want a flat map:  "{platformId}/{assetType}/{id}" → content
  const overrides: Record<string, string> = {}
  const overrideBaseDir = (overrideStore as unknown as { baseDir: string }).baseDir
  await walkMdFiles(overrideBaseDir, async (relPath, content) => {
    // relPath is like "claude-code/rule/some-id.md"
    const key = relPath.replace(/\.md$/, '')
    overrides[key] = content
  })

  // ── knowledge entries ─────────────────────────────────────────────────────
  const knowledge: Record<string, string> = {}
  const entriesDir = (knowledgeStore as unknown as { entriesDir: string }).entriesDir
  await walkMdFiles(entriesDir, async (relPath, content) => {
    const key = relPath.replace(/\.md$/, '')
    knowledge[key] = content
  })

  return {
    version: '1',
    exportedAt: new Date().toISOString(),
    machine: machine ?? hostname(),
    registry,
    overrides,
    knowledge,
  }
}

/**
 * Write a PrismExportPackage back to ~/.prism.
 * Writes:
 *   prismHomeDir/registry.json
 *   prismHomeDir/overrides/{key}.md
 *   prismHomeDir/knowledge/entries/{key}.md
 */
export async function extractExportPackage(
  pkg: PrismExportPackage,
  prismHomeDir: string,
): Promise<void> {
  // ── registry ──────────────────────────────────────────────────────────────
  const registryPath = join(prismHomeDir, 'registry.json')
  await mkdir(prismHomeDir, { recursive: true })
  await writeFile(registryPath, JSON.stringify(pkg.registry, null, 2), 'utf-8')

  // ── overrides ─────────────────────────────────────────────────────────────
  for (const [key, content] of Object.entries(pkg.overrides)) {
    const filePath = join(prismHomeDir, 'overrides', `${key}.md`)
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }

  // ── knowledge entries ─────────────────────────────────────────────────────
  for (const [key, content] of Object.entries(pkg.knowledge)) {
    const filePath = join(prismHomeDir, 'knowledge', 'entries', `${key}.md`)
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(filePath, content, 'utf-8')
  }
}

/** Validate that an unknown value is a PrismExportPackage */
export function validateExportPackage(data: unknown): data is PrismExportPackage {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  if (d['version'] !== '1') return false
  if (typeof d['exportedAt'] !== 'string') return false
  if (typeof d['registry'] !== 'object' || d['registry'] === null) return false
  if (typeof d['overrides'] !== 'object' || d['overrides'] === null) return false
  if (typeof d['knowledge'] !== 'object' || d['knowledge'] === null) return false
  const reg = d['registry'] as Record<string, unknown>
  if (reg['version'] !== '1') return false
  if (!Array.isArray(reg['entries'])) return false
  return true
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function walkMdFiles(
  dir: string,
  callback: (relPath: string, content: string) => Promise<void>,
): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
    throw err
  }

  await Promise.all(
    entries.map(async (name) => {
      const fullPath = join(dir, name)
      if (name.endsWith('.md')) {
        try {
          const content = await readFile(fullPath, 'utf-8')
          await callback(name, content)
        } catch {
          // skip unreadable files
        }
      } else {
        // might be a sub-directory — recurse
        try {
          await walkMdFiles(fullPath, async (relSubPath, content) => {
            await callback(`${name}/${relSubPath}`, content)
          })
        } catch {
          // not a directory, skip
        }
      }
    }),
  )
}
