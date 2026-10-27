import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { applyEdits, modify, parse as parseJsonc, type ParseError } from 'jsonc-parser'

// Read/modify/write helpers for native IDE config files. Writes only touch the
// targeted key path; every other field (and, for JSONC, comments) is kept.

export async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Atomic write: write a sibling temp file then rename over the target. */
export async function writeTextAtomic(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.prism-tmp-${process.pid}`
  await writeFile(tmp, text, 'utf-8')
  await rename(tmp, path)
}

export function parseJsonLoose(text: string, path: string): Record<string, unknown> {
  if (text.trim() === '') return {}
  const errors: ParseError[] = []
  const value = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false })
  if (errors.length > 0 || !value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} is not a valid JSON object`)
  }
  return value as Record<string, unknown>
}

export async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const text = await readTextOrNull(path)
  return text === null ? {} : parseJsonLoose(text, path)
}

/**
 * Set (or delete, when value is undefined) `keyPath` in a JSON/JSONC file.
 * Uses jsonc-parser edits so comments and formatting survive.
 */
export async function setJsonPath(path: string, keyPath: (string | number)[], value: unknown): Promise<void> {
  const text = (await readTextOrNull(path)) ?? '{}\n'
  parseJsonLoose(text, path) // refuse to edit a corrupted file
  const edits = modify(text, keyPath, value, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
  })
  await writeTextAtomic(path, applyEdits(text, edits))
}
