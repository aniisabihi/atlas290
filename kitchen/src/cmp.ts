/**
 * Plain, structural ordering — never `String.prototype.localeCompare` — for anything whose
 * order ends up in a committed pantry file. Municipality codes and SCB table ids happen to be
 * ASCII digits/letters, so no locale's collation actually reorders them today; but a
 * determinism guarantee that holds only because of what the data happens to look like is
 * weaker than one that holds structurally regardless of the machine's locale. This is
 * hardening, not a fix for a live bug. Shared by publish.ts (manifest source ordering) and
 * bubbles.ts (node ordering feeding the force simulation) so the reasoning is written once.
 */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
