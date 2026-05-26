import { test, expect, describe } from 'bun:test'
import { extractCompanionTokens } from '../../src/utils/mdm-tokens'

describe('extractCompanionTokens', () => {
  test('returns empty array when MDM has no dialogue', () => {
    const out = extractCompanionTokens({}, ['ฉัน', 'คุณ'])
    expect(out).toEqual([])
  })

  test('extracts tokens from dialogue.intro and dialogue.self_monologue', () => {
    const mdm = {
      dialogue: {
        intro: [{ lang: { th: 'เงียบ ลึก' } }],
        self_monologue: [{ lang: { th: 'ภายใน บางที' } }],
      },
    }
    const out = extractCompanionTokens(mdm, [])
    expect(out).toContain('เงียบ')
    expect(out).toContain('ลึก')
    expect(out).toContain('ภายใน')
    expect(out).toContain('บางที')
  })

  test('filters out tokens that appear in base vocabulary (set difference)', () => {
    const mdm = {
      dialogue: {
        intro: [{ lang: { th: 'ฉัน เงียบ' } }],
      },
    }
    const out = extractCompanionTokens(mdm, ['ฉัน', 'คุณ'])
    expect(out).not.toContain('ฉัน')
    expect(out).toContain('เงียบ')
  })

  test('dedupes tokens', () => {
    const mdm = {
      dialogue: {
        intro: [
          { lang: { th: 'เงียบ ลึก' } },
          { lang: { th: 'เงียบ ภายใน' } },
        ],
      },
    }
    const out = extractCompanionTokens(mdm, [])
    const silentCount = out.filter(t => t === 'เงียบ').length
    expect(silentCount).toBe(1)
  })

  test('handles both th and en lang fields', () => {
    const mdm = {
      dialogue: {
        intro: [
          { lang: { th: 'เงียบ', en: 'silence' } },
          { lang: { en: 'deeper' } },
        ],
      },
    }
    const out = extractCompanionTokens(mdm, [])
    expect(out).toContain('เงียบ')
    expect(out).toContain('silence')
    expect(out).toContain('deeper')
  })

  test('ignores entries with no lang field gracefully', () => {
    const mdm = {
      dialogue: {
        intro: [
          { lang: { th: 'เงียบ' } },
          { emotion: 'shy' },  // no lang
          null,
          { lang: null },
        ],
      },
    }
    const out = extractCompanionTokens(mdm, [])
    expect(out).toContain('เงียบ')
    expect(out.length).toBeGreaterThan(0)
  })

  test('exercises real companion-th.mdm — produces non-empty set after BASE_VOCABULARY filter', async () => {
    // The default companion.mdm is now the minimal English seed (~26 lines)
    // with near-zero authored tokens — that's the showcase. We exercise the
    // extractor against the preserved Thai bilingual variant (companion-th.mdm)
    // which still carries authored vocabulary, so this test continues to
    // guard the extraction pipeline against regressions.
    const { BASE_VOCABULARY } = await import('../../src/vocabulary/base-vocabulary')
    const companionMDM = (await import('../../entities/companion-th.mdm', { with: { type: 'json' } })).default
    const out = extractCompanionTokens(companionMDM, BASE_VOCABULARY)
    process.stderr.write(`[mdm-tokens] companion-specific count: ${out.length}\n`)
    process.stderr.write(`[mdm-tokens] sample: ${JSON.stringify(out.slice(0, 10))}\n`)
    expect(out.length).toBeGreaterThan(5)
    // Companion-specific words that should survive the base-vocab filter
    // (these don't appear in BASE_VOCABULARY's ~200 generic kid words):
    const expectedSurvivors = ['เงียบ', 'ลึก', 'ภายใน', 'เรียนรู้']
    const surviving = expectedSurvivors.filter(t => out.includes(t))
    expect(surviving.length).toBeGreaterThanOrEqual(1)
  })
})
