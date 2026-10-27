import { describe, it, expect } from 'vitest'
import { frontMatterString, renderWithFrontMatter } from './dir-store-utils.js'

const fm = (body: string) => `---\n${body}\n---\ncontent`

describe('frontMatterString', () => {
  it('decodes plain, double- and single-quoted scalars', () => {
    expect(frontMatterString(fm('description: plain text'), 'description')).toBe('plain text')
    expect(frontMatterString(fm('description: "Django: migrations, \\"lint\\""'), 'description')).toBe('Django: migrations, "lint"')
    expect(frontMatterString(fm("description: 'it''s fine'"), 'description')).toBe("it's fine")
  })

  it('decodes folded and literal block scalars', () => {
    expect(frontMatterString(fm('description: >-\n  line one\n  line two\nname: x'), 'description')).toBe('line one line two')
    expect(frontMatterString(fm('description: |\n  a\n  b\nname: x'), 'description')).toBe('a\nb')
  })

  it('joins plain multi-line continuation and ignores lists', () => {
    expect(frontMatterString(fm('description: first\n  second'), 'description')).toBe('first second')
    expect(frontMatterString(fm('tools:\n  - Read'), 'tools')).toBeUndefined()
  })
})

describe('renderWithFrontMatter — unchanged decoded values keep their original form', () => {
  it('does not rewrite a block-scalar description that was not edited', () => {
    const original = fm('name: s\ndescription: >-\n  long\n  text\nlicense: MIT')
    const out = renderWithFrontMatter(original, [['name', 's'], ['description', 'long text']], 'content')
    expect(out).toBe(original)
  })
})
