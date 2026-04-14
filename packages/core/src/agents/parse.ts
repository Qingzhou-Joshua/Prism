export interface ParsedAgent {
  name: string
  description?: string
  tools?: string[]
  model?: string
  content: string
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)^---\r?\n?([\s\S]*)$/m

export function parseAgentFile(raw: string, fileName?: string): ParsedAgent {
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

  const tools = Array.isArray(meta.tools)
    ? (meta.tools as unknown[]).filter((t): t is string => typeof t === 'string')
    : undefined

  return {
    name: typeof meta.name === 'string' ? meta.name : deriveNameFromFileName(fileName),
    description: typeof meta.description === 'string' ? meta.description : undefined,
    tools: tools && tools.length > 0 ? tools : undefined,
    model: typeof meta.model === 'string' ? meta.model : undefined,
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
    // Always clear listItems to prevent bleed-over to the next key
    listItems.length = 0
  }

  for (const line of lines) {
    const listItemMatch = /^\s+-\s+(.+)$/.exec(line)
    // Support kebab-case keys (e.g. my-key)
    const keyValueMatch = /^([\w-]+):\s*(.*)$/.exec(line)

    if (listItemMatch) {
      listItems.push(listItemMatch[1].trim())
    } else if (keyValueMatch) {
      flushList()
      currentKey = keyValueMatch[1]
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
