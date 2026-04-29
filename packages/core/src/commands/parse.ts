export interface ParsedCommand {
  name: string
  description?: string
  tags?: string[]
  targetPlatforms?: string[]
  content: string
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)^---\r?\n?([\s\S]*)$/m

export function parseCommandFile(raw: string, fileName?: string): ParsedCommand {
  // Only attempt front matter parsing when the file literally starts with ---
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return {
      name: deriveNameFromFileName(fileName),
      content: raw,
    }
  }

  const match = FRONT_MATTER_RE.exec(raw)
  if (!match) {
    return {
      name: deriveNameFromFileName(fileName),
      content: raw,
    }
  }

  const [, yamlBlock, body] = match
  const meta = parseYamlBlock(yamlBlock)

  const tags = Array.isArray(meta.tags)
    ? (meta.tags as unknown[]).filter((t): t is string => typeof t === 'string')
    : undefined

  const targetPlatforms = Array.isArray(meta.targetPlatforms)
    ? (meta.targetPlatforms as unknown[]).filter((t): t is string => typeof t === 'string')
    : undefined

  return {
    name: typeof meta.name === 'string' ? meta.name : deriveNameFromFileName(fileName),
    description: typeof meta.description === 'string' ? meta.description : undefined,
    tags: tags && tags.length > 0 ? tags : undefined,
    targetPlatforms: targetPlatforms && targetPlatforms.length > 0 ? targetPlatforms : undefined,
    // Strip leading newline that appears when content follows closing ---
    content: body.replace(/^\n/, ''),
  }
}

function deriveNameFromFileName(fileName?: string): string {
  if (!fileName) return ''
  const basename = fileName.split(/[\\/]/).pop() ?? ''
  return basename.replace(/\.md$/i, '')
}

function parseYamlBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = block.split(/\r?\n/)
  let currentKey: string | null = null
  const listItems: string[] = []

  const flushList = () => {
    if (currentKey !== null && listItems.length > 0) {
      result[currentKey] = [...listItems]
    }
    listItems.length = 0
  }

  for (const line of lines) {
    const listItemMatch = /^\s+-\s+(.+)$/.exec(line)
    // Support kebab-case keys (e.g. target-platforms)
    const keyValueMatch = /^([\w-]+):\s*(.*)$/.exec(line)

    if (listItemMatch) {
      listItems.push(listItemMatch[1].trim())
    } else if (keyValueMatch) {
      flushList()
      // Normalise kebab-case keys to camelCase (e.g. target-platforms → targetPlatforms)
      const rawKey = keyValueMatch[1]
      currentKey = rawKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      const val = keyValueMatch[2].trim()
      if (val !== '') {
        result[currentKey] = val
        currentKey = null
      }
    }
  }

  flushList()
  return result
}
