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
