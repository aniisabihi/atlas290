import { NO_VALUE_FILLS } from '../map/colour'

/**
 * The four absence patterns, defined exactly once for the whole page.
 *
 * Both the map and the legend reference them by id, so they live in their own hidden SVG at the
 * top of the app rather than inside either one. Defining them twice would mean duplicate ids in
 * the document, and leaving them inside the map would make the legend's swatches depend on the
 * map having rendered first.
 */
/** Diagonal hatch, stipple, cross-hatch, horizontals and a plain ground: absence told apart
 * without colour. */
function Patterns() {
  const stroke = '#6b6b6b'
  return (
    <defs>
      <pattern
        id={NO_VALUE_FILLS['not-yet-published'].patternId}
        width={6}
        height={6}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={6} height={6} fill={NO_VALUE_FILLS['not-yet-published'].ground} />
        <line x1={0} y1={0} x2={0} y2={6} stroke={stroke} strokeWidth={1.2} />
      </pattern>
      <pattern
        id={NO_VALUE_FILLS['too-few-cases'].patternId}
        width={5}
        height={5}
        patternUnits="userSpaceOnUse"
      >
        <rect width={5} height={5} fill={NO_VALUE_FILLS['too-few-cases'].ground} />
        <circle cx={2.5} cy={2.5} r={1} fill={stroke} />
      </pattern>
      <pattern
        id={NO_VALUE_FILLS['structural-break'].patternId}
        width={7}
        height={7}
        patternUnits="userSpaceOnUse"
      >
        <rect width={7} height={7} fill={NO_VALUE_FILLS['structural-break'].ground} />
        <path d="M0,0 L7,7 M7,0 L0,7" stroke={stroke} strokeWidth={1} />
      </pattern>
      <pattern
        id={NO_VALUE_FILLS['nothing-to-count'].patternId}
        width={6}
        height={6}
        patternUnits="userSpaceOnUse"
      >
        <rect width={6} height={6} fill={NO_VALUE_FILLS['nothing-to-count'].ground} />
        <line x1={0} y1={3} x2={6} y2={3} stroke={stroke} strokeWidth={1.2} />
      </pattern>
      <pattern
        id={NO_VALUE_FILLS['did-not-exist'].patternId}
        width={8}
        height={8}
        patternUnits="userSpaceOnUse"
      >
        <rect width={8} height={8} fill={NO_VALUE_FILLS['did-not-exist'].ground} />
      </pattern>
    </defs>
  )
}

export function NoDataPatterns() {
  return (
    <svg width={0} height={0} aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <Patterns />
    </svg>
  )
}
