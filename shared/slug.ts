/**
 * The path grammar for a municipality page: `stockholm-0180`.
 *
 * Shared between the kitchen-side tools that write the 580 pages and the site that reads them
 * back, so the two cannot disagree about what a URL means. Like `shared/geometry.ts`, this may
 * import nothing at all — it has to run in a browser and in a build script.
 *
 * **The code is the identifier and the slug is decoration.** `parseSegment` reads only the four
 * digits at the end and never checks the words in front of them, which buys two things: a
 * municipality SCB renames keeps every link anyone has already shared, and a hand-edited slug
 * cannot quietly resolve to a different place than the one it names.
 *
 * **Why the code is there at all.** Transliterating å to a makes Håbo (Uppsala county) and Habo
 * (Jönköping county) the same word. They are two real, separate municipalities, and without the
 * code one of them would silently get the other's page. Appending it to every path rather than
 * only to the pair that collides means no future rename can turn a unique slug into a colliding
 * one and change a URL that already exists.
 */

/**
 * Swedish letters, spelled the way Swedish spells them when it has to use ASCII: å and ä become
 * a, ö becomes o. Not the German ae/oe — that is a different language's convention and would
 * read as a misspelling here.
 *
 * é appears in Gällivare's neighbours and a few other names; the combining-mark strip below
 * would handle it anyway, and it is listed for the same reason the others are: so the mapping is
 * something to read rather than something to work out.
 */
const LETTERS: Record<string, string> = {
  å: 'a',
  ä: 'a',
  ö: 'o',
  é: 'e',
  ü: 'u',
  è: 'e',
}

/** The words part of a path segment, with no code on it. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[åäöéüè]/g, (c) => LETTERS[c] ?? c)
      // Anything else with a diacritic decomposes and loses it. A name this does not cover
      // becomes hyphens rather than throwing: the code is what resolves the page.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

export const CODE_PATTERN = /^(\d{4})$/

/** The full segment: `stockholm-0180`. */
export function segmentFor(name: string, code: string): string {
  if (!CODE_PATTERN.test(code)) {
    throw new Error(`municipality code must be four digits, got '${code}'`)
  }
  const words = slugify(name)
  return words ? `${words}-${code}` : code
}

/**
 * The code a segment names, or null if it names none.
 *
 * Only the trailing four digits are read. `malmo-1280`, `goteborg-1280` and `1280` all resolve
 * to 1280 — the first because it is right, the second because the slug is not consulted, and the
 * third because a bare code is a legal shorthand worth accepting rather than 404ing.
 */
export function parseSegment(segment: string): string | null {
  const match = /(?:^|-)(\d{4})$/.exec(segment)
  return match?.[1] ?? null
}

/** The whole path, ready to put in an href. */
export function pathFor(lang: string, name: string, code: string): string {
  return `/${lang}/${segmentFor(name, code)}/`
}
