import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The decision log's own integrity, checked by the build.
 *
 * Issue #37: two records both numbered 0018 reached `main`, because two sessions running in
 * parallel each read `docs/decisions/` when 0017 was the highest number and both merged. Nothing
 * caught it — `haus decisions check` asks whether a decision-worthy diff CARRIES an ADR, not
 * whether the ADRs are distinct — and the collision makes "Supersedes ADR-NNNN" ambiguous, which
 * is the one sentence the whole write-once scheme depends on.
 *
 * This project runs parallel sessions routinely, so the collision was not bad luck and will
 * happen again. A test is the cheapest thing that turns it from something nobody notices into
 * something the build says out loud, before the second record merges.
 */
const DIR = join(import.meta.dirname, '..', 'docs', 'decisions')

const records = readdirSync(DIR)
  .filter((name) => /^\d{4}-.+\.md$/.test(name))
  .sort()

describe('the decision log', () => {
  it('has records to check, so a broken glob cannot make this pass by finding nothing', () => {
    expect(records.length).toBeGreaterThan(15)
  })

  it('gives every record a number no other record has', () => {
    const byNumber = new Map<string, string[]>()
    for (const name of records) {
      const number = name.slice(0, 4)
      byNumber.set(number, [...(byNumber.get(number) ?? []), name])
    }
    const collisions = [...byNumber.entries()].filter(([, names]) => names.length > 1)
    expect(
      collisions.map(([number, names]) => `${number}: ${names.join(' and ')}`),
      'two records cannot share a number — "Supersedes ADR-NNNN" would not say which',
    ).toEqual([])
  })

  it('numbers each record inside itself the same way its filename does', () => {
    // A renumbered file whose heading still claims the old number is worse than the collision
    // it was renumbered to fix: every reference would then be right in one place and wrong in
    // the other.
    //
    // Two heading styles are accepted because both are in the log and both are write-once:
    // 0001-0012 wrote `# 0001 — Title` and 0013 onward write `# ADR-0013: Title`. Rewriting
    // twelve historical headings to satisfy a test would be the test dictating to the record.
    for (const name of records) {
      const first = readFileSync(join(DIR, name), 'utf8').split('\n')[0] ?? ''
      expect(first, name).toMatch(new RegExp(`^# (ADR-)?${name.slice(0, 4)}\\b`))
    }
  })

  it('lists every record in the README, and lists nothing that does not exist', () => {
    const readme = readFileSync(join(DIR, 'README.md'), 'utf8')
    const linked = [...readme.matchAll(/\((\d{4}-[a-z0-9-]+\.md)\)/g)].map((m) => m[1]!)
    expect([...new Set(linked)].sort()).toEqual(records)
  })
})
