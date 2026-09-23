import { t } from '../i18n/strings'
import type { Lang } from '../state/url'
import { SHIPPED_PACKAGES } from '../notices/packages'

/**
 * Sources and licences, on the page rather than only in the repository.
 *
 * SCB's terms are quoted rather than paraphrased where they bind: they ask that you do **not**
 * cite them as the source for figures you derived yourself, and that you do not present a service
 * as an official cooperation with them. Both are already honoured by the pantry's provenance
 * manifest, which labels every raw value as SCB's and every derived one as this project's
 * calculation; this says so where a visitor can read it.
 */
const REPOSITORY = 'https://github.com/aniisabihi/atlas290'

const TEXT = {
  sv: {
    data: 'All statistik kommer från SCB:s öppna statistikdatabas och är licensierad CC0 1.0 Universal. SCB kräver ingen källhänvisning. SCB anger också att du inte ska ange SCB som källa för siffror du själv har bearbetat — därför märks varje härledd siffra här som projektets egen beräkning, tillsammans med den SCB-tabell den bygger på. Den här webbplatsen är inte ett samarbete med SCB och framställs inte som ett sådant.',
    boundaries:
      'Kommungränserna kommer från SCB:s egen CC0-fil med förenklade gränser. SCB påpekar att filerna innehåller enkla kommun- och länsgränser anpassade för tematisering av statistik, och att gränserna inte är lämpliga för analyser. De används här enbart för att rita kartan.',
    libraries: 'Webbplatsen levererar dessa bibliotek till din webbläsare:',
    fonts:
      'Typsnitten levereras från den här webbplatsen, inte från någon typsnittstjänst — inga förfrågningar går till tredje part. Newsreader och IBM Plex är båda licensierade under SIL Open Font License 1.1, och licenstexterna ligger bredvid filerna under /fonts/. Filerna innehåller bara de tecken som faktiskt kan visas här.',
    code: 'Koden är MIT-licensierad. Datafilerna under public/pantry är CC0.',
  },
  en: {
    data: 'All statistics come from Statistics Sweden’s open statistical database and are licensed CC0 1.0 Universal. Statistics Sweden requires no attribution. They also ask that you do not cite them as the source for figures you have processed yourself — so every derived figure here is labelled as this project’s own calculation, naming the table it was built from. This site is not a collaboration with Statistics Sweden and is not presented as one.',
    boundaries:
      'Municipal boundaries come from Statistics Sweden’s own CC0 file of simplified borders. They note that the files contain simple municipal and county boundaries adapted for thematic mapping, and that the boundaries are not suitable for analysis. They are used here only to draw the map.',
    libraries: 'The site delivers these libraries to your browser:',
    fonts:
      'The typefaces are served from this site, not from a font service — no request goes to a third party. Newsreader and IBM Plex are both licensed under the SIL Open Font License 1.1, and the licence texts sit beside the files under /fonts/. The files are subset to the characters this site can actually render.',
    code: 'The code is MIT licensed. The data files under public/pantry are CC0.',
  },
} as const

export function Notices({ lang }: { lang: Lang }) {
  const strings = t(lang)
  const text = TEXT[lang]
  return (
    <footer className="notices">
      <details>
        <summary>
          <h2>{strings.noticesHeading}</h2>
        </summary>

        <h3>{strings.noticesData}</h3>
        <p>{text.data}</p>

        <h3>{strings.noticesBoundaries}</h3>
        <p>{text.boundaries}</p>

        <h3>{strings.noticesLibraries}</h3>
        <p>{text.libraries}</p>
        <ul>
          {SHIPPED_PACKAGES.map(({ name, licence }) => (
            <li key={name}>
              {name} — {licence}
            </li>
          ))}
        </ul>

        <h3>{strings.noticesFonts}</h3>
        <p>{text.fonts}</p>

        <h3>{strings.noticesCode}</h3>
        <p>
          {text.code} <a href={REPOSITORY}>{REPOSITORY}</a>
        </p>
      </details>
    </footer>
  )
}
