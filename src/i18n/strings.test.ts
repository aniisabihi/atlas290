import { describe, expect, it } from 'vitest'
import { LANGS } from '../state/url'
import { t, type Strings } from './strings'

const keys = Object.keys(t('sv')) as Array<keyof Strings>

describe('the string tables', () => {
  it('have exactly the same keys in both languages', () => {
    expect(Object.keys(t('en')).sort()).toEqual(Object.keys(t('sv')).sort())
  })

  it.each(LANGS)('has nothing blank in %s', (lang) => {
    for (const key of keys) {
      const value = t(lang)[key]
      const rendered = typeof value === 'function' ? (value as (...a: never[]) => string)() : value
      expect(rendered.length, `${lang}.${String(key)}`).toBeGreaterThan(0)
    }
  })

  it('actually translates, rather than copying Swedish into the English table', () => {
    // `coverage` is deliberately identical — "1968–2026" is the same in both languages — so it
    // is named here rather than allowed through by a loose rule that would also let a genuinely
    // untranslated string pass.
    const identicalOnPurpose = new Set<string>([
      'coverage',
      // 'Data' is the same word in Swedish and English, and inventing a difference to satisfy a
      // test would be worse copy than the honest repetition.
      'noticesData',
      // The project's name, and being identical in both languages is why it was chosen over the
      // four other candidates — docs/decisions/0006-the-name.md. A site that is equally Swedish
      // and English cannot have a name that reads as foreign in half of it.
      'siteName',
    ])
    const same = keys.filter((k) => {
      if (identicalOnPurpose.has(String(k))) return false
      const [a, b] = [t('sv')[k], t('en')[k]]
      return typeof a === 'string' && typeof b === 'string' && a === b
    })
    expect(same).toEqual([])
  })

  it('formats the parameterised strings differently per language', () => {
    expect(t('sv').notPublishedFor('Medelålder', 1998, 2025)).toContain('publiceras för')
    expect(t('en').notPublishedFor('Mean age', 1998, 2025)).toContain('is published for')
    expect(t('sv').rank(3, 287)).toBe('plats 3 av 287')
    expect(t('en').rank(3, 287)).toBe('rank 3 of 287')
  })
})
