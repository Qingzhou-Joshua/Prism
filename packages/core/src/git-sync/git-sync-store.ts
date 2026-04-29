import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
import type { Registry, RegistryEntry, RegistryDiff, PrismExportPackage } from '@prism/shared'

const exec = promisify(execCb)

function normalizeKey(type: string, name: string): string {
  return `${type}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function parseGitError(stderr: string): string {
  if (stderr.includes('Authentication failed')) return 'Git authentication failed. Check your PAT.'
  if (stderr.includes('Could not resolve host')) return 'Cannot reach git remote. Check network connectivity.'
  if (stderr.includes('Repository not found')) return 'Repository not found. Check the remote URL.'
  if (stderr.includes('Permission denied')) return 'Git permission denied. Check your credentials.'
  if (stderr.includes('remote: error')) return `Remote rejected: ${stderr.trim()}`
  return stderr.trim()
}

async function runGit(args: string, cwd: string): Promise<string> {
  try {
    const { stdout } = await exec(`git ${args}`, { cwd })
    return stdout.trim()
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string }
    const stderr = e.stderr ?? e.message ?? String(err)
    throw new Error(parseGitError(stderr))
  }
}

export class GitSyncStore {
  constructor(
    private readonly gitWorkDir: string,
    private readonly prismHomeDir: string,
  ) {}

  /** git init + remote add origin + initial commit of existing registry.json if present */
  async initialize(remoteUrl: string, branch: string): Promise<void> {
    await runGit('init', this.gitWorkDir)
    // Set default branch name
    try {
      await runGit(`checkout -b ${branch}`, this.gitWorkDir)
    } catch {
      // branch might already exist; try renaming current branch
      await runGit(`branch -M ${branch}`, this.gitWorkDir)
    }
    // Configure remote (ignore error if already set)
    try {
      await runGit(`remote add origin ${remoteUrl}`, this.gitWorkDir)
    } catch {
      await runGit(`remote set-url origin ${remoteUrl}`, this.gitWorkDir)
    }
    // Make an initial commit so the branch exists locally
    await runGit('add -A', this.gitWorkDir)
    const status = await this.getStatus()
    if (status.modified.length > 0 || status.untracked.length > 0) {
      try {
        await runGit('commit -m "chore: initial prism export"', this.gitWorkDir)
      } catch {
        // nothing staged, that's fine
      }
    }
  }

  /** Clone remote repo into gitWorkDir */
  async clone(remoteUrl: string, branch: string): Promise<void> {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(this.gitWorkDir, { recursive: true })
    // Clone into the directory itself (it must be empty)
    await exec(`git clone --branch ${branch} --single-branch ${remoteUrl} .`, { cwd: this.gitWorkDir })
  }

  /** git add -A, commit, push */
  async push(message: string): Promise<void> {
    await runGit('add -A', this.gitWorkDir)
    // Only commit if there are staged changes
    try {
      await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`, this.gitWorkDir)
    } catch (err: unknown) {
      const msg = String(err)
      // "nothing to commit" is not a real error
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added to commit')) {
        throw err
      }
    }
    const branch = await this.getCurrentBranch()
    await runGit(`push origin ${branch}`, this.gitWorkDir)
  }

  /** git fetch + pull (merge, not rebase) */
  async pull(): Promise<void> {
    const branch = await this.getCurrentBranch()
    await runGit(`fetch origin ${branch}`, this.gitWorkDir)
    await runGit(`pull --no-rebase origin ${branch}`, this.gitWorkDir)
  }

  /** Read registry.json from the working tree */
  async getLocalRegistry(): Promise<Registry | null> {
    const registryPath = join(this.gitWorkDir, 'registry.json')
    try {
      const raw = await readFile(registryPath, 'utf-8')
      return JSON.parse(raw) as Registry
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  /** Read registry.json from the fetched remote ref (origin/<branch>:registry.json) */
  async getRemoteRegistry(): Promise<Registry | null> {
    const branch = await this.getCurrentBranch()
    try {
      const raw = await runGit(`show origin/${branch}:registry.json`, this.gitWorkDir)
      return JSON.parse(raw) as Registry
    } catch {
      // Remote doesn't have registry.json yet, or remote branch doesn't exist
      return null
    }
  }

  /** Pure diff — no git I/O */
  computeDiff(localRegistry: Registry, remoteRegistry: Registry): RegistryDiff {
    const localMap = new Map<string, RegistryEntry>()
    for (const entry of localRegistry.entries) {
      localMap.set(normalizeKey(entry.type, entry.name), entry)
    }

    const remoteMap = new Map<string, RegistryEntry>()
    for (const entry of remoteRegistry.entries) {
      remoteMap.set(normalizeKey(entry.type, entry.name), entry)
    }

    const added: RegistryEntry[] = []
    const removed: RegistryEntry[] = []
    const modified: Array<{ local: RegistryEntry; remote: RegistryEntry }> = []

    // added: in remote but not local
    for (const [key, remoteEntry] of remoteMap) {
      if (!localMap.has(key)) {
        added.push(remoteEntry)
      }
    }

    // removed: in local but not remote
    for (const [key, localEntry] of localMap) {
      if (!remoteMap.has(key)) {
        removed.push(localEntry)
      }
    }

    // modified: in both but checksum differs
    for (const [key, localEntry] of localMap) {
      const remoteEntry = remoteMap.get(key)
      if (remoteEntry && remoteEntry.checksum !== localEntry.checksum) {
        modified.push({ local: localEntry, remote: remoteEntry })
      }
    }

    return { added, removed, modified }
  }

  async getCurrentBranch(): Promise<string> {
    return runGit('rev-parse --abbrev-ref HEAD', this.gitWorkDir)
  }

  /** git fetch origin <branch> without merging */
  async fetch(): Promise<void> {
    const branch = await this.getCurrentBranch()
    await runGit(`fetch origin ${branch}`, this.gitWorkDir)
  }

  async getStatus(): Promise<{ modified: string[]; untracked: string[] }> {
    const output = await runGit('status --porcelain', this.gitWorkDir)
    const modified: string[] = []
    const untracked: string[] = []
    for (const line of output.split('\n').filter(Boolean)) {
      const statusCode = line.slice(0, 2)
      const filePath = line.slice(3)
      if (statusCode.trim() === '??' || statusCode === '??') {
        untracked.push(filePath)
      } else {
        modified.push(filePath)
      }
    }
    return { modified, untracked }
  }

  async stash(): Promise<void> {
    await runGit('stash', this.gitWorkDir)
  }

  async unstash(): Promise<void> {
    await runGit('stash pop', this.gitWorkDir)
  }

  /**
   * Read a PrismExportPackage from the git work dir (registry.json + overrides/ + knowledge/).
   * Returns null if registry.json is missing or invalid.
   */
  async getExportPackage(): Promise<PrismExportPackage | null> {
    const registryPath = join(this.gitWorkDir, 'registry.json')
    let registry: Registry
    try {
      const raw = await readFile(registryPath, 'utf-8')
      registry = JSON.parse(raw) as Registry
    } catch {
      return null
    }

    async function collectMd(dir: string, prefix: string): Promise<Record<string, string>> {
      const result: Record<string, string> = {}
      let entries: string[]
      try {
        entries = await readdir(dir)
      } catch {
        return result
      }
      for (const name of entries) {
        const fullPath = join(dir, name)
        if (name.endsWith('.md')) {
          try {
            const content = await readFile(fullPath, 'utf-8')
            const key = prefix ? `${prefix}/${name.replace(/\.md$/, '')}` : name.replace(/\.md$/, '')
            result[key] = content
          } catch {
            // skip
          }
        } else {
          // recurse into subdirectory
          const sub = await collectMd(fullPath, prefix ? `${prefix}/${name}` : name)
          Object.assign(result, sub)
        }
      }
      return result
    }

    const overrides = await collectMd(join(this.gitWorkDir, 'overrides'), '')
    const knowledge = await collectMd(join(this.gitWorkDir, 'knowledge'), '')

    return {
      version: '1',
      exportedAt: new Date().toISOString(),
      registry,
      overrides,
      knowledge,
    }
  }
}
