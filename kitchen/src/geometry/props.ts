/**
 * Validates and extracts { code, name } from a municipality geometry's properties,
 * replacing an unenforced type assertion with an actual check (review finding 4): throws
 * if the geometry has no properties object, no four-digit `code`, or no non-empty
 * `name`, naming the offending index so a malformed shapefile or a mapshaper
 * misconfiguration fails loudly at the point the geometry is first read, instead of
 * producing `undefined` codes that surface confusingly downstream.
 */
export function municipalityProps(
  g: { properties?: unknown },
  index: number,
): { code: string; name: string } {
  const props = g.properties
  if (props === null || typeof props !== 'object') {
    throw new Error(`municipality geometry at index ${index} has no properties object`)
  }
  const code = (props as Record<string, unknown>)['code']
  const name = (props as Record<string, unknown>)['name']
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) {
    throw new Error(
      `municipality geometry at index ${index} has an invalid code (expected a four-digit ` +
        `string, got ${JSON.stringify(code)})`,
    )
  }
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(
      `municipality geometry at index ${index} (code ${code}) has an invalid name ` +
        `(got ${JSON.stringify(name)})`,
    )
  }
  return { code, name }
}
