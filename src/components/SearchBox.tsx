import { useId, useRef, useState } from 'react'
import type { Municipality } from '../../shared/pantry'
import { t } from '../i18n/strings'
import { searchMunicipalities } from '../search/match'
import type { Lang } from '../state/url'

/**
 * The ARIA 1.2 combobox pattern: the input keeps DOM focus at all times and the active option is
 * tracked with `aria-activedescendant`. Moving real focus into the list would take it away from
 * the text field, so every keystroke after the first arrow key would go somewhere unexpected.
 */
const MAX_RESULTS = 8

export function SearchBox({
  municipalities,
  lang,
  onSelect,
  label,
  placeholder,
}: {
  municipalities: readonly Municipality[]
  lang: Lang
  onSelect: (code: string) => void
  /** Overridden by the compare box, which searches the same list for a different reason. */
  label?: string
  placeholder?: string
}) {
  const strings = t(lang)
  const boxLabel = label ?? strings.searchLabel
  const boxPlaceholder = placeholder ?? strings.searchPlaceholder
  const listId = useId()
  const optionId = (index: number) => `${listId}-option-${index}`
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  const results = searchMunicipalities(query, municipalities, lang).slice(0, MAX_RESULTS)
  const expanded = open && results.length > 0

  const choose = (municipality: Municipality) => {
    onSelect(municipality.code)
    setQuery(municipality.name[lang])
    setOpen(false)
  }

  return (
    <div className="search">
      <label htmlFor={`${listId}-input`}>{boxLabel}</label>
      <input
        id={`${listId}-input`}
        ref={input}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder={boxPlaceholder}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(active) : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && results.length > 0) {
            event.preventDefault()
            setOpen(true)
            setActive((i) => (i + 1) % results.length)
            return
          }
          if (event.key === 'ArrowUp' && results.length > 0) {
            event.preventDefault()
            setOpen(true)
            setActive((i) => (i - 1 + results.length) % results.length)
            return
          }
          if (event.key === 'Enter') {
            const picked = results[active]
            if (picked) {
              event.preventDefault()
              choose(picked)
            }
            return
          }
          if (event.key === 'Escape') {
            // First Escape closes the list and keeps what was typed; a second clears it. Losing
            // a half-typed name to a stray keypress is worse than needing two presses.
            event.preventDefault()
            if (expanded) setOpen(false)
            else setQuery('')
          }
        }}
      />
      {/*
       * Always spoken, shown only when there is nothing else to see. With results the list is
       * the answer and the count sat half-hidden behind it, under the label and across the bar's
       * rule; with none, it is the only thing saying the search worked.
       */}
      <div
        role="status"
        className={
          query.trim() !== '' && results.length === 0
            ? 'search-count search-count--shown'
            : 'search-count'
        }
      >
        {query.trim() === ''
          ? ''
          : results.length === 0
            ? strings.searchNoResults
            : results.length === 1
              ? strings.searchOne
              : strings.searchResults(results.length)}
      </div>
      <ul id={listId} role="listbox" aria-label={boxLabel} hidden={!expanded}>
        {results.map((municipality, index) => (
          <li
            key={municipality.code}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Pointer down rather than click: a click fires after the input has already lost
            // focus and closed the list out from under the pointer.
            onMouseDown={(event) => {
              event.preventDefault()
              choose(municipality)
            }}
          >
            {municipality.name[lang]}
          </li>
        ))}
      </ul>
    </div>
  )
}
