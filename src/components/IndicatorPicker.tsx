import { useId } from 'react'
import type { Lookup } from '../data/select'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * A native select, labelled with the same word the legend used to carry.
 *
 * This was a fieldset of ten radios until 2026-09-15, on the argument that a radio group
 * announces "3 of 10" as you move through it while a collapsed select says nothing until it is
 * opened. That is still true, and the trade was made deliberately: ten radios took four wrapped
 * rows above the map, and the space matters more on the narrow screens where the map is already
 * fighting for height.
 *
 * `<select>` rather than a custom listbox, so the platform's own control does the work — it is
 * keyboard-operable, screen-reader-announced and touch-friendly on every device without a line
 * of code here, and on a phone it opens the system picker rather than a list that has to be
 * scrolled inside a page that also scrolls.
 */
export function IndicatorPicker({
  lk,
  selected,
  lang,
  onChange,
}: {
  lk: Lookup
  selected: string
  lang: Lang
  onChange: (indicatorId: string) => void
}) {
  const strings = t(lang)
  // Generated rather than a literal: nothing here knows it is the only picker on the page, and
  // a duplicated id would silently point the label at whichever one rendered first.
  const id = useId()
  return (
    <div className="panel indicator-picker">
      <label htmlFor={id}>{strings.indicatorLegend}</label>
      <select id={id} value={selected} onChange={(event) => onChange(event.target.value)}>
        {lk.data.indicators.map((indicator) => (
          <option key={indicator.id} value={indicator.id}>
            {indicator.name[lang]}
          </option>
        ))}
      </select>
    </div>
  )
}
