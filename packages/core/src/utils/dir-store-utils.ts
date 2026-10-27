import { createHash } from 'node:crypto'

/**
 * Derive a stable 8-character ID from a file name.
 * The same file name always produces the same ID.
 */
export function fileNameToId(fileName: string): string {
  return createHash('sha1').update(fileName).digest('hex').slice(0, 8)
}

/**
 * Extract createdAt / updatedAt from the front-matter block of a raw .md file.
 * These fields are written by the dir-stores but are not exposed by the
 * individual parseXxxFile helpers.
 */
export function extractMetaTimes(
  raw: string,
  fallback: string,
): { createdAt: string; updatedAt: string } {
  const match = /^---\r?\n([\s\S]*?)^---\r?\n?/m.exec(raw)
  if (!match) return { createdAt: fallback, updatedAt: fallback }
  const createdAt = /^createdAt:\s*(.+)$/m.exec(match[1])?.[1].trim() ?? fallback
  const updatedAt = /^updatedAt:\s*(.+)$/m.exec(match[1])?.[1].trim() ?? fallback
  return { createdAt, updatedAt }
}

/**
 * Extract a scalar field from the front-matter block of a raw .md file.
 * Returns undefined if the field is not present.
 */
export function extractFrontMatterField(raw: string, field: string): string | undefined {
  const match = /^---\r?\n([\s\S]*?)^---\r?\n?/m.exec(raw)
  if (!match) return undefined
  const fieldMatch = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(match[1])
  return fieldMatch?.[1].trim()
}

// ── Front-matter merge ──────────────────────────────────────────────────────
//
// IDE asset files carry front-matter fields Prism doesn't model (Cursor
// `globs`/`alwaysApply`, Claude skill `allowed-tools`, …). When rewriting a
// file we only replace the keys Prism manages and keep every other line of
// the original block verbatim.

/** A managed key's new value. `{ raw }` is pre-rendered YAML lines (after `key:`). */
export type FrontMatterValue = string | string[] | { raw: string[] } | undefined

interface FmEntry {
  key: string | null
  lines: string[]
}

const FM_BLOCK_RE = /^---\r?\n([\s\S]*?)^---\r?\n?/m

function splitFrontMatter(raw: string | null): FmEntry[] {
  if (!raw || !(raw.startsWith('---\n') || raw.startsWith('---\r\n'))) return []
  const m = FM_BLOCK_RE.exec(raw)
  if (!m) return []
  const entries: FmEntry[] = []
  for (const line of m[1].split(/\r?\n/)) {
    if (line === '' && entries.length === 0) continue
    const keyMatch = /^([\w-]+):(\s|$)/.exec(line)
    if (keyMatch) {
      entries.push({ key: keyMatch[1], lines: [line] })
    } else if (entries.length > 0 && (/^\s/.test(line) || line === '')) {
      entries[entries.length - 1].lines.push(line)
    } else {
      entries.push({ key: null, lines: [line] })
    }
  }
  // Drop trailing blank lines
  const last = entries[entries.length - 1]
  while (last && last.lines.length > 1 && last.lines[last.lines.length - 1] === '') last.lines.pop()
  return entries
}

function unquote(v: string): string {
  const t = v.trim()
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1)
  }
  return t
}

function yamlScalar(v: string): string {
  return /^[\s[\]{}&*!|>'"%@`#,?:-]|:\s|\s#|\n|\s$/.test(v) || v === '' ? JSON.stringify(v) : v
}

function renderEntry(key: string, value: Exclude<FrontMatterValue, undefined>): string[] {
  if (typeof value === 'string') return [`${key}: ${yamlScalar(value)}`]
  if (Array.isArray(value)) return [`${key}:`, ...value.map(v => `  - ${yamlScalar(v)}`)]
  return [`${key}:`, ...value.raw]
}

function sameAsOriginal(entry: FmEntry, value: Exclude<FrontMatterValue, undefined>): boolean {
  const first = entry.lines[0].slice(entry.key!.length + 1).trim()
  if (typeof value === 'string') return decodeFrontMatterScalar(entry.lines) === value || (entry.lines.length === 1 && first === value)
  if (Array.isArray(value)) {
    if (first.startsWith('[')) {
      const inline = first.replace(/^\[|\]$/g, '').split(',').map(s => unquote(s)).filter(Boolean)
      return inline.length === value.length && inline.every((v, i) => v === value[i])
    }
    const items = entry.lines.slice(1).map(l => /^\s+-\s+(.*)$/.exec(l)?.[1]).filter((x): x is string => x !== undefined).map(unquote)
    return first === '' && items.length === value.length && items.every((v, i) => v === value[i])
  }
  return false
}

/**
 * Render `---\n<front matter>\n---\n<body>`, merging `managed` keys into the
 * front matter of `original` (the file's current raw content, if any).
 * Keys whose value is undefined or an empty array are removed.
 *
 * `prismOnly` keys (Prism bookkeeping like createdAt/scope) are only added to
 * files Prism creates; existing native files get them only if already present.
 */
export function renderWithFrontMatter(
  original: string | null,
  managed: [string, FrontMatterValue][],
  body: string,
  prismOnly: string[] = [],
): string {
  const entries = splitFrontMatter(original)
  const managedMap = new Map(managed)
  const emitted = new Set<string>()
  const out: string[] = []

  const isEmpty = (v: FrontMatterValue) => v === undefined || (Array.isArray(v) && v.length === 0)

  for (const entry of entries) {
    if (entry.key === null || !managedMap.has(entry.key)) {
      out.push(...entry.lines)
      continue
    }
    const value = managedMap.get(entry.key)
    emitted.add(entry.key)
    if (isEmpty(value)) continue
    out.push(...(sameAsOriginal(entry, value!) ? entry.lines : renderEntry(entry.key, value!)))
  }
  for (const [key, value] of managed) {
    if (emitted.has(key) || isEmpty(value)) continue
    if (original !== null && prismOnly.includes(key)) continue
    out.push(...renderEntry(key, value!))
  }
  if (out.length === 0 && entries.length === 0) return body
  return ['---', ...out, '---', body].join('\n')
}


// ── Front-matter scalar decoding ────────────────────────────────────────────
//
// Native skill/agent files often use quoted or block-scalar descriptions
// (`description: "a: b"`, `description: >-` + indented lines). Decode those to
// the plain string the user sees.

function unescapeDoubleQuoted(v: string): string {
  try {
    return JSON.parse(`"${v.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"').replace(/\t/g, '\\t')}"`) as string
  } catch {
    return v
  }
}

/**
 * Decode one top-level YAML entry (its first line `key: ...` plus any
 * continuation lines) into a string. Returns undefined for lists/maps.
 */
export function decodeFrontMatterScalar(lines: string[]): string | undefined {
  const first = /^[\w-]+:\s*(.*)$/.exec(lines[0])
  if (!first) return undefined
  const head = first[1].replace(/\s+#.*$/, '').trim()
  const rest = lines.slice(1)

  // Block scalar: | or > with optional chomping/indent indicators
  const block = /^([|>])([+-]?)\d*$/.exec(head)
  if (block) {
    const body = rest.filter((l, i, arr) => l.trim() !== '' || arr.slice(i).some(x => x.trim() !== ''))
    const indent = Math.min(...body.filter(l => l.trim() !== '').map(l => l.length - l.trimStart().length))
    const stripped = body.map(l => l.slice(Number.isFinite(indent) ? indent : 0))
    let text = block[1] === '|'
      ? stripped.join('\n')
      : stripped.reduce((acc, l) => (l === '' ? acc + '\n' : acc === '' || acc.endsWith('\n') ? acc + l : acc + ' ' + l), '')
    if (block[2] !== '+') text = text.replace(/\n+$/, '')
    return text
  }

  const joined = [head, ...rest.map(l => l.trim())].filter(Boolean).join(' ')
  if (joined === '') return rest.some(l => /^\s+-\s/.test(l)) ? undefined : ''
  if (rest.some(l => /^\s+-\s/.test(l)) && head === '') return undefined
  if (joined.startsWith('"') && joined.endsWith('"') && joined.length >= 2) return unescapeDoubleQuoted(joined.slice(1, -1))
  if (joined.startsWith("'") && joined.endsWith("'") && joined.length >= 2) return joined.slice(1, -1).replace(/''/g, "'")
  return joined
}

/** Read a top-level string field from a raw file's front matter (decoded). */
export function frontMatterString(raw: string, field: string): string | undefined {
  const entry = splitFrontMatter(raw).find(e => e.key === field)
  return entry ? decodeFrontMatterScalar(entry.lines) : undefined
}

/** Read a file's raw content, or null if missing. */
export async function readRawOrNull(path: string | undefined): Promise<string | null> {
  if (!path) return null
  const { readFile } = await import('node:fs/promises')
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}
