export interface ParsedSkill {
  trigger?: string
  category?: string
  arguments?: string[]
  description?: string
  content: string
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)^---\r?\n?([\s\S]*)$/m

export function parseSkillFile(raw: string): ParsedSkill {
  const match = FRONT_MATTER_RE.exec(raw)
  if (!match) {
    return { content: raw }
  }
  const [, yamlBlock, body] = match
  const meta = parseYamlBlock(yamlBlock)
  return {
    trigger: typeof meta.trigger === 'string' ? meta.trigger : undefined,
    category: typeof meta.category === 'string' ? meta.category : undefined,
    description: typeof meta.description === 'string' ? meta.description : undefined,
    arguments: Array.isArray(meta.arguments)
      ? (meta.arguments as unknown[]).filter((a): a is string => typeof a === 'string')
      : undefined,
    content: body,
  }
}

function parseYamlBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = block.split(/\r?\n/)
  let currentKey: string | null = null
  const listItems: string[] = []

  const flushList = () => {
    if (currentKey !== null && listItems.length > 0) {
      result[currentKey] = [...listItems]
      listItems.length = 0
    }
  }

  for (const line of lines) {
    const listItemMatch = /^\s+-\s+(.+)$/.exec(line)
    const keyValueMatch = /^(\w+):\s*(.*)$/.exec(line)
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
