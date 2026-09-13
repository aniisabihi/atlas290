import { describe, expect, it } from 'vitest'
import { countyOf, existed, municipalitiesFromMetadata, SPLIT_PARENT } from './municipalities'

function meta(lang: 'sv' | 'en', names: Record<string, string>) {
  return {
    kind: 'metadata' as const,
    table: 'TAB638',
    lang,
    url: '',
    fetchedAt: '2026-09-13T00:00:00.000Z',
    response: {
      id: ['Region', 'Tid'],
      dimension: {
        Region: {
          label: 'region',
          category: {
            index: Object.fromEntries(Object.keys(names).map((k, i) => [k, i])),
            label: names,
          },
        },
        Tid: { label: 'år', category: { index: ['2024'] } },
      },
    },
  }
}

describe('municipality registry', () => {
  it('knows when split-off municipalities came into existence', () => {
    // Ruling R15: CREATED is the first year the municipality appears in SCB's data,
    // which is one year before the formal creation date because SCB reports a
    // year-Y figure using the administrative division as of 1 January of year Y+1.
    // Knivsta's formal creation date is 2003-01-01, so it first appears in 2002.
    expect(existed('0330', 2001)).toBe(false)
    expect(existed('0330', 2002)).toBe(true)
    expect(existed('0180', 1968)).toBe(true)
    expect(SPLIT_PARENT['0330']).toBe('0380')
  })

  it('derives the county from the first two digits', () => {
    expect(countyOf('0180')).toBe('01')
    expect(countyOf('2584')).toBe('25')
  })

  it('builds bilingual municipalities from sv and en metadata, dropping riket and counties', () => {
    const sv = meta('sv', {
      '00': 'Riket',
      '01': 'Stockholms län',
      '0180': 'Stockholm',
      '0114': 'Upplands Väsby',
    })
    const en = meta('en', {
      '00': 'Sweden',
      '01': 'Stockholm county',
      '0180': 'Stockholm',
      '0114': 'Upplands Väsby',
    })
    expect(municipalitiesFromMetadata(sv, en)).toEqual([
      { code: '0114', name: { sv: 'Upplands Väsby', en: 'Upplands Väsby' }, county: '01' },
      { code: '0180', name: { sv: 'Stockholm', en: 'Stockholm' }, county: '01' },
    ])
  })
})
