import type { Lookup } from '../data/select'
import { t } from '../i18n/strings'
import type { Lang } from '../state/url'

/**
 * Radios in a fieldset, not a select.
 *
 * Ten options where switching is the main thing a visitor does, and a radio group announces
 * "3 of 10" as you move through it while a collapsed select announces nothing until it is opened.
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
  return (
    <fieldset className="indicator-picker">
      <legend>{strings.indicatorLegend}</legend>
      {lk.data.indicators.map((indicator) => (
        <label key={indicator.id}>
          <input
            type="radio"
            name="indicator"
            value={indicator.id}
            checked={indicator.id === selected}
            onChange={() => onChange(indicator.id)}
          />
          {indicator.name[lang]}
        </label>
      ))}
    </fieldset>
  )
}
