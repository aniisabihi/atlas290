export interface JsonStat2 {
  id: string[]
  size: number[]
  dimension: Record<
    string,
    { category: { index: Record<string, number> | string[]; label?: Record<string, string> } }
  >
  value: Array<number | null>
}

export type Row = { dims: Record<string, string>; value: number | null }

export function isJsonStat2(x: unknown): x is JsonStat2 {
  const o = x as Partial<JsonStat2> | null
  return (
    !!o &&
    Array.isArray(o.id) &&
    Array.isArray(o.size) &&
    typeof o.dimension === 'object' &&
    o.dimension !== null &&
    Array.isArray(o.value)
  )
}

function codesOf(ds: JsonStat2, dim: string): string[] {
  const index = ds.dimension[dim]?.category.index
  if (!index) throw new Error(`dimension ${dim} missing from dataset`)
  if (Array.isArray(index)) return index
  return Object.entries(index)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code)
}

/** JSON-stat2 stores values flat, last dimension varying fastest. */
export function toRows(ds: JsonStat2): Row[] {
  const expected = ds.size.reduce((n, s) => n * s, 1)
  if (ds.value.length !== expected) {
    throw new Error(`value length ${ds.value.length} does not match size product ${expected}`)
  }
  const codes = ds.id.map((dim) => codesOf(ds, dim))
  const strides = ds.size.map((_, i) => ds.size.slice(i + 1).reduce((n, s) => n * s, 1))
  return ds.value.map((value, flat) => {
    const dims: Record<string, string> = {}
    ds.id.forEach((dim, d) => {
      const size = ds.size[d]
      if (size === undefined) {
        throw new Error(`size missing for dimension index ${d} (dimension name: ${dim})`)
      }
      const stride = strides[d]
      if (stride === undefined) {
        throw new Error(`stride missing for dimension index ${d} (dimension name: ${dim})`)
      }
      const pos = Math.floor(flat / stride) % size
      const code = codes[d]?.[pos]
      if (code === undefined) {
        throw new Error(
          `position ${pos} out of range for dimension ${dim} (has ${codes[d]?.length ?? 0} codes)`,
        )
      }
      dims[dim] = code
    })
    return { dims, value }
  })
}
