import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'

// Minimal, comment-preserving TOML table editing.
//
// smol-toml is used for reading, but its stringify drops comments and
// reorders the file. To keep users' config.toml intact we only splice the
// text of the specific table(s) being changed.

const HEADER_RE = /^\s*\[\[?\s*(.+?)\s*\]\]?\s*(?:#.*)?$/

/** Split a TOML dotted key (`a."b.c".d`) into its segments. */
export function parseTomlKeyPath(raw: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < raw.length) {
        cur += raw[++i]
      } else if (ch === quote) {
        quote = null
      } else {
        cur += ch
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '.') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

function startsWith(path: string[], prefix: string[]): boolean {
  return prefix.length <= path.length && prefix.every((seg, i) => path[i] === seg)
}

export function readToml(text: string): Record<string, unknown> {
  return text.trim() === '' ? {} : (parseToml(text) as Record<string, unknown>)
}

/**
 * Replace (or remove, when `value` is undefined) the table at `path` and all
 * of its sub-tables. The new table is written where the old one was, or
 * appended at the end of the file.
 */
export function replaceTomlTable(
  text: string,
  path: string[],
  value: Record<string, unknown> | undefined,
): string {
  const lines = text.split('\n')
  const kept: string[] = []
  let insertAt = -1
  let skipping = false

  for (const line of lines) {
    const m = HEADER_RE.exec(line)
    if (m) {
      skipping = startsWith(parseTomlKeyPath(m[1]), path)
      if (skipping && insertAt === -1) insertAt = kept.length
    }
    if (!skipping) kept.push(line)
  }

  if (value !== undefined) {
    // Build `{ a: { b: value } }` so stringify emits `[a.b]` headers.
    let wrapped: Record<string, unknown> = value
    for (let i = path.length - 1; i >= 0; i--) wrapped = { [path[i]]: wrapped }
    // smol-toml emits empty parent headers (e.g. `[mcp_servers]`); drop those
    // that only contain sub-tables so we don't duplicate existing parents.
    const block = stringifyToml(wrapped)
      .split('\n')
      .filter((l, i, arr) => {
        const m = HEADER_RE.exec(l)
        if (!m) return true
        const p = parseTomlKeyPath(m[1])
        if (p.length >= path.length) return true
        const next = arr.slice(i + 1).find(x => x.trim() !== '')
        return next !== undefined && !HEADER_RE.test(next)
      })
      .join('\n')
      .trim()

    if (insertAt === -1) {
      while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop()
      kept.push('', block, '')
    } else {
      kept.splice(insertAt, 0, block, '')
    }
  }

  const result = kept.join('\n').replace(/\n{3,}/g, '\n\n')
  // Validate — never write a file we can't parse back.
  readToml(result)
  return result
}

/** Read the table at `path` from a parsed TOML document. */
export function getTomlTable(doc: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined {
  let cur: unknown = doc
  for (const seg of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur && typeof cur === 'object' ? (cur as Record<string, unknown>) : undefined
}
