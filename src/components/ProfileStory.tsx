import type { Lookup } from '../data/select'
import { t } from '../i18n/strings'
import { storyFor } from '../profile/story'
import type { Lang } from '../state/url'

/**
 * The municipality in words, above the ten rows of figures.
 *
 * A paragraph each, not a bulleted list: these are sentences about one place, and three
 * bullets would suggest three headings of equal weight rather than a short piece of prose.
 *
 * It renders nothing at all when no rule fires. That cannot currently happen — the arc fires
 * for all 290 — but it is the right behaviour for a municipality with one published year, and
 * an empty heading with nothing under it is a worse page than no section.
 */
export function ProfileStory({
  lk,
  code,
  year,
  lang,
}: {
  lk: Lookup
  code: string
  year: number
  lang: Lang
}) {
  const sentences = storyFor(lk, code, year, lang)
  if (sentences.length === 0) return null

  return (
    <section className="story" aria-labelledby="story-heading">
      <h3 id="story-heading">{t(lang).storyHeading}</h3>
      {sentences.map((s) => (
        <p key={s.id}>{s.text[lang]}</p>
      ))}
    </section>
  )
}
